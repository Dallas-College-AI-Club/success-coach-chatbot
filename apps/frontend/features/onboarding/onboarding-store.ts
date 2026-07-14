import { useSyncExternalStore } from "react";
import type { OnboardingPayload } from "@/features/onboarding/types";

// Client-side persistence of the last completed onboarding. This is the #52-scope
// stand-in for the anonymous client store issue #50 will own (Zustand `persist` →
// localStorage, client-generated UUID). It lets a returning student skip the
// questions and jump straight to the summary they built last time.
//
// Deliberately tiny and self-contained: when #50 lands, this file is the single
// seam to replace. Every read is guarded, so storage being unavailable (private
// mode, quota, or a server render where `localStorage` doesn't exist) degrades to
// "first-time" rather than throwing — a saved session is a convenience, never a
// requirement.
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
// The session doesn't change within a visit, so there's nothing to subscribe to.
const subscribe = (): (() => void) => () => {};

/**
 * The saved session, read SSR-safely: `null` on the server and during hydration,
 * the stored value on the client immediately after. Avoids both a hydration
 * mismatch and a set-state-in-effect.
 */
export function useSavedSession(): SavedSession | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
