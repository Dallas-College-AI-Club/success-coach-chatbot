-- ============================================================================
-- Dallas College AI Chatbot — Schema v2.1 DDL
-- Source of truth: docs/schema_v2.dbml (+ docs/SCHEMA_HANDOVER.md,
-- docs/DATA_DICTIONARY.md). Do not hand-edit tables in a live DB — fix the
-- extraction/loader and re-run (docs/DESIGN_NOTES_ADR.md, ADR-001/ADR-004).
--
-- Vanilla Postgres only (ADR-008): no extensions required by this file.
-- Module 3 (embeddings/pgvector) is deliberately NOT here — it is optional and
-- lives in db/optional_pgvector.sql (ADR-005). Apply order:
--   psql -f db/schema.sql
--   psql -f db/views.sql
--   psql -f db/seed_field_visibility.sql
--   [optional] psql -f db/optional_pgvector.sql
--
-- Apply to a FRESH database. There is no migration framework by design
-- (ADR-004); schema changes are new numbered .sql files.
-- ============================================================================


-- ============================================================================
-- MODULE 1 · PIPELINE (raw + extraction)
-- ============================================================================

-- L0. Immutable, append-only. The whole database is rebuildable from this
-- table + code. Nothing writes here except the scrapers; rows are NEVER
-- edited or deleted.
CREATE TABLE raw_documents (
    id           bigserial PRIMARY KEY,
    source_type  varchar     NOT NULL,  -- schedule_csv | syllabus_html | syllabus_pdf | bookstore_page | catalog_page
    source_url   text,                  -- citations (DP-013), re-fetch, debugging
    term_code    varchar,               -- e.g. 2026SU — nullable for non-term sources (catalog pages)
    fetched_at   timestamptz NOT NULL,
    content_hash char(64)    NOT NULL,  -- sha256; new row only when hash changes
    raw_text     text,                  -- full extracted text — kept so future models can re-extract
    raw_payload  jsonb,                 -- structured raw (e.g. one CSV row) when applicable
    is_latest    boolean     NOT NULL DEFAULT true,

    UNIQUE (source_url, content_hash)
);
CREATE INDEX raw_documents_term_code_idx ON raw_documents (term_code);

-- L1. Versioned LLM output, recorded like an experiment. Swap models freely;
-- re-extract from raw anytime; flip is_current only after the new extraction
-- beats the old one. No data is deleted.
CREATE TABLE extractions (
    id                bigserial PRIMARY KEY,
    raw_document_id   bigint      NOT NULL REFERENCES raw_documents (id),
    extractor         varchar     NOT NULL,  -- model id, e.g. claude-sonnet-4-6 | qwen2.5-14b-q5
    extraction_method varchar     NOT NULL,  -- api | claude_code_session | local_ollama
    prompt_version    varchar     NOT NULL,
    schema_version    varchar     NOT NULL,  -- version of the extraction JSON Schema used
    extracted_at      timestamptz NOT NULL,
    status            varchar     NOT NULL DEFAULT 'ok',  -- ok | failed | needs_review
    data              jsonb       NOT NULL,  -- validated against the canonical JSON Schema
    validation_errors jsonb,
    is_current        boolean     NOT NULL DEFAULT true   -- exactly one current per raw_document
);
CREATE INDEX extractions_rawdoc_current_idx ON extractions (raw_document_id, is_current);
-- DATA_DICTIONARY: extractions.data is GIN-indexed (everything downstream reads it)
CREATE INDEX extractions_data_gin_idx ON extractions USING gin (data);


-- ============================================================================
-- MODULE 2 · SERVING CORE (what the chatbot queries)
-- created_at/updated_at per CLAUDE_CODE_BRIEF step 1. updated_at is maintained
-- by the loader's upsert SET clauses (no trigger framework — ADR-004).
-- ============================================================================

CREATE TABLE terms (
    id         serial PRIMARY KEY,
    code       varchar NOT NULL UNIQUE,  -- 2026SU — the natural key used across sources
    name       varchar NOT NULL,         -- Summer 2026
    year       int     NOT NULL,
    season     varchar NOT NULL,         -- spring | summer | fall | winter
    start_date date,
    end_date   date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Course-level = the shared baseline (same across sections). Anything NOT
-- stored here is, by construction, instructor-specific delta.
CREATE TABLE courses (
    id             serial PRIMARY KEY,
    subject_prefix varchar NOT NULL,  -- HIST
    course_number  varchar NOT NULL,  -- 1301
    title          varchar NOT NULL,
    credit_hours   numeric,
    description    text,              -- shared baseline — same across sections
    state_outcomes text,              -- state-defined outcomes — shared baseline
    requisites     text,              -- verbatim; structured edges live in course_requisites (Module 6)
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),

    UNIQUE (subject_prefix, course_number)
);

-- Identity rule (GAP_ANALYSIS Q8): full_name comes from SCHEDULE rows —
-- syllabus-extracted names are a cross-check only, never an identity source.
CREATE TABLE instructors (
    id              serial PRIMARY KEY,
    full_name       varchar NOT NULL,
    normalized_name varchar NOT NULL UNIQUE,  -- lowercased "last, first" for dedup
    email           varchar,                  -- PRIVATE until verified public — see field_visibility
    department      varchar,                  -- from syllabus header; optional FK to academic_units later
    cv_url          text,                     -- TX HB 2504 public vita link — PUBLIC by law
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- The fast-search spine: course x term x instructor.
CREATE TABLE sections (
    id                serial PRIMARY KEY,
    course_id         int     NOT NULL REFERENCES courses (id),
    term_id           int     NOT NULL REFERENCES terms (id),
    instructor_id     int     REFERENCES instructors (id),
    section_number    varchar NOT NULL,
    modality          varchar CHECK (modality IN ('online', 'in_person', 'hybrid')),
    campus            varchar,
    meeting_info_raw  text,     -- verbatim; parsed rows live in section_meetings
    start_date        date,     -- with end_date: fast-track detection (HIST §51 = 5 weeks)
    end_date          date,
    syllabus_url      text,
    coreq_section_ref varchar,  -- section-pinned coreq from the CSV, e.g. DMAT-0305-33403
    raw_document_id   bigint    REFERENCES raw_documents (id),  -- lineage to the schedule row
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),

    UNIQUE (course_id, term_id, section_number)
);
CREATE INDEX sections_instructor_id_idx ON sections (instructor_id);

-- Thin projection of extractions.data — one row per section, rebuildable by
-- the loader at any time. NOT a source of truth.
CREATE TABLE syllabi (
    id                  serial PRIMARY KEY,
    section_id          int    NOT NULL UNIQUE REFERENCES sections (id),
    extraction_id       bigint NOT NULL REFERENCES extractions (id),
    modified_date       date,   -- syllabus "Modified" date — staleness disclaimer (DP-041)
    withdraw_date       date,
    certification_date  date,
    instructor_outcomes jsonb,  -- instructor-defined outcomes (the delta; state outcomes live on courses)
    course_schedule     jsonb,  -- week/topic/dues as extracted; structure varies per professor
    policies            jsonb,  -- {late_work, attendance, makeup, ai_plagiarism, extra_credit} summaries
    distinctive_features jsonb, -- LLM-flagged unique items (e.g. History Podcasters project)
    full_summary        text,   -- ≤120-word neutral paragraph the bot quotes from
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Assessment mix unnested from JSON so cross-professor comparison is a plain
-- GROUP BY. The taxonomy is enforced twice (ADR-003): JSON Schema enum at
-- extraction time + this CHECK.
CREATE TABLE grading_components (
    id             serial PRIMARY KEY,
    syllabus_id    int     NOT NULL REFERENCES syllabi (id),
    raw_label      varchar NOT NULL,  -- verbatim: "Ready for Class", "History Podcasters"
    canonical_type varchar NOT NULL CHECK (canonical_type IN
        ('exam', 'quiz', 'homework', 'project', 'lab', 'participation',
         'paper', 'presentation', 'final_exam', 'other')),
    weight_pct     numeric,           -- normalized to percent when syllabus uses points
    points         numeric,
    notes          text,              -- nuance, e.g. "unlimited attempts, highest counts"
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX grading_components_syllabus_type_idx
    ON grading_components (syllabus_id, canonical_type);

-- v2.1: parsed meeting blocks, one row per block (lecture and lab separately).
-- Online sections have ZERO rows — absence is the signal; never invent times.
CREATE TABLE section_meetings (
    id           serial PRIMARY KEY,
    section_id   int     NOT NULL REFERENCES sections (id),
    meeting_type varchar NOT NULL,  -- lecture | lab | other
    days         varchar,           -- MTWRFSU subset, e.g. MW
    start_time   time,
    end_time     time,
    campus       varchar,
    building     varchar,
    room         varchar,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX section_meetings_section_id_idx ON section_meetings (section_id);

-- v2.1: bookstore links now (deterministic per section; ITSE has lecture + lab
-- L1 links); scraped items jsonb post-MVP.
CREATE TABLE section_materials (
    id            serial PRIMARY KEY,
    section_id    int     NOT NULL REFERENCES sections (id),
    component     varchar,           -- lecture | lab
    bookstore_url text    NOT NULL,
    items         jsonb,             -- post-MVP: scraped textbook titles/ISBNs
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX section_materials_section_id_idx ON section_materials (section_id);


-- ============================================================================
-- MODULE 3 · RETRIEVAL — NOT HERE (optional; see db/optional_pgvector.sql)
-- ============================================================================


-- ============================================================================
-- MODULE 4 · SUPPORT-CONTACT DIRECTORY (Issues #43–#46, integrated as designed)
-- ============================================================================

CREATE TABLE institutions (
    id      serial PRIMARY KEY,
    name    varchar NOT NULL,
    website text
);

-- Grants are managed per SCHOOL (Issue #47) — academic_units is the routing key.
CREATE TABLE academic_units (
    id             serial PRIMARY KEY,
    institution_id int     NOT NULL REFERENCES institutions (id),
    name           varchar NOT NULL   -- school, e.g. ETMS
);

CREATE TABLE contacts (
    id                 serial PRIMARY KEY,
    name               varchar NOT NULL,
    email              varchar,           -- PRIVATE by default in public repo (field_visibility)
    helps_with         text,
    active             boolean NOT NULL DEFAULT true,
    last_verified_date date               -- quarterly steward check
);

CREATE TABLE resource_categories (
    id            serial PRIMARY KEY,
    name          varchar NOT NULL,  -- grants | scholarships | financial_aid | emergency_funds | student_care | tech_support
    routing_model text               -- "route, don't determine eligibility"
);

CREATE TABLE help_topics (
    id   serial PRIMARY KEY,
    name varchar NOT NULL            -- trigger topics: rent, utilities, mental health, laptops...
);

-- The routing table: contact x school x category x program.
CREATE TABLE assignments (
    id                   serial PRIMARY KEY,
    contact_id           int NOT NULL REFERENCES contacts (id),
    academic_unit_id     int REFERENCES academic_units (id),
    resource_category_id int NOT NULL REFERENCES resource_categories (id),
    degree_or_program    varchar
);

CREATE TABLE assignment_topics (
    assignment_id int NOT NULL REFERENCES assignments (id),
    help_topic_id int NOT NULL REFERENCES help_topics (id),
    PRIMARY KEY (assignment_id, help_topic_id)
);

CREATE TABLE student_guidance (
    id                   serial PRIMARY KEY,
    resource_category_id int NOT NULL REFERENCES resource_categories (id),
    prep_steps           text,  -- e.g. "FAFSA on file + declared program of study"
    awareness_msg        text   -- proactive onboarding message (DP/#46)
);

-- Legacy directory stub retained for compatibility; PLANNING questions use
-- Module 6 degree_plans instead.
CREATE TABLE programs (
    id              serial PRIMARY KEY,
    contact_id      int REFERENCES contacts (id),
    name            varchar,
    deferred_detail text
);


-- ============================================================================
-- MODULE 5 · GOVERNANCE
-- ============================================================================

-- Simple public/private registry (seeded by db/seed_field_visibility.sql).
-- Future privacy expansion hangs off this table instead of a schema redesign.
CREATE TABLE field_visibility (
    table_name  varchar NOT NULL,
    column_name varchar NOT NULL,
    is_public   boolean NOT NULL DEFAULT true,
    notes       text,
    PRIMARY KEY (table_name, column_name)
);


-- ============================================================================
-- MODULE 6 · CATALOG & DEGREE PLANS (v2.1 — closes DP-011/012/020)
-- Source: catalog.dallascollege.edu (Acalog). Requirements CHANGE by edition;
-- every fulfillment answer cites its edition (ADR-007, DP-013).
-- ============================================================================

CREATE TABLE catalog_editions (
    id              serial PRIMARY KEY,
    catoid          int     NOT NULL UNIQUE,  -- Acalog catalog id, e.g. 5 (= 2026-27)
    year_label      varchar NOT NULL,         -- 2026-2027
    is_active       boolean NOT NULL DEFAULT false,  -- which edition the bot cites by default
    raw_document_id bigint  REFERENCES raw_documents (id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE degree_plans (
    id                 serial PRIMARY KEY,
    catalog_edition_id int     NOT NULL REFERENCES catalog_editions (id),
    poid               int,               -- Acalog program id
    name               varchar NOT NULL,
    award_type         varchar,           -- AA | AS | AAS | certificate | core_curriculum (bachelor's are poid pages too)
    academic_unit_id   int     REFERENCES academic_units (id),  -- plan -> school -> grant POC (Issue #47)
    raw_document_id    bigint  REFERENCES raw_documents (id),
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),

    UNIQUE (catalog_edition_id, poid)
);

CREATE TABLE plan_requirements (
    id                  serial PRIMARY KEY,
    degree_plan_id      int     NOT NULL REFERENCES degree_plans (id),
    group_name          varchar NOT NULL,  -- e.g. "American History (060)", "Major Courses"
    component_area_code varchar,           -- TX core FCA code 010-090 when applicable
    credits_required    numeric,
    rule                text,              -- free-text rule when not simply "take N credits from list"
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- "Does HIST-1301 fulfill X in plan Z?" = one join.
CREATE TABLE requirement_courses (
    requirement_id int NOT NULL REFERENCES plan_requirements (id),
    course_id      int NOT NULL REFERENCES courses (id),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (requirement_id, course_id)
);

-- Typed requisite edges (DP-012 chains). An FK edge when the requisite is a
-- course (PHYS-2425 -> MATH-2413); NULL + raw_text when it isn't (TSI Reading).
-- raw_text ALWAYS survives — structure is added, never substituted.
CREATE TABLE course_requisites (
    id                  serial PRIMARY KEY,
    course_id           int     NOT NULL REFERENCES courses (id),
    kind                varchar NOT NULL CHECK (kind IN
                            ('prerequisite', 'corequisite', 'tsi', 'other')),
    requisite_course_id int     REFERENCES courses (id),  -- null when non-course
    raw_text            text    NOT NULL,  -- verbatim requisite sentence
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX course_requisites_course_id_idx ON course_requisites (course_id);
