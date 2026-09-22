# Architecture

How the pieces fit together as they run today. For the reasoning behind design choices and
release-specific numbers, see [DECISIONS.md](DECISIONS.md); for the original detailed proposals
these implementations grew from, see [archive/](archive/).

## Components

```
Student
  │
  ▼
Next.js frontend (apps/frontend)
  │  onboarding → chat UI → tool loop (app/api/chat/route.ts)
  ▼
OpenRouter (LLM_BASE_URL) ──► openai/gpt-4.1-mini (LLM_MODEL)
  │  temperature 0.2, up to 8 tool-call steps per turn
  ▼
Tool registry (apps/frontend/lib/tools/registry.ts)
  │  compare_programs · search_faculty_expertise · get_current_date · get_semester
  │  get_instructor · get_class_schedule · get_course_info
  │  get_program_requirements · search_knowledge
  ▼
Neon PostgreSQL + pgvector — one table, knowledge_entry (apps/frontend/lib/schema.ts)
  ▲
  │  writes (batch, not at request time)
Python data pipeline (apps/data, uv + SQLAlchemy + psycopg 3)
  produces course / program_map / section / cv / resource / catalog rows
```

## Chat

- **Model:** `openai/gpt-4.1-mini` through OpenRouter, set by `LLM_MODEL` and `LLM_BASE_URL`.
  `temperature: 0.2`, bounded to 8 tool-call steps per request
  (`app/api/chat/route.ts`).
- **Grounding:** the system prompt (`apps/frontend/lib/system-prompt.ts`) requires every course
  code, credit count, prerequisite or program requirement to come from a tool result in the
  current conversation — never from the model's own memory.
- **Tools:** `apps/frontend/lib/tools/registry.ts` is the executable capability list. Each tool
  reads `knowledge_entry` directly; catalog and schedule cards display retrieved fields, and
  explanatory prose is model-generated.

## Data

- **Storage:** a single Neon Postgres table, `knowledge_entry`, holding both prose chunks (for
  semantic search) and structured `facts` documents (for exact lookups), discriminated by
  `doc_type`. Full design and query catalog: [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md).
- **Embeddings:** `Xenova/all-MiniLM-L6-v2`, 384 dimensions, computed locally with no embedding
  API. The Next.js app runs the encoder in-process (`apps/frontend/lib/embedding.ts`); the Python
  pipeline reuses that same encoder by invoking it through Node, so ingest and query vectors can
  never diverge (`apps/data/dallasai/pipeline/embed_rows.py` — it needs `npm ci` in
  `apps/frontend` and `node` on PATH). Both sides read one contract file,
  `apps/frontend/lib/embedding-contract.json`.
- **Pipeline:** the Python pipeline in `apps/data` (uv, SQLAlchemy, psycopg 3) acquires, extracts,
  embeds and loads course, program-map, section, CV, resource and catalog data. It is a separate,
  batch process — the frontend only reads. Full pipeline and runbook:
  [DATA_PIPELINE.md](DATA_PIPELINE.md), [../apps/data/REPRODUCE.md](../apps/data/REPRODUCE.md).

## Deployment

Manual `vercel deploy`/`vercel promote` from a clean checkout — the Vercel project is not
Git-connected, so merging a PR does not publish the app. See
[../apps/frontend/README.md § Release the demo](../apps/frontend/README.md#release-the-demo).

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs `npm run verify` (lint, `tsc --noEmit`, the
`node:test` regression suite via `tsx`, and a production build) from `apps/frontend`, and
`uv run pytest tests/ -q` from `apps/data`. These are the same commands described in
[CONTRIBUTING.md](../CONTRIBUTING.md).
