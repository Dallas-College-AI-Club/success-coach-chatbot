# Dallas College AI Club: Success Coach Chatbot

**Major** is a planning companion grounded in Dallas College records. Students can explore course plans and prerequisites, inspect published class sections and instructor backgrounds, and save courses for a conversation with their Success Coach.

The showcase combines a Next.js chat interface, read-only tools over Neon PostgreSQL/pgvector, and a Python data pipeline. The existing Simple, Playful and Focus experiences share the same chat and planning tools.

## Start here

| Goal | Reading path |
|---|---|
| Run the app and its checks | [Frontend setup and architecture](apps/frontend/README.md) |
| Reproduce the data pipeline | [Data runbook](apps/data/REPRODUCE.md), [pipeline rationale](apps/data/EXTRACTION_MANUAL.md) |
| Review this showcase update and next decisions | [Executive decision sheet](docs/SHOWCASE_EXECUTIVE_DECISIONS.md) |
| Inspect measured behavior, issues and evidence limits | [Consolidated audit](docs/SHOWCASE_AUDIT_AND_CLEANUP_STRATEGY.md) |
| Understand the approved mascot implementation | [Playful mascots](docs/PLAYFUL_MASCOTS.md) |
| Contribute | [Contribution and branch conventions](CONTRIBUTING.md) |

## Supported demonstration

- Ask for one numbered semester or a published program plan; expand individual course details and elective requirements.
- Look up saved Fall sections with dates, available meeting times, instructors, campus and source links; group by day, professor, time or campus.
- Request every named instructor for a course/term; expand saved CV backgrounds with highlighted keywords.
- Save verified courses to local notes and inspect the printable summary.
- Search the student-resource corpus; recover possible related records when an exact lookup fails.

The [current tool registry](apps/frontend/lib/tools/registry.ts) is the executable capability list. Catalog and schedule cards display retrieved fields directly; explanatory prose remains model-generated. No new database schema or application dependency is introduced by the showcase update.

## Data and limits

The configured demo corpus contains the 2026–2027 catalog, published professional backgrounds, selected student resources and saved schedules. The approved Fall repair restores meeting facts for 12,872 existing sections from an August 12, 2026 snapshot. It does not establish present seat availability. Missing facts are labeled; related semantic matches are not an exhaustive directory.

Major cannot decide admission, transfer acceptance, graduation or awards. Planning checklists distinguish self-reported completion from in-progress, uncertain and pending-transfer courses. Remaining credits are calculated only when the published rules and reported history reconcile. Faculty expertise lists cover explicit evidence in indexed CVs, with all matches accessible. Official degree audits, automatic timetable construction and syllabus-policy answers remain outside this release. See the audit for scope and verification, including known source and model limitations.

Database setup and ingestion are separate from running the frontend. Historical schema/seed documents illustrate the original design; use the current [data runbook](apps/data/REPRODUCE.md) and [runtime schema](apps/frontend/lib/schema.ts) when reproducing the supported path. Use a separate development database for imports.

Keep credentials in ignored local `.env` files or platform secret stores. Raw source archives, database snapshots, paid-test traces and generated build output stay outside Git. Model and database configuration on Vercel must be verified separately before a presentation release.
