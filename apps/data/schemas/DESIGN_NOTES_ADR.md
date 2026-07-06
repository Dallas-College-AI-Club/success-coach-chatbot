# Design Notes — Architecture Decision Records (ADRs)

Why the schema is structured this way. Each record: the decision, the reasoning, what it costs, and the trigger for revisiting it. New maintainers: read these before proposing changes — most "why don't we just…" questions are answered here. Format follows the standard lightweight ADR practice (context → decision → consequences).

---

## ADR-001 · LLM-first ELT: raw → extraction → thin core (not classic upfront normalization)
**Context.** Syllabi are wildly inconsistent prose (four samples: points vs percent grading, empty policy sections, project-only vs exam-only). Classic ETL would mean hand-coded parsers and a many-table normalized model designed before seeing all the variance. Team is students with high turnover; corpus is hundreds–low-thousands of documents per term.
**Decision.** Land every source immutably (`raw_documents`), let an LLM normalize each document into one validated JSON object (`extractions`), and keep only a *thin* relational core for the entities the chatbot joins on (terms/courses/instructors/sections) plus unnested `grading_components` for comparisons. Everything else stays JSONB, surfaced by views.
**Consequences.** (+) The messy work (canonicalizing "History Podcasters" → project, converting /1000 points to %) happens in one prompt, not in parser code. (+) The whole database is rebuildable from raw + code. (−) JSONB queries are slightly less ergonomic than columns; mitigated by the loader projecting hot fields into real tables.
**Revisit when.** Corpus exceeds ~50k documents or many concurrent writers appear.

## ADR-002 · Model-agnostic extraction: Claude now, local open-weight later
**Context.** The team has a Claude subscription through the mid-August MVP but may lose paid access in future semesters; cost-effectiveness is the standing constraint.
**Decision.** The extraction contract is (one JSON Schema) + (one versioned prompt) + (a provider setting). Every `extractions` row records `extractor`, `extraction_method`, `prompt_version`, `schema_version`. Raw text is retained forever.
**Consequences.** (+) Switching Claude → Ollama/Qwen is a config change plus a re-run; old and new outputs coexist and are diffable before flipping `is_current`. (+) The MVP batch can run inside a Claude Code session with no API key. (−) Local models will need the validate-retry loop tuned (2–3 attempts) and may need the 14B size for accuracy.
**Revisit when.** Never — this is the portability spine. If anything, tighten it.

## ADR-003 · Taxonomy as JSON-Schema enum, not lookup + junction tables
**Context.** v1 planned `assessment_types` + `syllabus_grading_components` junctions. The professor's guidance: let the LLM organize/realign content *before* it enters the structured store.
**Decision.** The controlled vocabulary (exam, quiz, homework, project, lab, participation, paper, presentation, final_exam, other) lives as an enum inside the extraction JSON Schema; the LLM maps raw labels into it at decode time. A CHECK constraint on `grading_components.canonical_type` enforces it a second time in-database.
**Consequences.** (+) Two fewer tables; identical GROUP BY comparability. (+) Changing the vocabulary = bump schema_version + re-extract, with a full audit trail. (−) Vocabulary changes require a re-extraction pass (cheap at this scale).
**Revisit when.** The vocabulary needs per-item metadata (descriptions, groupings) beyond a label — then a small lookup table returns for display only.

## ADR-004 · Plain SQL files + one loader script; no dbt, no ORM, no migration framework (MVP)
**Context.** v1 planned dbt-core + Drizzle Kit. Rotating student maintainers must be able to Google their way in; every extra tool is onboarding tax.
**Decision.** Numbered `.sql` files (schema, views, seeds) applied by `psql`/tiny runner; one ~150-line Python loader; GitHub Actions cron for orchestration.
**Consequences.** (+) A newcomer needs only SQL + basic Python. (+) Views are always-fresh; no materialization jobs. (−) No automatic lineage graph; compensated by DATA_DICTIONARY.md and DIAGRAMS.md.
**Revisit when.** Model count or contributor count grows enough that lineage/tests-as-config pay for themselves (rule of thumb: >20 SQL models or >5 regular contributors).

## ADR-005 · pgvector as an optional module, inside the same Postgres
**Context.** Section search/compare is pure SQL; only free-text policy Q&A needs semantic retrieval. Extension availability varies by future host.
**Decision.** `embeddings` ships as a separate optional SQL file guarded by `CREATE EXTENSION IF NOT EXISTS vector`; the core never references it.
**Consequences.** (+) The OLTP core is portable even to hosts without pgvector. (+) No second datastore to operate or sync. (−) If retrieval outgrows Postgres, it moves behind an interface later.
**Revisit when.** Chunks exceed low millions or vector latency hurts the app.

## ADR-006 · No student tables; personalization is session-context only
**Context.** The best questions are personal ("I'm in BAT Software Development taking these three…", "I got an A in ACCT…"). FERPA NFR: store the minimum, consent before persisting plans.
**Decision.** The schema stores nothing about students. The bot reasons over context the student types, then forgets. A consented `saved_plans` feature is deferred backlog.
**Consequences.** (+) Zero education-record liability in the database; demo-safe. (+) Radically simpler privacy story. (−) No cross-session memory; students restate context. (!) Chat *logs* will still contain self-disclosed grades — log redaction is a telemetry requirement owned by the chatbot layer.
**Revisit when.** The team is ready to build consent, retention windows, and student-visible data controls — not before.

## ADR-007 · Degree requirements are versioned by catalog edition
**Context.** Requirements change year to year; the live catalog (Acalog) is itself versioned by `catoid` (2026-27 = 5), programs by `poid`. A student's applicable requirements usually follow their catalog year.
**Decision.** `catalog_editions` is the root of Module 6; every plan/requirement/fulfillment row hangs off an edition; the bot cites the edition in every fulfillment answer (DP-013).
**Consequences.** (+) "Changing requirements" becomes new rows, never overwrites. (+) Historical answers stay reproducible. (−) Storage duplication across editions (trivial at this scale).
**Revisit when.** Never — un-versioned requirements would silently give wrong answers.

## ADR-008 · Treat Neon as vanilla Postgres; two touchpoints isolated
**Context.** Hosting may move to unknown school IT infrastructure.
**Decision.** Standard DDL/SQL only; the serverless driver stays behind a one-file adapter; branching is a dev/CI convenience nothing in production depends on. Exit = `pg_dump → pg_restore → repoint DATABASE_URL`.
**Consequences.** (+) Runs unchanged on RDS/Cloud SQL/Azure/self-hosted/Supabase. (−) Foregoes Neon-only features — deliberately.
**Revisit when.** IT mandates a non-Postgres target; then the dbt-adapter conversation from the original DATA_STRATEGY reopens.

## ADR-009 · Grade questions answered as fit-evidence, never probability
**Context.** Students will ask "where am I more likely to get an A?" No grade-distribution data exists (HB 2504 publishes syllabi, not grades), and the personas doc forbids grade guarantees.
**Decision.** The bot's system prompt reframes: match the *structure* of courses the student succeeded in (assessment mix, deadline style, attempt policies) to candidates, citing `grading_components`/`policies`. `section_grade_stats` is explicitly not built unless a real data source materializes.
**Consequences.** (+) Honest, schema-grounded, genuinely more useful than fake numbers. (−) Some students will want the number anyway; the bot explains why it can't.
**Revisit when.** Institutional research provides real distributions — then add the table *and* keep the no-guarantee language.
