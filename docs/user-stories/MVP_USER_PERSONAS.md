# MVP User Personas
# Define user personas #6

> Dallas College AI Chatbot — **Degree Planning**. (Event Finder and Lost & Found are deferred and out of scope for this release.)

---

## Document control

| Field | Value |
|---|---|
| **File** | `MVP_USER_PERSONAS.md` |
| **Document type** | Product personas + MVP scope definition |
| **Status** | Baseline (v1.0) |
| **Version** | 1.0 |
| **Last updated** | June 17, 2026 |

### Version history

| Version | Date | Summary |
|---|---|---|
| 0.1 | Jun 17, 2026 | Initial four personas + first MVP scope. |
| 0.2 | Jun 17, 2026 | Sean moved to Secondary; reframed around relocation + F-1 basics. Added document control, glossary, MoSCoW scope. |
| 0.3 | Jun 17, 2026 | Marked Event Finder and Lost & Found excluded; added 3-module matrices, an out-of-scope persona, tone baseline, coverage appendix. |
| **1.0** | Jun 17, 2026 | **Focused the MVP on Degree Planning only**; removed Event Finder & Lost & Found from persona matrices (deferred). Added **Persona 5 (Grace, the Straight-A Strategist)** as **[Post-MVP / Out of Scope]** (Traditional or Transfer students) and moved the GPA/efficiency, easy-class, and professor-preference needs from Maria to Grace. Set baseline v1.0. |

---

## Table of contents

1. [How to read this doc](#1-how-to-read-this-doc)
2. [Glossary](#2-glossary)
3. [Overview & MVP thesis](#3-overview--mvp-thesis)
4. [Personas at a glance](#4-personas-at-a-glance)
5. [The personas](#5-the-personas)
6. [MVP scope (MoSCoW)](#6-mvp-scope-moscow)
7. [Data sources & integrations](#7-data-sources--integrations)
8. [Guardrails, safety & privacy](#8-guardrails-safety--privacy)
9. [AI tone & guardrail baseline](#9-ai-tone--guardrail-baseline)
10. [Success metrics](#10-success-metrics)
11. [Assumptions & open questions](#11-assumptions--open-questions)
- [Appendix A — Acceptance-criteria coverage](#appendix-a--acceptance-criteria-coverage)

---

## 1. How to read this doc

This document (1) describes **five user personas** for the Degree-Planning chatbot in one consistent template, and (2) turns them into a **buildable MVP** — what to build first, what to defer, what data is required, and the guardrails to respect.

Personas are **fictional but representative** decision-making tools. Each maps to a real **segment** the team can later size with enrollment data. Each persona's **MVP Matrix** maps them to the chatbot's degree-planning features using MoSCoW priorities (Must / Should / Could / Won't).

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **MVP** | Smallest release that delivers real value and validates the core idea. |
| **MoSCoW** | Prioritization: Must / Should / Could / Won't have. |
| **JTBD** | Job To Be Done — the goal a user "hires" the product for. |
| **Modality** | Course delivery: online, in-person, or hybrid. |
| **Articulation / transfer equivalency** | Official mapping of how a course at one school counts at another. |
| **TSI** | Texas Success Initiative — college-readiness assessment. |
| **F-1** | Primary student visa for full-time U.S. academic study. |
| **DSO** | Designated School Official — staff authorized to advise F-1 students; based in the international office. |
| **I-20 / SEVP** | F-1 eligibility certificate / the federal program overseeing F-1 rules. |

---

## 3. Overview & MVP thesis

**Problem.** Students struggle to understand degree requirements, plan their semester, and avoid costly mistakes (wrong courses, lost credits, visa missteps). Official tools — catalog, Workday, scholarship pages, late syllabi — are fragmented and written in institutional language.

**Scope.** This MVP is the **AI Chatbot for Degree Planning** only. Event Finder and Lost & Found were considered earlier and are **deferred** (out of scope this release) to keep engineering focused and prevent feature creep.

**Thesis.** A chatbot that answers planning questions in plain language, grounded in the official catalog, removes the biggest friction — "What do I take, and in what order?" — while handling high-risk topics (transfer, visa) through disclaimers and human hand-off. Concentrating the MVP on this single module sharpens its value and protects the timeline.

---

## 4. Personas at a glance

| Attribute | Maria | John | Hannah | Sean | Grace |
|---|---|---|---|---|---|
| **Segment** | Traditional (new) | Transfer | Lifelong / certificate | International (F-1) | Traditional or Transfer (high-achiever) |
| **Scope** | **Primary** | Secondary | Secondary | Secondary | Post-MVP |
| **Distinctive need** | First-semester basics & major exploration | Transfer-credit mapping | Online certificate, flexible schedule | Relocation + F-1 compliance | GPA optimization (professors, workload) |

---

## 5. The personas

Template: **Scope Status & Segment → Archetype → Background → Core Goals & Frustrations → Needs from the chatbot → Example questions → MVP Matrix.** The MVP Matrix lists degree-planning features and their MoSCoW priority.

---

### Persona 1 — Maria, the First-Year Student
**Scope Status: [MVP Primary Target]  ·  Segment: Traditional student (Freshman / Sophomore)**

**Archetype.** A new associate-degree student, open to summer courses, still exploring her major.

**Background.** Maria just enrolled and doesn't know course codes or how to read the catalog. She hasn't picked a major but knows her interests. She wants a clear, efficient path that clears the common requirements for an A.S. in Biomedical Engineering — keeping open the options to transfer to UT Dallas or finish a Dallas College bachelor's (BAS in Management + Python certificate, or BAT in Software Development). She mainly needs help understanding requirements and planning her first semester in plain language.

**Core Goals & Frustrations.**
- *Goals:* understand degree requirements; plan a realistic first semester; ask in everyday language without course codes; explore interests and keep options open while undecided on a major; find advisors and scholarships for her path.
- *Frustrations:* doesn't know course codes; overwhelmed by prerequisites and catalog jargon; needs fast, simple guidance; syllabi update right before the term; scholarship pages are separate from Workday.

**Needs from the chatbot.** Plain-language, code-free Q&A with catalog citations; recommend the right courses and a first-semester schedule; run simple "what-if" plans for an undecided major; ask clarifying follow-ups.

**Example questions.**
- "What classes do I need for my major?"
- "What should I take my first semester?"
- "Can you help me pick 2–3 classes to start?"
- "I don't know the course codes — explain it simply?"

**MVP Matrix.**

| Feature | How Maria uses it | Priority |
|---|---|---|
| Degree Planning | Finds required courses and builds a first-semester schedule | Must |
| Plain-language Q&A + catalog citations | Asks without codes and trusts the answer | Must |
| Major-exploration "what-if" scenarios | Compares paths while undecided | Should |
| Scholarship / grant finder | Tracks funding for her intended path | Could |

---

### Persona 2 — John, the Transfer Student
**Scope Status: [MVP Secondary Target]  ·  Segment: Transfer student**

**Archetype.** Moves credits between Dallas College and a 4-year university — both directions.

**Background.** Two situations: **(A) Outbound** — John finished a Mechanical Engineering associate and plans to transfer; he needs to know which credits transfer and what to finish first. **(B) Reverse** — after transferring, he wants cheaper summer/evening classes at Dallas College that count back toward his bachelor's.

**Core Goals & Frustrations.**
- *Goals:* know which Dallas College courses the target university (e.g., SMU, UT Austin, UNT) accepts; understand which credits to complete before transferring.
- *Frustrations:* unsure which courses will be accepted; wrong choices can delay graduation.

**Needs from the chatbot.** Identify likely-transferable courses and what to finish first; show remaining credits; always disclaim to verify with the target school; suggest an advisor when unsure.

**Example questions.**
- "Which of my courses transfer to SMU / UT Austin / UNT?"
- "Do I need to retake any classes?"
- "How many credits do I still need?"

**MVP Matrix.**

| Feature | How John uses it | Priority |
|---|---|---|
| Degree Planning | Plans remaining and required courses | Must |
| Transfer-equivalency check | Sees whether a course transfers | Should — only if data is reliable; else guidance + verify disclaimer |
| Reverse-transfer guidance | Counts Dallas College courses back toward a bachelor's | Could |

> **Build note.** If reliable articulation data isn't available at launch, ship John's flow as *guidance + mandatory verification*, not a definitive "yes, it transfers."

---

### Persona 3 — Hannah, the Adult Online Learner
**Scope Status: [MVP Secondary Target]  ·  Segment: Lifelong learner / certificate (works full-time)**

**Archetype.** A working adult who needs flexible, mostly-online classes.

**Background.** Hannah is pursuing a Business Administration certificate and needs evening/weekend/online options. She wants to confirm the certificate fits her career and find aid.

**Core Goals & Frustrations.**
- *Goals:* know required courses; find online evening/weekend sections; build a realistic schedule around full-time work; confirm the program fits her career.
- *Frustrations:* can't attend many in-person classes; online sections aren't always offered; needs clear, practical answers.

**Needs from the chatbot.** Show required courses and modality (online / in-person / hybrid); warn that availability changes each term; link to the official schedule.

**Example questions.**
- "What courses do I need for the Business Administration certificate?"
- "Are these available online?"
- "What should I take if I work full-time?"

**MVP Matrix.**

| Feature | How Hannah uses it | Priority |
|---|---|---|
| Degree Planning | Finds required certificate courses | Must |
| Modality filter (online / evening / weekend) | Finds classes that fit work | Should — needs schedule data; else link to schedule |
| Career-fit guidance | Confirms the program | Could |
| Scholarship / aid finder | Funds the certificate | Could |

---

### Persona 4 — Sean, the International Student
**Scope Status: [MVP Secondary Target]  ·  Segment: International student (F-1)**

**Archetype.** A first-time arrival to the U.S. who needs help settling in and staying in F-1 good standing.

**Background.** Sean is moving from abroad to attend Dallas College and **has never traveled to the U.S.** Everything about arriving and settling is new: what happens at DFW on arrival, finding an apartment and a roommate, getting a U.S. phone, where the campuses are, and adjusting to the culture. He also needs the basics of keeping his F-1 status valid. He may want to stay after graduating.

**Core Goals & Frustrations.**
- *Goals:* know what to expect arriving at DFW; set up essentials (apartment, roommate, U.S. phone/SIM); find trustworthy resources for adjusting to U.S. life; understand entry prerequisites (English / TSI) and F-1 good-standing basics; plan a compliant schedule.
- *Frustrations:* first-time arrival, unfamiliar with everything from airport procedures to renting; visa rules are high-stakes; institutional English can be hard to parse.

**Needs from the chatbot.**
- First-arrival & settling-in guidance: what to expect at DFW; how/where to find an apartment and roommate; getting a U.S. phone/SIM; campus locations; links to official orientation and cultural-adjustment resources.
- Plain-language explanation of prerequisites (English / TSI).
- General, **published** F-1 good-standing basics (full-time enrollment expectations, limits on online courses counting toward full-time, keeping documents valid, reporting changes) — **always with a disclaimer to verify with the international office.**
- A prominent hand-off to the international (DSO) office for anything personal or case-specific.

**Example questions.**
- "What happens when I land at DFW airport?"
- "How do I find an apartment and a roommate?"
- "How do I get a U.S. phone number?"
- "What do I need to do to keep my F-1 status in good standing?"
- "Do I need an English or TSI test before classes?"

**MVP Matrix.**

| Feature | How Sean uses it | Priority |
|---|---|---|
| Degree Planning | Plans a compliant schedule | Must |
| Prerequisite explainer (English / TSI) | Understands entry requirements | Should |
| F-1 good-standing basics (with disclaimer) | Stays in status — basics only; defer specifics to DSO | Should |
| First-arrival & settling-in guidance | Settles into life in Dallas | Should |
| Personalized visa / immigration advice | (Always deflect to the international office) | Won't |

> **Safety rationale.** The chatbot covers general, published basics and practical relocation help, never personalized immigration advice. Every F-1 answer disclaims and routes to the DSO, whose guidance overrides the bot.

---

### Persona 5 — Grace, the Straight-A Strategist
**Scope Status: [Post-MVP / Out of Scope]  ·  Segment: Traditional or Transfer student (high-achiever)**

**Archetype.** A grade-focused student who wants to graduate with all A's and the most efficient path there.

**Background.** Grace already knows how to navigate college basics; her goal is maximizing GPA — to strengthen scholarship and competitive-transfer chances. She wants the most efficient schedule, prefers easier or well-reviewed classes, and chooses professors by teaching style. She balances heavy-homework courses against project-based ones, and wants to estimate weekly workload so she can protect her grades.

**Core Goals & Frustrations.**
- *Goals:* maximize GPA (aim for all A's); optimize course load and efficiency (balance heavy-homework vs. project-based courses; favor easier/well-reviewed classes via Reddit and RateMyProfessors); match teaching/learning styles (project- vs. test-based, textbooks, professor background for office-hours career guidance); estimate weekly workload per course; keep flexibility and run scenario comparisons.
- *Frustrations:* hard to tell which professors' sections best fit her goals and style; time-consuming to estimate true course load and the optimal mix for performance; syllabi update only right before the term (forces checking last year's).

**Needs from the chatbot.** Professor insights (teaching style, project vs. test, textbooks, background, reviews); per-course workload estimates and balanced-schedule recommendations; easier/well-reviewed options for required courses; scenario comparisons optimized for GPA and efficiency.

**Example questions.**
- "Which professor for this course has the best reviews?"
- "Build a low-workload schedule that still meets my requirements."
- "Which of these classes are more project-based than exam-heavy?"
- "How many hours per week will this schedule take?"

**MVP Matrix.**

| Feature | How Grace uses it | Priority |
|---|---|---|
| Degree Planning | Builds and sequences an efficient schedule; runs scenarios | Must |
| Professor insights (style, reviews, textbooks, background) | Picks the section that fits her style and goals | Could |
| Workload / course-load estimates | Balances effort to protect her GPA | Could |
| Easy / well-reviewed class recommendations | Chooses lower-risk sections for required courses | Could |

> **Note.** Grace's distinctive features are all enhancements (Could), so she's **Post-MVP**: the chatbot can serve her only after the optimization features (professor insights, workload estimates, well-reviewed-class picks) land on top of the core planning that ships first.

---

## 6. MVP scope (MoSCoW)

**Must have (core)**
- Degree Planning: plain-language Q&A over the **catalog** (requirements, prerequisites, sequencing).
- First-/next-semester planning; clarifying-question flow; catalog citations.
- Disclaimers + advisor hand-off for high-risk topics.

**Should have (if data allows)**
- Transfer-equivalency checks (John) — gated on articulation data.
- Modality / schedule filtering (Hannah) — gated on schedule data.
- First-arrival & settling-in guidance; F-1 good-standing basics with disclaimer; English/TSI prerequisite explainer (Sean).
- Major-exploration "what-if" scenarios (Maria).

**Could have (later)**
- Professor insights; workload estimates; easy/well-reviewed class recommendations (Grace).
- Scholarship/aid finder; career-fit guidance; reverse-transfer.

**Won't have (out of scope this release)**
- **Event Finder module** (deferred).
- **Lost & Found module** (deferred).
- Personalized visa/immigration advice (deflect to international office).
- Definitive transfer guarantees ("verify with the school").
- Any guarantee about grades or admission outcomes.

---

## 7. Data sources & integrations

| Need | Source | Dependency |
|---|---|---|
| Requirements, prerequisites, course codes | Official Dallas College catalog | **Required (Must)** |
| Schedule & modality | Registration system / schedule of classes | Should (Hannah, Sean) |
| Transfer equivalencies | Articulation agreements per partner university | Should (John) |
| Relocation info (DFW arrival, housing, roommates, phone, campuses, culture) | Dallas College orientation/student-life pages; vetted external resources | Should (Sean) |
| F-1 good-standing basics | Dallas College international office / SEVP guidance (referenced, never invented) | Should (Sean) |
| Professor reviews & teaching style | RateMyProfessors, Reddit, internal evaluations | Could (Grace) |
| Syllabi (often updated late) | Course syllabi repository | Could (Grace) |
| Scholarships & aid | Financial aid pages / Workday | Could (Maria, Hannah) |
| Visa case specifics | International (DSO) office — deflected, never generated | N/A |

> **Implication.** The catalog is the only hard dependency. Sequence the roadmap by data readiness, not feature appeal.

---

## 8. Guardrails, safety & privacy

**Behavioral guardrails (non-negotiable)**
- *Visa / immigration.* Only general, published F-1 basics; never personalized advice. Every such answer disclaims and routes to the DSO, whose guidance is final.
- *Transfer credit.* Never promise acceptance; always "verify with your target school."
- *Grades & admissions.* Never guarantee a grade or an admission outcome; professor reviews are user-generated opinion, not fact.
- *Availability.* Note that schedules and modality change each term.
- *Uncertainty.* When confidence is low or data is stale, say so and recommend a human.
- *Citations.* Show the catalog source behind requirement claims.
- *Out-of-scope features.* If a student asks about events or lost & found, the bot states these aren't part of this release and points to official Dallas College channels, rather than improvising.

**Fallback when the bot can't answer.** If a question is out of scope, ambiguous after a follow-up, or low-confidence, the bot says so plainly and hands off to the right human (advisor; international office for F-1) rather than guessing.

**Data & privacy.** Define up front what student data the bot stores (e.g., major, completed courses, status), how long it's kept, and who can see it. Never expose one student's data to another. Collect the minimum needed to answer, and tell students what is stored and why.

---

## 9. AI tone & guardrail baseline

The baseline is set by the **primary persona, Maria** (a new traditional student), then adjusted per segment.

**Baseline tone (applies to everyone).**
- Plain, everyday language; no jargon or course codes unless the student uses them; define terms inline.
- Patient and encouraging; reduce overwhelm; one step at a time.
- Short answer first, then offer depth (progressive disclosure).
- Always ground answers in the catalog and cite; always offer a next step; hand off on high-risk or low-confidence topics.

**Per-persona adjustments.**

| Persona | Tone adjustment | Hard constraint |
|---|---|---|
| Maria (Traditional, new) | Encouraging and exploratory; reassure a first-timer; simplest language | Cite the catalog; don't overwhelm with the full prerequisite chain at once |
| John (Transfer) | Precise and factual; structured around credits | Always disclaim "verify transfer with your target school"; never guarantee acceptance |
| Hannah (Lifelong, busy adult) | Concise and practical; lead with the answer; minimal preamble | Flag that modality/availability changes each term |
| Sean (International) | Simplest English; define terms; culturally aware | Never give personalized visa advice; published basics only + defer to international office |
| Grace (High-achiever) | Detail-oriented and data-driven; give comparisons and specifics | Never guarantee grades; present professor reviews as opinion and cite the source |

---

## 10. Success metrics

| Metric | Measures |
|---|---|
| **Task completion** | % of sessions where the student gets a usable plan without escalating. |
| **Correct deflection** | % of high-risk questions routed to a human — target 100% for personalized visa questions. |
| **Plain-language success** | % of code-free questions answered without rephrasing. |
| **Trust signal** | Citation click-through and "was this helpful?" rating. |
| **Scope adherence** | % of out-of-scope (event / lost & found) asks correctly redirected instead of improvised. |

---

## 11. Assumptions & open questions

1. **Catalog access (blocking).** Structured/machine-readable, or PDF/web only? Determines MVP feasibility.
2. **Segment sizing.** Largest segment by enrollment? (Assumed: Maria.) Given the MVP is degree-planning only, are transfer students (John) high-value enough to promote to Primary?
3. **Program accuracy.** Do the named programs read exactly as written in the current catalog?
4. **Transfer data.** Are articulation agreements available in a usable format?
5. **Schedule data.** Real-time modality/availability, or link-only?
6. **F-1 basics sourcing.** What is the authoritative source, and who signs off the wording is safe?
7. **Professor-data ethics.** Is it acceptable to surface RateMyProfessors/Reddit content, and how is bias and "easiness" framing handled responsibly?
8. **Language support.** Sean may struggle with English — does the MVP need multilingual or only plain-English simplification?
9. **Advisor hand-off.** Real escalation path (live chat, ticket, contact) — including the international office?
10. **Privacy.** What data is stored, for how long, and who can access it?

---

## Appendix A — Acceptance-criteria coverage

| Acceptance criterion | Status in v1.0 |
|---|---|
| Four distinct segment personas (Traditional, Transfer, Continuing Ed, International) | Met — §5 Personas 1–4 (plus Grace, a fifth in-scope persona). |
| Per-persona interaction goals across all three modules | Descoped — MVP is now Degree Planning only; Event Finder & Lost & Found deferred (§3, §6). |
| Identify Primary Targets | Met — Maria [Primary]; others [Secondary] (§4–§5). |
| A persona that will NOT use the MVP, with rationale | Met — Persona 5 (Grace) is [Post-MVP / Out of Scope] and spans Traditional or Transfer students; rationale in §5 and §6. |
| AI tone & guardrail baseline from primary personas | Met — §9 (and guardrails in §8). |
| Deliverable file with required per-persona sections | Met — this file; §5 template (Name & Archetype, Core Goals & Frustrations, MVP Matrix, Scope Status). |

---

*End of document.*
