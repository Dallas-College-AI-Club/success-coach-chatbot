# src/config

Repo-level JSON contracts shared by the data pipeline (`apps/data`) and the app
(`apps/frontend`). Readers are listed so a change here can be traced to the code it
governs. The frontend cannot import repo-root files without breaking `next build`, so
where it needs a value it copies it by hand; those spots are called out below.

## Facts schemas (`facts-schemas/`)

Wired = loaded by code today. Unwired = kept as the output contract for a doc_type
that `metadata-registry.json` already names but the pipeline does not extract yet.

| Schema | Status | Reader / reason kept |
|---|---|---|
| `facts-course-v1` | wired | `apps/data/dallasai/pipeline/extract.py:76` (`DOC_SCHEMAS`) |
| `facts-program-map-v1` | wired | `apps/data/dallasai/pipeline/extract.py:77` |
| `facts-syllabus-v1` | wired | `apps/data/dallasai/pipeline/extract.py:75`; the registry stores it inside a section row's `facts.syllabus`, not as its own row |
| `facts-cv-v2` | wired | `apps/data/dallasai/pipeline/extract.py:78`; `apps/data/dallasai/pipeline/verify_cv.py:46` |
| `facts-section-v2` | wired | `apps/data/dallasai/load_catalog_to_neon.py:87` (section facts validator) |
| `facts-section-v1` | unwired, kept | superseded by v2 (v2 is backward compatible); kept so `schema_version: 1` facts on older rows stay readable |
| `facts-cv-v1` | unwired, kept | superseded by v2; same reason |
| `facts-academic-calendar-v1` | unwired, kept | registry doc_type `academic_calendar` (term-scoped dates); no extractor yet |
| `facts-contact-v1` | unwired, kept | registry doc_type `contact` (module `contacts`); no extractor yet |
| `facts-event-v1` | unwired, kept | registry doc_type `event` (module `events`); no extractor yet |
| `facts-transfer-guide-v1` | unwired, kept | registry doc_type `transfer_guide` (degree planning); no extractor yet |

## Other files

| File | Status | Reader |
|---|---|---|
| `metadata-registry.json` | wired | `apps/data/dallasai/pipeline/extract.py:38`; every envelope's doc_type and extraction_method are checked against it before writing |
| `ai-prompts.json` | wired by hand | `apps/frontend/lib/system-prompt.ts:5` copies the refusal and redirect wording verbatim; change both together. `apps/frontend/lib/prompt-builder.ts:13` imports it, but nothing imports `prompt-builder` |
| `prompt-templates.json` | unwired | imported only by `apps/frontend/lib/prompt-builder.ts:14`, which has no importers |
| `runtime.json` | unwired | `apps/frontend/lib/constants.ts:42` mirrors `DISPLAY_TIMEZONE` by hand; `ACTIVE_CATALOG_YEAR` and `ACTIVE_TERM` are read by no code |
| `telemetry-event.schema.json` | unwired | documents the `chat_session.history` element; `apps/frontend/lib/schema.ts:169` cites it in a comment only |
