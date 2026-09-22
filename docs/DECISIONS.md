# Decisions

Append-only log of release-scoped decisions that would otherwise go stale in the README or get
lost in a closed PR. Newest first. Each entry is dated and says who decided, not an AI persona.

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
