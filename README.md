# Dallas College AI Club: Success Coach Chatbot

**Major** is a planning companion grounded in Dallas College records. Students can explore course plans and prerequisites, inspect published class sections and instructor backgrounds, and save courses for a conversation with their Success Coach.

The app combines a Next.js chat interface, read-only tools over Neon PostgreSQL/pgvector, and a Python data pipeline. The Simple, Playful and Focus experiences share the same chat and planning tools.

## Start here

| Goal | Reading path |
|---|---|
| Run the app and its checks | [Frontend setup](apps/frontend/README.md) |
| Understand how it fits together | [Architecture](docs/ARCHITECTURE.md) |
| Reproduce the data pipeline | [Data runbook](apps/data/REPRODUCE.md) |
| See what changed and why, dated | [Decisions log](docs/DECISIONS.md) |
| Contribute | [Contribution and branch conventions](CONTRIBUTING.md) |
| Superseded documents and research | [Archive](docs/archive/) |

## Supported demonstration

- Ask for one numbered semester or a published program plan; expand individual course details and elective requirements.
- Look up saved Fall sections with dates, available meeting times, instructors, campus and source links; group by day, professor, time or campus.
- Request every named instructor for a course/term; expand saved CV backgrounds with highlighted keywords.
- Save verified courses to local notes and inspect the printable summary.
- Search the student-resource corpus; recover possible related records when an exact lookup fails.

The [tool registry](apps/frontend/lib/tools/registry.ts) is the executable capability list. Catalog and schedule cards display retrieved fields directly; explanatory prose remains model-generated.

## Data and limits

The demo corpus contains the current catalog, published professional backgrounds, selected student resources and saved Fall schedules. Missing facts are labeled; related semantic matches are not an exhaustive directory. Release-specific numbers (which snapshot, how many sections) are dated in [docs/DECISIONS.md](docs/DECISIONS.md), not repeated here.

Major cannot decide admission, transfer acceptance, graduation or awards. Planning checklists distinguish self-reported completion from in-progress, uncertain and pending-transfer courses. Remaining credits are calculated only when the published rules and reported history reconcile. Faculty expertise lists cover explicit evidence in indexed CVs, with all matches accessible. Official degree audits, automatic timetable construction and syllabus-policy answers remain outside this release.

Database setup and ingestion are separate from running the frontend: see the [data runbook](apps/data/REPRODUCE.md) and [runtime schema](apps/frontend/lib/schema.ts). Use a separate development database for imports.

Keep credentials in ignored local `.env` files or platform secret stores. Raw source archives, database snapshots, paid-test traces and generated build output stay outside Git. Model and database configuration on Vercel must be verified separately before a presentation release.
