# September 25 townhall release candidate

Prepared September 24, 2026, from the latest GitHub main (`3178007`). Audience: about 200,
with a handful expected to try the public app concurrently. The audience URL is
https://major-demo-chi.vercel.app; a draft PR or staged deployment does not change it.

## Final pre-demo audit (September 24)

Latest GitHub main remains `3178007`; the task branch matched GitHub at audit start (`cf2aff3`).
The final pass reproduced and fixed:

- A coaching email made the 320px chat transcript 309px wide inside a 273px scrollport. Long
  words now wrap inside messages and cards; the retest has no horizontal transcript overflow.
- Removing the last saved section left an empty course on the prep sheet. Section-only entries
  now disappear when their final section is removed, while older catalog-only saves remain.
- Single-section and single-instructor headings incorrectly used plural wording.

Final local checks: **228 frontend cases** (179 business/UI, 11 request boundaries, 12 course-code
normalization, 26 sheet-question cases), lint, TypeScript, optimized build and the 52-file embedding
trace passed. **114 Python tests** passed. The current dependency scan reports **0 vulnerabilities**.

Browser coverage includes welcome, help, search/no-match recovery, changing styles mid-flow,
first-semester and schedule-fit handoffs, graduation wording, international incoming/returning,
dual-credit/back, transfer outbound/visiting/inbound, interest-area and nondegree routing, skipping,
resume and restart. The academic-calendar link loaded its 2026–2027 collection in the browser;
tutoring, Student Care Network and events links were checked against their official pages.

**72 chat layouts passed**: three styles × light/dark × six sizes × suggestions open/closed.
Sizes: 320×568, 390×844, 667×375, 844×390, 768×1024 and 1280×720. The composer remained visible,
Clear chat stayed at least 44px tall, the transcript retained at least 168px, and neither the page
nor transcript overflowed horizontally. Five sheet sizes passed with a long name and two notes.
Name and multiline-note edits survived refresh; removing the test note preserved the original.

Real interactions verified course disclosures, two completion checkboxes (12 credits remain and
both courses excluded), contextual update, schedule preview without losing the draft, all five
section groupings, expanding the remaining sections, instructor/CV disclosure, section save/unsave,
sheet course removal and return, 404 recovery and confirmed/cancelled chat clearing. An intentional
local-server outage produced the friendly error; Try again succeeded after service resumed.

**36/36 public model requests passed** on the pre-fix deployment (answer/retrieval code is unchanged):
planning with second completion/uncheck, evening/unknown times, tutoring, embedding-backed search,
5- and 10-request bursts, schedule counts, missing course, three coaching phrasings, prerequisites,
program comparison, instructor roster, faculty expertise, Spanish, missing program and transfer
review. No unavailable tool results or stream errors were observed. Independent database reads
confirmed 2 Fall ITDA 3320 sections and 93 MATH 1342 sections plus their saved meeting fields.
Four public boundary probes returned the expected 400/403/405 responses, and the QR redirected
to the audience site with HTTP 200. Model remains OpenRouter `openai/gpt-4.1-mini`, temperature 0.2;
the catalog and schedule snapshots are unchanged. Exact candidate/live verification is in the PR.

The shared daily counter was 195 of 1,000 requests when checked. Public limits remain 120 per
network/5 minutes, 300 globally/5 minutes and 1,000/day. This is not a 200-concurrent-user load test.
The production provider-key spending cap still requires account-owner confirmation; physical
phone keyboards, Safari and native Print/Save PDF pagination remain outside browser-emulation
coverage. These checks cannot guarantee every possible model answer or external-site response.

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

## Clear chat follow-up (September 24)

Added a visible Clear chat action beside Show suggestions. The confirmation defaults to Cancel,
works with Escape and keeps saved classes/sections, completion selections, onboarding choices
and sheet notes. Confirming aborts an active response and remounts a fresh conversation; old
messages, unfinished input and suggestion history are removed only from this browser tab.

Verification: 227 frontend checks (178 business/UI, 11 route, 12 normalization, 26 sheet), lint,
types, production build and embedding trace passed; 114 Python tests passed. A regression checks
that pending storage hydration cannot resurrect cleared messages. Browser checks passed 36
combinations: all three styles at 320×568, 390×844, 667×375, 844×390, 768×1024 and 1280×720,
with suggestions open/closed. No page overflow, visible composer, 44-pixel Clear chat target and
at least 168 pixels of conversation. Checked Cancel, Escape, default focus, confirmation at
320px, clearing while a request was pending, a successful next reply, clearing a completed
answer, refresh and sheet return. Existing MATH 1342 and ITSE 1370 sections, name and note stayed.
Physical-device and production spending-cap limitations below still apply.

## Verification and evidence

The subsequent schedule-preview update adds **View schedule** to course and program cards,
including named courses without catalog detail rows. It requests fresh sections, preserves the
unfinished question and focuses the result. Day/time/campus/instructor grouping and explicit
section saving reuse the existing cards. The audit covered ITDA 3320 (2 Fall sections), MATH 1342
(93), an absent course, stop/retry with a preserved draft, selecting a section, sheet refresh and
return. Independent database reads confirmed the section counts and meeting fields; the current
official MATH 1342 section 2 page confirmed Mon/Wed 10:25–11:45. Its current location text is more
specific than the saved campus tag, so the source link remains the authority for current details.

The course-level **Add to notes / Added to notes** button was subsequently removed at the
maintainer's request. **View schedule** is the course action; **Add section to notes** remains
on each schedule section. Existing saved courses, completion checkboxes and sheet removal remain
available. The existing rendering checks now guard this distinction.

The audit corrected an expanded instructor roster obscuring the schedule, unsupported flexibility
inferences from unparsed online meeting markers, and Stop reusing the Send button's DOM node and
submitting a preserved draft. All 18 measured style/size combinations passed again; preview and
section-save buttons provide at least 44-pixel targets. The focused four-request live suite passed
after those fixes. This update adds five frontend regressions; the final PR records deployment checks.

Suggested questions now start collapsed behind **Show suggestions** and can be closed with
**Hide suggestions**. Sending closes them automatically. All 36 open/closed combinations of the
same three styles and six sizes passed: no horizontal overflow, a visible composer and a 44-pixel
toggle. At 390×844, closing the three questions returns 144 pixels to the conversation. Keyboard
toggle/selection, draft preservation, hidden-question focus exclusion and automatic closing were
checked in the real browser. The choice starts closed again after a page reload.

Routine schedule previews and published program checklist lookups no longer repeat their cards
in a separate explanation. The generic "Major's explanation" heading is removed. Schedule-fit
questions, filters, prerequisites, recommendations, comparisons, resource answers and lookup
failures still show prose. The system prompt no longer asks for an unsolicited insight or a
routine coach closer. Four regression scenarios guard presentation, mixed/failed lookups and
unchanged stored history; the PR records the corresponding live browser and deployment checks.
All 18 style/viewport combinations passed with the streamlined replies. The real ITSC 1364
preview matched an independent database read (one Fall section, Hart at ECC, no parsed times),
and its work-schedule follow-up remained visible. A full Python checklist and its ITSE 1370
preview omitted recaps; saving section 3 retained both Friday meetings in the sheet. Returning
preserved the conversation and unfinished question. Four schedule API cases and three coach
contact cases passed locally using the unchanged model and source records.

The public suggestion check then exposed a coach-contact miss: "academic advising" returned
faculty biographies instead of the existing service record. Coaching/advising service searches
now read matching resource records directly, just as tutoring does. The saved August 21 record
was compared independently with the current official Success Coaching page (updated September
16): phone, email and Navigate agree. All three local contact/appointment phrasings returned that
resource and the correct contacts after the fix; the final PR records staged and public repeats.

Local model: `openai/gpt-4.1-mini` through OpenRouter, temperature 0.2. Live source checks used
the 2026–2027 catalog, program records scraped July 11, 2026, and Fall schedule evidence from
August 12, 2026. Source records and original catalog/schedule pages were checked independently.

- Frontend: lint, TypeScript, 177 business/UI regressions, 11 route-boundary checks, 12 course-code
  normalization cases, 26 sheet-question cases and an optimized production build.
- Data pipeline: 114 tests passed with Python 3.13. The first local attempt hit an inaccessible
  system temporary folder; rerunning with a fresh workspace test folder passed.
- Browser: 18 measured combinations of 3 styles and 6 sizes, from 320×568 to 1280×720,
  including 667×375 and 844×390 landscape. Chat and composer fit every measured viewport.
  With the collapsible controls, small-landscape transcript height is at least 183 pixels closed
  and 168 pixels open, compared with the original 8 pixels.
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
