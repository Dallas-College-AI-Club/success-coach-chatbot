# September 25 townhall release candidate

Prepared September 24, 2026, from the latest GitHub main (`3178007`). Audience: about 200,
with a handful expected to try the public app concurrently. The audience URL is
https://major-demo-chi.vercel.app; a draft PR or staged deployment does not change it.

## Changes

- Removed the two requested empty-schedule notices from the coach sheet. Kept actual section
  dates, published meeting text, sources and the Success Coach handoff. Linked the coaching URL.
- Made sheet headings, name entry, notes, links and action buttons fit phone widths. Printable
  names and multiline notes use wrapping text instead of clipped input fields.
- Preserved this tab's messages, question draft and recovery state through sheet navigation and
  refresh. Preserved sheet edits, question selections and removed recap answers in local storage.
- Reconciled checkbox changes, unchecks and typed corrections chronologically. Remaining-course
  requests read a new planning result; restoring an old answer cannot undo newer checkbox edits.
- Kept the chat and composer within the visual viewport in Simple, Playful and Focus, including
  short landscape windows. Compact follow-up choices can scroll horizontally.
- Clarified faculty follow-ups, removed unrelated default machine-learning topics, made school
  filtering respect contiguous query text, clarified skip/resume copy and disabled completed recap
  controls. Added a useful missing-page route and stopped-response recovery.
- Kept unknown schedule times distinct from non-matches. Scoped tutoring-service lookups to
  official resources after a live test incorrectly promoted faculty CVs as service information.
- Updated Next.js to 16.3.6 and compatible locked dependencies. Added bounded request parsing,
  shared expiring request counters and signatures that reject modified tool-result replay.

## Verification and evidence

The subsequent schedule-preview update adds **View schedule** to course and program cards,
including named courses without catalog detail rows. It requests fresh sections, preserves the
unfinished question and focuses the result. Day/time/campus/instructor grouping and explicit
section saving reuse the existing cards. The audit covered ITDA 3320 (2 Fall sections), MATH 1342
(93), an absent course, stop/retry with a preserved draft, selecting a section, sheet refresh and
return. Independent database reads confirmed the section counts and meeting fields; the current
official MATH 1342 section 2 page confirmed Mon/Wed 10:25–11:45. Its current location text is more
specific than the saved campus tag, so the source link remains the authority for current details.

The audit corrected an expanded instructor roster obscuring the schedule, unsupported flexibility
inferences from unparsed online meeting markers, and Stop reusing the Send button's DOM node and
submitting a preserved draft. All 18 measured style/size combinations passed again; preview and
section-save buttons provide at least 44-pixel targets. The focused four-request live suite passed
after those fixes. This update adds five frontend regressions; the final PR records deployment checks.

Local model: `openai/gpt-4.1-mini` through OpenRouter, temperature 0.2. Live source checks used
the 2026–2027 catalog, program records scraped July 11, 2026, and Fall schedule evidence from
August 12, 2026. Source records and original catalog/schedule pages were checked independently.

- Frontend: lint, TypeScript, 173 business/UI regressions, 10 route-boundary checks, 12 course-code
  normalization cases, 26 sheet-question cases and an optimized production build.
- Data pipeline: 114 tests passed with Python 3.13. The first local attempt hit an inaccessible
  system temporary folder; rerunning with a fresh workspace test folder passed.
- Browser: 18 measured combinations of 3 styles and 6 sizes, from 320×568 to 1280×720,
  including 667×375 and 844×390 landscape. Chat and composer fit every measured viewport.
  The small landscape transcript improved from 8 pixels to at least 184 pixels.
- Sheet: 320, 390, 667, 768 and 1280 pixel widths, no horizontal overflow; both requested notices
  absent with a saved course and a section without published clock times. Coaching link verified.
- Real return journey: course selection, checkbox edits, unfinished question, sheet name, multiline
  notes and coach-question selection survived sheet refresh and return. Chat history remained.
- Live planning: 18 → 15 → 12 → 15 remaining credits after completion, second completion and
  uncheck; fresh tool results at each step. Schedule response retained eight unknown-time sections.
- Small bursts: 5/5 and 10/10 real requests completed on repeat. An initial local run had one
  database connection failure; direct concurrent counter checks and the repeated burst passed.
  This is a small-burst smoke test, not sustained-load or 200-concurrent-user certification.

The audit/fix loop caught a SQL parameter type error, an unhandled “What courses remain?” wording,
restored-answer checkbox overwrite, missing retry state and stale test assumptions. These were
corrected and the affected checks repeated. Raw local traces and screenshots are intentionally
excluded from Git. Exact final verification, deployment URL and CI status belong in the draft PR.

Staging also exposed a deployment-only failure: Transformers 4.3 dynamically requires ONNX,
so the packager omitted its JavaScript package despite including the native binary. Explicit
runtime-file tracing and a post-build artifact check cover this dependency. A successful HTTP
response alone is insufficient: staged search must return actual results without `unavailable`.

## Release and remaining checks

Apply `apps/frontend/scripts/chat-request-budget.sql` to the deployment's database before use.
The local configured database has the table; a staged chat request must verify the deployment
can access it. No catalog or student records were modified by this migration.

Stage from the clean candidate commit using the frontend README. The existing rollback target is
https://major-demo-pgo0stiqn-ai-c64d.vercel.app (`dpl_CiPvKVK5NvsVs6EC1Rg63yaqThfp`).
Peer approval is required before merging. Promote only the approved, tested deployment, then
recheck the actual audience URL and QR redirect.

The local test key's existing $50 spending cap was verified and left unchanged. Vercel's secret
values cannot be pulled, so the production key's separate spending cap must be confirmed in the
provider account. No spending-cap increase is part of this change.

Before presenting: scan the actual projected QR on a physical phone; check iPhone/Safari and an
Android keyboard; preview the native Print/Save PDF output. Browser viewport checks do not prove
physical keyboard behavior or native pagination. The saved schedule is not live registration.
Model answers vary; passing these scenarios cannot establish that every possible response is flawless.

After the demo: review sustained usage and limits, cross-tab clearing/synchronization, authenticated
evidence references, transcript privacy/retention, source-refresh operations and broader device and
accessibility testing. Avoid adding new datasets or broad redesigns immediately before the demo.
