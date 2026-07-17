# Onboarding (issue #52)

A student picks a look, answers a few adaptive questions, and is handed into the
planning chat with their answers already gathered. **One state machine drives
three interchangeable visual modes.** This README maps the code; the design
rationale lives in [`docs/LANDING_ONBOARDING_UIUX.md`](../../../../docs/LANDING_ONBOARDING_UIUX.md),
and per-mode details in [`variants/README.md`](./variants/README.md).

## Three layers

**1. Data + logic** — framework-free, no JSX. This is where the correctness lives:

| File | Role |
|---|---|
| [`types.ts`](./types.ts) | The vocabulary. `PayloadContribs` is the one source of truth for answerable fields; `OnboardingPayload` is derived from it, so the two never drift. |
| [`questions.ts`](./questions.ts) | The question catalog **and** the branch rules. `followUpsFor(answers)` is a pure function: a `switch` on the goal returning the ordered follow-ups, keeping every path ≤ 3 follow-ups. `programFor` rewords the program question by who's asking. |
| [`programs.ts`](./programs.ts) | The 335 Dallas College programs feeding the picker (`code` = catalog poid). `label` is a trimmed display name for long transfer degrees, not the official catalog title — see the file header + `program-overrides.json`. |
| [`program-overrides.json`](./program-overrides.json) | Config for the #36 generator that regenerates `programs.ts` from the catalog: `exclude` (structural poids kept out of the picker) + `display_overrides` (trimmed labels by poid). The onboarding side owns this; the pipeline reads it. |
| [`build-payload.ts`](./build-payload.ts) | `buildPayload(answers, branch)` → the payload; derives `skippedSteps` from the resolved branch, so back-navigation still yields a correct record. |
| [`handoff-copy.ts`](./handoff-copy.ts) | The personalized chat hand-off copy (intro line, starter prompts, authority notes, coach-verify line). States no academic outcome. |
| [`shipped-intents.ts`](./shipped-intents.ts) | The capability list behind the "what can this help with" dialog; staging mirror of the question `shipped` flag. |
| [`telemetry.ts`](./telemetry.ts) | `emit(event, detail)` console stub + the `OnboardingEvent` vocabulary. |
| [`onboarding-store.ts`](./onboarding-store.ts) | The **anonymous client store (#50)**: Zustand + `persist` over `localStorage` (key `student-session-store`). Holds the saved session, the chat history, and the client-generated `studentId`; `saveSession` / `useSavedSession` are the onboarding-facing seam. |

**2. The state machine** — [`use-onboarding.ts`](./use-onboarding.ts). `useOnboarding(onComplete)` is the single brain: it holds the answers, derives the step list (`stepsFor` = goal + shipped follow-ups), and exposes the `OnboardingApi` every shell consumes. Every exit runs through one guarded function, so the payload is emitted exactly once.

**3. UI** — an orchestrator, shared parts, and one skinned shell per mode:

- [`skin.ts`](./skin.ts) — the contracts that let one core wear three looks: `Skin` (class-string bundle), `Copy` (per-mode words), `Mode` (id + name + icon + blurb + font + skin + copy + shell), `WizardProps`, `DoneState`.
- [`shared/onboarding-flow.tsx`](./shared/onboarding-flow.tsx) — the orchestrator: welcome → wizard → recap, mode switching, Start-over, and resuming a returning student.
- [`shared/welcome.tsx`](./shared/welcome.tsx) — the first screen (pick a look, Start), plus the "Welcome back" resume card.
- [`shared/wizard-parts.tsx`](./shared/wizard-parts.tsx) — the shared building blocks every shell arranges: `QuestionBody` (the interactive field), `QuestionHeading`, `AnswerChips`, `WizardControls`.
- [`shared/shells/`](./shared/shells/) — one shell per mode (`simple`, `playful`, `focus`): pure arrangement of the shared parts around a persistent scene.
- [`shared/scenes/`](./shared/scenes/) — the per-mode backdrops (Playful campus + critters, Focus mountain).
- Other `shared/*` — `recap-panel`, `chat-handoff`, `quick-actions`, `transfer-step`, `intl-goal-step`, `skinned-option`, `capability-dialog`, `mode-switcher`, `step-transition`, `brand`, `success-coach-bot`, and the `use-heading-focus` hook.
- [`variants/`](./variants/) — one `Mode` object per look + the registry (`index.ts`) and fonts.

Primitives (ShadCN) live in `components/ui/`; routes in `app/` (`page.tsx` → the flow, `chat/page.tsx` → the planning-chat placeholder).

## How one question flows

```
questions.ts (data)  →  goalStepFor() + followUpsFor()  →  stepsFor() (goal + shipped follow-ups)
   → useOnboarding exposes current = steps[stepIdx]
   → the active Shell renders it and drops in <QuestionBody>
   → QuestionBody switches on current.kind (buttons / picker / transferOrigin / intlGoal)
   → a tap calls api.answerOption → commit(): steps recompute, advance or finish
   → finishWith → buildPayload → onComplete → the recap / hand-off
```

## How three modes share one core

The logic lives once in `useOnboarding`. A **shell** is pure arrangement; a mode's
identity is just its `Skin` (class strings) + `Copy` (words) + font, bundled as a
`Mode`. Swap those three inputs and the same state machine becomes **Simple**
(chat bubbles), **Playful** (a panning campus), or **Focus** (a climbing mountain).
The mode switcher swaps the `Mode` object mid-flow; the answers survive because
they live in the hook, not the shell.

## Key seams

- **Client store (#50):** `onboarding-store.ts` — Zustand + `persist` to `localStorage`. `useHydrateSession()` (called once in `onboarding-flow.tsx`) reads storage on the client; reads report first-time until it has, so the server and hydration renders match, and writes before rehydration are dropped. The chat-history domain (`ChatMessage`, append/clear/status) is a floor for #37 to extend, unconsumed today; `resetSession` is the unconsumed seam for a future "forget my answers" affordance (no owner issue yet).
- **Chat hand-off (#37):** `ChatHandoff` routes to `/chat` (`QuickActions` is the separate row of external Dallas College resource links, not a `/chat` route); `handoff-copy.ts` owns the personalized copy; `app/chat/page.tsx` is the placeholder the RAG chat replaces.
- **Telemetry:** `emit()` is a console stub carrying the final event names — swap the body for the real transport.
- **Shipped gate:** the `shipped` flag on questions (and on intents) keeps the flow from advertising unbuilt paths.
- **Program data (#36):** the picker lists **335** of the catalog's 337 programs. Two structural entries are **excluded** — `Core Curriculum` (poid 3388) and `Core Options for A.A.S. Awards` (poid 3040) — because they're *requirements for all*, not a student's choice. **Nuance for the main chatbot:** both still MUST be ingested into `program_map` for the RAG (they supply the "choose one from Area X" slots every degree references), or graduation requirements come out incomplete — see [`docs/DATA_PIPELINE.md`](../../../../docs/DATA_PIPELINE.md) (degree-plan nuances) and #61. The list is hand-maintained now; #36 will regenerate it from `program_index.json` + `program-overrides.json`.
- **Transfer destinations:** `schoolOptions` (in `questions.ts`) names the universities Dallas College has coordinated articulation with (UTD, UNT, UT Arlington, Prairie View A&M, Texas A&M ×2, SMU — the Richland academies + RLC/SMU) so the chat can ground specific guidance; everyone else is a region bucket. Rendered as a searchable picker in `transfer-step.tsx`.

## Verifying

```bash
cd apps/frontend
npx tsx ../../docs/onboarding-flow-stress.ts          # every reachable path + invariants
npm run build && npm run lint
```
