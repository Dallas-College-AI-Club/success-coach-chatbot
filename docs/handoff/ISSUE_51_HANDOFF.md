# Issue #51 Implementation Guide — Backend Database Models

> **Audience**: whoever picks up [#51 Backend Database Models](https://github.com/Dallas-College-AI-Club/success-coach-chatbot/issues/51)
> **Read first**: [`docs/DATABASE_ARCHITECTURE.md`](../DATABASE_ARCHITECTURE.md) (the design), [`db/schema.sql`](../../db/schema.sql) (the exact target DDL)
> **Mission**: implement the two-table schema as SQLAlchemy 2.0 models + Alembic migrations against Neon. Python is the schema's source of truth; the TypeScript (Drizzle) mirror is a separate later issue.

---

## 1. Deviations from issue #51 as written — read this first

The issue text predates the finalized architecture. Two deliberate deviations are **part of the decided design — implement them as described here**; this section exists so the implementer and reviewers see exactly where the built system differs from the original issue wording and why:

1. **The `Student` model is merged into `ChatSession`.** #51 asks for *"a Student model … using the client-generated UUID as the primary key, with a JSONB field to store raw json information about students"* and *"a Chatsession model with … foreign key linking back to the Student UUID."* The architecture stores the same two facts — `chat_session.student_id uuid` (indexed, deliberately **no FK**) and `chat_session.profile jsonb` — on the session row instead. Why: with no accounts, a Student row would hold nothing a session row doesn't; snapshotting the profile per session records the context each answer was actually generated under (better for the knowledge-gap analysis #51 exists for); and one less table means one less thing to migrate, mirror, and explain. "All sessions for a student" remains one indexed query.
2. **`profile` is narrower than "raw json"** — a CHECK constraint allowlists its keys (mirroring the onboarding question set) and values come from closed option lists. This is a deliberate privacy hardening: a free-form JSONB profile is where PII leaks in.

The repository-layer acceptance criteria in #51 map as follows:

| #51 acceptance criterion | Where it lands |
|---|---|
| KnowledgeBase repository: add/update/delete entries (Document = url + ordered chunks) | Implement as a `dallasai/db/repository.py` module wrapping the canonical upsert + reconcile (architecture doc §5D) — a `Document(source_url, chunks[])` in, one transaction out |
| UserRepository: export all students + chat histories to JSON for post-processing | Implement as the archive job's core (architecture doc §5F): `SELECT` sessions grouped by `student_id` → JSON export |
| Vector indexes for retrieval | The HNSW/GIN/btree set in `db/schema.sql`, created by the initial migration |
| Alembic + env-var configuration | §4 below |

## 2. Deliverables

All Python work lives in `apps/data` (the `uv`-managed project).

1. `dallasai/db/database.py` — engine + session factory reading `DATABASE_URL_UNPOOLED` from the environment.
2. `dallasai/db/models.py` — `KnowledgeEntry` and `ChatSession` declarative models (skeletons below).
3. Alembic initialized and configured; **one** initial migration that produces exactly the state of `db/schema.sql`.
4. A CI test that the existing repo contract files in `src/config/` (§5) stay in sync with the models.
5. A pytest that applies the migration to a fresh database and runs `db/seed_mock.sql` + its smoke queries successfully.

Definition of done:

- [ ] `alembic upgrade head` succeeds on a fresh Neon branch **and** on local Postgres 16+.
- [ ] `psql -f db/seed_mock.sql` inserts all rows; every smoke query at the bottom of that file returns the expected shape.
- [ ] Running the seed twice changes nothing (idempotency).
- [ ] `SELECT` through a SQLAlchemy session works over `DATABASE_URL_UNPOOLED`; a plain `@neondatabase/serverless` query works over `DATABASE_URL` (connection contract proven from both languages).
- [ ] `git grep` finds no credentials; `.env` is git-ignored.

---

## 3. Model skeletons

```python
# dallasai/db/models.py
from datetime import datetime
from uuid import UUID

from pgvector.sqlalchemy import HALFVEC
from sqlalchemy import (BigInteger, CheckConstraint, Computed, Identity, Index, Integer,
                        SmallInteger, Text, UniqueConstraint, text)
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP, TSVECTOR
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class KnowledgeEntry(Base):
    __tablename__ = "knowledge_entry"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)

    # provenance / idempotent ingest
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    content_hash: Mapped[str] = mapped_column(Text, nullable=False)   # deliberately NOT unique
    scraped_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))

    # payload
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    facts: Mapped[dict | None] = mapped_column(JSONB)
    # NOTE: "metadata" is reserved on declarative classes — map the attribute as metadata_
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    embedding: Mapped[list[float]] = mapped_column(HALFVEC(768), nullable=False)

    # generated filter columns (Computed => never written by application code)
    doc_type: Mapped[str | None] = mapped_column(Text, Computed("metadata->>'doc_type'", persisted=True))
    module: Mapped[str | None] = mapped_column(Text, Computed("metadata->>'module'", persisted=True))
    course_code: Mapped[str | None] = mapped_column(
        Text, Computed("upper(trim(regexp_replace("
                       "regexp_replace(metadata->>'course_code', '([A-Za-z])([0-9])', '\\1 \\2'), "
                       "'[^A-Za-z0-9]+', ' ', 'g')))", persisted=True))
    program_code: Mapped[str | None] = mapped_column(Text, Computed("upper(metadata->>'program_code')", persisted=True))
    year: Mapped[int | None] = mapped_column(Integer, Computed("((metadata->>'year'))::integer", persisted=True))
    semester: Mapped[str | None] = mapped_column(Text, Computed("lower(metadata->>'semester')", persisted=True))
    term_ord: Mapped[int | None] = mapped_column(SmallInteger, Computed(
        "(((metadata->>'year'))::integer * 10 + CASE lower(metadata->>'semester') "
        "WHEN 'spring' THEN 1 WHEN 'may' THEN 2 WHEN 'summer' THEN 3 "
        "WHEN 'fall' THEN 4 WHEN 'winter' THEN 5 END)::smallint", persisted=True))
    catalog_year: Mapped[str | None] = mapped_column(Text, Computed("metadata->>'catalog_year'", persisted=True))
    event_starts_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), Computed("to_timestamp((metadata->>'event_start_epoch')::bigint)", persisted=True))
    professor: Mapped[str | None] = mapped_column(Text, Computed("metadata->>'professor'", persisted=True))
    instructor_slug: Mapped[str | None] = mapped_column(Text, Computed("metadata->>'instructor_slug'", persisted=True))
    chunk_tsv = mapped_column(TSVECTOR, Computed("to_tsvector('english', chunk_text)", persisted=True))

    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))

    __table_args__ = (
        UniqueConstraint("source_url", "chunk_index", name="uq_knowledge_entry_source_chunk"),
        CheckConstraint("metadata->>'doc_type' IS NOT NULL", name="ck_ke_doc_type"),
        CheckConstraint("metadata->>'semester' IS NULL OR lower(metadata->>'semester') IN "
                        "('fall','spring','summer','winter','may')", name="ck_ke_semester"),
        CheckConstraint("(metadata->>'year') IS NULL OR (metadata->>'year')::integer BETWEEN 2020 AND 2035",
                        name="ck_ke_year"),
        Index("ix_ke_embedding", "embedding", postgresql_using="hnsw",
              postgresql_ops={"embedding": "halfvec_cosine_ops"},
              postgresql_with={"m": 16, "ef_construction": 64}),
        Index("ix_ke_tsv", "chunk_tsv", postgresql_using="gin"),
        Index("ix_ke_metadata", "metadata", postgresql_using="gin",
              postgresql_ops={"metadata": "jsonb_path_ops"}),
        Index("ix_ke_course", "course_code", "doc_type", "catalog_year"),
        Index("ix_ke_program", "program_code", "doc_type", "catalog_year"),
        Index("ix_ke_doc_mod", "doc_type", "module"),
        Index("ix_ke_term", "year", "semester"),
        Index("ix_ke_instructor", "instructor_slug"),
        Index("ix_ke_event_start", "event_starts_at", postgresql_where=text("doc_type = 'event'")),
    )


class ChatSession(Base):
    __tablename__ = "chat_session"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)   # client-generated; no server default
    student_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True))       # pseudonymous; deliberately no FK
    profile: Mapped[dict | None] = mapped_column(JSONB)
    history: Mapped[list] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    message_count: Mapped[int] = mapped_column(Integer, Computed("jsonb_array_length(history)", persisted=True))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    archived_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))

    __table_args__ = (
        CheckConstraint("profile IS NULL OR profile - 'campus' - 'major' - 'student_type' = '{}'::jsonb",
                        name="ck_cs_profile_allowlist"),
        CheckConstraint("jsonb_array_length(history) <= 200", name="ck_cs_history_cap"),
        Index("ix_cs_student", "student_id"),
        Index("ix_cs_archive", "updated_at", postgresql_where=text("archived_at IS NULL")),
    )
```

(Skeleton, not gospel — verify each construct renders the exact DDL in `db/schema.sql`; that file wins any disagreement.)

---

## 4. Alembic specifics

- `alembic init` inside `apps/data`; in `env.py`, read `DATABASE_URL_UNPOOLED` from the environment (never hardcode; never use the pooled URL for migrations — transaction-mode pooling breaks DDL/session semantics).
- The initial migration must, in order:
  1. `op.execute("CREATE EXTENSION IF NOT EXISTS vector")`
  2. Create both tables (autogenerate from the models, then hand-verify against `db/schema.sql` — pay attention to generated-column expressions and index options, which autogenerate can render imperfectly).
  3. Set the database-level GUC for filtered vector search:
     ```python
     op.execute("""DO $$ BEGIN
         EXECUTE format('ALTER DATABASE %I SET hnsw.iterative_scan = ''relaxed_order''', current_database());
     END $$;""")
     ```
- **Ship the whole schema as ONE migration.** Every `ADD COLUMN … GENERATED … STORED` rewrites the table and rebuilds all indexes (including HNSW), and Postgres cannot `ALTER` a generation expression afterwards (only drop + re-add). Get the expressions right once, here.
- Put the canonical ingest upsert + reconcile statements (architecture doc §5, query D) in the migration's docstring so they ship with the schema.
- Import `pgvector.sqlalchemy` in `env.py` (or `render_item`) so autogenerate can render `HALFVEC`.

## 5. Repo contracts (starter files committed — finalize with the models)

**The contract files already exist** (delivered with issue #36) — your job is to keep them true as the models land and wire the CI sync test:

| File (committed) | Contents |
|---|---|
| [`src/config/metadata-registry.json`](../../src/config/metadata-registry.json) | canonical metadata keys and vocabularies (`doc_type`, `semester`, `campus`, `modality`, categories…), time-scoping rules, `instructor_slug` derivation rule, set-semantic array list, telemetry vocabularies, the `profile` key allowlist |
| [`src/config/facts-schemas/`](../../src/config/facts-schemas/) | one versioned JSON Schema per doc_type (9 files: course, program_map, section, syllabus, cv, contact, event, academic_calendar, transfer_guide) |
| [`src/config/telemetry-event.schema.json`](../../src/config/telemetry-event.schema.json) | the per-turn `chat_session.history` element schema |
| [`src/config/runtime.json`](../../src/config/runtime.json) | `ACTIVE_CATALOG_YEAR`, `ACTIVE_TERM` (year + semester), display timezone |

Add a CI test asserting the models, the registry, and the schemas agree (e.g., the `semester` enum in the registry matches the DB CHECK; every `doc_type` in the registry with a `facts_schema` has its schema file; the registry's `profile_keys` list matches the `ck_cs_profile_allowlist` CHECK).

## 6. Gotchas checklist

- [ ] `metadata` is reserved on SQLAlchemy declarative models → map as `metadata_ = mapped_column("metadata", JSONB)`.
- [ ] All generated columns use `Computed(..., persisted=True)`; application code must never assign them.
- [ ] `HALFVEC` comes from `pgvector.sqlalchemy` (the `pgvector` PyPI package), dimension 768.
- [ ] `content_hash` gets **no** unique constraint (repeated boilerplate across pages is legitimate).
- [ ] `chat_session.id` has no server default — it is client-generated.
- [ ] **No foreign keys anywhere** — cross-row references go through `course_code` / `instructor_slug` / `catalog_year`; integrity is the pipeline's job.
- [ ] The embedding provider decision (architecture doc §9) must be confirmed before this issue merges — it freezes `HALFVEC(768)`.
- [ ] Driver: pick one and pin it — recommended `psycopg` (v3, `postgresql+psycopg://` URL scheme) with a **synchronous** engine; `pgvector-python` supports it directly, and the ingest workload is batch, not concurrent. (The issue text mentions `psycopg2-binary`; it also works — just don't mix the two.) Keep the **plain** `postgresql://` string in `.env` — `psql` reads the same variable and can't parse the `+psycopg` scheme — and rewrite it in code instead: `url = url.replace("postgresql://", "postgresql+psycopg://", 1)` before `create_engine(...)`. Without this, SQLAlchemy defaults the plain scheme to psycopg2 and fails with `ModuleNotFoundError: psycopg2`.
- [ ] Connection strings only from env vars; see README §Database for how to obtain them from Neon.

## 7. What this issue does NOT include

- The ingest/scraper pipeline (separate issue — it implements query D and the registry validation).
- The TypeScript Drizzle mirror (separate issue — hand-written from these models; no drizzle-kit).
- LLM tool implementations (issues #37/#38 — they consume the query catalog).
