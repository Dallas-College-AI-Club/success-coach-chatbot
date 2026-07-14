import type { OnboardingPayload } from "@/features/onboarding/types";

// Client-side session persistence belongs to issue #50 (anonymous client store:
// Zustand `persist` + a client UUID), assigned to @treysweeney — it was out of
// scope for #52. The localStorage stand-in has been removed; this file keeps only
// the seam (the type + the two function signatures) so the onboarding flow still
// compiles and #50 can drop in the real store without touching call sites.
//
// Until #50 lands nothing is persisted, so every visit is first-time (no resume).
// The removed implementation and how it maps to #50 are in
// docs/handoff/CLIENT_STATE_HANDOFF.md.

export interface SavedSession {
  payload: OnboardingPayload;
  summary: string[];
  modeId: string;
}

/** No-op until issue #50 owns persistence. */
export function saveSession(session: SavedSession): void {
  void session;
}

/** Always "first-time" until issue #50 owns persistence. */
export function useSavedSession(): SavedSession | null {
  return null;
}
