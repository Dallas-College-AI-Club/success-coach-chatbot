# Handoff — building the planning chat UI

For whoever picks up the **planning chat** (issue [#37](https://github.com/Dallas-College-AI-Club/success-coach-chatbot/issues/37), wireframed in #3). Onboarding (#52) is done and hands the student to the chat with their answers already gathered; this note covers what the chat inherits, what to reuse, and the patterns that keep it working on every device. Companion reading: [`LANDING_ONBOARDING_UIUX.md`](../LANDING_ONBOARDING_UIUX.md).

---

## 1. Where the chat plugs in

The chat lives at **`/chat`** ([`app/chat/page.tsx`](../../apps/frontend/app/chat/page.tsx)). Today that route is a styled placeholder — replace it with the real chat. Everything already points here:

- The onboarding hand-off's **Start chat** button routes to `/chat`.
- The end-of-flow **quick actions** (register, academic calendar, financial aid, tutoring, campus events, talk to a coach) also route to `/chat`. As their real destinations ship, point each shortcut at the office/surface that owns it (see [`quick-actions.tsx`](../../apps/frontend/features/onboarding/shared/quick-actions.tsx)).

Keep the route stable so the hand-off keeps working while you build.

## 2. The context the chat inherits

Onboarding produces one **payload** — the student's answers, keyed to the #36 profile allowlist. The chat should open already scoped to it (no re-asking). Keys:

| Key | Meaning |
|---|---|
| `goal` | the Q1 selection (what they came to do) |
| `major` | a catalog program id, or `null` for "still figuring it out" |
| `target_institution` | transfer destination / home-school code, or a category (`TX_OTHER`, `US_OTHER`, `INTL`) |
| `student_type` | set via the audience link — `dual_credit` (parents route here too) or `international` |
| `intl_status` | `incoming` or `current`, set with the goal on the international goal step (else `null`) |
| `modality_pref` / `dayparts_pref` | class-format and time preferences |
| `transfer_direction` / `interest_area` / `oneoff_purpose` | path-specific context |
| `skippedSteps` | steps left blank — a skip is distinct from a "no preference" answer |
| `onboardingVersion` / `completedAt` | version stamp + timestamp |

**How to read it:** the payload is kept in a small browser store — [`onboarding-store.ts`](../../apps/frontend/features/onboarding/onboarding-store.ts) (`useSavedSession()` / `saveSession()`). This is the **#52-scope stand-in** for the anonymous client store issue [#50](https://github.com/Dallas-College-AI-Club/success-coach-chatbot/issues/50) will own (Zustand `persist` + a client-generated UUID). When #50 lands, that one file is the seam to swap; until then, read from it so a returning student resumes seamlessly. Values are closed-list (catalog ids / enum codes), so they're safe to pass straight into a prompt or a retrieval filter.

## 3. Reuse the brand system — don't reinvent it

The `/chat` placeholder already sets the visual contract; build the real chat on it.

- **Colours (Dallas College):** blue `#003385`, red `#E52626`, silver `#D6D2C4`. Blue carries text/primary actions; red is a sparing accent; keep a light background.
- **Bot avatar:** [`SuccessCoachBot`](../../apps/frontend/features/onboarding/shared/success-coach-bot.tsx) — the robot with the Dallas **"D"** antenna badge. Use it for assistant messages.
- **Club branding:** keep [`AiClubLogo`](../../apps/frontend/features/onboarding/shared/brand.tsx) and the Success Coach wordmark (`/title.png`) in the header, as the placeholder does.
- **Message bubbles / inputs:** the placeholder's blue-tinted bubble and pill input are the baseline.

## 4. Personalities (Simple / Playful / Focus)

Onboarding ships three looks through a **skin system** ([`skin.ts`](../../apps/frontend/features/onboarding/skin.ts): `Skin` / `Copy` / `Mode`; variants in [`variants/`](../../apps/frontend/features/onboarding/variants/)). The student picks one and it's saved (`modeId` in the store). **Open decision for the chat (see #41):** carry the chosen personality into the chat (theme the chat with the same skin) or land everyone in one neutral chat look. If you theme it, reuse the `Skin` contract rather than hard-coding a fourth style. The Simple mode is already a chat UI ([`shells/simple.tsx`](../../apps/frontend/features/onboarding/shared/shells/simple.tsx)) — a useful reference for bubble/scroll layout.

## 5. Device patterns to follow (these are non-obvious)

The onboarding was audited across phone, tablet (iPad), and laptop, portrait and landscape. A chat UI hits the same traps harder (long message lists, a pinned composer, the on-screen keyboard). Follow these:

- **Single scroll region.** Don't size a scrollable panel with a raw `dvh` while it sits under a header inside page padding — on short/landscape screens the panel + header exceed the viewport and you get a *nested double scroll*. Use a **`h-dvh` flex column**: header as a fixed row, the message list `flex-1 min-h-0 overflow-y-auto`, the composer pinned below. (Onboarding cards use `min(720px, calc(100dvh - Nrem))` as the lighter equivalent — fine for a card, but a chat wants the flex-column version.)
- **Touch targets via pointer, not width.** Gate comfortable ≥44px hit areas on **`pointer-coarse:`**, not on a width breakpoint. iPad is a touch device at ≥768px wide — width breakpoints would (wrongly) give it desktop-compact controls. Mouse pointers keep the compact look automatically. (See how the mode switcher, program picker, and text links do it.)
- **Reserve space for fixed/absolute headers.** A vertically-centered card under an `absolute` brand header will ride under it on short screens — add top padding on small viewports (onboarding uses `pt-20 sm:pt-6` on the welcome).
- **No horizontal overflow, ever.** Wrap wide rows, `max-w-full` on media, and test from a **375px** phone up. Verify by measuring `document.documentElement.scrollWidth - clientWidth === 0` at each width.
- **The mobile keyboard** shrinks the visual viewport; `dvh` (dynamic viewport height) already accounts for browser chrome — prefer it over `vh`, and keep the composer in view when the keyboard opens.

## 6. Guardrails and grounding (must-honor)

- **Never assert an outcome the college hasn't confirmed** — transfer credit, financial aid, or graduation. Route those to the deciding institution/office and to a Success Coach. This is the interview's standing rule (#42) and the guardrail scope ([#39](https://github.com/Dallas-College-AI-Club/success-coach-chatbot/issues/39)); see also `GUARDRAIL_BENCHMARKS.md`. Every path closes on *"A Success Coach reviews your plan before it's official."*
- **Ground answers in verified Dallas College catalog data** (RAG over the catalog — #35/#36/#61). `major`/`target_institution` arrive as catalog ids/codes to filter on.
- **Respect staged capability.** [`shipped-intents.ts`](../../apps/frontend/features/onboarding/shipped-intents.ts) is the single source for which capabilities are live; don't offer an answer the pipeline can't yet ground.

## 7. Telemetry continuity

Onboarding logs a console funnel with the #50 vocabulary (`page_load`, `cta_tap`, `onboarding_started`, `question_answered`, `question_skipped`, `onboarding_skipped`, `onboarding_completed`, `onboarding_resumed`, `audience_link_tap`, `capability_opened`) via [`telemetry.ts`](../../apps/frontend/features/onboarding/telemetry.ts). Continue the funnel into the chat with matching names (e.g. a `chat_opened` / first-message event) so the same anonymous analytics transport is a drop-in.

## 8. Known follow-ups carried over

Small, non-blocking items noticed during the device audit, left for whoever touches these areas next:

- **Focus mountain on phones** pillarboxes (the portrait art paints ~120px wide, centered, in a full-width row). Cosmetic; cap/center the mobile SVG or use a wider phone viewBox.
- **Answer chips** ("tap to change") are ~28px on touch — above the 24px minimum and backed by a full-size Back button, so functional; enlarge if you want parity with the other touch targets.
