# Decisions

Append-only log of release-scoped decisions that would otherwise go stale in the README or get
lost in a closed PR. Newest first. Each entry is dated and says who decided, not an AI persona.

## 2026-09-25 — Post-townhall branding and answer quality

The maintainer reported squeezed header logos and requested another UI and answer audit.
Preserve the artwork's native proportions in nonshrinking brand groups; phone preferences
wrap onto their own row and desktop controls share the header. Both onboarding and chat use
the same layout rules. The compact-height layout still reserves space for the conversation.

The real-answer pass reproduced an unassigned instructor being called "Professor To be
Announced", missing online times being described as "no fixed meeting times", and a course
correction producing an answer before refreshing its checklist. Normalize assignment
placeholders in cards, rosters and search excerpts, explicitly label missing meeting times
in model inputs, and refresh a known program first when the student reports a course status.
Keep original source records and saved conversations intact; no model or dataset changes.
The public prose check also generalized a recommendation across courses; explicitly scope each
recommendation to the course that records it. After a cached Vercel build mixed new markup with
old styles, require a cache-free release build and inspect the staged CSS before promotion.

## 2026-09-25 — Make elective controls reveal real courses

The maintainer reported that elective disclosures only repeated requirement text and broke into
single-word fragments on phones. Resolve explicitly named core areas and source-listed technical
choices into actual course rows with View schedule. Use the same catalog edition, preserve science
exclusions and technical pairings, and exclude fixed requirements across the entire plan even when
only one semester is requested. AAS humanities examples must come from its final choose-one block,
not the composition/speech requirements on the same source page. Do not infer courses behind AAS
XXXX placeholders; label the directly verified examples as partial and link to the full source.

Keep complete named-core lists searchable and show five rows initially. Titles with unavailable
course records remain course codes, with schedule lookup still available. Remove the generic
elective Show more control; put View course options on its own line, and link unresolved entries
directly to the catalog. Routine elective lookup recaps are redundant with these cards; advice and
mixed requests retain their answer. Saving still happens only on an actual section card.

## 2026-09-24 — Final student-perspective conversation audit

The maintainer requested another comprehensive audit and authorized fixes, commit and deployment.
A stopped answer retried after a status edit must preserve the newer edit. Store the retry-time
history after the repeated user text, retaining its original visible wording and normal precedence
for later student corrections. Free-typed next-course questions refresh the known program checklist;
otherwise an older reply can recommend an already completed class.

Keep suggestions on the latest successful program through conversational replies and failed lookups.
Do not offer nonexistent instructors after an empty schedule; carry the selected term forward.
Replace the opening's dangling invitation with directions to type or open Suggestions. Keep help
instructions aligned with View schedule, Add section to notes and the edit/reset controls.

A Spanish discovery response incorrectly translated the ingestion placeholder "none stated" into
"no prerequisites." Describe that placeholder as missing data and reinforce exact-record lookup.
Do not rewrite source facts, change the model, or expand the demo's datasets. Use one variable
Bricolage face for the sheet's heading weights after the two-weight font loader failed clean builds.
Sheet restart uses Next navigation after clearing the requested stores.

## 2026-09-24 — Related editing and removal audit

The maintainer requested fixes for all similar bugs. Save typed course corrections before waiting
for a model response, apply course lookup history as well as program history, and protect later
edits from stale replies. Negative enrollment and planning statements must not become positive
statuses. Duplicate additions point to the existing editor instead of silently resetting status.

Show all self-reported statuses on the prep sheet, allow removal of one saved section, remove a
deleted question's coach-selection flag, and scope hidden setup answers to the current setup.
Use an accessible, phone-sized confirmation for Reset prep sheet. Preserve catalog facts and
verified program requirements; the broader program-rule scan found no further capstone text
attached to unrelated elective rows.

## 2026-09-24 — Edit reported courses and restart setup

The maintainer requested course-history editing/removal, a discoverable form restart and a check
of the BAT American History elective. Add an editor from the checklist and the compact Plan options
menu beside Clear chat. Changes persist and use the same chronological planning path as checkboxes;
explicit removals override earlier completion statements. The prep sheet exposes the same editor
and per-course removal. Restart setup confirms its scope and keeps saved notes/courses by default,
with an explicit option to clear them. Reset prep sheet keeps onboarding choices.

The current official 2026–2027 BAT Software Development catalog (poid 3381) lists HIST 1301 in
semester 7 and a 3-credit American History elective in semester 8. Keep that valid core requirement.
The UI had repeated the semester's entire rule under each elective, including the unrelated ITDA
4350 capstone note. Match labeled elective rules to their own rows and retain other semester notes
at group level. No catalog/database facts or credit totals were rewritten.

## 2026-09-24 — Final demo audit fixes

The maintainer authorized a final audit, fixes, review by dbracewell and public deployment.
Long email addresses and URLs wrap inside chat replies rather than widening a phone transcript.
Removing the last section-only save removes its otherwise empty course entry; older independent
catalog saves (identified by their catalog source) remain. Other sections, notes and completion
choices are unaffected. Singular schedule/instructor labels use singular wording.

## 2026-09-24 — Clear chat without losing saved planning notes

The maintainer requested a visible Clear chat option. Place it beside the suggestions toggle
without consuming another phone row. Confirm before clearing this tab's messages, unfinished
question and suggestion history. Abort any active response and start with the profile's opening
message; preserve onboarding choices, completion selections, saved sections and sheet edits.
Reloading or returning from the sheet must not resurrect the cleared conversation.

## 2026-09-24 — One course action before choosing a section

The maintainer requested removal of the course-level **Add to notes / Added to notes** control.
Course cards keep **View schedule**, expandable details and completion checkboxes. Students save
an actual section from its schedule card. Existing saved courses remain available in the prep
sheet, where students can still remove them; this UI change does not rewrite saved notes.

## 2026-09-24 — Remove redundant reply text

The maintainer requested removal of schedule explanations that repeat the cards and a review of
other low-value text. Routine schedule previews and published course checklists now use cards as
the answer. Preserve actual advice, schedule-fit/filter answers, comparisons, prerequisites,
resource contacts and unsuccessful or mixed lookups. Unknown wording keeps its prose rather than
risk discarding an answer. Remove the "Major's explanation" wrapper; useful prose reads normally.
Stop prompting the model for unsolicited extra insights or a coach closer after every lookup.
Source links, dates, unknown-time labels and plan-review context remain with their relevant cards.

## 2026-09-24 — Success Coach contact retrieval

The maintainer-authorized audit found that the coach-contact suggestion could miss the existing
resource and incorrectly claim that contact data was unavailable. Like tutoring, Success Coaching
and academic-advising service searches now read matching resource records directly. Contacts stay
in the database; no contact facts or new datasets were added. Faculty-background searches retain
the broader search path. The saved August 21 resource and the current official page agree on the
phone, email and Navigate appointment resource.

## 2026-09-24 — Collapsible suggested questions

The maintainer requested open/close controls because suggested questions occupied too much of
the phone screen. Start closed behind **Show suggestions**, allow **Hide suggestions**, and close
after sending a question. Opening or closing does not modify the transcript or draft. In short
windows, the toggle and horizontally scrollable questions share one row to preserve chat space.

## 2026-09-24 — Preview a schedule before saving a class

The maintainer approved a visible **View schedule** action on every course card and publishing
the tested update to the demo. Reuse the existing schedule cards and day/time/campus/instructor
grouping for tomorrow's presentation. The action preserves unfinished input, requests fresh
section data and focuses the returned schedule. Viewing does not save a course or section;
students explicitly choose **Add section to notes** to retain the actual section and its meetings.
Empty saved results link to the official schedule. Broader filtering and a separate picker panel
remain after-demo work; do not fabricate independent day/time combinations.
The browser audit also exposed raw online day markers being described as daily availability.
Unparsed meeting text stays visible in source details but is omitted from model-facing schedule
results when no clock times were parsed. Instructor rosters expand only for the student's visible
instructor question, not because hidden scheduling instructions mention instructors.

## 2026-09-24 — Townhall readiness and printable notes

The maintainer approved audit tasks 1–5 and requested removal of two empty-schedule notices,
phone-friendly sheets, preserved chat on return and a clickable Success Coaching address.

- Persist chat in per-tab session storage and sheet edits in local storage. Closing the tab ends
  its recoverable chat; this is not a server account or cross-device transcript feature.
- Replace fixed chat-height subtraction with the available visual viewport. Compact landscape
  keeps the conversation and composer visible while follow-up chips scroll horizontally.
- Treat completed-course checkboxes as chronological student statements, including unchecks.
  Refresh remaining-course planning after changes. This supersedes the September 22 routing gap.
- Sign tool outputs and reject modified replayed evidence; bound request size and use shared Neon
  request counters. The campus-network allowance is 120/5 minutes; global limits are 300/5 minutes
  and 1,000/day. Apply `scripts/chat-request-budget.sql` before deploying to each configured database.
  Provider-key spending limits are independent and must be checked in the provider account.
- Upgrade Next.js to 16.3.6 and compatible locked dependencies to address the dependency audit.
- Keep unknown meeting times distinct from non-matching times. Removing empty-state notices from
  the printed sheet does not create missing section facts or establish enrollment eligibility.
- Draft the PR and stage a tested deployment. Peer approval remains required for merging; moving
  the public demo URL is a separate release action. Physical phone keyboards, Safari, native print
  pagination and unbounded model variations require checks beyond the automated browser matrix.

After the demo: assess authenticated result references, cross-tab data handling, automated source
refresh, longer-lived sessions and stronger operational controls using actual usage evidence.

## 2026-09-22 — Guided planning conversation (demo week)

- **Follow-up chips are deterministic.** After every reply the next three chips are chosen from that
  reply's finished tool results plus the student's profile, never from model prose and never with an
  extra model call. Cheap, and a chip can only offer a step the data can answer.
- **No "what jobs does this program lead to" chip.** Measured against the live records: program rows
  carry only name, award, credits and group names, with no career or outcome text (the only career
  wording in the corpus is co-op boilerplate in about 90 course descriptions). Such a chip would hit
  the ungrounded-records refusal. The undecided path uses award type, first-semester coursework, a
  deterministic comparison of two programs, and faculty expertise instead.
- **Reported-completion wording is load-bearing.** The "I've taken these, what's left?" chip sends
  "I have completed X and Y. Which courses in <program> are left, and what should I take this
  semester?" because the tool router requires a completion word AND a program word to force a fresh
  requirements lookup. Free-typed phrasings such as "what do I still need for my degree" can be
  answered from an older result in the transcript. Known gap; widening the router is a follow-up.
- **The student's bubble shows the question, not the steering prompt.** Chip prompts carry the
  program name and display instructions for the model; the transcript shows the chip's plain question
  and the model receives the full prompt.
- **Follow-scroll breaks only on reader intent, not on position.** The pane stops following when a
  scroll lands within 700 ms of a wheel, touch, pointer or key event on it, and resumes near the
  bottom. A position-only rule was rejected on evidence: a removed "Thinking…" row clamps scrollTop
  downward exactly like a reader scrolling up, which is what stranded long answers before. Native
  scrollbar drags in browsers that emit no pointer event for them (historically Gecko) can be
  snapped back mid-stream; a direction-plus-height-delta rule would fix that at the cost of more
  machinery than a Chrome-only demo warrants. Revisit if the app is used outside Chrome.

## 2026-09-20 — Showcase follow-up (issue #195)

The team completed the responsive Playful scene, section-note and dark-mode requests on the
merged #194 baseline. No schema, database content or model configuration changed. Full evidence
is archived at [archive/2026-09-20-SHOWCASE_EXECUTIVE_DECISIONS.md](archive/2026-09-20-SHOWCASE_EXECUTIVE_DECISIONS.md)
and [archive/2026-09-20-SHOWCASE_AUDIT_AND_CLEANUP_STRATEGY.md](archive/2026-09-20-SHOWCASE_AUDIT_AND_CLEANUP_STRATEGY.md).

- **Model:** `openai/gpt-4.1-mini` via OpenRouter, chosen for the best latency/quality/cost
  balance of the models compared (`GPT-OSS 20B`, `GPT-4.1 mini`, `GPT-5.6 Luna`).
- **Fall 2026 schedule data:** a facts-only repair matched 12,872 existing Fall sections against
  an August 12, 2026 snapshot by course, section and source URL; 6,520 have fully parsed meeting
  times, the rest retain source text. This was an approved database write, not a migration to
  rerun on merge.
- **Historical docs:** superseded handoffs and research were archived under `docs/archive/`
  with an index (this branch, 2026-09-22), rather than deleted.

### Still open (not decided)

These were raised for advisor decision on 2026-09-20 and remain open as of this writing:

- **Completed-course tracking and remaining-credit math** — deterministic planning state (build
  a validated completed-course set) vs. annotations-only (no automatic remaining-credit claim).
- **Faculty expertise search** — a source-backed evidence index with exhaustive enumeration vs.
  keeping the current qualified-candidate search.
- **Pipeline/schedule freshness** — a documented, safe refresh path vs. freezing the audited
  snapshot with no freshness promise.
- **Public operation and evidence trust** — server-side revalidation of tool facts plus
  rate/spend controls vs. authenticated result references.
- **Syllabus availability** — keep syllabus-specific answers unavailable for this showcase, or
  run a bounded ~20-document pilot first. The syllabus archive covers Spring 2024–Summer 2026,
  not Fall 2026.

## 2026-09-18 — Jobs refactored to the AI SDK (#188)

Tool-calling and chat streaming were moved onto the Vercel AI SDK's job/tool primitives,
replacing the earlier hand-rolled loop.

## 2026-07-14 — Chatbot name: "Major"

The front-end persona name became **Major**, replacing the earlier placeholder "Koa". The
governed system-prompt persona is unchanged; "Major" is UI copy only. See
[LANDING_ONBOARDING_UIUX.md §12](LANDING_ONBOARDING_UIUX.md#12-scope-and-planned-enhancements).
