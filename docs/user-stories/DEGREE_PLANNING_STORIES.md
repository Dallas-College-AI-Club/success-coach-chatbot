# Degree Planning — User Stories & Acceptance Criteria

> Implementation-ready backlog for the **AI Chatbot / Degree Planning** MVP pillar.
> Intended repo path: `/docs/user-stories/DEGREE_PLANNING_STORIES.md`

---

## Document control

| Field | Value |
|---|---|
| **File** | `DEGREE_PLANNING_STORIES.md` |
| **Document type** | Sprint-ready user stories + acceptance criteria |
| **Status** | Draft for backlog grooming |
| **Version** | 1.1 |
| **Last updated** | June 17, 2026 |
| **Source persona doc** | `MVP_USER_PERSONAS.md` |

**Scope.** Degree Planning only. The original three-pillar concept (AI Degree Planning, Event Finder, Lost & Found) has been narrowed: **Event Finder and Lost & Found are out of scope** for this release. They appear here only as a *redirect* behavior (DP-052), never as implemented features. The task's "event has passed" edge-case example is therefore **N/A** for this pillar and is handled by out-of-scope redirection rather than event logic.

**How this document is organized (three parts):**
- **Part I — User stories**, grouped into six epics.
- **Part II — Cross-cutting requirements**: non-functional requirements and the conversation/hand-off state model.
- **Part III — Planning & traceability**: first-sprint slice, deferred backlog, and acceptance-criteria coverage.

---

## Conventions

**Personas** (from `MVP_USER_PERSONAS.md`):

| Key | Persona | Scope |
|---|---|---|
| **M** | Maria — First-Year Student | Primary |
| **J** | John — Transfer Student | Secondary |
| **H** | Hannah — Adult Online Learner | Secondary |
| **S** | Sean — International Student | Secondary |
| **G** | Grace — Straight-A Strategist | Post-MVP (deferred) |

**Priority tags** (map to the persona doc's MoSCoW): `P0` = Must (MVP-critical) · `P1` = Should (high value, often data-gated) · `P2` = Could (later).

**Estimates.** Story points on a Fibonacci scale (1, 2, 3, 5, 8, 13) — relative effort + uncertainty, not hours. Any story > 8 pts must be split before it enters a sprint.

**Labels.** `type:` feature | guardrail | infra · `area:` nlu | catalog | transfer | planning | syllabus | safety | ux.

**INVEST application.** Every story is **I**ndependent (dependencies named; cross-story coupling minimized), **N**egotiable (AC describe behavior, not implementation), **V**aluable (carries an `As a… I want… So that…` statement), **E**stimable (has a point estimate), **S**mall (≤ 8 pts; split-notes flag where a story is near the ceiling), and **T**estable (AC + concrete QA steps). INVEST is enforced at grooming via the Definition of Ready below.

**Definition of Ready (DoR).** Value statement present · AC written (checklist or Gherkin) · ≥ 1 persona referenced · estimate assigned · external data dependency identified and available (or stubbed) · no unresolved blocking dependency.

**Definition of Done (DoD).** Code merged behind automated tests · all AC pass · QA steps executed · edge/error paths handled · citations and disclaimers verified · telemetry event emitted (see Observability NFR) · accessibility checks pass (keyboard + screen reader) · privacy review for any new student-data field (see FERPA NFR).

---

## Glossary

| Term | Meaning |
|---|---|
| **NLU / Intent / Entity** | Natural-language understanding; the *intent* is what the user wants (e.g., requirement lookup); *entities* are the things referenced (course, program, school). |
| **Prerequisite / Co-requisite** | A course required *before* another; a course required *alongside* another. |
| **Articulation / transfer equivalency** | Official mapping of how a course at one school counts at another. |
| **Modality** | Course delivery mode: online, in-person, or hybrid. |
| **Catalog citation** | A reference to the official catalog section/source backing a claim. |
| **Hand-off** | Routing the student to a human (advisor, or DSO for F-1). |
| **DSO** | Designated School Official — international-office staff authorized to advise F-1 students. |
| **FERPA** | U.S. law protecting the privacy of student education records. |
| **Gherkin** | Given-When-Then syntax for executable acceptance scenarios. |
| **INVEST** | Quality checklist for user stories (Independent, Negotiable, Valuable, Estimable, Small, Testable). |

---

## External dependencies & assumptions

These gate delivery; confirm each at grooming. (Data readiness — not feature appeal — drives sequencing.)

| Dependency | Needed by | Status to confirm |
|---|---|---|
| Machine-readable catalog (requirements, prerequisites, course codes) | DP-010/011/012/020 — **most of the MVP** | **Blocking** — structured API vs. PDF/web |
| Articulation / transfer-equivalency data per partner university | DP-021/022 | Required for transfer stories |
| Historical syllabus repository (per course/section) | DP-040/041 | Required for syllabus intelligence |
| Schedule & modality data (per term) | DP-032 | Required for modality filter |
| Student context via institutional SSO (read-only profile) | personalized plans | Bot reads profile; **never** handles credentials |
| International-office (DSO) hand-off channel / contact | DP-050/053 | Confirm escalation path |
| Authoritative, signed-off F-1 "basics" copy | DP-050 | Legal/DSO sign-off on wording |

---

## Story index

| ID | Title | Persona(s) | Priority | Pts |
|---|---|---|---|---|
| DP-001 | Plain-language intent classification | M (all) | P0 | 5 |
| DP-002 | Streaming responses | M (all) | P0 | 3 |
| DP-003 | Clarifying-question flow for ambiguous input | M | P0 | 5 |
| DP-010 | Course-code & entity extraction | M, J | P0 | 5 |
| DP-011 | Degree-requirement lookup | M | P0 | 5 |
| DP-012 | Prerequisite check & chain | M, J | P0 | 5 |
| DP-013 | Source citations for catalog claims | M (all) | P0 | 3 |
| DP-020 | Degree-track pathway map | M | P0 | 8 |
| DP-021 | Associate-to-4-year transfer map | J | P1 | 8 |
| DP-022 | Transfer-equivalency check with disclaimer | J | P1 | 5 |
| DP-030 | First-semester plan generation | M | P0 | 8 |
| DP-031 | Multi-term course sequencing | M, J | P1 | 5 |
| DP-032 | Modality filter (online / evening / weekend) | H | P1 | 5 |
| DP-040 | Intent routing: catalog description vs. historical syllabus | M | P1 | 5 |
| DP-041 | Historical syllabus parsing with staleness disclaimer | M | P1 | 8 |
| DP-050 | F-1 good-standing basics + DSO deflection | S | P1 | 5 |
| DP-051 | Missing / stale catalog data fallback | M (all) | P0 | 3 |
| DP-052 | Out-of-scope redirection (events / lost & found) | M (all) | P0 | 2 |
| DP-053 | Advisor hand-off for high-risk / low-confidence | M (all) | P0 | 3 |

---

# Part I — User stories

## EPIC A — Conversational foundation
**Goal.** The bot understands plain-language input, responds responsively, and asks for clarification instead of guessing — the substrate every other epic builds on. *Serves: Maria (primary), all.*

### DP-001 — Plain-language intent classification
**Persona(s):** Maria (Primary), all · **Priority:** P0 · **Estimate:** 5 · **Labels:** `type:feature` `area:nlu` · **Dependencies:** none

**User story.** As a new student (Maria), I want to ask questions in everyday words without knowing course codes, so that I can get help even when I don't know the catalog's terminology.

**Acceptance criteria (Gherkin).**
```gherkin
Scenario: Recognize a known intent from natural language
  Given the chatbot is in an active session
  When I type "what classes do I need for my major?"
  Then the bot classifies the intent as "degree_requirement_lookup"
  And it retains the intent and extracted entities for the next turn

Scenario: Multiple intents in one message
  Given I type "what do I take first and is it online?"
  When the bot parses the message
  Then it identifies both "first_semester_plan" and "modality_filter"
  And it addresses the primary intent first, then offers to answer the second

Scenario: Confidence gating
  Given the top intent's confidence is below the answer threshold
  When the bot would otherwise respond
  Then it triggers a clarifying question (DP-003) instead of answering
```

**Edge cases / error paths.**
- Out-of-domain intent → route to DP-053 hand-off; never guess.
- Empty / gibberish input → friendly reprompt; no fabricated answer.
- Mixed in-scope + out-of-scope intents → answer in-scope, redirect the rest (DP-052).

**QA verification steps.**
1. Submit 20 labeled utterances; confirm ≥ 90% map to the correct intent.
2. Submit a dual-intent message; confirm both detected and correctly ordered.
3. Submit a below-threshold utterance; confirm a clarifying question (not a guess).

---

### DP-002 — Streaming responses
**Persona(s):** all · **Priority:** P0 · **Estimate:** 3 · **Labels:** `type:infra` `area:ux` · **Dependencies:** DP-001

**User story.** As any student, I want responses to stream as they generate, so that I get immediate feedback and the bot feels responsive.

**Acceptance criteria (checklist).**
- [ ] Tokens render incrementally; first token < 1.5s (p50) under normal load.
- [ ] A typing/loading indicator shows until the first token.
- [ ] The user can stop generation mid-stream; the partial answer is retained.
- [ ] If the stream fails mid-response, a clear error + retry control is shown.
- [ ] Streaming respects "reduced motion" accessibility settings.

**Edge cases / error paths.**
- Network drop mid-stream → partial text + "connection lost, retry?" control.
- Backend timeout → graceful error; no indefinitely stuck spinner.

**QA verification steps.**
1. Throttle network; confirm incremental rendering + indicator.
2. Cancel mid-stream; confirm partial text persists and a new prompt works.
3. Force a backend 500; confirm error + retry, no infinite spinner.

---

### DP-003 — Clarifying-question flow for ambiguous input
**Persona(s):** Maria (Primary) · **Priority:** P0 · **Estimate:** 5 · **Labels:** `type:feature` `area:nlu` · **Dependencies:** DP-001

**User story.** As an undecided first-year student (Maria), I want the bot to ask a short follow-up when my request is unclear, so that I get a relevant answer instead of a wrong guess.

**Acceptance criteria (Gherkin).**
```gherkin
Scenario: Missing required entity triggers one clarifying question
  Given I type "what classes do I need?"
  And no program/major is known for my session
  When the bot processes the request
  Then it asks exactly one clarifying question (e.g., "Which program are you aiming for?")
  And it does not return a course list until the program is provided

Scenario: Do not re-ask once answered
  Given I have already provided my program this session
  When I ask another requirement question
  Then the bot reuses the stored program and does not ask again
```

**Edge cases / error paths.**
- User declines to answer → offer a general/illustrative answer with a caveat, or hand off (DP-053).
- Multiple missing entities → ask the single highest-value one (one question per turn).

**QA verification steps.**
1. Ask with no program set; confirm exactly one clarifying question.
2. Provide the program, ask again; confirm no repeat.
3. Decline the question; confirm a caveated fallback, not a fabricated list.

---

## EPIC B — Catalog grounding & citations
**Goal.** Every factual answer is extracted from, and traceable to, the official catalog — the bot never fabricates requirements. *Serves: Maria (primary), John, all.*

### DP-010 — Course-code & entity extraction
**Persona(s):** Maria, John · **Priority:** P0 · **Estimate:** 5 · **Labels:** `type:feature` `area:nlu` · **Dependencies:** DP-001

**User story.** As a student (Maria/John), I want the bot to recognize the courses, programs, and schools I mention in plain language, so that it can act on what I mean without exact course codes.

**Acceptance criteria (Scenario Outline — data-driven).**
```gherkin
Scenario Outline: Resolve plain-language references to catalog codes
  Given the catalog contains "<code> — <title>"
  When I type "<phrase>"
  Then the bot resolves the reference to <code>
  And it confirms the resolved course in its reply

  Examples:
    | phrase                          | code      | title                        |
    | the first English writing class | ENGL 1301 | Composition I                |
    | intro to programming            | COSC 1336 | Programming Fundamentals I   |
    | college algebra                 | MATH 1314 | College Algebra              |

Scenario: Ambiguous reference
  Given my phrase matches more than one catalog course
  When the bot extracts the entity
  Then it lists the candidate matches and asks me to choose (DP-003)
```

**Edge cases / error paths.**
- No catalog match → state it can't find the course; offer to search by program (no guess).
- Misspelling → fuzzy-match and confirm before acting.
- Unsupported target university (transfer) → say so; link to the school's site.

**QA verification steps.**
1. Run the Examples table; confirm each phrase resolves to the right code.
2. Provide an ambiguous phrase; confirm a disambiguation prompt.
3. Provide a nonexistent course; confirm a no-match message, no fabrication.

---

### DP-011 — Degree-requirement lookup
**Persona(s):** Maria (Primary) · **Priority:** P0 · **Estimate:** 5 · **Labels:** `type:feature` `area:catalog` · **Dependencies:** DP-010, DP-013

**User story.** As a first-year student (Maria), I want a clear list of the courses required for a program, so that I understand what I need to complete.

**Acceptance criteria (checklist + Gherkin).**
- [ ] Returns the required-course list, grouped (core / major / electives), with credit hours.
- [ ] Each requirement is sourced (DP-013).
- [ ] A plain-language summary precedes the list (progressive disclosure).

```gherkin
Scenario: Requirements for a known program
  Given the catalog defines the "A.S. in Biomedical Engineering" requirements
  When I ask "what classes do I need for biomedical engineering?"
  Then the bot returns the grouped required courses with credit hours
  And it cites the catalog section the list came from
```

**Edge cases / error paths.**
- Requirements incomplete/missing → DP-051 fallback (state the gap, hand off).
- Discontinued program → say so; suggest the nearest active program.

**QA verification steps.**
1. Query a known program; confirm grouped list + credit hours + citation.
2. Query a seeded data gap; confirm the fallback message.
3. Query a discontinued program; confirm the correct notice.

---

### DP-012 — Prerequisite check & chain
**Persona(s):** Maria, John · **Priority:** P0 · **Estimate:** 5 · **Labels:** `type:feature` `area:catalog` · **Dependencies:** DP-010, DP-013

**User story.** As a student (Maria/John), I want to see a course's prerequisites, so that I take classes in the right order and avoid registration blocks.

**Acceptance criteria (Gherkin).**
```gherkin
Scenario: Direct prerequisites
  Given a course has prerequisites in the catalog
  When I ask "what are the prerequisites for this course?"
  Then the bot lists the direct prerequisites with citation

Scenario: Full prerequisite chain on request
  Given a course has multi-level prerequisites
  When I ask "show the full chain" (or accept the offer to expand)
  Then the bot returns the ordered prerequisite chain
  And it flags any co-requisites separately

Scenario: "One-of" prerequisites
  Given a course accepts any one of several prerequisites
  When the bot lists prerequisites
  Then it renders the alternatives as options, not a single required course
```

**Edge cases / error paths.**
- Circular/contradictory data → data-quality warning + hand off (DP-051/053); no infinite loop.
- No prerequisites → state "no prerequisites" explicitly.

**QA verification steps.**
1. Query a course with direct prereqs; confirm list + citation.
2. Expand to full chain; confirm order + co-req separation + "one-of" rendering.
3. Seed a circular prereq; confirm warning + hand-off, no loop.

---

### DP-013 — Source citations for catalog claims
**Persona(s):** all · **Priority:** P0 · **Estimate:** 3 · **Labels:** `type:guardrail` `area:catalog` · **Dependencies:** none

**User story.** As any student, I want to see where a requirement claim comes from, so that I can trust and verify the answer.

**Acceptance criteria (checklist).**
- [ ] Every requirement/prerequisite claim renders a citation (section + link/anchor where available).
- [ ] Citations are clickable and open the source.
- [ ] If a claim cannot be sourced, it is not stated as fact (defers to DP-051).

**Edge cases / error paths.**
- No URL/anchor → cite the catalog section name/version text at minimum.
- Conflicting sources → present the most recent and note the conflict.

**QA verification steps.**
1. For 10 requirement answers, confirm each claim has a working citation.
2. Remove a source for one claim; confirm the claim is withheld.
3. Confirm citation links resolve to the cited section.

---

## EPIC C — Degree & transfer pathways
**Goal.** Show end-to-end paths through a program and across institutions, with transfer answers always caveated. *Serves: Maria (pathways), John (transfer).*

### DP-020 — Degree-track pathway map
**Persona(s):** Maria (Primary) · **Priority:** P0 · **Estimate:** 8 · **Labels:** `type:feature` `area:planning` · **Dependencies:** DP-011, DP-012
**Split note:** candidate to split into (a) single-program sequence render and (b) decision-point / alternative-path annotations.

**User story.** As an exploring student (Maria), I want to see the full pathway for a degree track, so that I understand the sequence from start to completion.

**Acceptance criteria (checklist + Gherkin).**
- [ ] Renders the ordered pathway (terms/stages) for a chosen program.
- [ ] Ordering respects prerequisites (DP-012).
- [ ] Notes credit-hour totals and decision points (e.g., transfer vs. continue).

```gherkin
Scenario: Pathway for an associate track
  Given a program with a defined course sequence
  When I ask "show me the pathway for this associate degree"
  Then the bot returns the term-by-term sequence with credits
  And it marks the point where transfer-out is an option
```

**Edge cases / error paths.**
- Incomplete sequence → render what's known + DP-051 gap note.
- Multiple valid pathways → present the default; offer alternatives (DP-031).

**QA verification steps.**
1. Request a pathway; confirm ordered terms, credits, decision points.
2. Verify ordering never violates a prerequisite.
3. Seed a gap; confirm partial render + gap note.

---

### DP-021 — Associate-to-4-year transfer map
**Persona(s):** John · **Priority:** P1 · **Estimate:** 8 · **Labels:** `type:feature` `area:transfer` · **Dependencies:** DP-020, DP-022
**Split note:** candidate to split by (a) "courses that map" and (b) "remaining requirements at target."

**User story.** As a transfer student (John), I want to see how my associate degree maps to a target university's bachelor's, so that I take courses that will count and avoid wasted credits.

**Acceptance criteria (Gherkin).**
```gherkin
Scenario: Map associate courses to a supported target university
  Given articulation data exists for the target university (e.g., UT Dallas)
  When I ask "how does my A.S. map to a UT Dallas bachelor's?"
  Then the bot shows which DC courses map to target requirements
  And it shows remaining requirements at the target
  And every mapping includes a "verify with the target school" disclaimer

Scenario: Target university not supported
  Given no articulation data exists for the named school
  When I ask for a transfer map
  Then the bot states it can't confirm equivalencies for that school
  And it links to the school's transfer office
```

**Edge cases / error paths.**
- Partial articulation → show confirmed mappings; mark the rest "unverified — confirm with school."
- Outdated agreement → display the agreement date + staleness caveat.

**QA verification steps.**
1. Request a map for a supported school; confirm mappings + remaining reqs + disclaimer.
2. Request an unsupported school; confirm deferral + link.
3. Confirm no mapping is presented as a guarantee.

---

### DP-022 — Transfer-equivalency check with disclaimer
**Persona(s):** John · **Priority:** P1 · **Estimate:** 5 · **Labels:** `type:feature` `area:transfer` · **Dependencies:** DP-010

**User story.** As a transfer student (John), I want to check whether a specific DC course transfers to my target school, so that I don't take a course that won't count.

**Acceptance criteria (checklist).**
- [ ] Returns the equivalency (or "no known equivalent") for a course + target-school pair.
- [ ] Always appends a mandatory "verify with your target school" disclaimer.
- [ ] Never returns a definitive guarantee of acceptance.

**Edge cases / error paths.**
- No data → "can't confirm — verify with the school," plus hand-off (DP-053).
- Transfers as elective only (not toward major) → state the distinction.

**QA verification steps.**
1. Check a course with known equivalency; confirm result + disclaimer.
2. Check a course with no data; confirm deferral + hand-off.
3. Scan responses for any "guaranteed to transfer" language (must be absent).

---

## EPIC D — Semester planning
**Goal.** Turn requirements into a concrete, valid schedule the student can register from. *Serves: Maria (primary), John, Hannah.*

### DP-030 — First-semester plan generation
**Persona(s):** Maria (Primary) · **Priority:** P0 · **Estimate:** 8 · **Labels:** `type:feature` `area:planning` · **Dependencies:** DP-011, DP-012
**Split note:** candidate to split into (a) eligible-course selection and (b) load-balancing + rationale.

**User story.** As a new student (Maria), I want a suggested first-semester schedule, so that I can register with confidence.

**Acceptance criteria (Gherkin).**
```gherkin
Scenario: Generate a balanced first semester
  Given a chosen program and a target credit load
  When I ask "what should I take my first semester?"
  Then the bot proposes courses with no unmet prerequisites
  And the total credits fall within the requested load
  And it explains in plain language why each course was chosen
```

**Edge cases / error paths.**
- No load specified → assume a sensible default, state the assumption, offer to adjust.
- Too few eligible courses → return what's valid + explain the shortfall.
- Conflicting requirements → surface the conflict + hand off (DP-053).

**QA verification steps.**
1. Request a plan; confirm all suggested courses are prerequisite-eligible.
2. Confirm total credits respect the requested/assumed load.
3. Request an impossible load; confirm a graceful, explained partial plan.

---

### DP-031 — Multi-term course sequencing
**Persona(s):** Maria, John · **Priority:** P1 · **Estimate:** 5 · **Labels:** `type:feature` `area:planning` · **Dependencies:** DP-020, DP-030

**User story.** As a student (Maria/John), I want courses ordered across multiple terms, so that I follow a valid path to completion.

**Acceptance criteria (checklist).**
- [ ] Produces a term-by-term plan with no prerequisite violations.
- [ ] Balances credit load across terms within a stated range.
- [ ] Allows re-balancing (e.g., lighter term) and regenerates validly.

**Edge cases / error paths.**
- Summer toggle on/off → plan recomputes correctly.
- Course offered only in specific terms → respect offering windows if data exists; else flag the assumption.

**QA verification steps.**
1. Generate a multi-term plan; confirm zero prerequisite violations.
2. Toggle summer; confirm valid recompute.
3. Request a lighter term; confirm rebalanced, still valid.

---

### DP-032 — Modality filter (online / evening / weekend)
**Persona(s):** Hannah · **Priority:** P1 · **Estimate:** 5 · **Labels:** `type:feature` `area:planning` · **Dependencies:** DP-011

**User story.** As a working adult (Hannah), I want to filter courses by delivery mode and time, so that I can build a schedule around full-time work.

**Acceptance criteria (Gherkin).**
```gherkin
Scenario: Filter required courses by modality
  Given schedule/modality data is available for the term
  When I ask "which of these are available online?"
  Then the bot lists only the online sections
  And it warns that availability changes each term and links to the official schedule

Scenario: Modality data unavailable
  Given no schedule data is connected for the term
  When I ask for online options
  Then the bot states it can't confirm current modality
  And it links to the official schedule of classes
```

**Edge cases / error paths.**
- Hybrid courses → label clearly as hybrid (not "online").
- Section full → note availability is point-in-time and may change.

**QA verification steps.**
1. With data present, filter online; confirm only online sections + caveat.
2. Without data, confirm deferral + link.
3. Confirm hybrid sections are labeled distinctly.

---

## EPIC E — Syllabus intelligence (intent shift)
**Goal.** Distinguish "what the catalog says" from "what the course is actually like," and answer the latter from historical syllabi with clear staleness handling. *Serves: Maria.*

### DP-040 — Intent routing: catalog description vs. historical syllabus
**Persona(s):** Maria · **Priority:** P1 · **Estimate:** 5 · **Labels:** `type:feature` `area:syllabus` · **Dependencies:** DP-001, DP-010

**User story.** As a student (Maria), I want the bot to know when I want the official course description versus what the course is actually like, so that I get the right depth of answer.

**Acceptance criteria (Gherkin).**
```gherkin
Scenario: Route to catalog description
  Given I ask "what is this course about?"
  When the bot classifies the intent
  Then it returns the official catalog description with citation (DP-013)

Scenario: Route to historical syllabus
  Given I ask "what's the workload like?" or "what does this class actually cover?"
  When the bot classifies the intent
  Then it routes to syllabus analysis (DP-041), not the catalog description
  And it labels the answer as based on a past syllabus
```

**Edge cases / error paths.**
- Mixed ask → answer catalog first, then offer syllabus detail.
- No historical syllabus → fall back to catalog description + state it isn't available yet.

**QA verification steps.**
1. Submit description-intent phrasings; confirm catalog routing.
2. Submit "what's it really like" phrasings; confirm syllabus routing.
3. Remove the syllabus; confirm graceful fallback to catalog.

---

### DP-041 — Historical syllabus parsing with staleness disclaimer
**Persona(s):** Maria · **Priority:** P1 · **Estimate:** 8 · **Labels:** `type:feature` `area:syllabus` · **Dependencies:** DP-040
**Split note:** candidate to split into (a) parse + extract and (b) multi-section variation handling.

**User story.** As a student (Maria), I want a summary of what a course has historically covered (topics, assessment mix), so that I know what to expect before the new syllabus is posted.

**Acceptance criteria (checklist + Gherkin).**
- [ ] Extracts topics, assessment breakdown (exams vs. projects), and rough workload signals from the most recent available syllabus.
- [ ] Always states the term/year of the syllabus used and that the upcoming term may differ.
- [ ] Never presents historical syllabus content as the current/official requirement.

```gherkin
Scenario: Summarize the latest available syllabus
  Given the most recent syllabus on file is from a prior term
  When I ask what the course covers and how it's graded
  Then the bot summarizes topics and assessment mix
  And it prefixes the answer with the syllabus term and a "may change" caveat
```

**Edge cases / error paths.**
- Only an old syllabus exists → use it but make the age prominent.
- Syllabus unparseable/corrupted → state it couldn't read the file; offer the catalog description.
- Multiple sections differ → surface variation across professors (don't merge silently).

**QA verification steps.**
1. Parse a known syllabus; confirm topics + assessment mix + term label + caveat.
2. Provide a corrupted file; confirm graceful error + catalog fallback.
3. Provide two differing section syllabi; confirm variation is surfaced.

---

## EPIC F — Safety, guardrails & hand-off
**Goal.** Keep the bot honest and safe: never fabricate, always disclaim high-risk topics, and route to humans when appropriate. *Serves: all; Sean for F-1.*

### DP-050 — F-1 good-standing basics + DSO deflection
**Persona(s):** Sean · **Priority:** P1 · **Estimate:** 5 · **Labels:** `type:guardrail` `area:safety` · **Dependencies:** DP-001

**User story.** As an international student (Sean), I want general, published basics about keeping F-1 status, so that I understand the fundamentals — while being safely directed to the international office for anything specific.

**Acceptance criteria (Gherkin).**
```gherkin
Scenario: General F-1 basics question
  Given I ask "what do I need to keep my F-1 status?"
  When the bot answers
  Then it returns only general, published basics (e.g., full-time enrollment, document validity)
  And every F-1 answer ends with a disclaimer to verify with the international office (DSO)

Scenario: Personalized visa question
  Given I ask a case-specific question (e.g., "is MY situation okay?")
  When the bot detects personalized visa intent
  Then it does not give personalized advice
  And it routes me to the international (DSO) office (DP-053)
```

**Edge cases / error paths.**
- Ambiguous general-vs-personal → treat as personal (more cautious) and deflect.
- Mixed planning + visa → answer the planning part; deflect the visa part.

**QA verification steps.**
1. Ask a general F-1 question; confirm basics + DSO disclaimer present.
2. Ask a personalized visa question; confirm no advice + DSO hand-off.
3. Scan F-1 responses; confirm the disclaimer is never missing.

---

### DP-051 — Missing / stale catalog data fallback
**Persona(s):** all · **Priority:** P0 · **Estimate:** 3 · **Labels:** `type:guardrail` `area:safety` · **Dependencies:** DP-011, DP-013

**User story.** As any student, I want the bot to tell me when it doesn't have reliable data, so that I'm not misled by a confident but wrong answer.

**Acceptance criteria (Gherkin).**
```gherkin
Scenario: Required data is missing
  Given the catalog data for a request is missing or incomplete
  When the bot would otherwise answer
  Then it clearly states it can't fully answer and why
  And it offers a next step (advisor hand-off or official source link)
  And it does not fabricate the missing information
```

**Edge cases / error paths.**
- Partially missing → answer the known part, flag the gap explicitly.
- Stale data (older than the freshness window) → answer with a prominent freshness caveat.

**QA verification steps.**
1. Seed a data gap; confirm a clear "can't confirm" + next step, no fabrication.
2. Seed partial data; confirm partial answer + explicit gap flag.
3. Seed stale data; confirm the freshness caveat appears.

---

### DP-052 — Out-of-scope redirection (events / lost & found)
**Persona(s):** all · **Priority:** P0 · **Estimate:** 2 · **Labels:** `type:guardrail` `area:safety` · **Dependencies:** DP-001

**User story.** As any student, I want a clear answer when I ask about something the bot doesn't cover, so that I'm pointed to the right place instead of getting an improvised reply.

**Acceptance criteria (checklist).**
- [ ] Event-finder or lost & found requests are recognized as out of scope.
- [ ] The bot states these aren't part of this release and links to official Dallas College channels.
- [ ] The bot does not invent event listings or lost & found results.

**Edge cases / error paths.**
- Mixed ask (planning + event) → answer the planning part, redirect the event part.
- Note: the task's "event has passed" example is N/A here — events aren't implemented; the bot redirects rather than reasoning about event dates.

**QA verification steps.**
1. Ask "what events are on campus?"; confirm out-of-scope notice + official link, no fabricated events.
2. Ask about lost & found; confirm the same pattern.
3. Mixed ask; confirm planning answered + event redirected.

---

### DP-053 — Advisor hand-off for high-risk / low-confidence
**Persona(s):** all · **Priority:** P0 · **Estimate:** 3 · **Labels:** `type:guardrail` `area:safety` · **Dependencies:** DP-001

**User story.** As any student, I want to be connected to a human when the bot is unsure or the topic is high-stakes, so that I get reliable help and don't act on a risky guess.

**Acceptance criteria (Gherkin).**
```gherkin
Scenario: Low-confidence answer triggers hand-off
  Given the bot's confidence is below the answer threshold
  When it would otherwise respond
  Then it offers a hand-off to the appropriate human (advisor, or DSO for F-1)
  And it summarizes the question to carry into the hand-off

Scenario: High-risk topic always offers hand-off
  Given the topic is transfer acceptance or visa status
  When the bot answers within its allowed scope
  Then it still surfaces the relevant human hand-off option
```

**Edge cases / error paths.**
- Hand-off channel unavailable → provide official contact info as a fallback.
- Repeated low-confidence in one session → proactively suggest the hand-off.

**QA verification steps.**
1. Force low confidence; confirm hand-off offer + question summary.
2. Ask a transfer/visa question; confirm hand-off option present.
3. Disable the hand-off channel; confirm contact-info fallback.

---

# Part II — Cross-cutting requirements

## Non-functional requirements (NFRs)

These apply to every story; they are part of the DoD, not optional polish.

| Area | Requirement |
|---|---|
| **Performance** | First token < 1.5s (p50); full response < 6s (p90) under target concurrency. Degrade gracefully under load (queue/notice, never silent failure). |
| **Accessibility** | WCAG 2.2 AA: full keyboard operation, screen-reader labels on interactive elements, visible focus, respects "reduced motion" for streaming, sufficient contrast. |
| **Privacy & FERPA** | Student education records are protected under FERPA. Store the minimum needed; encrypt in transit and at rest; define a retention window; never expose one student's data to another; show students what is stored and why; obtain any required consent before persisting personalized plans. |
| **Security** | The bot never asks for or handles passwords/credentials (auth via institutional SSO). Sanitize input; resist prompt injection; rate-limit; redact PII from logs. |
| **Observability** | Emit a structured analytics event per turn (intent, confidence, hand-off?, citation-present?, fallback?). Errors logged without PII. Events feed the success metrics below. |
| **Internationalization** | Plain-English baseline now; architecture must not preclude future multilingual support (open question for Sean). |
| **Content safety baseline** | Cite the catalog; never fabricate; apply mandatory disclaimers (transfer, F-1/visa, grades/admissions); redirect out-of-scope; hand off on low confidence. (See `MVP_USER_PERSONAS.md` §8–§9.) |

**Linked success metrics** (from the persona doc): task completion, correct deflection (target 100% for personalized visa), plain-language success, citation click-through / helpfulness, scope adherence. Instrument stories so these are measurable from day one.

## Conversation & hand-off state model (complex logic)

The degree-planning analog of the task's "state changes" example. Each turn moves the session through a small, explicit state machine.

| From state | Trigger | To state |
|---|---|---|
| `Active` | clear, confident, in-scope intent | `Answering` |
| `Active` | ambiguous / missing entity | `Clarifying` |
| `Clarifying` | user supplies the missing entity | `Answering` |
| `Clarifying` | user declines / still ambiguous | `HandedOff` (or caveated answer) |
| `Answering` | answer delivered | `Answered` |
| any | low confidence or high-risk topic | `HandedOff` |
| any | out-of-scope (event / lost & found) | `OutOfScopeRedirect` |

```gherkin
Scenario: State transition on low confidence
  Given the session is in state "Answering"
  When the model's confidence drops below the threshold mid-resolution
  Then the session transitions to "HandedOff"
  And the bot offers a human hand-off with a summary of the question

Scenario: Out-of-scope short-circuit
  Given the session is in any state
  When the user asks an Event Finder or Lost & Found question
  Then the session transitions to "OutOfScopeRedirect"
  And the bot redirects to official channels without attempting an answer
```

---

# Part III — Planning & traceability

## Recommended first-sprint vertical slice

Ship a thin, end-to-end path that proves value and de-risks the core before breadth.

- **Sprint 1 (core loop):** DP-001, DP-002, DP-010, DP-011, DP-013, DP-051, DP-053
  → *"Ask in plain language → get cited degree requirements → safe fallback / hand-off."*
- **Sprint 2 (planning depth):** DP-003, DP-012, DP-020, DP-030.
- **Sprint 3 (breadth, data-gated):** DP-021, DP-022, DP-031, DP-032, DP-040, DP-041, DP-050, DP-052.

Sequencing is driven by **data readiness** (see External dependencies): nothing data-gated should enter a sprint before its source is confirmed or stubbed.

## Deferred / Post-MVP backlog (not for this release)

Tracked for later; intentionally **not** specced to sprint-ready depth. Serves Grace (Post-MVP) or "Could-have" enhancements.

| ID | Title | Persona(s) | Priority |
|---|---|---|---|
| DP-060 | Professor insights (style, reviews, textbooks, background) | G | P2 / Post-MVP |
| DP-061 | Per-course workload estimates | G | P2 / Post-MVP |
| DP-062 | Easy / well-reviewed class recommendations | G | P2 / Post-MVP |
| DP-063 | Scholarship / aid finder & deadline tracking | M, H | P2 |
| DP-064 | Career-fit guidance | H | P2 |
| DP-065 | Reverse-transfer optimization (DC courses → bachelor's) | J | P2 |
| DP-066 | Major-exploration "what-if" scenario comparison | M | P1 (next) |
| DP-067 | First-arrival & settling-in guidance (housing, DFW, SIM) | S | P1 (next) |
| DP-068 | Multilingual / plain-English simplification | S | TBD (open question) |

> **Guardrail for Post-MVP professor stories (DP-060/062):** never guarantee grades; present reviews as user-generated opinion and cite the source.

## Appendix — Acceptance-criteria coverage (this task)

| Required by the task | Where satisfied |
|---|---|
| INVEST framework on every story | Conventions (INVEST + DoR) · per-story value statement, estimate, dependencies, split-notes, AC, QA |
| `As a… I want… So that…` value statement | Every story header |
| AC via checklist or Gherkin (Given-When-Then) | Each story; Scenario Outline in DP-010; state-change scenarios in Part II |
| Complex-logic handling (e.g., state changes) | Part II — conversation/hand-off state model |
| Edge cases / error paths (incl. missing data; "event passed" N/A) | Per-story "Edge cases" · DP-051 (missing data) · DP-052 (events out of scope) |
| Cross-reference to personas | Per-story "Persona(s)" field · Conventions persona key |
| Effort estimates | Per-story "Estimate" + Story index |
| Priority tags | Per-story "Priority" + Story index |
| QA verification steps | Per-story "QA verification steps" |
| Focus: NL extraction of codes / prereqs / pathways | DP-010, DP-011, DP-012, DP-020, DP-021 |
| Focus: intent shift catalog → historical syllabi | DP-040, DP-041 |
| Industry best practice | NFRs (incl. FERPA/a11y), external dependencies, state model, first-sprint slice, glossary, labels, DoR/DoD |

---

*End of document.*
