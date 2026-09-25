# Decisions

Append-only log of release-scoped decisions that would otherwise go stale in the README or get
lost in a closed PR. Newest first. Each entry is dated and says who decided, not an AI persona.

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
