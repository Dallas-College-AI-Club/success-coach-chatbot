# Success Coach — showcase review and decisions

## Showcase follow-up · issue #195 · September 20, 2026

**Conclusion:** PR #194 is merged, including the six automated review fixes. This follow-up completes the owner's responsive scene, section-note and dark-mode requests on that merged baseline. No schema, database content or model configuration changes are needed.

| Change | Result and rationale |
|---|---|
| Review findings (already merged in #194) | Explicitly named SQL preamble strings remove ambiguous list concatenation; one import style per database/loader module removes duplicate test imports. Generated SQL remains identical to the committed baseline. |
| Coach printout | The shared D-bot replaces the official Dallas College logo. Starter questions save concise contextual wording; existing course-plan prompts are repaired on load without a model call. Schedule rows now offer **Add section to notes**. The sheet prints the selected section number, term, dates, meeting times, room, instructor and source instead of catalog descriptions. It preserves multiple selected sections and explicitly identifies missing times or an unselected section. |
| Playful scenery | Two small SVG layers separate the flexible meadow from individually scaled campus clusters. All seven campuses spread across the available width in verified west-to-east order with varied depth, trees and grounding shadows; buildings retain their proportions. Dallas landmarks include Reunion Tower. Grass, flowers and a lake fill the foreground. The scenery adapts around the existing chat position, which stays identical across themes. No new dependency or external runtime request. |
| Mascot movement and artwork | Characters scale with the viewport up to 128 px; narrow gutters and shallow strips no longer force tiny sprites. Tall windows split the cast between curved side-field and lower-meadow routes with different depths and species pacing. The sun is capped at 56 px; short windows retain side paths. Ground characters alternate walking and running and promptly cross fully concealed areas. The cast now shares Blazer’s cute, athletic illustration style with seven distinct expressions. Bear/Lion have short legs, Bear/Bee stronger facial features and Eagle an airborne pose. The Phoenix Sun combines a bird silhouette with curled solar flames and a 45-second east-to-west sunrise/sunset arc. Hidden-canvas drawing stops safely during layout changes. |
| Dark mode | All three themes follow the system preference through one shared CSS palette, including onboarding, dialogs, conversation text, sources, inputs and selected states. Landscapes dim while characters remain visible. No theme provider, new preference store or additional dependency is introduced. The coach sheet stays white for printing. |
| Major's explanation | Long explanations start expanded beneath structured course results and can still be collapsed by the student. Course and elective detail disclosures keep their existing behavior. |
| Multilingual invitation | Only the chat input hint follows supported browser language preferences, including Spanish, Korean, Vietnamese, Chinese, French, Portuguese, Arabic, Hindi and Urdu. Send/Stop, suggested questions and the rest of the interface retain their existing labels. English and unsupported-language fallbacks use the current theme’s hint; no translation request, preference store or dependency. |

**Verification:** 133 frontend checks, lint, TypeScript and production build pass. Python remains at 124 passed, four existing skips; the two previously edited Python files pass Ruff. Motion checks include four-minute collision simulations and ten minutes of directional sunrise/sunset cycles per viewport. Revised-artwork checks covered all seven blink poses, five window sizes and twenty hide/show actions with no repeated canvas errors. Five browser languages across three themes preserved English Send controls; Arabic used right-to-left input alignment. Local browser checks cover 1572×1272, 1034×1253, 1280×800, 390×844 and 844×390 layouts with seven characters, zero out-of-viewport drawings and zero detected visible overlaps. All three chat themes have identical measured geometry. System dark-mode checks cover the welcome page, selected options, program search, help dialog, all three chat palettes, real schedule results and a white coach sheet; rendered chat text and links remain high contrast. A live GPT-4.1-mini/Neon request returned all nine Fall ITSE 1303 sections; section 1's dates, lecture/lab times, room, instructor and link agree with the archived original Fall CSV and the saved printout. Saving two sections, reloading the sheet and removing only one preserve the remaining selection. Long explanations start expanded. Earlier catalog checks verified semester 1 of Accounting Assistant Certificate (18 credits; 30 for the full program), concise saved questions and checkbox behavior. Native printer/PDF pagination was not retested in this follow-up.

**Release status:** these follow-up changes are tracked by #195 and available in the local preview. PR #194 was merged while they were being prepared; the new branch starts at that merged commit. Its earlier release receipt identifies the existing public deployment; a Git push alone does not publish this update. Earlier decisions below record the original #190/#191 split. Syllabus work continues separately.

## Release ownership and merge order · September 20, 2026

**Decision:** ship fixes to the existing demo in **PR #190**. Build the follow-up for **issue #191** directly on that reviewed commit. Shared files may receive new capabilities in the follow-up, but existing-behavior cleanup is already part of #190. No database import, merge or deployment is included in this publication authorization.

| Ship with #190 | Keep in the #191 follow-up |
|---|---|
| Contextual onboarding starters; hide all starters after the first question; delete obsolete follow-up selector | Completed/in-progress/transfer history; conservative credit calculations; exact program comparison |
| Semester-only and range filtering; reject unavailable semester scope without substituting the whole plan | Required/recommended/concurrent prerequisite assessment against reported history |
| Full course/term instructor rosters after title discovery; saved-source dates; grouped sections, highlighted CV details | Exhaustive faculty expertise with AND/OR evidence, coverage and every matched source |
| Broad-recovery excerpts, valid course identifiers, correct 384-dimensional query embedding contract | Pipeline adoption of that contract, safe data loading, corpus gap proposals and reproducibility |
| Normalized/deduplicated saved notes, storage-denied handling, shared citation policy, removal of unused transcript code and unified frontend verification | No duplicate cleanup commits; only new capabilities and their regression coverage |

Publish #190 first; target its branch with the follow-up PR until #190 merges. If #190 is squash-merged, transplant only the follow-up commit onto updated `main`, then retarget and rerun checks. This avoids carrying the original #190 commits into a second review. Future changes on `main` still require a fresh conflict check.

### Current audit evidence

- Frontend: **78 checks for #190** (31 demo/mascot, 9 boundary, 12 normalization, 26 sheet-filter); **121 for the combined follow-up**. Both pass lint, TypeScript and production builds.
- Python baseline: **74 passed, 4 existing skips** for #190; **124 passed, 4 existing skips** for the follow-up. One existing Chroma deprecation warning remains. All **17 touched Python files** pass Ruff; a repository-wide probe found 157 existing lint findings in untouched legacy files, outside these PRs.
- Read-only Neon verification: **335 program choices**, first-semester scopes, **1,573 valid course records**, and **1,426 Fall sections** across MySQL, Python, College Algebra and Composition I. All pages and complete instructor rosters matched source records. No data was changed.
- Seven targeted #190 GPT-4.1-mini requests passed (2.1–7.5 seconds locally): program → MySQL roster → Python prerequisites → second semester; missing-course recovery; current-term title discovery; schedule-aware starter. An additional browser starter answered correctly. Model prose can still repeat a list inside its collapsed explanation; structured fields remain the source of truth.
- The final combined build also passed six paid conversation checks: two mixed course-history cases, visible clarification, complete MySQL schedule, unavailable semester 13, and broad recovery after an empty exhaustive-faculty search. Read-only comparisons rechecked all 337 saved plans and eight faculty searches across 2,709 indexed CVs.
- Browser: Playful onboarding, first-question starter removal, course disclosure, save-to-notes and print-sheet persistence; Simple/Focus/Playful at 390 px without horizontal overflow. The in-app browser did not open the print link's new tab; the same `/summary` page was verified directly. Native popup handling and printer/PDF pagination are not certified by this run.

Local evidence: `club-project/local/success-coach-pr190/apps/frontend/.tmp/190-{verify.log,data.json,chat.json}` and the existing #191 evidence described below. Initial test-harness mistakes and the inaccessible system pytest cache were corrected before successful final runs; they were not product defects.

## Next PR review — issue #191 · September 20, 2026

**Conclusion:** the approved planning, data-pipeline, corpus-reconciliation and faculty-search changes are implemented locally. **Item 2 (public-app protections) remains tabled. The owner authorized commits and PR publication after the audit. Merge, deployment and new Neon imports remain separate decisions.**

**Scope confirmed by the owner:** **05 — Exhaustive faculty expertise search is included in this PR. 11 — Syllabus integration is next PR**, using the saved testing/methodology materials in the owner's Dallas College AI Club “Project - Success Coach Chatbot” folder. No syllabus import or integration is included here.

**Local files:** credentials now live in `_minjoo_local-only/success-coach-chatbot.env.local`, outside the repository. Dependencies and audit evidence remain in the sibling `club-project/local/success-coach-chatbot` runtime copy, excluded from Git. The launcher uses the exact project configuration; obsolete shared/runtime credential copies were removed. References below to `.tmp` evidence are relative to that copy. Disposable attachments and caches were deleted from the source workspace.

[Issue #191](https://github.com/Dallas-College-AI-Club/success-coach-chatbot/issues/191) tracks this work on branch `bugfix/191-planning-data-integrity`. It is based on the updated PR #190 head. PR #190 is still open and requires review; this is a dependent follow-up. Keep the next diff based on #190 until it merges, then retarget after checking updated `main`.

| Approved item | What is ready and why | Method implemented / alternative | Decision & advisor comments |
|---|---|---|---|
| **Latest UI request · Starter questions** | Initial questions use the selected program, goal, schedule preferences, transfer direction/school, interest or single-course purpose. All buttons disappear on the first submitted user question, including typed questions. | Keep the existing onboarding handoff as the single source; delete the obsolete follow-up suggestion module. Schedule starters check one identified starting course and disclose missing times; unknown programs ask for clarification. Preserve Simple, Playful, Focus and mascots. **Alternative:** persistent follow-up buttons was rejected by the owner. | Owner requested; implemented<br>Comment: __________ |
| **1 · Planning accuracy** | Self-reported completed, in-progress, withdrawn, planned and pending-transfer courses stay distinct. Completed/in-progress rows leave the recommendation list, but in-progress credits remain unfinished. Requested semester scope is enforced. Prerequisites show separate required/recommended/concurrent/unknown evidence. Program comparison computes exact required-course intersections. | One pure `lib/planning.ts` module, used by tool output and UI, computes status/credit/choice results. Simple exhaustive equal-credit choices are capped and counted once. Unknown course titles, missing credits, overlapping or conditional choices return an unresolved total. Fresh tool routing prevents reuse of a differently scoped answer. **Alternative:** only show catalog checklists and omit remaining-credit calculations altogether. General degree-audit/eligibility inference is deliberately not implemented. | [ ] Approve code<br>[ ] Request revision<br>Comment: __________ |
| **3 · Reproducible backend** | New deliveries and queries use the same 384-dimensional MiniLM encoder. Setup never drops existing tables; status/export are read-only. Empty or invalid verification cannot pass. Missing or changed facts-only update targets roll back the whole transaction. | Shared model/dimensions/dtype/pooling/normalization contract; Python calls the existing frontend encoder. Hash the embedded text and require provenance before carrying vectors. Generate the fresh-database SQL from authoritative models. Fingerprint source bytes, identity/provenance, prompt, schema and extractor for safe resumes. Retire legacy write bypasses. **Alternative:** maintain a separate Python encoder plus cross-runtime parity tests; more maintenance and a second numerical contract. | [ ] Approve code<br>[ ] Request revision<br>Comment: __________ |
| **4 · Data completeness and freshness** | The archive gap is **86 real courses + 19 option pages**, not 105 missing enrollable courses. Another 15 indexed `XXXX` records are option pages. Proposals are extracted, source-checked, embedded and loader-validated locally. Schedule composition now includes meeting facts and preserves unknown formats/raw text; visible results show saved-source dates. | Read-only snapshot → deterministic reconciliation → reviewable supplements → separately approved import. Prepare **86 course additions and 34 option-page additions/reclassifications**. Preserve original July source dates; do not relabel them as newly fetched. **Alternative:** leave the live gaps visible and ship the audit tooling without importing proposals. | [ ] Approve code<br>[ ] Review proposed data import separately<br>[ ] Defer data import<br>Comment: __________ |
| **5 · Complete faculty expertise results** | Topic searches scan all 2,709 indexed CV records, with explicit AND/OR meaning, literal source evidence, source links, coverage dates, and every matching profile accessible through Show more. ML/NLP does not imply LLM expertise. | Dedicated evidence query over `raw_text`/`evidence` fields; no semantic top-k cap. Group repeated CVs only by matching name and education evidence, retain all sources, and disclose the exact keyword variants. UI shows 50 rows at a time without dropping results; model context contains counts and coverage, with names only for lists of ten or fewer to prevent a misleading partial list. **Alternative:** retain broad candidate search and explicitly decline exhaustive lists. The dedicated path avoids an embedding migration or inferred expertise labels. | [ ] Approve code<br>[ ] Request revision<br>Comment: __________ |

### Evidence and remaining decisions

- **Follow-up audit:** repaired a detached-database-field crash in the Fall repair builder; additional mixed-status parsing errors; unmatched course lists incorrectly allowing exact arithmetic; unknown-edition credit comparisons; legacy corequisite classification; and broad-search evidence cut off before the matching passage. Empty faculty searches now receive one broad recovery. Unresolved student history has a visible clarification request. Catalog imports require a known edition and preserve the actual catalog ID; schedule refreshes compare receipt instants correctly across timezones.
- **Simplification:** compile title aliases once per assessment, use indexed course/choice lookups, read schedule CSVs once, and reuse validated vectors whenever their actual text is unchanged. No source file or dependency was added for this follow-up audit. The status parser now passes **675 combinations** of 15 student phrasings and three conjunctions. All 12,872 Fall repairs validate in a new read-only rehearsal, including their reviewed hashes. All nine MySQL sections and four named instructors match the original CSV.
- **Final follow-up checks:** 12 new GPT-4.1-mini API requests exercised history corrections, program/course/faculty/schedule switches and zero-match recovery. The first schedule assertion used the wrong field; original results were independently verified and the corrected final four requests pass. Browser checks confirm the visible clarification, starter dismissal, expandable course evidence and all three themes at 390 px without horizontal overflow. Model prose still varies; the visible structured clarification and credit calculation are deterministic. The final source scan found zero matches for actual project secrets, zero staged files and zero ignored runtime artifacts in the source workspace.

- **Latest bug audit:** fixed mixed future/current history, hypothetical questions overwriting history, omitted prerequisite/support groups, nested concurrent-requisite labels, and full named checklists incorrectly narrowed by a contextual semester mention. Fixed stale extracted facts after a missing source, empty replay falling through to paid extraction, colliding catalog-year output identities, malformed embedding inputs, and missing concurrency guards on facts-only repairs. Faculty grouping now keeps source/date attribution deterministic; large model summaries carry counts instead of a partial name sample.
- **Latest real-data regression:** all **337 programs** and **1,573 valid individual-course requisite records** exercised. Six additional plans now reconcile after restoring prerequisite groups; original HTML confirms those groups and Medical Assisting's prerequisites. Eight read-only faculty queries agree with saved evidence: ML OR LLM **15 profiles / 17 CVs**, BOTH **1**, Python **28**, mathematics **292 / 293**, C++ **11**, cybersecurity **26**, nursing **145 / 146**, and an unsupported topic **0**. No matching source was lost. Seven new GPT-4.1-mini turns found the Medical Assisting scope bug; both final targeted retries pass after repair. Browser expansion reaches all 292 mathematics profiles.
- **Private configuration:** one active project file outside Git, loaded explicitly by the local launcher. It overrides inherited settings and clears unrelated database/Vercel aliases. A deliberately wrong inherited database URL still produced correct live answers. No local Vercel project link exists; deployment linking remains a separate action. Secrets, dependencies and audit traces are absent from the source workspace.

- **Automated checks:** **117 frontend checks** (79 demo/boundary/mascot/planning, 12 normalization, 26 print-sheet); backend **124 passed, 4 existing skips**. Lint, TypeScript and optimized build pass. Local checks and CI use the same `npm run verify` command.
- **Real conversations:** 13 production-mode GPT-4.1-mini turns, including a continuing eight-turn conversation and three concurrent independent requests. Correct Python-certificate totals change from **12 to 15 credits** after a withdrawal correction; semester 2 remains scoped to 9 credits. Exact comparison with Software Development A.A.S. returns **ITSE 1329, ITSE 1350, MATH 1314** (9 shared required credits). The current Fall Python schedule still returns all 16 sections. Fresh-session course-title history resolves, while an unidentified program prompts clarification.
- **Source agreement:** independent full-snapshot enumeration finds 17 ML/LLM CV records grouped into 15 profiles, or one profile for BOTH topics. All **28 displayed evidence excerpts** match the archived CV HTML. Mathematics returns 293 records grouped into 292 profiles; browser pagination reaches all 292. The read-only export reproduces 4,645 public records and 3,331 course/term schedule groups; no corpus facts/hashes changed during preparation.
- **UI continuity:** Simple, Playful, Focus, backgrounds and mascots remain. Expanded Python details distinguish recommended preparation and show reported history; saving a remaining course carries its description, requisite wording, credits and catalog source into the coach sheet. Elective and faculty explanations remain collapsible.
- **Additional stress audit:** a 35-turn sweep covers onboarding goals, combined/mixed course history, transfer clarification, topic switches, unavailable records and exhaustive faculty results; six follow-up turns and five targeted instructor/term regressions follow the fixes. Independent comparisons match **49 returned program groups, 126 course-detail records, six resource results and 48 schedule section rows** to saved data. Browser checks cover both clicked and typed first questions, disappearance during streaming and after completion, theme changes, elective expansion and notes. A recovered-search assertion initially checked the model's input instead of the server's executed scope; the saved output and a new live request confirmed broad recovery.
- **Bugs fixed in this audit:** uncertain/partially recognized history cannot earn credits; mixed completion statuses and rejected-transfer corrections remain separate; duplicate elective codes cannot earn duplicate credit. Schedule assembly preserves term identity and latest receipts. SQLite reruns update filters and rebuild search correctly; reconciliation does not propose already imported option pages again. A who-teaches title search must continue to the complete schedule after unambiguous discovery. Fresh, unspecified teaching questions default to the current Dallas term instead of a historical search snippet. CV highlighting now includes C++ and C#.
- **Whole-catalog check:** all **1,925 indexed course/program records** were checked against archived HTML. One stored title differs from its malformed printed heading (**MRKG 1366**); two description differences have existing documented source-typo adjudications. A false warning for noncredit headings was fixed. **41 program group sums need source interpretation**, often because groups contain tracks/alternatives; these are not 41 confirmed erroneous degree totals. All 337 programs were exercised; none of those 41 received an invented exact remaining-credit total. Details and review options are in the audit document.
- **Cleanup:** removed the unused suggestion selector, duplicated validation/imports, obsolete legacy execution paths and stale setup/testing instructions; refreshed touched Python formatting and resource cleanup. `CONTRIBUTING.md` now requires this review for every file touched going forward. No new dependency was added.
- **Schedule producer rehearsal:** all 12,872 Fall targets matched; 6,520 retain parsed times and 6,352 have no parsed clock time. All rows pass the v2 validator, including 158 unknown-modality records normalized to missing information. The 36 unparsed meeting rows retain their source text. This was a read-only rehearsal, not another import.
- **Data approval remains separate:** 86 course and 34 option-page proposals are in ignored local review artifacts. A code commit does **not** import them. Recheck target hashes and source identity before an approved upsert. **153 distinct section course codes still lack a catalog record after the proposed repair** across the saved terms; obtain matching official sources or keep details unavailable. This count is not 153 missing Fall sections.
- **Limits remain explicit:** course history is a conservative interpretation of student statements, not a transcript. Grade, placement, consent, transfer and complex elective eligibility require official review. The model's optional prose can still be verbose or phrase a recommendation awkwardly; structured categories and arithmetic are authoritative, and long explanations stay collapsed. Faculty completeness is within saved evidence and disclosed keyword variants, not every college employee or every experience in an unindexed source. Source snapshots are not live registration data. Fresh schema SQL and rollback behavior were checked without applying DDL to shared Neon; a disposable-database installation is still the deployment rehearsal.

**Owner decision checklist**

- [ ] Approve committing this reviewed code/docs diff.
- [ ] Hold the commit for the revisions noted above.
- [ ] Review the proposed data import as a separate decision.
- [ ] Keep Neon unchanged.
- [ ] Review MRKG 1366's exact printed title versus an explicitly annotated display normalization before any data correction.

**Advisor comments:** __________________________________________________________

The earlier showcase checkpoint below is historical to issue #189 / PR #190. Its then-deferred items are superseded only by the #191 scope above.

---

## Previous PR checkpoint — #190

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
