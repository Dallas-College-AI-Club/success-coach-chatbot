-- ============================================================================
-- Success Coach Chatbot — Database Schema (Neon Postgres + pgvector)
--
-- Design reference : docs/DATABASE_ARCHITECTURE.md
-- Seed data        : apps/data/db/seed_mock.sql
--
-- This file is the documented target state of the database. Issue #51
-- converts it to SQLAlchemy 2.0 models + an Alembic migration (Python is the
-- schema source of truth; TypeScript mirrors it with Drizzle in a later
-- issue). Until then, this file can be applied directly to a fresh database:
--
--   psql "$DATABASE_URL_UNPOOLED" -f apps/data/db/schema.sql
--   psql "$DATABASE_URL_UNPOOLED" -f apps/data/db/seed_mock.sql
--
-- Two tables. No foreign keys. Data integrity is enforced by the ingest
-- pipeline against repo-committed contracts (see DATABASE_ARCHITECTURE.md §6).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;   -- pgvector (Neon ships 0.8+)

-- Filtered vector search: let HNSW scans keep iterating until enough rows
-- match the WHERE clause (pgvector 0.8+). Set once at database level because
-- the Next.js read path (neon-http) cannot carry per-session settings.
DO $$
BEGIN
    EXECUTE format('ALTER DATABASE %I SET hnsw.iterative_scan = ''relaxed_order''',
                   current_database());
END $$;


-- ============================================================================
-- Table 1 · knowledge_entry — everything the chatbot knows
--
-- One row per retrievable unit. Two kinds of rows share the table:
--   * prose chunks — markdown sections of scraped documents (syllabi, catalog
--     pages, CVs, articles), found by hybrid vector + keyword search
--   * fact rows    — machine-readable extractions (courses, degree plans,
--     sections, contacts), answered by indexed point-reads; their
--     human-readable rendering lives in chunk_text and is embedded too
--
-- The row kind and domain are discriminated by metadata->>'doc_type':
--   course | program_map | section | syllabus | catalog | cv | contact |
--   event | academic_calendar | transfer_guide | knowledge_article
--
-- Every filter the LLM tools use is a GENERATED column promoted from the
-- metadata JSONB stamp: the pipeline writes ONE jsonb object, and the filter
-- columns can never drift from it. Promoting a new key later is a one-line
-- ALTER TABLE, so tool-driven denormalization (issues #37/#38) never forces
-- a redesign.
-- ============================================================================
CREATE TABLE knowledge_entry (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- provenance / citation / idempotent ingest ------------------------------
    source_url    text        NOT NULL,
        -- Real URL of the scraped page (returned with every answer as the
        -- citation), or a pseudo-URI for rows without a public page:
        --   seed://…                        hand-seeded rows
        --   <url>#facts                     the fact row extracted from a page
        --   <url>#<catalog_year>            catalog rows, year-namespaced
        --                                   (§4 of the architecture doc)
        --   <url>#<catalog_year>#facts      catalog facts row (same year scoping)
        --   <url>#<row-fragment>            one row of a structured source,
        --                                   e.g. <schedule_csv>#BIOL-1406-72002
    chunk_index   integer     NOT NULL DEFAULT 0,   -- ordinal within its document
    content_hash  text        NOT NULL,
        -- sha256 over the canonical serialization of (chunk_text, facts,
        -- metadata) — sorted keys, sorted set-semantic arrays. Lets re-scrapes
        -- skip unchanged rows. Deliberately NON-unique: identical boilerplate
        -- legitimately recurs across pages. Never add a UNIQUE constraint here.
    scraped_at    timestamptz NOT NULL DEFAULT now(),
        -- Last time the pipeline saw/verified this row (ALWAYS bumped on
        -- upsert). Drives staleness disclaimers and stale-row cleanup.

    -- payload ------------------------------------------------------------------
    chunk_text    text         NOT NULL,
    facts         jsonb,
        -- Structured extraction, validated against the versioned JSON Schema
        -- for its doc_type (repo contract). NULL on prose chunks; non-NULL
        -- ONLY on a document's facts row — the '#facts' pseudo-URI row when a
        -- document also has prose chunks, or the document's single row itself
        -- when a source yields one row per entity (schedule-CSV sections,
        -- seed:// entries). Structured lookups add "AND facts IS NOT NULL"
        -- and get exactly one row per document.
    metadata      jsonb        NOT NULL DEFAULT '{}'::jsonb,
        -- The single ingest stamp. Keys are governed by the repo metadata-key
        -- registry; the pipeline validates every stamp before writing.
    embedding     halfvec(768) NOT NULL,
        -- 768-dim half-precision vector, cosine space. Dimension is frozen
        -- project-wide and must match the embedding model used by BOTH the
        -- Python pipeline (ingest) and the Next.js API route (queries).

    -- promoted filter surface (GENERATED from metadata ⇒ cannot drift) ---------
    doc_type      text GENERATED ALWAYS AS (metadata->>'doc_type') STORED,
    module        text GENERATED ALWAYS AS (metadata->>'module') STORED,
    course_code   text GENERATED ALWAYS AS
                    (upper(trim(regexp_replace(
                        regexp_replace(metadata->>'course_code', '([A-Za-z])([0-9])', '\1 \2'),
                        '[^A-Za-z0-9]+', ' ', 'g')))) STORED,
        -- normalized to 'ENGL 1302' no matter how the source wrote it
        -- ('engl-1302', 'ENGL1302', 'engl  1302' all yield 'ENGL 1302')
    program_code  text GENERATED ALWAYS AS (upper(metadata->>'program_code')) STORED,

    -- term scoping: year and semester are separate, validated columns so term
    -- filtering can never mis-identify a course offering
    year          integer  GENERATED ALWAYS AS (((metadata->>'year'))::integer) STORED,
    semester      text     GENERATED ALWAYS AS (lower(metadata->>'semester')) STORED,
    term_ord      smallint GENERATED ALWAYS AS ((((metadata->>'year'))::integer * 10 +
                    CASE lower(metadata->>'semester')
                         WHEN 'spring' THEN 1 WHEN 'may'    THEN 2
                         WHEN 'summer' THEN 3 WHEN 'fall'   THEN 4
                         WHEN 'winter' THEN 5 END)::smallint) STORED,
        -- chronological ordering & BETWEEN ranges ("most recent syllabus")

    -- catalog scoping: which catalog edition a row belongs to ('2025-2026')
    catalog_year  text GENERATED ALWAYS AS (metadata->>'catalog_year') STORED,

    -- event scoping: typed start time so "this weekend at RLC" is an indexed
    -- range scan (stamped as UTC epoch seconds; NULL on non-event rows)
    event_starts_at timestamptz GENERATED ALWAYS AS
                    (to_timestamp((metadata->>'event_start_epoch')::bigint)) STORED,

    -- people: professor is display-only; instructor_slug is the stable join key
    professor       text GENERATED ALWAYS AS (metadata->>'professor') STORED,
    instructor_slug text GENERATED ALWAYS AS (metadata->>'instructor_slug') STORED,

    -- keyword leg of hybrid search
    chunk_tsv     tsvector GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED,

    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
        -- last time CONTENT changed (the ingest upsert bumps it only when
        -- content_hash changes; scraped_at bumps on every verification)

    CONSTRAINT uq_knowledge_entry_source_chunk UNIQUE (source_url, chunk_index),

    -- write-time validation backstops (primary validation is in the pipeline)
    CONSTRAINT ck_ke_doc_type CHECK (metadata->>'doc_type' IS NOT NULL),
    CONSTRAINT ck_ke_semester CHECK (metadata->>'semester' IS NULL OR
        lower(metadata->>'semester') IN ('fall','spring','summer','winter','may')),
    CONSTRAINT ck_ke_year CHECK ((metadata->>'year') IS NULL OR
        (metadata->>'year')::integer BETWEEN 2020 AND 2035)
);

COMMENT ON TABLE knowledge_entry IS
    'Everything the chatbot knows: prose RAG chunks and structured fact rows, discriminated by doc_type. One row per retrievable unit.';
COMMENT ON COLUMN knowledge_entry.source_url IS
    'Citation URL (or pseudo-URI) returned with every answer; part of the upsert identity.';
COMMENT ON COLUMN knowledge_entry.facts IS
    'Machine-readable extraction (JSON Schema per doc_type); NULL on prose chunks; non-NULL only on #facts rows.';
COMMENT ON COLUMN knowledge_entry.metadata IS
    'Single ingest stamp; source of truth for every generated filter column. Keys governed by the repo registry.';
COMMENT ON COLUMN knowledge_entry.embedding IS
    'halfvec(768), cosine space. Same embedding model at ingest and query time.';
COMMENT ON COLUMN knowledge_entry.professor IS
    'Display name only — never used as a join key; join on instructor_slug.';

-- indexes ---------------------------------------------------------------------
CREATE INDEX ix_ke_embedding ON knowledge_entry
    USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX ix_ke_tsv        ON knowledge_entry USING gin (chunk_tsv);
CREATE INDEX ix_ke_metadata   ON knowledge_entry USING gin (metadata jsonb_path_ops);
CREATE INDEX ix_ke_course     ON knowledge_entry (course_code, doc_type, catalog_year);
CREATE INDEX ix_ke_program    ON knowledge_entry (program_code, doc_type, catalog_year);
CREATE INDEX ix_ke_doc_mod    ON knowledge_entry (doc_type, module);
CREATE INDEX ix_ke_term       ON knowledge_entry (year, semester);
CREATE INDEX ix_ke_instructor ON knowledge_entry (instructor_slug);
CREATE INDEX ix_ke_event_start ON knowledge_entry (event_starts_at) WHERE doc_type = 'event';
-- No index on content_hash: the ingest upsert probes (source_url, chunk_index).


-- ============================================================================
-- Table 2 · chat_session — anonymous student profiles + chat telemetry
--
-- One row per chat session. Live chat history for the UI lives in the
-- browser's localStorage; this table is the server-side analytics/evaluation
-- log (knowledge gaps, guardrail metrics, RAG quality) and is archived weekly
-- and purged. Every value written here is PII-scrubbed upstream.
-- ============================================================================
CREATE TABLE chat_session (
    id            uuid        PRIMARY KEY,   -- client-generated (crypto.randomUUID())
    student_id    uuid,
        -- pseudonymous id from the client's localStorage; groups the sessions
        -- of a returning student. Nullable (anonymous sessions). Deliberately
        -- NOT a foreign key — there is no student table, and the id is never
        -- derived from any real identifier.
    profile       jsonb,
        -- optional entry-flow snapshot — the allowlisted durable onboarding keys
        -- (kept in lockstep with the registry profile_keys): {campus?, major?,
        -- student_type?, transfer_direction?, intl_status?, target_institution?,
        -- modality_pref?, dayparts_pref?, interest_area?, oneoff_purpose?}.
        -- Transient onboarding fields (goal, session meta) go to telemetry, never
        -- here. The CHECK below allowlists the keys so no free-text (and therefore
        -- no PII) can ever be stored here.
    history       jsonb       NOT NULL DEFAULT '[]'::jsonb,
        -- append-only array of per-turn event objects (versioned JSON Schema,
        -- repo contract): scrubbed content plus telemetry — intent, confidence,
        -- retrieval results, guardrail outcomes, citation flags.
    message_count integer     GENERATED ALWAYS AS (jsonb_array_length(history)) STORED NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),   -- bumped on every append
    archived_at   timestamptz,                           -- set by the weekly archive job

    CONSTRAINT ck_cs_profile_allowlist CHECK (
        profile IS NULL OR profile
          - 'campus' - 'major' - 'student_type'
          - 'transfer_direction' - 'intl_status' - 'target_institution'
          - 'modality_pref' - 'dayparts_pref' - 'interest_area' - 'oneoff_purpose'
          = '{}'::jsonb),
    CONSTRAINT ck_cs_history_cap CHECK (jsonb_array_length(history) <= 200)
);

COMMENT ON TABLE chat_session IS
    'Server-side analytics/eval log (live chat history is client localStorage). PII-scrubbed, weekly archive + purge.';
COMMENT ON COLUMN chat_session.student_id IS
    'Pseudonymous client uuid for returning-student grouping; no FK by design.';
COMMENT ON COLUMN chat_session.archived_at IS
    'Purge rule: DELETE only WHERE archived_at IS NOT NULL AND updated_at <= archived_at.';

CREATE INDEX ix_cs_student ON chat_session (student_id);
CREATE INDEX ix_cs_archive ON chat_session (updated_at) WHERE archived_at IS NULL;
