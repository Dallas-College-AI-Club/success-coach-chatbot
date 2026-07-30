# Extraction Manual — how we turn raw scrapes into load-ready facts

_Written after the 2026-07-25 catalog run (1,906 documents → 18,087 rows, zero
verification failures). Read top-to-bottom the first time; afterwards it's a
runbook for any extraction round — syllabi, CVs, or a new catalog year._

## 0. What exists and where

| Thing                                                              | Where                                                                                         |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Raw corpus (~2.8 GB: syllabi, CVs, catalog, schedules, manifests)  | OneDrive/SharePoint share — NOT in git. Set its local path as `RAW_ROOT` in `apps/data/.env`. |
| The extraction engine + all tooling                                | `apps/data/pipeline/` (this repo)                                                             |
| Prompts + worked exemplars + counterexamples                       | `apps/data/prompts/` — `extract_v3.md` is ACTIVE (`PROMPT_VERSION` in `pipeline/extract.py`)  |
| Golden-gate fixtures                                               | `apps/data/gate/` (context + hand-verified expected per case)                                 |
| Finished deliveries (data + audit + conflicts reports)             | SharePoint `working files - 20260724/neon-delivery/` — never in git                           |
| Analysis materials (examples, fixtures, stress tests, advisor set) | SharePoint `working files - 20260724/`                                                        |

Secrets: `apps/data/.env` (gitignored) holds `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY`,
`EXTRACTOR`, `RAW_ROOT`, `FACTS_OUT`. Keys are personal — never shared, never committed.

## 1. The pipeline in one line

manifests → `extract_batch` (LLM, schema-validated, quarantining) → `verify_catalog`
(mechanical, zero-LLM) → adjudicate any flags → `assemble_delivery` (compose rows +
acceptance) → `embed_rows` (vectors, contract-enforced) → package + audit report.

## 2. Step-by-step for a new run

```powershell
cd apps\data          # .env filled in; deps: pip install --user jsonschema beautifulsoup4 lxml pypdf anthropic requests
.\run_catalog.ps1 -Stage gate     # 1. golden gate MUST be green before anything else
.\run_catalog.ps1 -Stage pilot    # 2. ~20 docs, then read the verifier output yourself
.\run_catalog.ps1 -Stage bulk     # 3. resumable; safe to kill/rerun; split across machines
.\run_catalog.ps1 -Stage verify   # 4. repeat after any fix until "0 FAIL"
python -m pipeline.assemble_delivery --raw-root $env:RAW_ROOT --facts out\facts --out out\delivery --fail-on-acceptance
python -m pipeline.embed_rows --rows out\delivery\rows.json
```

Iron rules learned the hard way:

- **A red gate blocks bulk.** Sonnet failed the gate on prompt v1 too — few-shot
  exemplars are a _correctness_ requirement, not an optimization.
- **Never edit a prompt in place** — copy to `extract_vN+1.md`, bump `PROMPT_VERSION`,
  re-run the gate.
- **Promoting a gate fixture into the exemplars destroys it as a fixture**
  (train/test separation). Retire it and hand-verify a fresh one.
- **Hand-verified outputs are authoritative**: put their envelopes into the output
  dir BEFORE bulk (the runner skips existing files) so bulk can't overwrite them.
- **Fix error CLASSES, not instances**: a flag means either the prompt, the
  verifier, or the source is wrong — patch the right one and re-run everything
  (verification is cheap and deterministic).

## 3. The error catalog — don't rediscover these

**Source formatting the verifier already understands** (`verify_catalog.py`):
prefix-elided code lists ("SRGT 1541 and 1367"), parenthesized subjects
("(ESOL) 0044"), no-space codes ("ITSC1405"), superscript splits ("4<sup>th</sup>" →
"4 th"), long titles with internal parentheses, `&nbsp;` in title lines, non-credit
pages (no "(N Credit Hours)" suffix), ranged credits ("1-4 Credit Hours"), seam
punctuation from the HTML→text converter, curly-vs-straight typography.

**Model failure modes the v3 prompt + exemplars fix** (watch for regressions):
TSI/placement text parsed as a course prerequisite (it's `requisites_raw` only);
"X or equivalent" becoming a two-member `one_of`; `options_exhaustive: false`
inferred from any bounded list (only printed "other options" wording justifies it);
wildcard placeholder rows truncated ("MATH XXXX" instead of the full printed line);
option lists inside `rule` compressed to bare codes.

**College-side (source) errors — record, never "fix" in data:**
two confirmed typos (run-together words in 17060, missing leading letter in 17273 —
see the delivery's CONFLICTS_REPORT); dangling course references are usually
_fetch-scope artifacts_ (developmental/ESOL/continuing-ed codes outside the
program-referenced catalog set), not errors. Adjudicated anomalies live in
`gate/adjudicated_source_anomalies.json` so the verifier stays honest about them.

**Platform gotchas:** Claude 5 models REJECT the `temperature` parameter
(`_call_anthropic` falls back automatically); Ollama silently truncates prompts
without `num_ctx` (the code guards this); PowerShell 5.1 mangles multiline JSON
args (pass files, not strings); OneDrive locks folders mid-sync (retry deletes,
or archive instead).

## 4. Free/local models (the $0 path)

The recommended free setup is **LM Studio locally** — OpenRouter's free chat tier
proved too slow/rate-limited for bulk (tested: `openai/gpt-oss-20b:free`).

- `EXTRACTOR="lmstudio:qwen2.5-14b-instruct"` (or the club's current best local
  model), temperature 0, JSON mode — all already wired in `pipeline/extract.py`.
- **Prompt: `extract_v3.md` exactly as the engine builds it** — the EXAMPLES splice
  automatically injects every worked exemplar for the doc_type. Small models NEED
  the full exemplar set; do not trim it for context unless the model's window
  forces you to (then keep at least one points-based and one percent-based
  syllabus exemplar, and always the counterexample-free positive set).
- The `prompts/examples/*/counterexamples/` files are labeled WRONG outputs for
  contrastive prompting experiments — never splice them as positives.
- Gate first, exactly like the paid path: run `golden_gate.py` under the local
  model. Expect iterations; that is the gate doing its job. A local model that
  cannot pass the gate for a doc_type does not run bulk for that doc_type
  (issue #72's GO/NO-GO rule).

## 5. Doc_type-specific notes

**Syllabi:** engine + schemas ready; 7 worked exemplars + 2
counterexamples exist; 2024 terms are PDFs (`pdf_to_text`, expect ligature noise —
one exemplar covers it); identity ALWAYS from the manifest, never the document;
sections merge via `assemble_delivery`/`compose_sections` (representative section
carries `facts.syllabus`, siblings get `syllabus_ref`). Build the syllabus
equivalent of `verify_catalog.py` (checksum/total exclusion, weights-vs-points
units, count-never-derived are the key mechanical checks).

**CVs:** 5 exemplars + 1 counterexample exist; codes-as-printed,
no titles-as-codes, department never from job-history prose; emptiness ≠ low
confidence. Beware TWO professors named Bracewell — always key identity off the
manifest `professor` field.

**Catalog (a new catalog year):** bump `catalog_year`/`catoid`; the by-program index
(navoid 1227) MISSES the academic-transfer degrees — the section indexes
(Engineering 1262, Field-of-Study/Texas Direct 1263, Emphasis 1261, AAT 1224) add
~31 more; `catalog_fetch.py --poids-file` backfills them. Field-of-Study pages
print plan codes under non-standard labels (e.g. `AA.FS.MUSIC.14`). Poids **3388
(CORE-42) and 3040 (Core Options for A.A.S.) must always be extracted and
hand-verified** — every degree answer resolves against them. Regenerate
`program_index.json` and the onboarding picker (`generate-programs.mjs`).

## 6. Quality bar (what "done" means)

Verifier at 0 FAIL over the whole corpus · every flag adjudicated with quoted
evidence (verifier gap / extraction error / source anomaly) · hand-verification for
structural documents + a random sample · acceptance queries green against the
SQLite answer key · embeddings dims/norm-asserted and provenance-stamped · an
AUDIT_REPORT with per-doc_type GO/NO-GO shipped WITH the data. Quarantine is
reviewed 100% or empty — never silently dropped.
