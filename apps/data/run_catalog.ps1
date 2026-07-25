# Catalog extraction runner — stages per CATALOG_TO_NEON_HANDOFF.md.
#   .\run_catalog.ps1 -Stage gate | pilot | bulk | verify
# Requires ANTHROPIC_API_KEY in apps\data\.env. A red gate BLOCKS later stages.
param([Parameter(Mandatory=$true)][ValidateSet("gate","pilot","bulk","verify")][string]$Stage)

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
Get-Content "$here\.env" | Where-Object { $_ -match "^\s*[^#].*=" } | ForEach-Object {
    $k, $v = $_ -split "=", 2
    if ($v.Trim()) { Set-Item -Path "env:$($k.Trim())" -Value $v.Trim() }
}
if (-not $env:ANTHROPIC_API_KEY) { Write-Error "ANTHROPIC_API_KEY is empty in apps\data\.env"; exit 1 }
$env:PYTHONIOENCODING = "utf-8"
$raw = $env:RAW_ROOT
$out = $env:FACTS_OUT

if ($Stage -eq "gate") {
    python -m pipeline.golden_gate --raw-root $raw
    if ($LASTEXITCODE -ne 0) { exit 1 }
}
if ($Stage -eq "pilot") {
    python -m pipeline.extract_batch --raw-root $raw --manifest-glob "archive_catalog_*.jsonl" --doc-type course --limit 20 --out "$here\out\pilot"
    python -m pipeline.verify_catalog --facts "$here\out\pilot" --raw-root $raw
}
if ($Stage -eq "bulk") {
    python -m pipeline.extract_batch --raw-root $raw --manifest-glob "archive_catalog_*.jsonl" --doc-type course --out $out
    python -m pipeline.extract_batch --raw-root $raw --manifest-glob "archive_catalog_*.jsonl" --doc-type program_map --out $out
    python -m pipeline.verify_catalog --facts $out --raw-root $raw
}
if ($Stage -eq "verify") {
    python -m pipeline.verify_catalog --facts $out --raw-root $raw
}
