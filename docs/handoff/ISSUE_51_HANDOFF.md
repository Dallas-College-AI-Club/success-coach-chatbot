# Issue #51 Handoff — Backend Database Models (@Alexandercs19)

> **Mission:** implement the two-table schema as SQLAlchemy 2.0 models + Alembic
> against Neon. Python is the schema's source of truth; the TypeScript (Drizzle)
> mirror is a separate later issue.
>
> **Read first:** [`docs/DATABASE_ARCHITECTURE.md`](../DATABASE_ARCHITECTURE.md)
> (the design) and [`apps/data/db/schema.sql`](../../apps/data/db/schema.sql) (the exact target DDL —
> **that file wins any disagreement**).

---

## 1. The big picture — where #51 sits

The whole data pipeline ([`docs/DATA_PIPELINE.md`](../DATA_PIPELINE.md) — read it,
it's the map) flows into the table this issue builds:

```
 schedule CSVs ─┐
 syllabus HTML  ├─► raw archive ─► facts + chunks ─► embeddings ─► knowledge_entry  ◄── #51 builds this
 CV pages       │   (apps/data/raw/)  (validated JSON)  (768-dim)      + chat_session
 catalog pages ─┘                                                        │
                                                                the chatbot retrieves & answers
```

Two tables, **no foreign keys** — integrity is enforced by the ingest pipeline
against the repo contracts in `src/config/`:

- **`knowledge_entry`** — one row per retrievable unit (a section *with its
  syllabus facts embedded*, a catalog course, a degree plan, a CV, a prose chunk).
  Filter columns (`doc_type`, `course_code`, `year`, `semester`, …) are
  `GENERATED ALWAYS … STORED`, promoted from the `metadata` JSONB stamp.
  `embedding halfvec(768) NOT NULL`.
- **`chat_session`** — anonymous, PII-scrubbed chat analytics (client-generated
  uuid, pseudonymous `student_id`, CHECK-allowlisted `profile`, capped `history`).

The scrapers and the extraction/compose stages already exist
(`apps/data/pipeline/`) and are producing the rows this schema will hold — #51 is
the last piece between them and a live Neon database.

## 2. Where the branch stands (verified against `apps/data/db/schema.sql`)

The current `51-backend-database-models` branch already delivers the models — and
they were audited column-for-column against the target DDL:

| Delivered on the branch | Verified |
|---|---|
| `KnowledgeEntry`: BigInteger identity PK; `source_url`/`chunk_index`/`content_hash`(non-unique)/`scraped_at`; `chunk_text`; `facts` JSONB; `metadata_` mapped to column `"metadata"`; `embedding HALFVEC(768) NOT NULL` | ✅ matches |
| All 13 generated columns as `Computed(..., persisted=True)` — incl. the two-step `course_code` normalization, `term_ord` season CASE, `event_starts_at`, `chunk_tsv` | ✅ matches |
| Constraints & indexes by exact name: `uq_knowledge_entry_source_chunk`, `ck_ke_doc_type/semester/year`, `ix_ke_embedding` (hnsw, `halfvec_cosine_ops`, m=16, ef_construction=64), GIN tsv + `jsonb_path_ops`, composite btrees, partial `ix_ke_event_start` | ✅ matches |
| `ChatSession`: client-generated uuid PK (no server default), `student_id` with **no FK**, `profile` allowlist CHECK, `history` cap CHECK, computed `message_count`, partial `ix_cs_archive` | ✅ matches |
| `database.py`: reads `DATABASE_URL_UNPOOLED`, rewrites `postgresql://` → `postgresql+psycopg://` for the psycopg-3 driver, sync engine with `pool_pre_ping` | ✅ matches the driver contract (§6) |
| Alembic initialized (`alembic.ini`, `env.py` wired to `Base.metadata`) | ✅ scaffold in place |

Nothing above needs redoing. The file layout is flat (`dallasai/models.py`,
`dallasai/database.py`) — keep it; the repository module below should follow the
same flat convention (`dallasai/repository.py`).

## 3. What remains

### 3a. Branch base — do this first

PR #59 (`feature/36-database-architecture-design-initialization`) **merged into
`main` on 2026-07-14**, so `main` now contains `apps/data/db/schema.sql`,
`apps/data/db/seed_mock.sql`, and the `src/config/` contract files. Rebase the
`51-backend-database-models` branch onto current `main` so the seed test and the
contract-sync CI test have something to run against before you write the migration.
(Note: the `profile` allowlist is being widened from 3 to 10 keys in PR #70 — see
§4 — which is open at time of writing; rebase again once it merges.)

### 3b. The initial migration (the core deliverable)

`alembic/versions/` is currently empty. Ship **one** migration that produces
exactly the state of `apps/data/db/schema.sql`, in order:

1. `op.execute("CREATE EXTENSION IF NOT EXISTS vector")`
2. Create both tables. Autogenerate from the models, then **hand-verify against
   `apps/data/db/schema.sql`** — autogenerate renders `Computed` expressions and
   hnsw/gin index options imperfectly, and needs `import pgvector.sqlalchemy`
   in `env.py` (or a `render_item`) to render `HALFVEC`.
3. Set the database-level GUC for filtered vector search:
   ```python
   op.execute("""DO $$ BEGIN
       EXECUTE format('ALTER DATABASE %I SET hnsw.iterative_scan = ''relaxed_order''', current_database());
   END $$;""")
   ```

**Why one migration:** every later `ADD COLUMN … GENERATED … STORED` rewrites the
table and rebuilds all indexes (including HNSW), and Postgres cannot `ALTER` a
generation expression afterwards — get the expressions right once, here. Put the
canonical ingest upsert + reconcile SQL (architecture doc §5, query D) in the
migration's docstring so it ships with the schema.

**`env.py` hardening (small but real):** avoid importing the engine at module load
(`from dallasai.database import …` executes `create_engine` and breaks offline
`alembic upgrade --sql` when the env var is absent) — read `os.getenv` inside
`env.py` instead; and note `config.set_main_option("sqlalchemy.url", url)` breaks
if the password contains `%` (configparser interpolation) — escape or set the URL
on the context directly.

### 3c. The repository layer

`dallasai/repository.py` — the write path the ingest pipeline calls:

| #51 acceptance criterion | Implementation |
|---|---|
| KnowledgeBase repository: add/update/delete entries (`Document` = url + ordered chunks) | Wrap the canonical §5D **upsert + reconcile**: a `Document(source_url, chunks[])` in, one transaction out. `ON CONFLICT (source_url, chunk_index)` with `content_hash`-gated updates; `scraped_at` always bumped; same-transaction reconcile DELETE. The compose stage that will call this already exists: [`apps/data/pipeline/build_knowledge.py`](../../apps/data/pipeline/build_knowledge.py) (its SQLite demo sink mirrors the exact row shape). |
| UserRepository: export sessions to JSON for post-processing | The archive job's core (architecture doc §5F): `SELECT` sessions grouped by `student_id` → JSON export. |

### 3d. Tests

1. **Contract-sync CI test** — models ↔ `src/config/` stay true: the `semester`
   enum in the registry matches `ck_ke_semester`; every registry `doc_type` with a
   `facts_schema` has its schema file; registry `profile_keys` matches the
   `ck_cs_profile_allowlist` CHECK.
2. **Migration + seed pytest** — apply the migration to a fresh database, run
   `apps/data/db/seed_mock.sql`, assert its smoke queries return the expected shapes, and
   assert running the seed twice changes nothing.

### Definition of done

- [ ] `alembic upgrade head` succeeds on a fresh Neon branch **and** local Postgres 16+.
- [ ] `psql -f apps/data/db/seed_mock.sql` inserts all rows; every smoke query at the bottom of that file returns the expected shape; running it twice changes nothing.
- [ ] `SELECT` through a SQLAlchemy session works over `DATABASE_URL_UNPOOLED`; a plain `@neondatabase/serverless` query works over `DATABASE_URL` (both languages proven).
- [ ] `git grep` finds no credentials; `.env` is git-ignored.

---

## 4. Deviations from the issue text — for you and your reviewers

The issue wording predates the finalized architecture. Two deliberate deviations
are part of the decided design:

1. **No `Student` table.** The issue asks for a Student model + a ChatSession FK.
   The design stores the same two facts — `chat_session.student_id uuid` (indexed,
   deliberately **no FK**) and `chat_session.profile jsonb` — on the session row.
   Why: with no accounts, a Student row would hold nothing a session row doesn't;
   snapshotting the profile per session records the context each answer was
   generated under; one less table to migrate and mirror. "All sessions for a
   student" remains one indexed query.
2. **`profile` is narrower than "raw json"** — a CHECK constraint allowlists its
   keys (the 10 onboarding-derived durable keys finalized in PR #70 — campus,
   major, student_type, transfer_direction, intl_status, target_institution,
   modality_pref, dayparts_pref, interest_area, oneoff_purpose — mirroring
   onboarding) with closed option-list
   values. Deliberate privacy hardening: free-form JSONB profiles are where PII
   leaks in.

## 5. Repo contracts (already committed — keep them true, wire the CI test)

| File | Contents |
|---|---|
| [`src/config/metadata-registry.json`](../../src/config/metadata-registry.json) | canonical metadata keys and vocabularies (`doc_type`, `semester`, `campus`, `modality`, `credit_hours`, `session`, categories…), time-scoping rules, the `instructor_slug` derivation rule, set-semantic array list, telemetry vocabularies, the `profile` key allowlist |
| [`src/config/facts-schemas/`](../../src/config/facts-schemas/) | the versioned JSON Schemas (course, program_map, section, syllabus, cv, contact, event, academic_calendar, transfer_guide). Note: `facts-syllabus-v1` defines the syllabus object **embedded inside a section row's `facts.syllabus`** — syllabus rows themselves are prose chunks only (`facts_schema: null` in the registry); a section and its syllabus are one fact row, with sibling sections pointing via `facts.syllabus_ref` |
| [`src/config/telemetry-event.schema.json`](../../src/config/telemetry-event.schema.json) | the per-turn `chat_session.history` element schema |
| [`src/config/runtime.json`](../../src/config/runtime.json) | `ACTIVE_CATALOG_YEAR`, `ACTIVE_TERM`, display timezone |

## 6. Gotchas checklist

- [ ] `metadata` is reserved on declarative models → map as `metadata_ = mapped_column("metadata", JSONB)`. *(already done on the branch)*
- [ ] Generated columns use `Computed(..., persisted=True)`; application code never assigns them. *(already done)*
- [ ] `HALFVEC` from `pgvector.sqlalchemy`, dimension 768. *(already done)*
- [ ] `content_hash` gets **no** unique constraint (repeated boilerplate across pages is legitimate). *(already done)*
- [ ] `chat_session.id` has no server default — client-generated. *(already done)*
- [ ] **No foreign keys anywhere** — cross-row references go through `course_code`/`instructor_slug`/`catalog_year`; integrity is the pipeline's job.
- [ ] The embedding-provider decision (architecture doc §9) must be confirmed before this merges — it freezes `HALFVEC(768)`.
- [ ] Driver: `psycopg` v3 with a synchronous engine; keep the **plain** `postgresql://` string in `.env` (psql reads the same var) and rewrite the scheme in code. *(already done)*
- [ ] Connection strings only from env vars; README §Database explains obtaining them from Neon.

## 7. What #51 does NOT include

- The scrape/extract/compose pipeline — it already exists at
  [`apps/data/pipeline/`](../../apps/data/pipeline/) (see `DATA_PIPELINE.md`) and
  will call your repository layer; you don't build or change it.
- The TypeScript Drizzle mirror (separate issue — hand-written from these models; no drizzle-kit).
- LLM tool implementations (issues #37/#38 — they consume the query catalog).
