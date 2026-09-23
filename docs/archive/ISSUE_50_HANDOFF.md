# Handoff — client-side state persistence (issue #50)

For **@treysweeney**, who owns issue [#50 — Client-Side State Persistence and Anonymous Analytics](https://github.com/Dallas-College-AI-Club/success-coach-chatbot/issues/50).

While building the onboarding page (#52) we added a tiny `localStorage` stand-in so a returning student could reopen the summary they built last time. That persistence is **#50's job, not #52's** (noted in review), so it has been **removed**: `onboarding-store.ts` now keeps only the interface as a no-op seam (`saveSession` does nothing, `useSavedSession()` returns `null`), so nothing persists and every visit is first-time until #50 lands. This note hands you exactly what we had, where it plugged in, and how it maps to #50 so you don't start from zero.

## What we had (the removed stand-in)

`apps/frontend/features/onboarding/onboarding-store.ts`, in full:

```ts
import { useSyncExternalStore } from "react";
import type { OnboardingPayload } from "@/features/onboarding/types";

const KEY = "sc_onboarding_v1";

export interface SavedSession {
  payload: OnboardingPayload;
  summary: string[];
  modeId: string;
}

function parse(raw: string | null): SavedSession | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as SavedSession;
    // Guard against a corrupt or shape-changed value.
    if (!s || typeof s !== "object" || !s.payload || !Array.isArray(s.summary) || !s.modeId) {
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveSession(session: SavedSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage unavailable — ignore */
  }
}

// Stable snapshot for useSyncExternalStore: re-parse only when the stored string
// actually changes, so the hook doesn't loop on a fresh object every render.
let cachedRaw: string | null = null;
let cachedSession: SavedSession | null = null;
function snapshot(): SavedSession | null {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSession = parse(raw);
  }
  return cachedSession;
}
const subscribe = (): (() => void) => () => {};

/**
 * The saved session, read SSR-safely: `null` on the server and during hydration,
 * the stored value on the client immediately after. Avoids both a hydration
 * mismatch and a set-state-in-effect.
 */
export function useSavedSession(): SavedSession | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
```

## Where it plugged in (the #52 seam)

Two call sites, both still present and now reading the no-op:

- **`saveSession(session)`** — called once, on onboarding completion, in `shared/onboarding-flow.tsx` (`complete()`), with `{ payload, summary, modeId }`.
- **`useSavedSession()`** — called in `shared/welcome.tsx` to decide whether to show the "Welcome back" resume card and skip the questions.
- The profile shape is **`OnboardingPayload`** in `features/onboarding/types.ts` (goal, major, transfer_direction, schedule prefs, student_type, intl_status, etc., plus `skippedSteps`, `onboardingVersion`, `completedAt`). #50's "User Information" domain can reuse this type directly.

## How it maps to #50

### Similar (keep the ideas)
- Persists to the **browser's `localStorage`** so a student resumes **without an account**.
- **SSR/hydration-safe reads**: the stand-in used `useSyncExternalStore` returning `null` on the server and during hydration, then the stored value on the client — no hydration mismatch, no set-state-in-effect. #50 needs the same guarantee (acceptance criterion: "safely handles Next.js hydration without server/client HTML mismatches").
- Stores the **student's profile answers** (the `OnboardingPayload`).
- **Defensive reads**: a corrupt/shape-changed value parses back to `null` (first-time) rather than throwing — worth carrying into the `persist` deserializer.

### Different (what #50 changes)
| | #52 stand-in | #50 target |
|---|---|---|
| Mechanism | plain `localStorage` + hand-rolled `useSyncExternalStore` hook | **Zustand** `create()` + **`persist`** middleware |
| Storage key | `sc_onboarding_v1` | `student-session-store` (per the issue) |
| Data | one blob: `{ payload, summary, modeId }` | **two domains**: User Information (profile/goals) **and** AI Chat History |
| When written | **once**, at onboarding completion | **every state mutation**, automatically |
| Reactivity | read-only snapshot, no subscription | reactive store with **selectors + actions** |
| Identity | none | a **client-generated UUID** |

### Missing (net-new work for #50)
- **UUID**: generate with `crypto.randomUUID()` on first load if absent, persist it, expose a selector; append it to outgoing analytics event headers/payloads (PII-free tracking).
- **Chat history domain**: message interface (`role`, `content`, `timestamp`, status) + actions to append, clear, and update message status.
- **Profile actions**: live update/reset actions (the stand-in only wrote a final blob).
- **Zustand + `persist`**: store scaffold via `create`, wrapped in `persist` with the `student-session-store` key and a hydration strategy (empty initial state on the server or a custom hydration mechanism).
- **Init hook** at the root layout/provider to mint + persist the UUID when the hydrated store lacks one.
- **Analytics readiness**: API/service layer to attach the UUID; DB schema prepared to accept it.

## Suggested first steps
1. Add Zustand; scaffold `student-session-store` with `persist` and the two domains + UUID.
2. Reuse `OnboardingPayload` as the profile type; port the `null`-on-corrupt guard into the deserializer.
3. Replace the two seams: have `onboarding-flow.tsx` write the profile into the store, and `welcome.tsx` read it (or a `hasSession` selector) for the resume card. Delete `onboarding-store.ts` once the store covers it.
4. Wire the UUID into the analytics/API layer.
