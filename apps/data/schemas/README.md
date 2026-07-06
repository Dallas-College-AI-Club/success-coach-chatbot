# Dallas College AI Chatbot — Database & Pipeline (schema v2)

The data layer for the degree-planning chatbot MVP: **raw → LLM extraction →
thin relational core + SQL views**, on vanilla PostgreSQL. Plain SQL files and


## Layout (this directory, `data/`, is the project root — run commands from here)

```
db/             schema.sql · views.sql · optional_pgvector.sql · seed_*.sql
                client.py · client.ts   ← the ONLY connection modules (ADR-008)
schemas/        syllabus_extraction.schema.json · degree_plan_extraction.schema.json · the design package   ·                img/ (ERD + diagram PNG/SVG/dot sources)
pipeline/       scrape_schedule.py · scrape_syllabi.py · scrape_catalog.py
                extract.py · load_extractions.py · models.py · rawdocs.py
prompts/        extract_v1.md            ← versioned; copy to v2, never edit
tests/          test_acceptance_queries.py (A–F) · gold/ (hand-checked set, later)
sample_syllabi/ real syllabi
```

## 1. Setup

**Prereqs:** Python ≥3.11, Node ≥20 (only for the TS client), `psql`, and a
PostgreSQL 15+ database — Neon or any vanilla Postgres (ADR-008).

**Neon:** create a project at console.neon.tech → open your project →
**Connect** → copy the connection string it shows.

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # Windows
# python -m venv .venv && .venv/bin/pip install -r requirements.txt     # macOS/Linux
npm ci                        # only if you'll use the TypeScript client

cp .env.example .env          # then paste your connection string as DATABASE_URL
```

**How settings flow:** everything reads the git-ignored `.env` (or real
environment variables). Python code gets connections from `db/client.py`
(`from db.client import get_connection`); TypeScript from `db/client.ts`
(`import { pool } from "./db/client"`). **No other file creates a
connection** — that one-file isolation is what keeps a future move off Neon a
config change. Instead of `DATABASE_URL` you may set the standard libpq
variables (`PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`); CI does exactly
that. Never put a connection string in code — CI greps for it and fails.

## 2. Create the database

```bash
psql -f db/schema.sql                 # 25 tables, modules 1/2/4/5/6
psql -f db/views.sql                  # the 8 search/comparison views
psql -f db/seed_field_visibility.sql  # privacy registry (emails private)
psql -f db/seed_directory.sql         # non-personal directory scaffolding
psql -f db/optional_pgvector.sql      # OPTIONAL module 3 — needs pgvector
```

(`psql` honors the same `.env` values via `PG*` variables, or pass
`"$DATABASE_URL"` as its argument.) The pgvector file is optional by design
(ADR-005): skip it on hosts without the extension; nothing else references it.
Its `vector(768)` dimension is pinned to `EMBED_MODEL=nomic-embed-text` —
switching to an OpenAI-style model means `vector(1536)` + re-embed.

**Mock data** (dev/test only — it truncates what it seeds, prints row counts):

```bash
psql -f db/seed_mock.sql
```

## 3. Run the pipeline: scrape → extract → load

```bash
# 1. SCRAPE — the only writers of raw_documents (append-only, hash-deduped)
.venv/Scripts/python -m pipeline.scrape_schedule "../raw data/dallas_classes_2022_Summer.csv"
.venv/Scripts/python -m pipeline.scrape_syllabi --urls-from-db          # or --file <pdf>
.venv/Scripts/python -m pipeline.scrape_catalog --catoid 5              # Acalog 2026-27

# 2. EXTRACT — LLM -> validated JSON (provider set by EXTRACTOR in .env)
.venv/Scripts/python -m pipeline.extract --all-pending

# 3. LOAD — project JSON into the core (idempotent; re-runs change nothing)
.venv/Scripts/python -m pipeline.load_extractions
```

Every extraction row records `extractor`, `extraction_method`,
`prompt_version`, `schema_version` — mixed-model data coexists and is
auditable (ADR-002).

## 4. Re-extract with a new model

The schema never changes when the model does:

1. Edit `.env`: `EXTRACTOR="ollama:qwen2.5-14b"` (any provider:model).
2. Re-run: `python -m pipeline.extract --raw-id <N>` (or `--all-pending`
   after demoting rows). New rows insert alongside old; `is_current` flips to
   the newest — nothing is deleted, so old vs. new output stays diffable
   against `tests/gold/`.
3. `python -m pipeline.load_extractions` re-projects the core.

Prompt or schema changes work the same way: copy `prompts/extract_v1.md` →
`extract_v2.md` / bump `schema_version` — never edit in place.

## 5. Rebuild everything from raw

The core is a projection; raw is sacred. To rebuild from scratch on a fresh
database:

```bash
psql -f db/schema.sql && psql -f db/views.sql
psql -f db/seed_field_visibility.sql && psql -f db/seed_directory.sql
# restore raw_documents from your backup (pg_restore), then:
.venv/Scripts/python -m pipeline.extract --all-pending    # or reuse existing extractions
.venv/Scripts/python -m pipeline.load_extractions
```

If `extractions` survived too, skip the extract step — the loader alone
rebuilds every core table.

## 6. Tests & CI

```bash
# point PG*/DATABASE_URL at a *_test database — the suite DROPS public and
# rebuilds it from the committed SQL files, then runs acceptance queries A–F
.venv/Scripts/python -m pytest tests/ -v
```

CI (GitHub Actions) runs on every push: applies schema/views/pgvector + seeds
on Postgres 17, live-checks both client adapters (`SELECT count(*) FROM
sections`), runs the acceptance suite, and fails if any connection-string
literal appears outside `.env.example`/`docs/`. A second (disabled-until-
secrets) workflow runs scrape→extract→load on a cron.

## Rules that keep this maintainable

See [CLAUDE.md](CLAUDE.md) — the short version: never edit `raw_documents` or
hand-edit core tables; nulls mean "the source didn't say"; instructor identity
comes from schedule rows; every fulfillment answer cites its catalog edition;
no ORMs/dbt; no emails or personal data in the repo, ever.
