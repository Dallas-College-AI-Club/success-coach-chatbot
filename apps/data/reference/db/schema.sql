-- Generated from dallasai.models; regenerate with python -m dallasai.database --schema

-- Fresh databases only. Existing databases need a reviewed migration; this never drops tables.

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS chat_session (
	id UUID NOT NULL,
	student_id UUID,
	profile JSONB,
	history JSONB DEFAULT '[]'::jsonb NOT NULL,
	message_count INTEGER GENERATED ALWAYS AS (jsonb_array_length(history)) STORED NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	archived_at TIMESTAMP WITH TIME ZONE,
	PRIMARY KEY (id),
	CONSTRAINT ck_cs_profile_allowlist CHECK (profile IS NULL OR profile - 'campus' - 'major' - 'student_type' = '{}'::jsonb),
	CONSTRAINT ck_cs_history_cap CHECK (jsonb_array_length(history) <= 200)
);

CREATE INDEX IF NOT EXISTS ix_cs_archive ON chat_session (updated_at) WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_cs_student ON chat_session (student_id);

CREATE TABLE IF NOT EXISTS knowledge_entry (
	id BIGINT GENERATED ALWAYS AS IDENTITY,
	source_url TEXT NOT NULL,
	chunk_index INTEGER DEFAULT 0 NOT NULL,
	content_hash TEXT NOT NULL,
	scraped_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	chunk_text TEXT NOT NULL,
	facts JSONB,
	metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
	embedding HALFVEC(384) NOT NULL,
	doc_type TEXT GENERATED ALWAYS AS (metadata->>'doc_type') STORED,
	module TEXT GENERATED ALWAYS AS (metadata->>'module') STORED,
	course_code TEXT GENERATED ALWAYS AS (upper(trim(regexp_replace(regexp_replace(metadata->>'course_code', '([A-Za-z])([0-9])', '\1 \2'), '[^A-Za-z0-9]+', ' ', 'g')))) STORED,
	program_code TEXT GENERATED ALWAYS AS (upper(metadata->>'program_code')) STORED,
	year INTEGER GENERATED ALWAYS AS (((metadata->>'year'))::integer) STORED,
	semester TEXT GENERATED ALWAYS AS (lower(metadata->>'semester')) STORED,
	term_ord SMALLINT GENERATED ALWAYS AS ((((metadata->>'year'))::integer * 10 + CASE lower(metadata->>'semester') WHEN 'spring' THEN 1 WHEN 'may' THEN 2 WHEN 'summer' THEN 3 WHEN 'fall' THEN 4 WHEN 'winter' THEN 5 END)::smallint) STORED,
	catalog_year TEXT GENERATED ALWAYS AS (metadata->>'catalog_year') STORED,
	event_starts_at TIMESTAMP WITH TIME ZONE GENERATED ALWAYS AS (to_timestamp((metadata->>'event_start_epoch')::bigint)) STORED,
	professor TEXT GENERATED ALWAYS AS (metadata->>'professor') STORED,
	instructor_slug TEXT GENERATED ALWAYS AS (metadata->>'instructor_slug') STORED,
	program_name_squashed TEXT GENERATED ALWAYS AS (regexp_replace(lower(facts->>'name'), '[^a-z0-9]', '', 'g')) STORED,
	chunk_tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_knowledge_entry_source_chunk UNIQUE (source_url, chunk_index),
	CONSTRAINT ck_ke_doc_type CHECK (metadata->>'doc_type' IS NOT NULL),
	CONSTRAINT ck_ke_semester CHECK (metadata->>'semester' IS NULL OR lower(metadata->>'semester') IN ('fall','spring','summer','winter','may')),
	CONSTRAINT ck_ke_year CHECK ((metadata->>'year') IS NULL OR (metadata->>'year')::integer BETWEEN 2020 AND 2035)
);

CREATE INDEX IF NOT EXISTS ix_ke_course ON knowledge_entry (course_code, doc_type, catalog_year);

CREATE INDEX IF NOT EXISTS ix_ke_doc_mod ON knowledge_entry (doc_type, module);

CREATE INDEX IF NOT EXISTS ix_ke_event_start ON knowledge_entry (event_starts_at) WHERE doc_type = 'event';

CREATE INDEX IF NOT EXISTS ix_ke_instructor ON knowledge_entry (instructor_slug);

CREATE INDEX IF NOT EXISTS ix_ke_metadata ON knowledge_entry USING gin (metadata jsonb_path_ops);

CREATE INDEX IF NOT EXISTS ix_ke_program ON knowledge_entry (program_code, doc_type, catalog_year);

CREATE INDEX IF NOT EXISTS ix_ke_program_name_squashed ON knowledge_entry USING gin (program_name_squashed gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ix_ke_term ON knowledge_entry (year, semester);

CREATE INDEX IF NOT EXISTS ix_ke_tsv ON knowledge_entry USING gin (chunk_tsv);

COMMIT;
