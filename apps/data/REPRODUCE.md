# Reproduce the data pipeline

For someone running this for the first time. Follow it top to bottom. Each section says
what it produces and what it costs.

For *why* a stage exists, see [`EXTRACTION_MANUAL.md`](EXTRACTION_MANUAL.md). This file
is the how. Keep the two separate.

---

## What this pipeline does

The chatbot answers student questions only from verified Dallas College records. This
pipeline is what puts those records in the database.

It reads public Dallas College pages (course catalog, degree plans, class schedules,
instructor profiles), turns each page into a structured record, checks that record
against the original page, and loads it into one Postgres table.

One rule drives the whole design: **nothing loads that a student could be misled by.**
That is why there are so many verification steps.

### Words you will see

| Term | Meaning |
|---|---|
| **doc_type** | The kind of record: `course`, `program_map` (degree plan), `section` (one class offering), `cv` (instructor), `syllabus`. |
| **facts** | Structured JSON pulled from a page: prerequisites, requirement groups, grading weights. Schema-validated. |
| **envelope** | One JSON file per source document, holding its `facts` plus where it came from. If the file exists, that document is done. This is how every stage resumes. |
| **chunk_text** | The readable sentence stored with the facts. Semantic search matches against this. |
| **embedding** | 768 numbers representing `chunk_text`, used for semantic search. |
| **delivery** | A finished batch of rows ready to load, plus its audit trail. |
| **rows.json** | The delivery file. A JSON array shaped exactly like the database table. |
| **upsert** | Insert or update, keyed on `(source_url, chunk_index)`. This is why re-loading is always safe. |

### The shape

```
scrape → extract → verify → assemble → embed → load
 (web)    (LLM)    (free)    (free)     (API)   (free)
```

Only **extract** and **embed** cost money. Everything else is deterministic and free to
re-run. Most of the time you can skip extract entirely — see §1.

---

## 0. Setup

### Where things live

| What | Where | In git? |
|---|---|---|
| Pipeline code | `apps/data/dallasai/` | yes |
| Raw corpus (~2.8 GB) — **this is `RAW_ROOT`** | `D:\RaOn\OneDrive - RaOn\-\_project\raw` | no |
| Finished deliveries + audit trails | SharePoint → `.../etl/neon-delivery/` | no |
| Envelopes, main delivery (1,906) | `.../etl/neon-delivery/data/audit-trail/provenance-envelopes/` | no |
| Envelopes, 19 supplemental programs | `.../etl/neon-delivery/additional/provenance-envelopes/program_map/` | no |
| Your working output | `apps/data/out/` | no |
| Secrets | `apps/data/.env` | never |

> **Two raw corpora exist on the club machines and only one is complete.** The
> SharePoint `.../Project - Success Coach Chatbot/raw/` folder is a partial mirror,
> missing `cv_profiles/` (the CV live-profile backfill) and two manifests. Point
> `RAW_ROOT` at the `_project\raw` path above. Quote every path — they contain spaces,
> and the SharePoint tree contains an emoji that breaks inline `python -c`.

### The code

Everything is under `apps/data/dallasai/`. Run modules as `python -m dallasai.<module>`
**from `apps/data/`**. Running a file by path fails with `ModuleNotFoundError`.

| Stage | Module | Does |
|---|---|---|
| scrape | `pipeline/catalog_fetch.py` | Catalog courses and degree plans. Uses Playwright; the site blocks plain HTTP. |
| scrape | `pipeline/archive_syllabi_cv.py` | Syllabi and instructor CVs, driven by a schedule CSV. |
| scrape | `pipeline/scrape_schedule.py` | The class-schedule CSV every other stage keys on. Produced 100% of the existing section corpus. **Read §2 before running it** — the site refuses automation and the run needs repeated stop-wait-resume cycles. |
| clean | `markdown_converter.py` → `clean_html_and_markdown()` | One pass: strips boilerplate and returns both clean HTML and Markdown with frontmatter. Calls `pipeline/html_cleaner.py` internally and auto-detects catalog vs Concourse layout. Cleaning happens first, on the DOM, because container detection and table structure are lost once the page is flattened to text. |
| clean | `pipeline/preprocess_html.py` | Batch wrapper over the above. |
| chunk | `semantic_chunker.py` | Split Markdown on headers. |
| extract | `pipeline/extract.py` | The extraction engine: prompts, retries, quarantine, provider choice. |
| extract | `pipeline/extract_batch.py` | Runs the engine across a corpus. Resumable. |
| verify | `pipeline/verify_catalog.py`, `verify_cv.py` | Deterministic checks. No model involved. |
| verify | `pipeline/golden_gate.py` | Regression gate against hand-verified fixtures. |
| compose | `pipeline/compute_cv.py`, `compose_cv.py` | Python arithmetic, then builds `chunk_text`. |
| assemble | `pipeline/assemble_delivery.py` | **Writes `rows.json`** (course + program_map + section). |
| assemble | `pipeline/assemble_cv_delivery.py` | Writes `rows-cv.json`. |
| assemble | `pipeline/build_knowledge.py` | Shared row builder and `content_hash`. |
| assemble | `pipeline/build_section_meetings.py` | Meeting days and times, as a facts-only update. |
| embed | `pipeline/carry_embeddings.py` | Reuses vectors from a previous delivery. Run before `embed_rows`. |
| embed | `pipeline/embed_rows.py` | **The only embedder.** Pinned model and dimensions; aborts on a bad vector. |
| load | `load_catalog_to_neon.py` | Validates and upserts into Neon. |
| support | `database.py` | Engine and session. Resolves `.env` correctly; reuse it. |

Schemas live in `src/config/facts-schemas/`, the doc_type contract in
`src/config/metadata-registry.json`, prompts in `apps/data/reference/prompts/`.

> **Do not use `main.py` or `pipeline_runner.py`.** They are a superseded second ingest
> path. See §8.

### Install

```powershell
cd apps/data
pip install -e .
playwright install chromium     # catalog scraping only
```

### `apps/data/.env`

```
# Comments MUST be on their own line. The loader below does not strip a
# trailing "# ..." — an inline comment becomes part of the value.

EXTRACTOR=anthropic:claude-sonnet-5
# Claude path only
ANTHROPIC_API_KEY=sk-ant-...
# embeddings, needed on both paths
OPENROUTER_API_KEY=sk-or-...
RAW_ROOT=D:\RaOn\OneDrive - RaOn\-\_project\raw
# used only by run_catalog.ps1 as its --out root; the python CLIs take --out
FACTS_OUT=out\facts
# direct connection string; the host must have NO -pooler
DATABASE_URL_UNPOOLED=postgresql://...
```

`FACTS_OUT` is not optional: `run_catalog.ps1` passes it as `--out`, and
`extract_batch` declares `--out` required — unset, the expensive stage of §3 dies at
argparse before a single document is read.

Keys are per person. Never commit or share them. Load `.env` into your shell:

```powershell
Get-Content .\.env | Where-Object { $_ -match "^\s*[^#].*=" } | ForEach-Object {
    $k, $v = $_ -split "=", 2
    $v = ($v -split '\s+#')[0].Trim().Trim('"').Trim("'")
    if ($v) { Set-Item -Path "env:$($k.Trim())" -Value $v }
}
```

This loader is the **only** source of `ANTHROPIC_API_KEY` and `OPENROUTER_API_KEY` —
`extract.py` and `embed_rows.py` read `os.environ` directly and never call
`load_dotenv`. `run_catalog.ps1` embeds the same loader, so fix it in both places or
keep every comment on its own line.

### Claude path or $0 path

| | Claude | $0 |
|---|---|---|
| `EXTRACTOR=` | `anthropic:claude-sonnet-5` | `lmstudio:<model>` or `ollama:<model>` |
| Cost | paid per document | free |
| Needs | `ANTHROPIC_API_KEY` | LM Studio or Ollama running locally |
| Quality | what the shipped corpus used | varies, so pilot and verify matter more |

Same engine, prompts, schemas and verifiers on both. Set `temperature = 0`. On local
models the code sets `num_ctx`; without it the prompt truncates silently and you get
wrong JSON that looks right.

**On the Claude path, know which doc_types are cached.** `CACHED_PROMPT_DOC_TYPES` in
`extract.py` is `{"cv"}` — and only `cv` runs a template laid out for it. Everything
above `## Identity context` is sent as a constant prefix with `cache_control`; in v4
(cv) that heading sits near the end, so nearly the whole template is cached. In v3
(course, program_map, syllabus) it sits near the top, so almost nothing is — the code
comment says so deliberately, because v3's layout is the one the golden gate validated.

Two consequences:

- **If you edit v4, keep per-document content below `## Identity context`.** Moving
  anything above it breaks caching silently — no error, no warning, input cost jumps
  roughly tenfold.
- **Restructure v3 before running syllabi.** The uncached template is re-billed on every
  document, it is largest for `syllabus`, and `syllabus` is by far the biggest corpus —
  so this is where an uncached template costs the most. Making v3 prefix-first the way
  v4 is cuts the input side of that round by roughly 90%. It costs a gate re-run and a
  pilot, and it is the highest-leverage change available before a bulk run. Prompts are
  versioned per doc_type and never edited in place, so this means a new `extract_v5.md`.

**Caching only discounts input.** Output is billed in full every time, it is several
times the input rate, and for rich schemas it is the larger half of the bill. The only
levers on output are extracting fewer documents and asking the schema for less. Budget a
round by counting both.

**Embeddings stay on the paid path, on both routes.** Ingest and query both use
`openai/text-embedding-3-small` at 768 dimensions through OpenRouter, pinned to OpenAI.
Embedding is a negligible share of what this pipeline spends — extraction dominates, by
orders of magnitude — so there is nothing to save here and a great deal to break.

What breaks: two embedding models share no common basis, so a corpus holding vectors
from two models returns the wrong rows and **nothing anywhere errors**. Postgres computes
the distance happily; the affected rows sort to the back and get cut by the relevance
floor, and the bot reports it has no record of data that was just loaded.

Only a *dimension* mismatch is loud, because `halfvec(768)` rejects the wrong width. A
same-width different model is silent. The cheapest guard is one query — it must always
return exactly one row:

```sql
SELECT metadata->>'embedding_model', count(*) FROM knowledge_entry GROUP BY 1;
```

### Check the install

```powershell
python -m pytest tests/test_extract.py tests/test_compute_cv.py -q
```

---

## 1. What are you producing?

| doc_type | Source | LLM? | Status |
|---|---|---|---|
| `section` | schedule CSV (scraped — see §2) | no | 16,181 loaded (Spring + Summer 2026) |
| `course` + `program_map` | Acalog catalog | yes | 1,588 + 318 loaded; 19 more staged |
| `cv` | Concourse instructor pages | yes | 2,709 loaded |
| `syllabus` | Concourse syllabi | yes | **next round — not run yet** |

**Read this before running anything.** The expensive stage is usually skippable. The
**1,906** envelopes of the main catalog delivery (1,588 course + 318 program_map) are
on SharePoint under `data/audit-trail/provenance-envelopes/`. Point
`assemble_delivery --facts` at that folder and re-assembling costs zero model calls.
Only re-extract if the source pages changed or you are fixing an extraction defect.

> The 19 supplemental programs are a **separate** delivery, under
> `additional/provenance-envelopes/program_map/`. **Do not merge them into the main
> `--facts` folder.** `CATALOG_EXPECTED_COUNTS` demands exactly 318 program_map rows,
> so a 337-program `rows.json` is rejected outright. Assemble and load them separately
> with `--supplemental-programs --expect 19`. Pointing `--facts` at the main folder
> alone silently reproduces the original 19-program gap, with no error.

---

## 2. `section` — class schedule (free)

Built from the term's schedule CSV at
`$env:RAW_ROOT\schedule\dallas_classes_<YYYY>_<Term>.csv`. **A new term starts by
obtaining that CSV.** Nothing downstream can see a term without it.

There is no separate command for section rows. The catalog assemble step (§3, step 5)
reads the schedule CSVs and builds them.

### Where the CSV comes from

Earlier versions of this document and `EXTRACTION_MANUAL.md` called these "eConnect
exports." **That is wrong, and it mattered** — it turned a job we can do into a
dependency on a system that never offered it, and the Fall refresh sat unstarted for two
months as a result.

What actually happened, measured from the files: all 11 CSVs were **scraped from the
public schedule website** `https://schedule.dallascollege.edu` in a single run on
2026-06-18/19, roughly seven hours, one HTTP request per subject prefix. Every field is a
rendered display string, not a database record — `start_date` reads `Aug 21, 2023`,
`corequisites` is the literal word `none`, and `class_features` is an anchor label and
href reassembled. In every file, `date_accessed` values map one-to-one with
`class_prefix` values: one fetch per subject, stamped at fetch time.

The name came from a browser bookmark. The page title of that public site is
*"eConnect - Credit Class Schedule"*, and it was recorded as if it were a system of
record.

**There is no bulk export, no downloadable file, and no public API.** Dallas College's
own documentation describes eConnect as student self-service; the only export-shaped
feature is printing your own tentative schedule.

**The tool that produced these CSVs is not in this repository.** It is not in git history
on any branch, not in any worktree, not in the SharePoint corpus, and nothing was
deleted — there is no commit to point at. Note also that no `archive_schedule_*` manifest
exists, though every in-repo acquisition stage writes one. Whoever ran it in June ran it
from somewhere else. **Ask them first — that is far cheaper than rebuilding it.**

### Obtaining a new term's CSV

> **Steps 1–2 are UNVERIFIED.** We have no working acquisition tool and none was built or
> tested. Step 3 is verified and will tell you in seconds whether whatever you obtained is
> usable. Do not write "run the exporter" into any runbook until a file passes step 3.

**1. Acquire the rows.** The producer is `pipeline/scrape_schedule.py` (committed here as
the tool that made 100% of the existing section corpus). It targets
`schedule.dallascollege.edu`, iterates every course prefix, and emits exactly the 16
columns below. It identifies itself honestly with a contact address, checks `robots.txt`,
and builds explicit year-coded paths like `/FALL2026/Prefix/ACCT` — the bare `/{Term}/`
alias was observed serving cached snapshots of the **wrong year**.

**Read this before running it. The site actively refuses automation.** Measured
2026-08-12:

| Client | `/FALL2026/Prefix/ACCT` |
|---|---|
| The scraper's self-identifying UA | HTTP **403**, 118 bytes |
| `python-requests/2.31.0` | HTTP **403** |
| Empty UA | HTTP **403** |
| Browser UA | HTTP **202**, 0 bytes, `x-amzn-waf-action: challenge` |
| `robots.txt` | HTTP **403** |

`robots.txt` returning 403 means **disallow**, not unknown: Python's `RobotFileParser`
sets `disallow_all = True` on 401/403, so the scraper's own gate returns `False` and it
**exits 2**. `--force` is therefore mandatory, and it is a deliberate override of a
refusal the site is asserting — not a configuration step. With `--force`, STEP 0 selects
the headless-browser path 100% of the time; there is no working `requests` path.

**It does not complete in one pass, and that is the real cost.** The crawl harvests some
subjects, then the WAF escalates and every prefix begins failing:

```
WAF challenge still pending after 15s; reloading once to nudge it...
ERROR  failed to fetch <PREFIX>: Playwright: WAF challenge did not clear
       (HTTP 405; interactive CAPTCHA / active rate-block?) -- continuing.
```

The operator must stop, wait 5–10 minutes, and re-run the identical command with
`--resume`. Measured: **80 of 164 prefixes / 7,907 rows** across several cycles — expect
roughly a dozen stop-wait-resume rounds for a full term, not one run. Anyone writing
"just run the scraper" into a runbook has not run it.

```powershell
cd "$env:RAW_ROOT\schedule"     # it writes to the CURRENT directory
python -m dallasai.pipeline.scrape_schedule --term Fall --year 2026 --force --resume --delay 2
```

`--output` defaults to `dallas_classes_{year}_{term}.csv` with **no directory component**,
so run it from `raw\schedule\` or the file lands wherever you happened to be. Always pass
`--term` and `--year` explicitly; never rely on the built-in default.

**Required completeness gate — row count is not evidence.** A failed subject is logged as
`ERROR ... -- continuing`, so a run can finish, look complete, and be missing whole
subjects. Check prefix coverage against the 164 the index reports:

```powershell
python -c "import csv,sys; p=sys.argv[1]; print(len({r['class_prefix'] for r in csv.DictReader(open(p,newline='',encoding='utf-8-sig'))}), 'prefixes — must be 164')" dallas_classes_2026_Fall.csv
```

Anything below 164 means keep resuming. This is the same failure shape as the `status:
202` gate in §7 — a stage that skips input and exits 0.

**The escalation that removes all of the above.** This crawling generates WAF load on the
college's own infrastructure, and the cost recurs every term. **Ask Dallas College IT for
a feed or a scheduled export** — it serves both sides, survives every future term, and
needs no override of an access control. Ask whoever ran the June 2026 harvest first, in
case a file already exists. Treat the scraper as the fallback, not the plan.

**DOM mapping**, recorded so it is not rediscovered. One `<tr class="jq_ResultRecord">`
per section; rows with a `<th>` and at least six `<td>` are real sections.

| Cell | Yields |
|---|---|
| `th` → first `<a>` text (`ABDR-1307-1`) | `class_prefix`, `class_number`, `section_number` |
| `th` → `<a href>` | `syllabus_url` |
| `th` → own text, minus anchor and nested divs | `class_name` |
| `td[0]` Class Meeting Information | `meeting_info` |
| `td[1]` Faculty Information (strip `/ Vita`) | `professor` |
| `td[2]` `Loc / Credits`, `^(.*?)\s*(\d+)$` | `location`, `credit_hours` |
| `td[3]` Start/End Dates, two `[A-Z][a-z]{2} \d{1,2}, \d{4}` | `start_date`, `end_date` |
| `td[4]` Class Features (links as `Label (url)`) | `class_features` |
| `td[5]` Links, excluding `Class Syllabus` | `other_links` |

The scraper matches columns by **header name**, not index — keep that if it is ever
rebuilt.

**2. Name and place it** exactly as `dallas_classes_<YYYY>_<Term>.csv` in
`$env:RAW_ROOT\schedule\`. The consumers glob `dallas_classes_*.csv`, so do not leave
stray CSVs in that folder.

**3. Validate before trusting it** — this uses only shipped code and costs nothing:

```powershell
python -c "from pathlib import Path; import os; from dallasai.pipeline.assemble_delivery import sections_from_csvs; r=sections_from_csvs(Path(os.environ['RAW_ROOT']),['2026FA']); print(len(r),'sections'); print(r[0]['chunk_text'] if r else 'ZERO — see below')"
```

`0 sections` means the file was not recognised and **no amount of further scraping will
help**. The usual cause is the recognition gate at `archive_syllabi_cv.py:101`:

```python
is_schedule = "syllabus_url" in cols and "class_prefix" in cols
```

Miss either **column header** and the file silently takes a different branch, produces
zero sections, and **exits 0**. That is the single most dangerous failure mode here.

### The column contract

Header, exactly, in this order:

```
class_prefix,class_number,section_number,professor,date_accessed,class_name,credit_hours,term_year,syllabus_url,start_date,end_date,meeting_info,location,class_features,other_links,corequisites
```

Twelve of the sixteen are actually read. `start_date`, `end_date`, `other_links` and
`corequisites` are consumed by nothing — supply them for header conformance.

Invariants beyond having the columns:

- `date_accessed` must match `^\d{4}-\d{2}-\d{2}` or `scraped_at` falls back to the
  database default.
- `credit_hours` must be a bare digit string — the test is `.isdigit()`, so **`3.0`
  silently becomes null**.
- `(course_code, section)` must be unique within the file; the join is last-wins.
- `meeting_info` must carry a modality token and a spelled-out type. The pre-2025FA
  abbreviated form (`T018 LEC F 07:00 AM - 08:50 AM`) parses at **0%**.
- `class_name` must be populated. An empty title is the "row that cannot be found"
  failure in §8 — the section retrieves for nothing.
- `syllabus_url` values feed the syllabus and CV work lists. Where they are empty,
  `source_url` falls back to a synthetic `section:<term>:<course>:<section>` key — and
  `source_url` is half the upsert key, so a delivery built without them and a later one
  built with them become **two rows per section instead of an upsert**. Decide the policy
  once, before the first load.

### Fall 2026 — current status

Fall 2026 acquisition is **in progress** — a partial CSV exists and the data is clean
(16 columns matching Spring 2026, zero blanks in `class_name`, `credit_hours`,
`location`, `syllabus_url`, `professor`, `meeting_info`; `syllabus_url` 100% Concourse).
It is not yet at full prefix coverage — see the gate above.

Fall 2026 **is published**: registration opened 2026-03-02 and classes begin
**2026-08-24** (8-week halves Aug 24 – Oct 15 and Oct 19 – Dec 10; measured once from a
live page, not independently re-verified). Note this refutes `academicCalendar-trey.ts`,
which says Aug 16 — that file holds generic US constants and disclaims being any
institution's calendar. Publication is not the blocker. The blockers are that no CSV exists, no
producing tool is in the repo, and the host refuses scripted access.

Work in progress on this, so it is not duplicated:

- A separate session is preparing the Fall path. It has **not** produced a CSV.
- It has fixed a real defect required before any Fall load: `_SESSION_RE`
  (`archive_syllabi_cv.py:165`) matched only Spring's two 8-week variants, so **3,068 of
  10,954 rows** in `dallas_classes_2025_Fall.csv` silently received an empty `session`.
  The generalised pattern covers all four seasons. The change is purely additive:
  3,068 rows gain a label, **0 rows have a label changed**, and 2026 Spring is
  unaffected. No live row is affected today, because only Spring and Summer 2026
  sections are loaded — this defect would have fired the first time Fall loaded.
- 2023 and 2024 Fall files contain no 8-week sessions at all, so this naming appeared in
  Fall 2025. Confirmed present in the real Fall 2026 data: **731 of 2,608 rows (28%)**
  in the partial carry `Fall First/Second 8 Week Session`.
- **`load_catalog_to_neon.py` supplemental mode was pinned to `program_map`**, so a
  section-only Fall delivery failed with "Unexpected dataset composition" before writing
  a row. Generalised to `--supplemental <doc_type> --expect N`, with
  `--supplemental-programs` kept as shorthand so the §6 commands are unchanged.

Both fixes are required before Fall loads and are independent of how the CSV is obtained.

Meeting days and times are an optional second pass. It reads the already-loaded section
rows back out of Neon and updates their `facts`:

```powershell
python -m dallasai.pipeline.build_section_meetings --schedule "$env:RAW_ROOT\schedule" --out out\sections-meetings.facts-only.json
python -m dallasai.load_catalog_to_neon out\sections-meetings.facts-only.json --facts-only --load --batch-size 500
```

> **Order matters.** Run this after sections are loaded. It queries Neon for
> `doc_type='section'`. Against an empty or half-loaded database it writes a short file
> and the loader skips the missing rows without erroring.

---

## 3. `course` + `program_map` — catalog

```powershell
# 1. scrape. Idempotent, existing files skip.
python -m dallasai.pipeline.catalog_fetch --catoid 5 --catalog-year 2026-2027 --out "$env:RAW_ROOT"

# 2. golden gate. Calls the live model. A red gate blocks bulk.
.\run_catalog.ps1 -Stage gate

# 3. pilot ~20 documents, verify, have a human review. Never skip.
.\run_catalog.ps1 -Stage pilot

# 4. bulk, ~1,900 documents. The expensive stage. Resumable.
.\run_catalog.ps1 -Stage bulk

# 5. assemble rows. Free. Point --facts at last run's envelopes to skip steps 1-4.
python -m dallasai.pipeline.assemble_delivery --raw-root "$env:RAW_ROOT" --facts out\facts --terms 2026SP 2026SU --out out\delivery --fail-on-acceptance

# 6. reuse unchanged vectors, then embed only what changed
python -m dallasai.pipeline.carry_embeddings out\delivery\rows.json <previous>.embedded.json out\delivery\rows.carried.json
python -m dallasai.pipeline.embed_rows --rows out\delivery\rows.carried.json --out out\delivery\rows.embedded.json
```

Find `catoid` for a new catalog year in the catalog site's URLs (2026-2027 = 5).

Poids **3388 (CORE-42)** and **3040** must always be fetched and hand-verified. Every
degree answer resolves against them.

**For scale:** the first round ran on 2026-07-25 through the Claude API and took about
5½ hours of wall clock for 1,906 documents — courses and degree plans extracting
concurrently, roughly 5 seconds per course and 25 seconds per degree plan. Over 97%
succeeded on the first attempt. Budget a similar window and run it detached.

---

## 4. `cv` — instructor profiles

```powershell
# 1. scrape. The term is chosen by which CSV you pass.
#    Fall 2026 has no CSV yet — see §2. Newest available is 2026_Summer.
python -m dallasai.pipeline.archive_syllabi_cv --kind cv --worklist "$env:RAW_ROOT\schedule\dallas_classes_2026_Summer.csv" --out "$env:RAW_ROOT"

# 2a. build the work list this step consumes (nothing else creates it)
New-Item -ItemType Directory -Force out | Out-Null
python -c "import json,glob,os;seen=set();[seen.add(json.loads(l)['raw_path']) "
  "for f in glob.glob(os.environ['RAW_ROOT']+r'\manifests\archive_*.jsonl') "
  "for l in open(f,encoding='utf-8') if l.strip() and json.loads(l).get('kind')=='cv' "
  "and json.loads(l).get('status')==200];open('out/worklist.txt','w')"
  ".write(chr(10).join(sorted(seen)))"

# 2b. extract. Pilot ~20 first, then the full work list.
python -m dallasai.pipeline.extract_batch --raw-root "$env:RAW_ROOT" --doc-type cv --paths-file out\worklist.txt --out out\facts-cv --quarantine-dir out\facts-cv-quarantine

# 3. verify. Free. Exits nonzero whenever a flag fires, which is expected.
python -m dallasai.pipeline.verify_cv --facts out/facts-cv/cv --as-of 2026 --raw-root "$env:RAW_ROOT"

# 4. compose. Fills computed numbers, teaching records, chunk_text.
python -m dallasai.pipeline.compose_cv --facts out/facts-cv/cv --out out/facts-cv-composed --raw-root "$env:RAW_ROOT" --as-of 2026

# 5. assemble, carry, embed
python -m dallasai.pipeline.assemble_cv_delivery --composed out/facts-cv-composed --out out/delivery-cv --fail-on-acceptance
python -m dallasai.pipeline.carry_embeddings out\delivery-cv\rows-cv.json <previous>.embedded.json out\delivery-cv\rows-cv.carried.json
python -m dallasai.pipeline.embed_rows --rows out\delivery-cv\rows-cv.carried.json --out out\delivery-cv\rows-cv.embedded.json

# 6. faculty index, optional. --out is a basename; writes .json and .md.
python -m dallasai.pipeline.expertise_index --rows out/delivery-cv/rows-cv.json --raw-root "$env:RAW_ROOT" --out out/delivery-cv/FACULTY_EXPERTISE_INDEX
```

`--as-of` must match between verify and compose, or every computed value flags.

**Each new term:** re-scrape schedules, then re-run compose with the new `--as-of`.
Durations advance, teaching records pick up the new term, and no re-extraction is needed.

> The CV live-profile backfill (162 of 2,709 rows) has **no committed tool**. Its method
> is recorded in the 2026-07-26 report's `purpose` and `notes` fields. Until
> `pipeline/backfill_cv_profiles.py` exists, a CV re-run reproduces about 94% of the
> shipped corpus.

---

## 5. `syllabus`

> **Owner: Nef — he has run this round. Nef, please replace the notes below with the
> commands and settings you actually used.** Everything under "Draft steps" is inferred
> from how the other doc_types run, not from the real round.

The ~32,000 scraped syllabi are on SharePoint under `raw/syllabi/`. Prompt v3 rules,
5 worked examples, 2 counterexamples and `facts-syllabus-v1` are all in the repo.

Syllabus content is designed to ride inside section rows as `facts.syllabus`, not as its
own `doc_type`. The merge logic exists in `build_knowledge.compose_sections` — it puts the
facts on a representative section row and points sibling sections at it with
`facts.syllabus_ref`. The catalog assemble path passes an empty map today
(`assemble_delivery.py:98`), so wiring that call site is what connects the two.

### Draft steps

```powershell
# 1. scrape — likely already done; ~32,000 pages are on disk
python -m dallasai.pipeline.archive_syllabi_cv --kind syllabus --worklist "$env:RAW_ROOT\schedule\dallas_classes_2026_Spring.csv" --out "$env:RAW_ROOT"

# 2. build a work list from the manifests (kind=syllabus, status=200), then PILOT ~20
python -m dallasai.pipeline.extract_batch --raw-root "$env:RAW_ROOT" --doc-type syllabus --paths-file out\syllabus-pilot.txt --out out\facts-syl --quarantine-dir out\facts-syl-quarantine

# 3. verify, then assemble + carry + embed + load as in §3 and §6
```

### Open items — Nef to confirm

- **Verifier.** The other doc_types each have one (`verify_catalog.py`, `verify_cv.py`).
  Note here what you used for syllabi.
- **Gate coverage.** `golden_gate.py:79` derives doc_type from the fixture folder prefix
  and understands only `course-` and `program_map`; a syllabus fixture needs a small
  change there.
- **Wiring the merge.** `assemble_delivery.py:98` passes an empty map to
  `compose_sections`.

---

## 6. Load to Neon

**Always run without `--load` first.** That validates and prints the row census without
touching the database. Read the census, confirm it is what you meant to load, then add
`--load`.

```powershell
# full catalog or CV delivery
python -m dallasai.load_catalog_to_neon <rows>.embedded.json
python -m dallasai.load_catalog_to_neon <rows>.embedded.json --load --batch-size 100

# supplemental program_map-only delivery
python -m dallasai.load_catalog_to_neon <rows>.embedded.json --supplemental-programs --expect 19 --load

# facts-only update to rows that already exist
python -m dallasai.load_catalog_to_neon <facts-only>.json --facts-only --load --batch-size 500
```

`--expect N` is required for supplemental loads. It catches a truncated or
double-written file and fails before any write.

The loader upserts on `(source_url, chunk_index)` and skips rows whose `content_hash` is
unchanged, so re-loading is safe. The file staged as `load-this/rows.json` is the
embedded output renamed; an un-embedded `rows.json` cannot pass validation.

---

## 7. Known blockers

| Blocker | Effect |
|---|---|
| `extract_batch` skips manifest entries where `status != 200`. 107 catalog pages recorded `202` despite complete HTML on disk. | Silent data loss: 19 programs (including Computer Science) **and 88 courses**. Only the 19 programs were ever recovered — the 88 courses are still missing from the database. |
| `backfill_cv_profiles.py` does not exist. | A CV re-run reproduces about 94% of the shipped corpus. |
| The Fall 2026 schedule CSV does not exist, and the tool that produced the other 11 is not in this repo (§2). | No Fall sections can be built. This is the gap behind "what should I take this fall?" — and Fall begins 2026-08-24. |
| `src/config/runtime.json` pins `ACTIVE_CATALOG_YEAR: "2025-2026"`; the loaded data is `2026-2027`. | Nothing reads it yet. Wiring it up as-is returns zero rows. |

A fully re-scraped catalog must still match `CATALOG_EXPECTED_COUNTS` exactly, so a
catalog that gained one course cannot be loaded whole. Program-only deliveries are
already handled by `--supplemental-programs --expect N`.

---

## 8. Failures that have already happened

All of these produced plausible output. None raised an error.

### Scraping

- **A complete page recorded as a failed fetch.** The catalog answers the first request
  with a challenge stub under HTTP 202. The file on disk ends up complete, but the
  manifest keeps `status: 202`, and `extract_batch` skips anything that is not 200. That
  silently dropped 108 pages. Before extracting, count manifest entries by status and
  compare against files on disk.
- **The program index is not the program list.** `navoid=1227` misses the
  academic-transfer degrees. The section indexes add about 31 more, and two programs are
  reachable only from a curated page. 337 programs are published; a by-program crawl
  finds 306. Reconcile scraped count against published count.
- **A syllabus URL that is really a search page.** Archived terms link a search result.
  Resolution matches on section, then single candidate, then professor name.
- **Empty pages that are not empty.** About a third of empty-looking course-CV pages have
  real content on the instructor's live profile. They are held, not loaded. Publishing
  "no content" is a claim we cannot support.
- **About 23 course-CV links serve a different instructor's CV.** Treat page identity as
  untrusted.

### Extraction

- **A wrong-person profile extracted at `confidence: high`.** The worst failure so far,
  and the output looked perfect. Identity now comes from the manifest only, checked by
  surname, with both sides ASCII-folded because manifests contain mojibake (`OrtuÃ±o`)
  where the CV prints `Ortuño`.
- **Editing one prompt changed a different doc_type's output.** Adding CV rules to a
  shared prompt degraded catalog accuracy: flattened newlines, dropped prefixes,
  case-normalized names. Each doc_type now has its own prompt version, never edited in
  place. Change a prompt, re-run the gate, re-pilot.
- **Model arithmetic reaching students.** Durations were being calculated by the model.
  The extractor now emits `{{years_teaching}}`-style tokens and Python fills in the real
  values. No number a student sees is model arithmetic.
- **`null` used as a default instead of a finding.** Writing `null` for something the
  document states is as wrong as inventing a value. Read the whole document first.
- **The recurring grading-table mistakes**, all seen live: keeping the `TOTAL` row,
  promoting extra credit to a grading row, inventing `count: 16` from "16-week course",
  converting points to percentages, merging a two-part final, collapsing four `Lab` rows,
  applying the drop policy to printed counts, paraphrasing a policy that must be verbatim,
  and correcting source typos. Row structure follows what is printed.
- **Training on the test set.** A document used as a prompt example can never be a gate
  fixture again. Two were retired for this. Example-specific values are registered as
  sentinels so contamination is detectable.
- **Prompt caching breaking silently.** Anything per-document placed above
  `## Identity context` destroys the cacheable prefix. Input cost roughly 10×, no error.

### Assembly, embedding and load

- **Fabricated vectors.** `main.py:203` writes `[0.0] * 768` when no embedder is passed,
  and no caller passes one, while stamping `embedding_model: "local-768"`. Zero vectors
  in a cosine-indexed column can never be retrieved. The live database is clean (zero
  such rows), so this is a hazard in code, not damage in data. Do not run that path.
- **Fabricated facts.** The same file substituted `{"confidence": "high", ...}` when the
  extractor threw. That placeholder validates against `facts-syllabus-v1`, whose only
  required field is `confidence`. Schema validity is not evidence of truth.
- **A row that cannot be found.** Section rows assembled without a course title retrieved
  for nothing. Title, credit hours and location are joined back from the schedule CSV on
  `(course_code, section)`.
- **Query vectors from the wrong model.** A mis-keyed option once produced 1536-dimension
  query vectors against a 768-dimension corpus. Ingest pins the provider; the query side
  must use the same model and dimensions.
- **Loading into the wrong database.** Nothing in the load path names its target. Run
  without `--load` first, read the census, confirm host and region. On 2026-08-11 this
  left 19 rows in a database nobody meant to touch.
- **The ledger must balance.** loaded + held + excluded + superseded = every page
  scraped. If it does not balance, something was dropped silently.

### Not failures, though they look like it

- `verify_cv` exits nonzero whenever any flag fires, and a real corpus always has flags.
  The delivered CV corpus had about 150, all adjudicated. Only new flags matter.
- A run can crash on its final console output after every file is written. Check the
  output before deciding it failed.

---

## 9. Lessons learned

The failures below share one pattern: **plausible output that nothing checks.** None of
them threw an error; every one was found days or weeks later by a person noticing
something odd. Each row gives the instruction that would have prevented it.

| What happened | Instruct it this way next time |
|---|---|
| When the extractor failed, `main.py` substituted a hardcoded `{"confidence":"high","policies":{},"grading":[]}`. It was syllabus-shaped, so it passed schema validation, cleared the confidence gate, and was upserted as fact. Five code paths reached that fallback. *(Fixed.)* | An extraction failure must produce an absent result the gate rejects — never a placeholder, and never a `confidence` the model did not emit. Schema validity is not truth: pair it with an assertion that a real model call produced the payload. |
| The same module defaults the embedding to `[0.0] * 768` when no embedder is passed — and no call site passes one — then stamps `embedding_model="local-768"` as if the work happened. Cosine against a zero vector is undefined, so those rows are permanently unretrievable. **Still open**, and `README.md:37` still documents this module as the ingest command. | Make the embedder a required argument and hard-exit when it is missing. Never stamp provenance for work that was not performed. Route every writer through the loader that already asserts width and unit norm. |
| `extract_batch.py:167` skips any manifest entry whose recorded status is not 200, with no skip report. Nineteen catalog programs had complete 89–112 KB pages on disk but a stale `202` in the manifest, so they were never extracted, never quarantined, and silently absent for weeks. **Still open.** | Reconcile the manifest against files on disk before each batch. Any gate that declines input must report what it skipped and why. Processing 318 of 337 inputs must not exit 0 quietly. |
| `main.py` defaults `doc_type` to `"syllabus"` for unrecognized documents, and the `ck_ke_doc_type` constraint only asserts `IS NOT NULL` — the vocabulary lives solely in Python. One documented 1,001-document run stamped course documents as syllabi; the tool that queries `doc_type='course'` matched none of them. **Still open.** | Never default a controlled-vocabulary field; an unrecognized type must raise. Put the vocabulary in the database constraint, or name the constraint for what it actually asserts. |
| `load_catalog_to_neon.py` gates loads on a hardcoded snapshot under exact equality, so a correct re-scrape gaining one course is rejected before a row is written. The number is now also stale. **Still open** (a `--expect N` supplemental mode covers partial loads). | Derive expected counts from a manifest written by the run that produced the rows, not from the previous delivery. Validate per-row invariants and let idempotent re-runs fix partial loads. |
| `getCourseInfo` never selected `requisites_raw`, `source_url` or `catalog_year`, though extraction had populated all three. 289 of 1,588 courses reported "no prerequisites" while the row read "Required: College level ready in Reading and Writing," and no answer could carry a citation. *(Fixed.)* | Diff a tool's projected columns against the facts schema: a populated field no consumer reads is a silent answerability gap. An empty derived list must never render as an affirmative negative. |
| For a period no tool queried `program_map`, and only 1,588 of ~20,800 rows were reachable by any query path. Asked what a degree requires, the assistant invented course codes while 318 real requirement rows sat in the same table. *(Fixed.)* | Track reachability per `doc_type` as a first-class metric before broadening ingest. A corpus with no query path is an invitation to fabricate. Build one vertical slice end to end before adding sources. |
| Retrieval was designed against a short composer, not the one that ships rows. On live data a nearest-neighbour search for a certificate returned five instructor CVs and zero programs, because CV chunks carry ~10× the topical surface. With no distance floor, an off-corpus question confidently cited an unrelated internship. *(Fixed.)* | Calibrate retrieval against the composer that actually writes the rows, and run the design's own worked example against the live corpus before building on it. Mixed chunk lengths need `doc_type`-scoped retrieval and a measured floor from day one. |
| `archive_syllabi_cv.py:127` passed the CSV's `meeting_info` through a helper that greps one word and discards the rest — though the schema already had `meeting_info_raw` and a `meetings[]` array. The absence was later misread as "the source has no meeting times," a feature was de-scoped, and a tool shipped saying so, before all 16,181 rows were re-derived. *(Fixed.)* | When an ingest reduces a source field to a derived scalar, keep the raw field too. Distinguish "absent from the database" from "absent from the source" by checking the source bytes before concluding a feature is unbuildable. |
| The section-to-syllabus merge was deferred with an inline comment rather than a tracked issue, and `golden_gate.py:79` hardcodes two doc types so a syllabus fixture cannot be added to the gate. **Still open.** | A deferral belongs in a tracked issue with a failing gate case, not an inline comment. Every `doc_type` the schema promises needs a gate case. |
| Two multi-hour crawls ran without probing the source first: one against an archive that no longer retains that year (95% genuine 404s), and one whose planner matched zero of 25,648 rows because that year uses a different format — it reported `targets=0` and exited 0. Manifests also bucketed 404s and dropped connections together. **Still open:** 26 documented invocations across nine files have been broken since a package rename, which is the proximate reason a term refresh never ran. | Probe a source before a long run: sample for retention, check for challenge pages, check whether the index is server-rendered. Persist the real status per attempt so "failed" is never one bucket. A planner that filters out 100% of its input must fail loudly. Treat documented commands as testable artifacts. |
| **The tool that produced 100% of the section corpus lives outside this repository.** `scrape.py` is the only acquisition step not committed alongside `catalog_fetch.py` and `archive_syllabi_cv.py`. That is why the manual said "producing/obtaining" instead of giving a command, why the source was misdescribed as an eConnect export for months, and why a term refresh sat unstarted while the answer was a zip file away. | Commit every acquisition tool with the pipeline it feeds. If a script produced data we shipped, its absence from git is a defect regardless of how well it works — and the cost lands on whoever needs the next term, not on whoever wrote it. |
| A cost analysis counted input tokens and ignored output entirely, concluding that a stage was effectively free. Output bills at several times the input rate, and for a rich schema it is the larger half — so the conclusion was off by orders of magnitude and pointed optimization at the cheapest stage in the pipeline. It went unnoticed until the figure was compared against a real invoice. | Price a run as input **plus** output, and say which you measured. Sanity-check any cost conclusion against an actual bill before acting on it; a number that disagrees with an invoice is wrong no matter how clean the arithmetic. |
| Several planning passes reasoned about database state from code archaeology, producing a standing "assume the corpus is empty or poisoned" prior and a conclusion that a setting had never been deployed. Single live queries refuted both. One audit ran against a stale worktree and reported features as missing that had already merged. | Measure before reasoning. Run a provenance census — `doc_type` counts, embedding model, zero-vector check, `source_url` scheme — and record it with a timestamp and database identifier. Settings cannot be audited from source; require a live receipt. Assert branch and HEAD before any multi-file review. |

### Saving time and money

Ordered by how much they save.

1. **Skip extraction entirely when you can.** Every envelope from the last run is on
   SharePoint. Point `assemble_delivery --facts` at that folder and re-assembling costs
   zero model calls. Only re-extract when the source pages changed or you are fixing an
   extraction defect.
2. **Carry embeddings before embedding.** `carry_embeddings` reuses vectors for rows
   whose `content_hash` is unchanged, so a re-assembly usually needs no new embedding
   calls at all.
3. **Pilot ~20 documents, always.** Retry loops and output truncation are both visible
   at 20 documents and expensive at 2,000. One pilot caught five systematic defects
   before they reached 3,116 documents.
4. **Check caching before a big v3 round** (see §0). The uncached part of the template
   is re-billed on every single document, and only `cv` currently runs a template laid
   out for caching.
5. **Count output, not just input.** Output bills at several times the input rate and
   caching does not touch it. For a rich schema it is the larger half of the bill, so a
   round's cost is set as much by what the schema asks the model to emit as by how many
   documents you run.
6. **Use `--facts-only` when only facts change.** It updates existing rows without
   re-shipping a vector per row — one delivery went from ~160 MB to 12 MB this way.
7. **Refresh terms with compose, not extraction.** Re-running `compose_cv` with a new
   `--as-of` advances durations and teaching records with zero re-extraction.
8. **Let resumability work.** An existing envelope skips, so a killed run costs nothing
   to restart. Run bulk detached in shards rather than tied to a terminal.
9. **Keep the test suite hermetic.** It once fired live paid extraction calls on every
   run; an autouse fixture that clears `EXTRACTOR` prevents that.

### A prompt worth pasting when starting work here

> Read the installed library docs before writing code against them. Do not create a
> parallel implementation of something that exists — extend it. Any filter that drops
> input must log what it dropped. Do not catch exceptions broadly around I/O; fail loudly.
> Do not build a module before its call site. Commit any script whose output we ship.
> Prefer the smallest change, and prefer deleting code to adding it.

---

## 10. What "done" means

Verifier at zero unadjudicated flags. Every flag adjudicated with quoted evidence.
Quarantine reviewed completely. The ledger balances. Acceptance probes green. Embeddings
checked for dimension and norm. An audit report with a per-doc_type go/no-go shipped with
the data.

If any of these is missing, it is not done.
