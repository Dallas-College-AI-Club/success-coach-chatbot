# Issue #35 Handoff — Document Processing, Chunking & Indexing (@netflix2023)

> **Goal of #35:** the pipeline that turns raw scraped documents into clean,
> chunked, embedded rows the chatbot can search.
>
> **Where things stand:** the RAG approach you proved in
> [`rag_poc.py`](../../apps/data/dallasai/rag_poc.py) — markdown-header chunking,
> per-chunk metadata stamps, and (crucially) your context-starvation fix of
> **pre-filtering by course before similarity search** — *is* the production
> design. This handoff maps that approach onto the production target
> (`knowledge_entry`), gives the exact contracts to build against, and lists what's
> left to ship. The raw corpus is already on disk (~24k syllabi, ~3k CVs,
> ~1.8k catalog pages under `apps/data/raw/`), so this stage has real input to run on.

---

## 0. The big picture — where #35 sits

The full pipeline is documented in [`docs/DATA_PIPELINE.md`](../DATA_PIPELINE.md)
(**read it first** — it's the map everyone shares). Four stages; #35 owns the
chunking half of Stage 2 and Stage 3:

```
   STAGE 1: ACQUIRE            STAGE 2: PARSE <-- #35 (chunks)   STAGE 3: EMBED <-- #35   STAGE 4: LOAD
   scrapers -> raw HTML/CSV -> facts JSON + prose chunks      ->  768-dim vectors       -> knowledge_entry
   + JSONL manifests           (facts = the extraction stage)                             (one table, Neon)
```

Stage 1 is done (the corpus is on disk); the facts half of Stage 2 is the
extraction stage ([`ISSUE_61_HANDOFF.md`](ISSUE_61_HANDOFF.md), issue #61); Stage
4's models are issue #51. Your input contract is the scrape **manifest** (one JSONL
record per file: `source_url`, `raw_path`, `sha256`, course/section/professor/term)
— identity always comes from there, never from document body text.

---

## 1. The production target (read this first)

Everything loads into **one Postgres table, `knowledge_entry`**
([`db/schema.sql`](../../db/schema.sql)) — one row per retrievable unit, two kinds:

- **Prose chunks** (`facts = NULL`) — markdown sections found by hybrid
  vector + keyword search. *This is the surface #35 produces.*
- **Fact rows** (`facts` = validated JSON) — structured extractions answered by
  indexed point-reads (produced by the extraction stage, see
  [`ISSUE_61_HANDOFF.md`](ISSUE_61_HANDOFF.md)).

**Your pre-filter strategy became the schema.** The `WHERE course_id = X ORDER BY
distance` fix you designed in `RAG_EVALUATION.md §7` is realized as **generated
filter columns** promoted from each row's metadata stamp (`course_code`, `year`,
`semester`, `doc_type`, `instructor_slug`, …) with composite indexes — so every
retrieval query pre-filters exactly the way your PoC showed it must, and the
per-course starvation failure can't happen.

Two things about the target differ from the PoC setup, both deliberate:

| | PoC (ChromaDB) | Production (`knowledge_entry`) | Why |
|---|---|---|---|
| Vector | ChromaDB default embedder, **384-dim** MiniLM | **`halfvec(768)` — frozen** | one embedding model must serve Python ingest **and** the Vercel query route; 768 candidates: local `nomic-embed-text` (LM Studio/Ollama, your ISSUE_20 pick) or hosted `gemini-embedding-001`. ChromaDB's built-in embedder can't be used for production rows — but ChromaDB remains great for local experiments. |
| Tables | new `course_chunks` table | rows in `knowledge_entry` | one-table design (issue #36): chunks and facts share the filter surface and one HNSW index |

## 2. The chunking spec

From [`DATABASE_ARCHITECTURE.md §6.4`](../DATABASE_ARCHITECTURE.md): **markdown-aware
splitting — header sections kept intact, 500–1000 tokens per chunk, 10–20 % overlap**;
one row per chunk, `chunk_index` = ordinal. Your PoC's header-splitter is the right
skeleton; production adds:

1. **Split on H2/H3 section boundaries** (Concourse syllabi have a stable H2 set:
   Course Information, Course Description, Graded Work, Course Schedule, Course
   Policies, …) instead of every `#` line, then apply the token cap/overlap within
   long sections.
2. **Skip the boilerplate denylist** — these sections are identical across thousands
   of syllabi and are already served by catalog/contact rows; chunking them
   per-syllabus wastes ~30–40 % of the corpus budget:
   *Course Description, State-Defined Learning Outcomes, Texas Core Objectives,
   Support Contacts, Institutional Policies, Required Course Materials (link-only).*
3. **Identity comes from the work-list, never from the document body.** The
   scraper's manifest (`raw/manifests/*.jsonl`) carries `course_code`, `section`,
   `professor`, `term_code` for every file. Syllabi frequently don't name their own
   instructor (3 of the 4 committed sample PDFs don't), so body-text heuristics
   ("instructor:" line scans) inevitably produce `UNKNOWN`s and mismatches — read
   identity from the manifest record instead and stamp it into each chunk's
   metadata.
4. **Stamp the governed metadata keys** (validated against
   [`metadata-registry.json`](../../src/config/metadata-registry.json)):
   `doc_type`, `module`, `course_code`, `subject`, `year`, `semester`,
   `professor`, `instructor_slug`, `section`, `header_path`, plus provenance
   (`extractor`, `extraction_method`, `schema_version`, `raw_hash`).

## 3. Loading & idempotency (already specified — don't redesign)

Rows load via the **§5D idempotent upsert + reconcile**
([`DATABASE_ARCHITECTURE.md §5`](../DATABASE_ARCHITECTURE.md)): identity is
`UNIQUE(source_url, chunk_index)`; `content_hash` (sha256 over chunk_text+facts+
metadata) gates updates so unchanged chunks cost no re-embed and no index churn;
`scraped_at` is always bumped ("verified today") while `updated_at` moves only on
real content change. A working reference of the compose/load step — including the
SQLite demo sink that mirrors the Postgres row shape — is
[`pipeline/build_knowledge.py`](../../apps/data/pipeline/build_knowledge.py).

One structural rule to know: **a section and its syllabus are ONE row** — syllabus
facts embed in the representative section row (`facts.syllabus`), and
`doc_type='syllabus'` rows are *prose chunks only*. Your chunker's output is exactly
those prose chunks; the facts side is the extraction stage's job.

## 4. Embedding contract

- **768-dim, cosine space, the same model at ingest and at query time**, exposing a
  `task_type` (`document` at ingest / `query` at answer time).
- Cache embeddings keyed by `(embed_model, task_type, sha256(chunk_text))` — re-runs
  of unchanged text cost nothing.
- Stamp `embed_model` into metadata on every row.
- Provider is a pending team decision (`DATABASE_ARCHITECTURE.md §9`); build behind
  an interface so `nomic-embed-text` (local) and `gemini-embedding-001` (hosted) are
  a config swap — the same pattern the extractor uses.

## 5. What's left to ship (the #35 deliverables)

1. **`pipeline/chunk.py`** — manifest-driven: read each raw HTML file + its manifest
   record → markdown → H2/H3 chunks (spec above) → chunk records with stamped
   metadata. (BeautifulSoup/lxml are already project dependencies.)
2. **`pipeline/embed.py`** — the provider-swappable embedding stage with the cache.
3. **Wire into `build_knowledge.py`** so chunks load alongside fact rows.
4. **Unit tests** — markdown tables survive conversion; chunks carry the mandatory
   metadata; boilerplate sections are excluded; idempotent re-run writes nothing.
5. **`.env.example`** — chunk size, overlap, `EMBED_MODEL`, `LLM_BASE_URL`,
   `DATABASE_URL_UNPOOLED`.

Input to develop against is already there: `apps/data/raw/syllabi/2026SP/*.html`
(6,856 files) with manifests in `apps/data/raw/manifests/`. The full pipeline
picture: [`docs/DATA_PIPELINE.md`](../DATA_PIPELINE.md).
