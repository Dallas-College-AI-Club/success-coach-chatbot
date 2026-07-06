-- ============================================================================
-- MODULE 3 · RETRIEVAL — OPTIONAL pgvector module (ADR-005)
--
-- The serving core NEVER references this module; apply it only when free-text
-- policy Q&A needs semantic retrieval, on a host where the pgvector extension
-- is installed (Neon has it built in; for self-hosted, install pgvector).
-- If this file fails at CREATE EXTENSION, the host lacks pgvector — the rest
-- of the database is unaffected.
--
--   psql -f db/optional_pgvector.sql
--
-- DIMENSION / METRIC ARE A MATCHED PAIR WITH THE MODEL (CLAUDE_CODE_BRIEF §3
-- step 12): the vector() dimension below MUST match the embedding model named
-- in .env EMBED_MODEL, and every row records that model in embed_model.
--
--   EMBED_MODEL          dimension   change below to
--   nomic-embed-text     768         vector(768)   <- default (local, free)
--   OpenAI/OpenRouter-   1536        vector(1536)
--     style (e.g. text-embedding-3-small)
--
-- Switching models = new table (or column) + re-embed everything; embed_model
-- makes mixed/old rows auditable, mirroring extractions.extractor (ADR-002).
-- Distance metric: cosine (vector_cosine_ops) — pair it with cosine similarity
-- in query code.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE embeddings (
    id          bigserial PRIMARY KEY,
    syllabus_id int  REFERENCES syllabi (id),
    chunk_ix    int  NOT NULL,
    chunk_text  text NOT NULL,          -- chunked so retrieval returns quotable passages
    embedding   vector(768) NOT NULL,   -- <- pinned to EMBED_MODEL (nomic-embed-text = 768)
    embed_model varchar NOT NULL,       -- recorded per row, like extractions.extractor

    UNIQUE (syllabus_id, chunk_ix)
);

-- HNSW + cosine: the metric half of the matched pair.
CREATE INDEX embeddings_embedding_hnsw_idx
    ON embeddings USING hnsw (embedding vector_cosine_ops);
