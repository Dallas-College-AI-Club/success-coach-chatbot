# Success Coach — showcase review and decisions

**For Prof. David Bracewell · September 20, 2026 · [Issue #189](https://github.com/Dallas-College-AI-Club/success-coach-chatbot/issues/189)**

**Conclusion:** review the bounded demo repair now; keep broader planning/data changes in the next PR. The implementation makes existing records easier to discover, inspect and save. It preserves all three themes and integrates the separately approved mascot work. It does not make the chatbot an eligibility engine or a live registration system.

**Authorization:** the owner approved these fixes, GPT-4.1 mini, the reviewed Fall import, and creating a branch/commit/PR with `dbracewell` as reviewer. Merge and presentation deployment remain separate. Credentials, raw data, snapshots and paid-test traces stay local. Branch: `bugfix/189-showcase-demo-polish`, based on GitHub `main` at `1e87c578df87bb5880cff88c8e4a6ffd43676a1a`.

## This PR: what changed, why, and how

The first three rows preserve the owner's priority order. These are implemented changes, not requests for another round of implementation approval.

| Priority / audit decision | Problem and outcome | Implementation and rationale |
|---|---|---|
| **1 · Useful starter questions** | Buttons asked for unsupported schedule fitting or generated advisor questions. They now ask direct course-plan, prerequisites and tuition/resource questions; used questions retire. | Curated `{label, prompt}` pairs carry the verified program name. Follow-ups come from returned course records, follow course-list order and use the same saved calendar classification as the backend. No model call is needed to generate buttons. |
| **2 · Compact courses and notes** | Long answers hid course-save actions; semester headings and elective paragraphs were confusing. | Numbered course rows, strong semester headings, explicit semester filtering, credits, closed details and add/remove actions. Elective rules live inside the elective row's **Show more**. Stored descriptions/requisite wording and source links remain available; placeholders cannot be saved as real courses. Notes survive navigation and appear on the print sheet. |
| **3 · Broader recovery** | A failed exact lookup ended the answer without checking other available records. | The bounded tool loop requires one broad recovery after a failed exact course/program/schedule/instructor lookup. Reuse one embedding, search separately across document types, combine semantic and keyword matches, reject off-topic lookalikes, deduplicate sources and return up to six qualified candidates. Related results never establish exhaustive coverage. |
| **02-S · Actual schedules** | Distinct sections were merged by instructor and meeting facts were absent. | Term/year filtering, individual sections, totals and 100-row pagination; five rows initially visible, expandable remainder, grouping by day/professor/time/campus. Empty times mean unknown. Complete named-instructor enumeration is independent of the section page. |
| **05 · Instructor usability** | A who-teaches question could produce one biography; CV clicks appeared to do nothing. | Route course-title questions through discovery and then the schedule tool. Show every named instructor for the course/term, bold names, separate unassigned sections, and expand CV summaries inline. CV links use exact, unambiguous instructor keys; highlights mark literal phrases already present, not inferred expertise. |
| **04/07/09 · Necessary reliability repairs** | Calendar defaults caused tool errors; empty replies, eager embedding imports and cancellation degraded the demo. | Normalize provider-filled empty/zero calendar options, use Dallas civil dates, return useful limitations for invalid calendar queries, lazy-load the embedding runtime, propagate Stop to the provider, validate request shapes, allow official resource citations, retain an empty-reply retry and handle unavailable browser storage. |
| **09/10 · Reviewability and presentation** | Setup descriptions were stale and UI changes needed repeatable coverage. | Reuse existing route/tools/stores; one shared course-data module, one result-rendering module, one suggestion selector. No added dependency or schema migration. CI now runs lint and demo regressions. READMEs explain the actual execution path and limits. Playful loads the approved seven-mascot scene lazily; Simple and Focus remain available. |

## Evidence and acceptance boundary

| Check | Result / meaning |
|---|---|
| Deterministic frontend checks | 34 demo/boundary/mascot tests; 12 course-normalization and 26 sheet-filter cases. Covers scope, elective rules, pagination labels, complete rosters, CV highlights, source allowlist, provider defaults, cancellation and recovery. |
| Pipeline regression | 74 passed, 4 skipped; one existing Chroma deprecation warning. Skipped tests are not passes. |
| Database → tool | 216 Fall sections compared by source key, professor and date; 151 exact CV links checked. Python has 16 sections. ENGL 1301 has 942; two 100-row pages have no overlap, and every grouping preserves its loaded section set. Full instructor rosters independently matched all course/term rows, including later pages. |
| Current conversation run | 10 paid GPT-4.1-mini turns, including program → MySQL teachers → named CV → Python schedule → recommended prerequisite, missing-program recovery, expertise search, and three concurrent requests. All returned nonempty text without stream/tool errors; 1.8–4.3 seconds locally. This is a small smoke/load sample, not a capacity SLA or whole-corpus accuracy rate. |
| Actual browser | Semester 1 only; elective details beneath the elective; save course; all four named MySQL instructors plus TBA sections; calendar succeeds; inline CV and highlights; day/time/professor grouping; Simple/Playful/Focus controls. Print-sheet data and persistence are checked separately from native printer/PDF pagination. |
| Earlier breadth | 335 picker labels resolve; 263 projections from seven maps checked against stored fields; historical 202 conversational requests and 38,067 raw archive files reviewed. Historical failures remain in the audit rather than being relabeled as passing. |

Build, typecheck, lint, secret exclusion and GitHub CI are release gates; see the PR checks and the [final audit checkpoint](SHOWCASE_AUDIT_AND_CLEANUP_STRATEGY.md#final-review-checkpoint) for the completed run. No test proves absence of every possible model error. Generated explanations may still overstate missing prerequisites or flatten choice rules; structured records preserve their source wording. Broad CV discovery explicitly remains a candidate search, not a complete expertise directory.

## Approved Fall data repair

The owner explicitly approved a facts-only update to the configured Neon database. **12,872** existing Fall 2026 sections matched the supplied August 12 CSV by course, section and source URL. **6,520** have fully parsed times; **6,352** retain raw text without structured times, including **36** unparsed formats. Source text is preserved instead of inventing a schedule.

The import rechecked the before-state under row locks, updated facts/hash/timestamp in one transaction and independently compared all 12,872 facts/hashes afterward. Text, metadata and embeddings were unchanged. The before/proposed/result snapshots remain ignored locally. This database may serve the public app; the approved import is already applied and is **not** a migration to rerun on PR merge.

<a id="latest-local-fixes-and-model-decision--september-20"></a>

## Model decision and cost

The owner selected **`openai/gpt-4.1-mini`**. It is configured locally and in the credential-free example. Vercel's environment is not changed by this PR.

| Model through OpenRouter | Input / output per million tokens¹ | Two matched diagnostic questions | Illustrative 1,000 turns² |
|---|---:|---:|---:|
| GPT-OSS 20B | $0.03 / $0.13 | 26.5 / 14.7 s | $0.41 |
| **GPT-4.1 mini — selected** | **$0.40 / $1.60** | **2.9 / 2.8 s** | **$5.40** |
| GPT-5.6 Luna, reasoning disabled — alternative | $0.20 / $1.20 | 3.5 / 2.8 s | $2.90 |

¹ Historical September 20 [provider catalog](https://openrouter.ai/api/v1/models) snapshot; verify rates before future spend. ² Assumes a total 11,500 input and 500 billed output tokens across each turn's calls, before cache discounts. Six calls total, one per question/model: useful diagnosis, not statistical ranking. GPT-OSS spent 154–787 output tokens on reasoning. Scope filtering and omitting display-only descriptions reduced the first-semester program payload from 8,982 to 1,404 characters. A faster model cannot repair missing or incorrect source data.

## Next PR: advisor choices

For each decision, select A, B or Hold and enter conditions. **“Astra would” describes proposed implementation, not completed work.** Detailed original findings and all alternatives remain in the [consolidated audit](SHOWCASE_AUDIT_AND_CLEANUP_STRATEGY.md). None of these selections authorizes a production data write or deployment.

### 04 · Completed courses, prerequisites and comparisons

**Why:** conversational memory is not a reliable completion ledger; generated arithmetic can mishandle OR groups and double-count electives. Missing prerequisite fields do not mean no prerequisites.

**A — Recommended:** Astra would keep a validated completed-course set separate from raw catalog requirements, compute remaining exact codes and credit/choice constraints deterministically, and retain source wording plus required/recommended/unknown status. Render completed courses as completed rather than silently dropping requirements. Compare programs by exact set intersection and preserve alternatives. Add fixtures for repeated electives, OR/AND rules, missing requisites and topic switches. This fixes the decision logic without adding another model call.

**B — Smaller:** keep published plans unchanged and add explicit completed-course annotations supplied by the student; offer no automatic remaining-credit or eligibility claim. Lower implementation risk, less planning assistance.

- [ ] A — Deterministic planning state.  [ ] B — Annotations only.  [ ] Hold.

**Comments / acceptance cases:** ______________________________________

### 05 · Exhaustive faculty expertise search

**Why:** top-k embedding search cannot answer “every professor with ML/LLM experience” exhaustively. Complete course-instructor rosters in this PR solve a different, exact-query problem.

**A — Recommended:** Astra would build a source-backed expertise index from CV records: canonical instructor key, explicit quoted evidence, source URL and as-of date. Normalize reviewed synonyms; separate taught-course evidence from research/employment. Enumerate all matching keys with pagination and a declared coverage count. Validate positives and negatives against original CVs.

**B — Smaller:** retain qualified candidate search and inline backgrounds; never claim the result is complete. No new ingestion. This is the current release behavior.

- [ ] A — Evidence index and enumeration.  [ ] B — Candidate search only.  [ ] Hold.

**Comments / expertise vocabulary:** __________________________________

### 06 · Pipeline and schedule freshness

**Why:** saved schedules age; other terms lack meeting facts. The archive review also identified old alternate ingest paths, validation/quarantine gaps and term/section joining risks.

**A — Recommended:** Astra would retain one documented assemble → embed → validate → load path; disable unsafe legacy entry points; preserve dated source receipts; quarantine invalid rows; prove idempotence on a disposable database; test exact course+term+section keys. Reuse the reviewed Fall parser for new receipts only after source/schema checks, then request separate production import approval.

**B — Smaller:** freeze the audited snapshot, label its date and document unsupported terms; make no freshness or availability promise. No new imports.

- [ ] A — Reproducible refresh pipeline.  [ ] B — Frozen snapshot.  [ ] Hold.

**Comments / refresh owner and cadence:** ______________________________

### 07 · Public operation and evidence trust

**Why:** origin checks are not abuse protection; browser-supplied conversation/tool history should not become trusted academic evidence. These broader trust changes need their own review.

**A — Recommended:** Astra would revalidate relevant tool facts server-side, bound input/history/token budgets and add rate/spend controls. Validate profile fields as data, not instructions; keep sensitive text out of logs. Test forged history, oversized input and replay attacks.

**B — Alternative:** authenticate compact server-issued result references with expiry and bind them to the anonymous session; re-query expired records. Saves repeat lookups but adds signing-key/rotation and replay complexity. Both options still require public spend controls.

- [ ] A — Server revalidation.  [ ] B — Authenticated references.  [ ] Hold.

**Comments / public budget:** _________________________________________

### 08–09 · Presentation release and broader acceptance

**Why:** local success is not proof of the deployed commit, model, database, font/native-runtime packaging or cold-start behavior. Three concurrent requests are not a public-load target.

**A — Recommended:** after deployment approval, Astra would record the preview's SHA/model/data receipt and repeat the source-backed student journeys there. Test actual phone layouts, keyboard/screen-reader flows, native print/PDF pagination, cold retrieval, outages, cancellation and an agreed concurrency budget. Require named acceptance results rather than “all bugs fixed.”

**B — Smaller:** freeze an identified working release and perform the same critical manual journeys before the event; publish narrower claims and retain explicit unresolved limits. More manual effort for each release.

- [ ] A — Verified preview and release gates.  [ ] B — Frozen demo/manual gate.  [ ] Hold.

**Comments / date, devices, load target:** ______________________________

### 10 · Remaining developer documentation

**Why:** historical research, migration handoffs and current runtime documentation coexist. This PR corrects the entry points; reorganizing every old artifact would enlarge the release unnecessarily.

**A — Recommended:** Astra would label/archive superseded handoffs, fix internal links, index current evidence and preserve team attribution. Retain research as dated evidence rather than presenting mock results as production validation.

**B — Smaller:** keep the new README reading path and add status labels only; no file moves.

- [ ] A — Curate historical documents.  [ ] B — Index/labels only.  [ ] Hold.

**Comments:** ________________________________________________________

### 11 · Syllabus availability

**Why:** uploading files alone does not make grounded answers. The supplied syllabus archive covers Spring 2024–Summer 2026, not Fall 2026. Reliable extraction, exact joins and a query contract are missing from the active path.

**A — Recommended for this showcase:** keep syllabus-specific grading, textbook and workload answers unavailable; demonstrate catalog requirements, schedules and CVs instead.

**B — Bounded pilot:** Astra would first locate existing verified extracts, sample about 20 varied HTML/PDF/missing cases, validate substantive facts, quarantine failures and join exact course+term+section+instructor. Load only a disposable database and test source → extraction → tool → answer. Review quality/cost before expanding or approving any production import. Never borrow another term's grading policy without evidence.

- [ ] A — Keep unavailable.  [ ] B — Pilot only.  [ ] Hold.

**Comments / courses, terms, budget:** _________________________________

**Reviewer:** ____________________ **Date:** ____________________

**Approved next-PR IDs and conditions:** _______________________________

**Publication decision:** merge/deployment and new production data writes require separate authorization.
