# Issue #61 Handoff — LLM Facts-Extraction Stage on a Local LLM (LM Studio)

> **What this stage does:** reads an archived document (syllabus, catalog course,
> degree plan, CV) and produces one **validated JSON facts object** per document —
> the structured half of `knowledge_entry` that powers exact answers ("how is this
> graded?", "what are the prerequisites?"). Prose chunking is the separate #35
> stage; this one is the LLM step.
>
> **Why local:** the full corpus is ~24,000 syllabi + ~1,800 catalog pages + ~3,000
> CVs ≈ 135M input tokens. On a paid API that's hundreds of dollars; on a local
> model via LM Studio it's **$0**, in line with the project's strict $0/month
> budget and its provider-independence principle. The engine is provider-agnostic,
> so Claude (paid, fast) and LM Studio (free, slower) are the *same command* with a
> different env var — recommended: validate on a small Claude batch, run the full
> corpus locally.
>
> **Issue tracking:** this is
> [issue #61](https://github.com/Dallas-College-AI-Club/success-coach-chatbot/issues/61)
> — the "structured facts extraction" follow-up that `DATABASE_ARCHITECTURE.md §6.4`
> calls for (assignees: @culukuru, @netflix2023, @treysweeney).

---

## 0. The big picture — where extraction sits

The full pipeline is documented in [`docs/DATA_PIPELINE.md`](../DATA_PIPELINE.md)
(**read it first** — it's the map everyone shares). Extraction is the facts half of
Stage 2:

```
   STAGE 1: ACQUIRE            STAGE 2: PARSE <-- THIS DOC (facts)   STAGE 3: EMBED    STAGE 4: LOAD
   scrapers -> raw HTML/CSV -> facts JSON + prose chunks          ->  768-dim vectors -> knowledge_entry
   + JSONL manifests           (chunks = issue #35)                                    (one table, Neon)
```

The scrape manifests (`raw/manifests/*.jsonl`) supply each document's file path
*and* its identity (course, section, professor, term) — extraction reads identity
from there, never from the document body. Outputs feed the compose/load stage,
where each syllabus's facts merge into its section's row (`facts.syllabus`).

---

## 1. The contract (memorize this — everything else is plumbing)

**One JSON Schema + one versioned prompt + a provider setting.**

- **Schema** = the repo contract for the doc_type:
  [`src/config/facts-schemas/facts-{syllabus,course,program_map,cv}-v1.schema.json`](../../src/config/facts-schemas/).
  The schema is injected into the prompt *and* used to validate the response.
- **Prompt** = [`apps/data/prompts/extract_v1.md`](../../apps/data/prompts/extract_v1.md)
  — versioned, never edited in place (copy to `extract_v2.md` to change it). It
  carries the extraction rules: *null means the source didn't say; verbatim text
  survives structure; grading Weight columns may hold points OR percentages; exclude
  "Total" checksum rows; empty headings → null; identity comes from the provided
  context, never the document body.*
- **Provider** = the `EXTRACTOR` env var. Every result records `extractor`,
  `extraction_method`, `prompt_version`, `schema_version`, so any row in the
  knowledge base is traceable to exactly how it was produced, and outputs from two
  models can be diffed before switching.

The engine is [`apps/data/pipeline/extract.py`](../../apps/data/pipeline/extract.py):
prompt → model → parse JSON → validate against the schema → on failure, feed the
exact validator errors back and retry (up to 2 retries) → `confidence: "low"` or
exhausted retries ⇒ **quarantine** (`needs_review` — never loaded, never displaces a
good row).

## 2. Setting up LM Studio (one-time, ~15 minutes)

1. Install **LM Studio** (lmstudio.ai) — Windows/Mac/Linux desktop app.
2. In-app, download an instruct model good at structured JSON. Recommended:
   - **Qwen 2.5 14B Instruct** (best accuracy for grading-table edge cases; needs
     ~10 GB RAM/VRAM at Q4), or
   - **Qwen 2.5 7B / Llama 3.1 8B Instruct** for lighter machines (expect a few more
     validation retries).
3. Open the **Local Server** tab → *Start Server*. LM Studio serves an
   OpenAI-compatible API at `http://localhost:1234/v1`.
4. Configure the pipeline (in `apps/data/.env`):

```bash
EXTRACTOR="lmstudio:qwen2.5-14b-instruct"      # provider:model (model name as shown in LM Studio)
LLM_BASE_URL="http://localhost:1234/v1"        # LM Studio default
```

Switching to Claude later (or for the validation batch) is only:

```bash
EXTRACTOR="anthropic:claude-sonnet-4-6"
ANTHROPIC_API_KEY="sk-ant-…"
```

Ollama works too: `EXTRACTOR="ollama:qwen2.5:14b"` (native API at `:11434`, no
base-URL needed). OpenRouter (the project's selected free gateway) is also wired:
`EXTRACTOR="openrouter:<model>"` + `OPENROUTER_API_KEY` — fine for small validation
batches, but its free-tier rate limits (HTTP 429) make it a poor fit for the bulk
corpus; that's what local models are for.

## 3. Running an extraction

```bash
cd apps/data

# one syllabus (identity context comes from the scrape manifest, never the body):
python -m pipeline.extract --doc-type syllabus \
    --html "raw/syllabi/2026SP/87180.html" \
    --context '{"course_code":"ENGL 1301","professor":"Contreras, Nelda","section":"C102","year":2026,"semester":"spring","modality":"hybrid"}' \
    --out out/facts/syllabus/87180.json

# a catalog course / degree plan:
python -m pipeline.extract --doc-type course --html "raw/catalog/2026-2027/courses/15806.html" ...
python -m pipeline.extract --doc-type program_map --html "raw/catalog/2026-2027/programs/3448.html" ...
```

The **batch runner** is a small loop over the scrape manifests
(`raw/manifests/archive_*.jsonl`): each line supplies the file path *and* the
identity context. Batch by term; the engine is stateless, so parallelism is safe up
to whatever your machine's LM Studio throughput allows.

**Throughput planning (local):** a 14B model on a decent GPU does roughly 5–15 s per
syllabus → the full 24k-syllabus corpus is a few machine-days. Run it as an
unattended batch (it's resumable — skip documents whose output JSON already exists);
or split terms across teammates' machines. Zero dollars either way.

## 4. Quality gates (identical for every provider)

1. **Schema validation** with error-feedback retries — local models fail validation
   more often on the first attempt; the retry loop with exact errors usually
   converges by attempt 2–3.
2. **Quarantine** — `confidence:"low"`, identity mismatches, or unparseable output
   land in `needs_review`, never in the database. Review the quarantine folder,
   fix the prompt (bump the version), re-run.
3. **The golden set** — the four sample syllabi in
   [`apps/data/sample_syllabi/`](../../apps/data/sample_syllabi/) are the regression
   fixtures. They were chosen because they exercise the hard cases: points-vs-percent
   grading, checksum rows, empty template headings, a co-requisite course's separate
   grade bucket, missing instructor names. Before trusting any new model or prompt
   version, extract these four and hand-check the output.
4. **Spot-audit against sources** — for a sample of extractions, re-read the source
   HTML and confirm no value was invented. "Null = the source didn't say" is the
   quality bar; a fabricated policy is a firing offense for a model.

## 5. Embeddings on LM Studio (the other local workload)

The knowledge base needs a **768-dimension embedding** per chunk (`halfvec(768)`,
frozen). LM Studio can serve `nomic-embed-text` (768-dim) on the same local server
(`POST /v1/embeddings`) — free, and fine for **ingest**. One caveat before
committing to local-only embeddings: the *same model* must also embed student
questions at answer time from the deployed Next.js runtime, so a purely-local server
covers ingestion but production query-time needs the model behind a reachable
endpoint (or the hosted `gemini-embedding-001` at 768 dims). That provider decision
is `DATABASE_ARCHITECTURE.md §9`'s open item — this runbook works with either.

## 6. Where the outputs go

Validated facts JSONs feed the compose/load stage
([`pipeline/build_knowledge.py`](../../apps/data/pipeline/build_knowledge.py)),
which merges each syllabus into its section row (`facts.syllabus`), builds
course/program/cv rows, and upserts into `knowledge_entry`. End-to-end picture:
[`docs/DATA_PIPELINE.md`](../DATA_PIPELINE.md).
