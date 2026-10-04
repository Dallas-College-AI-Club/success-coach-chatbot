# Dallas College AI Club: Success Coach Chatbot

**Major** is a planning companion grounded in Dallas College records. Students can explore course plans and prerequisites, inspect published class sections and instructor backgrounds, and save courses for a conversation with their Success Coach.

The app combines a Next.js chat interface, read-only tools over Neon PostgreSQL/pgvector, and a Python data pipeline. The Simple, Playful and Focus experiences share the same chat and planning tools.

## Start here

1. Read this page, then [CONTRIBUTING.md](CONTRIBUTING.md) for branch names, pull requests and the definition of done.
2. If you work with an AI coding agent, it follows [AGENTS.md](AGENTS.md); Claude reads the same file through `CLAUDE.md`.
3. Set up the part you will work on:

| You work on | You need | Setup guide | Check before a PR |
|---|---|---|---|
| Chat app, `apps/frontend` | Node.js 20.9+ (CI uses 22), a Neon `DATABASE_URL`, your own OpenRouter key | [Frontend README](apps/frontend/README.md) | `npm run verify` |
| Data pipeline, `apps/data` | Python 3.13 with [uv](https://docs.astral.sh/uv/), the raw corpus in `DATA_DIR` | [Data runbook](apps/data/REPRODUCE.md), then the [extraction manual](apps/data/EXTRACTION_MANUAL.md) | `uv run pytest tests/ -q` |

CI runs both checks on every pull request.

## Where things are

| Path | What it holds |
|---|---|
| `apps/frontend` | Next.js app: onboarding, chat, and read-only tools. The [tool registry](apps/frontend/lib/tools/registry.ts) is the executable capability list. |
| `apps/data` | Python pipeline (`dallasai/`): scrape, extract, verify, compose, embed and load into Neon; tests, gate fixtures and extraction prompts. |
| `src/config` | Facts schemas and prompt/runtime configuration shared by both apps ([README](src/config/README.md)). |
| `docs` | [Architecture](docs/ARCHITECTURE.md), dated [decisions](docs/DECISIONS.md), governance RFCs and design notes. |
| `tests/guardrails` | Guardrail test corpus described in [RFC-0003](docs/rfcs/RFC-0003-PROMPT-EVALUATION-STANDARD.md). |

Superseded documents and retired code were removed on 2026-10-03. Git history keeps them; the last snapshot is at commit [`65f85ae`](https://github.com/Dallas-College-AI-Club/success-coach-chatbot/tree/65f85ae).

## Configuration, credentials and data

- **Credentials** go only in ignored local files: `apps/frontend/.env.local` for the app and `apps/data/.env` for the pipeline, each copied from its `.env.example`. Never put them in source, screenshots, issues or PRs.
- **Raw data** (scraped catalog, schedules, syllabi, CVs and their manifests) is not in Git. Keep it in one folder outside the repository and set `DATA_DIR` in `apps/data/.env`; every pipeline stage reads raw files through that setting.
- **Databases:** run imports against a separate development database. Setup and ingestion are separate from running the frontend: see the [data runbook](apps/data/REPRODUCE.md) and the [runtime schema](apps/frontend/lib/schema.ts).

## Supported demonstration

- Ask for one numbered semester or a published program plan; expand individual course details and elective requirements.
- Look up saved Fall sections with dates, available meeting times, instructors, campus and source links; group by day, professor, time or campus.
- Request every named instructor for a course/term; expand saved CV backgrounds with highlighted keywords.
- Save verified courses to local notes and inspect the printable summary.
- Search the student-resource corpus; recover possible related records when an exact lookup fails.

Catalog and schedule cards display retrieved fields directly; explanatory prose remains model-generated.

## Data and limits

The demo corpus contains the current catalog, published professional backgrounds, selected student resources and saved Fall schedules. Missing facts are labeled; related semantic matches are not an exhaustive directory. Release-specific numbers (which snapshot, how many sections) are dated in [docs/DECISIONS.md](docs/DECISIONS.md), not repeated here.

Major cannot decide admission, transfer acceptance, graduation or awards. Planning checklists distinguish self-reported completion from in-progress, uncertain and pending-transfer courses. Remaining credits are calculated only when the published rules and reported history reconcile. Faculty expertise lists cover explicit evidence in indexed CVs, with all matches accessible. Official degree audits, automatic timetable construction and syllabus-policy answers remain outside this release.

Merging a pull request does not deploy the app; the manual release steps are in the [frontend README](apps/frontend/README.md#release-the-demo).
