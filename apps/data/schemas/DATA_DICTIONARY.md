# Data Dictionary & Data Map — Dallas College AI Chatbot (Schema v2.1)

**What this is.** The field-by-field map of the entire schema: where each value comes from (*Filled from*), which student questions or components consume it (*Answers / used by*), and why it exists at all (*Why*). Read alongside `schema_v2.dbml` (the model), `DESIGN_NOTES_ADR.md` (the why-this-architecture records), and `GAP_ANALYSIS.md` (the evidence).
**How to read "Filled from":** `scrape` = written by a fetcher script · `LLM` = produced by the extraction step (see `syllabus_extraction.schema.json`) · `loader` = derived by `load_extractions.py` · `staff` = maintained by humans (directory module) · `system` = defaults/derived in-database.
**Privacy:** every field is public data except where marked **PRIVATE** (registry: `field_visibility`). No file in this package contains actual emails or personal data — safe for the public repo.

---

## Module 1 · Pipeline

### raw_documents — the immutable landing zone (nothing here is ever edited or deleted)
| Field | Type | Filled from | Answers / used by | Why |
|---|---|---|---|---|
| id | bigserial PK | system | all lineage joins | stable identity for every fetched artifact |
| source_type | varchar | scrape | routing to the right extraction schema | one table serves 5 source kinds (schedule_csv, syllabus_html/pdf, bookstore_page, catalog_page); the type picks the parser |
| source_url | text | scrape | citations (DP-013), re-fetch, debugging | the bot must be able to cite where a claim came from |
| term_code | varchar NULL | scrape | scoping re-runs to one term | catalog pages have no term — hence nullable |
| fetched_at | timestamptz | scrape | freshness questions, audit | "when did we last check?" |
| content_hash | char(64) | scrape | change detection | a new row is written **only** when the hash changes — this is what makes re-scraping cheap and the table append-only |
| raw_text | text | scrape | LLM input; **re-extraction forever** | the single most important field in the schema: keeping full text means any future (better/cheaper/local) model can re-process everything without re-scraping — the anti-staleness insurance |
| raw_payload | jsonb NULL | scrape | structured raws (one CSV row) | CSV rows are already structured; storing them as JSON skips lossy text round-trips |
| is_latest | boolean | system | "current version" filters | older snapshots stay for history; queries default to the latest |

### extractions — versioned LLM output (the "T" of ELT, recorded like an experiment)
| Field | Type | Filled from | Answers / used by | Why |
|---|---|---|---|---|
| id | bigserial PK | system | lineage | |
| raw_document_id | FK | system | provenance | every extracted fact traces to a source document |
| extractor | varchar | pipeline config | audits, model comparisons | records *which model* produced the row (claude-sonnet-4-6 today, qwen2.5-14b next year) — mixed-model data can coexist because each row says what made it |
| extraction_method | varchar | pipeline config | audit | api vs claude_code_session vs local_ollama — the MVP batch may be run interactively with no API key |
| prompt_version / schema_version | varchar | pipeline config | reproducibility | change the prompt or the JSON Schema → bump the version → old and new outputs are comparable, never confused |
| extracted_at | timestamptz | system | freshness, run grouping | |
| status | varchar | validator | quality gate | ok / failed / needs_review; `confidence:"low"` from the LLM lands here for human review |
| data | jsonb | LLM | **everything downstream** | the canonical validated JSON; the loader and views read from here; GIN-indexed |
| validation_errors | jsonb NULL | validator | debugging failed extractions | keep the reasons, not just the failure |
| is_current | boolean | loader | "which extraction wins" | after a re-extraction beats the old one on the gold set, flip this flag — no data is deleted |

## Module 2 · Serving core (the tables the chatbot actually queries)

### terms
| Field | Type | Filled from | Answers / used by | Why |
|---|---|---|---|---|
| id / code / name | | loader | every schedule question | code (`2026SU`) is the natural key used across sources |
| year / season | int / varchar | loader | **offering-pattern history** (Q3) | season must be its own column so "offered in 3 of the last 3 summers" is a GROUP BY, not string surgery |
| start_date / end_date | date NULL | loader | term-window questions | |

### courses — the shared baseline (everything the same across sections lives here — that grain choice is what makes comparison nearly free)
| Field | Type | Filled from | Answers / used by | Why |
|---|---|---|---|---|
| subject_prefix / course_number | varchar | loader | all lookups; natural key | students say "HIST 1301", never an id |
| title / credit_hours | | loader | display, plan math | credit_hours feeds "how many credits am I short?" |
| description / state_outcomes | text | LLM→loader | "what's this course about?" | course-level by construction: identical across sections, written once, and — key design point — anything *not* stored here is automatically instructor-specific delta |
| requisites | text | LLM→loader | display fallback | verbatim sentence; the *structured* version lives in course_requisites (Module 6) |

### instructors
| Field | Type | Filled from | Answers / used by | Why |
|---|---|---|---|---|
| full_name | varchar | loader (from **schedule rows**) | professor questions | evidence rule: syllabi barely name instructors (see GAP_ANALYSIS Q8) — the schedule CSV is authoritative; syllabus-extracted names are a cross-check only |
| normalized_name | varchar unique | loader | dedup ("Ojeda, Carlos" = "carlos ojeda") | one professor, one row, across terms — required for teaching-history questions |
| email | varchar NULL | staff | contact hand-offs | public info (published on HB 2504 syllabi; team decision 2026-07-07) — visibility governed by field_visibility |
| department | varchar NULL | LLM (syllabus header) | "which department is this professor in?" | syllabus headers state it ("Physical Sciences Department"); optional FK to academic_units later |
| cv_url | text NULL | scrape | "professor's background" (Grace, DP-060) | TX HB 2504 requires faculty vitas be posted publicly — same repository as syllabi; PUBLIC by law, so safe to link |

### sections — the search spine (course × term × instructor)
| Field | Type | Filled from | Answers / used by | Why |
|---|---|---|---|---|
| course_id / term_id / instructor_id | FK | loader | **every** search & comparison | the three axes of "find me a class" |
| section_number | varchar | loader | natural key with course+term | |
| modality | varchar CHECK | LLM/CSV→loader | Hannah's online filter (DP-032) | online / in_person / hybrid |
| campus | varchar | loader | "which campus?" commute reasoning | |
| meeting_info_raw | text | scrape | fallback display, re-parse source | keep the verbatim string even after parsing — if the parser had a bug, the truth is still here |
| start_date / end_date | date | loader | **fast-track detection** | HIST §51 computes to 5 weeks from these two fields — no extra column needed |
| syllabus_url | text | scrape | citation link | |
| coreq_section_ref | varchar NULL | CSV→loader | section-pinned coreqs | the CSV proves these exist (e.g. `DMAT-0305-33403`) |
| raw_document_id | FK | loader | lineage | |

### syllabi — the instructor delta, one row per section
| Field | Type | Filled from | Answers / used by | Why |
|---|---|---|---|---|
| section_id / extraction_id | FK | loader | joins + provenance | rebuildable at any time from its extraction — this table is a *projection*, not a source of truth |
| modified_date | date | LLM | **staleness disclaimer** (DP-041) | "this syllabus was last updated 04/22/2026" — the personas complain syllabi update late; this field powers the honest caveat |
| withdraw_date / certification_date | date | LLM | deadline questions | "when's the last day to drop?" |
| instructor_outcomes | jsonb | LLM | outcome-overlap comparison | instructor-defined outcomes = the variable part (state outcomes live on courses) |
| course_schedule | jsonb | LLM | "what's due week 1?" | week/topic/dues as extracted; jsonb because structure varies wildly per professor |
| policies | jsonb | LLM | policy comparison — late_work, attendance, ai_plagiarism, extra_credit, makeup | comparing AI policies across sections turned out to be one of the highest-value answers (HIST automatic-zero vs ITSE lenient); also holds non-numeric grade rules like PHYS's 60%-lab-minimum gate |
| distinctive_features | jsonb | LLM | "what's unique about this section?" | LLM flags rarities (History Podcasters project, R-rated film list); cross-checked statistically by v_syllabus_distinctives |
| full_summary | text ≤120w | LLM | the bot's grounding text | one neutral paragraph per section the chatbot can quote from safely |

### grading_components — assessment mix, unnested for SQL comparison
| Field | Type | Filled from | Answers / used by | Why |
|---|---|---|---|---|
| syllabus_id | FK | loader | | |
| raw_label | varchar | LLM | display fidelity | keep the professor's own words ("Ready for Class", "History Podcasters") |
| canonical_type | varchar CHECK | LLM (enum) | **test-heavy vs project questions; all comparison views** | the taxonomy is a JSON-Schema enum the LLM must map into (exam, quiz, homework, project, lab, participation, paper, presentation, final_exam, other) — enforced twice: at decode time and by the CHECK. This replaced two lookup/junction tables (ADR-003) |
| weight_pct | numeric NULL | LLM (computed) | apples-to-apples weights | points-based syllabi (ACCT: /1000) are converted to percent at extraction so every section compares on the same scale |
| points / notes | | LLM | fidelity + nuance | notes keeps things like "unlimited attempts, highest counts" |

### section_meetings — parsed times/places (v2.1; one row per meeting block)
| Field | Type | Filled from | Answers / used by | Why |
|---|---|---|---|---|
| section_id / meeting_type | FK / varchar | LLM→loader | "when's the **lab**?" | lecture and lab are separate rows — PHYS meets 5–7 PM lecture + 7:10–9:10 PM lab in different buildings; 504/3,355 CSV sections embed a LAB block |
| days | varchar (MTWRFSU) | LLM | day filters | |
| start_time / end_time | time | LLM | **evening filter (Hannah), conflict checks (Q11)** | `start_time >= '17:00'` = evening; `(start,end) OVERLAPS` = schedule-conflict answer |
| campus / building / room | varchar | LLM | "where do I go?" + commute sanity | |
| *(no rows)* | — | — | online sections | absence is the signal; the extractor must emit an empty list, never invent times |

### campuses — code lookup for the seven Dallas College campuses (+ Online)
| Field | Type | Filled from | Answers / used by | Why |
|---|---|---|---|---|
| code | varchar unique | seed (db/seed_directory.sql) | joins from sections.campus | the schedule CSV speaks in codes (BHC, CVC, EFC, ECC, MVC, NLC, RLC, Online); sections.campus stays a plain code so scrapers never fail on a new one |
| name / city | varchar | seed (dallascollege.edu/locations) | "where is this campus?", commute reasoning in v_section_search | Brookhaven=Farmers Branch, Cedar Valley=Lancaster, Eastfield=Mesquite, El Centro=downtown Dallas, Mountain View=Oak Cliff, North Lake=Irving, Richland=North Dallas |
| address / url | varchar / text | seed / campus pages | directions, citations | url links the official campus page; address filled when needed |

### section_materials (v2.1)
| Field | Type | Filled from | Answers / used by | Why |
|---|---|---|---|---|
| section_id / component | FK / varchar | scrape | lecture vs lab materials | ITSE has two links (lecture + lab L1) |
| bookstore_url | text | scrape | "what books do I need?" (MVP: link out) | deterministic per-section URLs; honest MVP answer |
| items | jsonb NULL | scrape (post-MVP) | true textbook diffs across sections | filled only when bookstore scraping lands |

## Module 3 · Retrieval (OPTIONAL — core works without it)
### embeddings
| Field | Why |
|---|---|
| syllabus_id / chunk_ix / chunk_text | which text a vector represents; chunked so retrieval returns quotable passages |
| contact_id | second retrieval target (Issue #43): directory rows — chunk_text composes helps_with + unit scope + help_topics so free-form statements ("I can't make rent") resolve to the right category; exactly one of syllabus_id/contact_id per row (CHECK); secondary aid only — deterministic routing stays primary |
| embedding vector | pgvector similarity for free-text policy Q&A the SQL views can't answer |
| embed_model | recorded per row so re-embedding with a new model is auditable, mirroring `extractions.extractor` |

## Module 4 · Support-contact directory (Issue #43–#46 design, integrated as-is)
| Table | Purpose (one line each) |
|---|---|
| institutions / academic_units | who owns what: grants are managed **per school** (Issue #47 finding), so academic_units is the routing key; both carry a nullable unique `external_id` (stable key for syncing from an external authoring tool, Issue #43); seeds include a **"General / All"** unit — the college-wide fallback so routing never dead-ends |
| contacts | the humans; `last_verified_date` powers the quarterly steward check; email is public staff-directory info (team decision 2026-07-07); `external_id` (nullable unique) holds the external authoring tool's record id for idempotent sync (Issue #43) |
| resource_categories | grants / scholarships / financial_aid are *different offices* — the #47 interview's core finding; `routing_model` records "route, don't determine eligibility" |
| help_topics + assignment_topics | trigger words (rent, utilities, mental health, laptops) → surface emergency/support resources proactively |
| assignments | the routing table: contact × school × category × program; `external_id` (nullable unique) = Airtable record id for idempotent sync; `criteria` (free text) holds grant prerequisites the bot RELAYS verbatim when routing (FAFSA on file, declared program of study, program-specific rules) — never evaluated: "route, don't determine eligibility" |
| student_guidance | `prep_steps` ("FAFSA on file + declared program of study") and `awareness_msg` (the proactive onboarding line) — content the bot says verbatim |
| programs | legacy stub retained for directory compatibility; planning questions use Module 6 degree_plans instead |

## Module 5 · Governance
### field_visibility
| Field | Why |
|---|---|
| table_name / column_name PK | one row per governed column |
| is_public (default true) | the simple public/private registry; all current fields seed as public (directory + instructor info is published data, team decision 2026-07-07); any future private field is marked false here instead of redesigning the schema |
| notes | why a field is private, who approved |

## Module 6 · Catalog & degree plans (v2.1 — the DP-011/012/020 gap closer)
### catalog_editions
| Field | Why |
|---|---|
| catoid / year_label | the live catalog is Acalog, versioned by catoid (2026-27 = 5). Requirements **change by edition** — the user's own requirement — so fulfillment is never stored un-versioned |
| is_active / raw_document_id | which edition the bot cites by default; lineage to the scraped page |

### degree_plans
| Field | Why |
|---|---|
| catalog_edition_id + poid (unique) | each program is an Acalog poid page *within* an edition — the same program can differ across years |
| name / award_type | AA/AS/AAS/certificate/**bachelor programs** (BAT Software Development is just another poid) |
| academic_unit_id | plan → school → grant POC in one join (connects planning to the #47 directory) |

### plan_requirements
| Field | Why |
|---|---|
| degree_plan_id / group_name | requirement groups as the catalog states them ("American History", "Major Courses") |
| component_area_code | TX core Foundational Component Area code (010–090) when applicable — how "HIST-1301 fulfills American History" is encoded |
| credits_required / rule | numeric rule when simple, free-text `rule` when the catalog says something odd — never force prose into numbers |

### requirement_courses
| Field | Why |
|---|---|
| requirement_id + course_id PK | "does course X fulfill requirement Y in plan Z?" = one join — the schema's answer to the #1 P0 user story |

### course_requisites
| Field | Why |
|---|---|
| course_id / kind | typed edges: prerequisite / corequisite / tsi / other |
| requisite_course_id NULL | an FK when the requisite is a course (PHYS-2425 → MATH-2413, enabling DP-012 *chains*); NULL when it isn't (HIST's TSI Reading) |
| raw_text | the verbatim sentence always survives — structure is added, never substituted |

## Views (plain SQL — the comparison & convenience layer; no data of their own)
| View | Question it answers |
|---|---|
| v_section_search | "find all Fall 2026 HIST-1301 sections" — the hot path |
| v_course_assessment_profile | the per-course grading baseline: what % of sections use each assessment type |
| v_syllabus_distinctives | "what's unusual about this section?" — components rare (<0.34 share) within their course |
| v_section_compare | side-by-side grading mix + policies for one course/term |
| v_course_similarity | "are all sections basically the same?" — max weight spread per type; low = say so and save the student time |
| v_course_offering_history | "is it usually offered in summer?" — course × season × years (pattern + disclaimer, never a promise) |
| v_instructor_history | "is this professor new? what else do they teach?" — first term seen, courses, counts |
| v_section_conflicts (helper) | "do these sections overlap?" — the OVERLAPS pattern every recommendation ends with |

## Cross-cutting rules a new maintainer must know
1. **Raw is sacred.** Never edit or delete raw_documents; fix data by fixing the extraction or loader and re-running.
2. **The database is a projection.** syllabi/grading_components/sections can be dropped and rebuilt from extractions at any time; extractions can be rebuilt from raw_documents + code. That property *is* the turnover insurance.
3. **Never hand-edit core tables.** If a value is wrong, the prompt, schema, or loader is wrong — fix that.
4. **Nulls mean "the source didn't say."** ACCT-2301's late-work section is literally empty; the extractor must return null, and the bot must say "the syllabus doesn't state a late-work policy," never invent one.
5. **No student data, by design.** Personalized questions are answered from context the student types in-session; nothing about students is stored (FERPA-minimal). Log redaction of self-disclosed grades is a telemetry requirement, not a schema one.
6. **Every claim is citable.** source_url + catalog edition + syllabus modified_date exist so the bot can always say where and when a fact came from.
