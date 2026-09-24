"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { OnboardingPayload } from "@/features/onboarding/types";
import { useEffect } from "react";

// Onboarding choices persist locally; conversation-store keeps this tab's chat.
// No server session logging or transcript synchronization is implemented here.

/** The completed onboarding a returning student resumes into. */
export interface SavedSession {
  payload: OnboardingPayload;
  summary: string[];
  modeId: string;
}

interface SessionState {
  /** Pseudonymous local identifier, never derived from a real identifier. */
  studentId: string | null;
  session: SavedSession | null;
  /** False until `rehydrate()` has run, so reads can stay SSR-safe. Never persisted. */
  hasHydrated: boolean;
  setSession: (session: SavedSession) => void;
  /** Update just the saved look. An action (not read-modify-write at call
   *  sites) so concurrent writers cannot lose each other's fields. */
  setModeId: (modeId: string) => void;
  /** Unconsumed seam for a future "forget my answers" affordance — a real
   *  privacy need on shared campus machines. No owner issue yet; file one
   *  before wiring it into UI. */
  resetSession: () => void;
}

type PersistedSession = Pick<SessionState, "studentId" | "session">;

function isSavedSession(value: unknown): value is SavedSession {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    !!s.payload &&
    typeof s.payload === "object" &&
    !Array.isArray(s.payload) &&
    // `completedAt` is set unconditionally by the payload's sole producer
    // (build-payload.ts), so its absence marks a foreign or truncated blob.
    typeof (s.payload as Record<string, unknown>).completedAt === "string" &&
    ((s.payload as Record<string, unknown>).dayparts_pref == null ||
      (Array.isArray((s.payload as Record<string, unknown>).dayparts_pref) &&
        (
          (s.payload as Record<string, unknown>).dayparts_pref as unknown[]
        ).every((v) => typeof v === "string"))) &&
    Array.isArray(s.summary) &&
    s.summary.every((x) => typeof x === "string") &&
    typeof s.modeId === "string"
  );
}

// A stored value is cast, never validated, so a corrupt or shape-changed blob
// would otherwise become a type lie. Anything unrecognized degrades to
// "first-time" rather than throwing.
function parsePersisted(raw: unknown): Partial<PersistedSession> {
  if (!raw || typeof raw !== "object") return {};
  const v = raw as Record<string, unknown>;
  return {
    studentId: typeof v.studentId === "string" ? v.studentId : null,
    session: isSavedSession(v.session) ? v.session : null,
  };
}

// `crypto.randomUUID` is gated to secure contexts (https/localhost); on a
// plain-http deploy it is undefined, and a throw inside the rehydration
// callback is swallowed by zustand — leaving `hasHydrated` false, and the
// store dark, forever. `getRandomValues` has no such gate, so fall back to
// assembling the v4 UUID by hand.
function mintStudentId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
}

export const useStudentSession = create<SessionState>()(
  persist(
    (set) => ({
      studentId: null,
      session: null,
      hasHydrated: false,

      setSession: (session) => set({ session }),
      setModeId: (modeId) =>
        set((s) => (s.session ? { session: { ...s.session, modeId } } : {})),
      resetSession: () => set({ session: null }),
    }),
    {
      name: "student-session-store",
      // The getter must still touch localStorage first: on the server (or a
      // browser blocking storage) that throw keeps `api.persist` absent, which
      // every read is built to survive. The setItem gate drops writes until
      // rehydration has run — zustand persists on *every* write, so an early
      // write (e.g. a future /chat consumer that forgets `useHydrateSession`)
      // would otherwise overwrite a returning student's blob — the only copy
      // of their data — with defaults.
      storage: createJSONStorage(() => {
        void localStorage;
        return {
          getItem: (name) => {
            try {
              return localStorage.getItem(name);
            } catch {
              return null;
            }
          },
          setItem: (name, value) => {
            if (useStudentSession.getState().hasHydrated) {
              try {
                localStorage.setItem(name, value);
              } catch {
                /* Continue with an in-memory session. */
              }
            }
          },
          removeItem: (name) => {
            try {
              localStorage.removeItem(name);
            } catch {
              /* Storage may be blocked. */
            }
          },
        };
      }),
      // An explicit allowlist, so a field added later doesn't start persisting
      // by accident. Actions and `hasHydrated` are runtime-only.
      partialize: (s): PersistedSession => ({
        studentId: s.studentId,
        session: s.session,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...parsePersisted(persisted),
      }),
      // Runs after every rehydrate — including a first visit (empty storage)
      // and the error path (an unparseable blob arrives as `state` undefined
      // and is overwritten by the next write, so corruption degrades to a
      // fresh identity with the warning below as the only signal). The id is
      // minted once the stored value is known and can never overwrite an
      // existing one; minting at render or on the server would bake a fresh id
      // into the HTML and cause the very mismatch the hydration gate prevents.
      // Nothing in this callback may throw: zustand swallows its exceptions,
      // which would leave `hasHydrated` false — and the store dark — forever.
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn(
            "[student-session] stored session unreadable; starting fresh",
          );
        }
        const studentId = state?.studentId ?? mintStudentId();
        useStudentSession.setState({ studentId, hasHydrated: true });
      },
      // Storage is read only when we ask, which keeps the server render and the
      // hydration render provably identical to the defaults. Also load-bearing:
      // deferring the first hydrate past module eval is what makes the
      // `useStudentSession` references above legal — an eager hydrate would hit
      // them mid-`create()` and zustand would swallow the TDZ throw silently.
      skipHydration: true,
    },
  ),
);

/**
 * Loads the store from localStorage, once, on the client. Call this above any
 * consumer: `persist` writes storage on every mutation, and until rehydration
 * has run those writes are dropped by the storage gate — mutate before calling
 * this and the change simply doesn't persist.
 */
export function hydrateStudentSession(): void {
  if (useStudentSession.persist) {
    void useStudentSession.persist.rehydrate();
  } else {
    // Storage-denied browsers still get a usable in-memory session.
    useStudentSession.setState({
      studentId: useStudentSession.getState().studentId ?? mintStudentId(),
      hasHydrated: true,
    });
  }
}

export function useHydrateSession(): void {
  useEffect(hydrateStudentSession, []);
}

/** Persist the completed onboarding so a return visit can reopen it. */
export function saveSession(session: SavedSession): void {
  useStudentSession.getState().setSession(session);
}

/**
 * The saved session, read SSR-safely: `null` on the server and during
 * hydration, the stored value on the client immediately after. Avoids both a
 * hydration mismatch and a set-state-in-effect.
 */
export function useSavedSession(): SavedSession | null {
  return useStudentSession((s) => (s.hasHydrated ? s.session : null));
}

/** The anonymous client id, for tagging analytics events. */
export function useStudentId(): string | null {
  return useStudentSession((s) => s.studentId);
}
