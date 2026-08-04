# CV extraction runner — loads .env, runs one resumable extract_batch pass.
#   .\run_cv_extract.ps1 -PathsFile out\worklist.txt          # foreground
#   .\run_cv_extract.ps1 -PathsFile out\bulk-shard-3.txt -Retry   # keep relaunching until clean exit
# For a large corpus, split the work list into out\bulk-shard-1..N.txt and start
# each DETACHED (survives closed terminals):
#   1..8 | ForEach-Object { Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$pwd\run_cv_extract.ps1`" -PathsFile out\bulk-shard-$_.txt -Retry" -WorkingDirectory "$pwd" -WindowStyle Hidden }
param(
    [Parameter(Mandatory=$true)][string]$PathsFile,
    [switch]$Retry
)

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
Get-Content "$here\.env" | Where-Object { $_ -match "^\s*[^#].*=" } | ForEach-Object {
    $k, $v = $_ -split "=", 2
    if ($v.Trim()) { Set-Item -Path "env:$($k.Trim())" -Value $v.Trim() }
}
if (-not $env:ANTHROPIC_API_KEY) { Write-Error "ANTHROPIC_API_KEY is empty in apps\data\.env"; exit 1 }
$env:PYTHONIOENCODING = "utf-8"
$log = [IO.Path]::ChangeExtension($PathsFile, ".log")
$max = if ($Retry) { 40 } else { 1 }
for ($i = 0; $i -lt $max; $i++) {
    python -m dallasai.pipeline.extract_batch --raw-root $env:RAW_ROOT --doc-type cv `
        --paths-file $PathsFile --out out\facts-cv --quarantine-dir out\facts-cv-quarantine 2>&1 |
        Out-File -Append -Encoding utf8 $log
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 60
}
