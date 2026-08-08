"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { OnboardingPayload } from "@/features/onboarding/types";
import { useEffect } from "react";

// The anonymous client store (issue #50). Two domains — the student's onboarding
// answers and their chat history — plus a client-generated id, persisted to
// localStorage so a return visit resumes without an account.
//
// This is the system's only durable student/session state. The server's
// `chat_session` table is a PII-scrubbed analytics/eval log, archived weekly
// and purged (apps/data/reference/db/schema.sql), so continuity is client-side by
// design; nothing here is a cache of anything. Tabs don't sync: the stored
// state follows the most recent writer.

/** The completed onboarding a returning student resumes into. */
export interface SavedSession {
  payload: OnboardingPayload;
  summary: string[];
  modeId: string;
}

export type ChatRole = "user" | "assistant" | "system";

/** Provisional — the real vocabulary belongs to the chat transport (#37). */
const CHAT_MESSAGE_STATUSES = ["pending", "streaming", "complete", "error"] as const;
export type ChatMessageStatus = (typeof CHAT_MESSAGE_STATUSES)[number];

/**
 * The floor for a chat turn, not the final shape: #37 owns the chat and is
 * expected to extend this (per-message citations are required by DP-013 and
 * governed by RFC-0005's Citation Policy, and the server history contract
 * records per-turn citation flags and grounding results — none of which has
 * anywhere to live here yet).
 */
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  status: ChatMessageStatus;
}

interface SessionState {
  /** Maps to `chat_session.student_id` — pseudonymous, never derived from a real identifier. */
  studentId: string | null;
  session: SavedSession | null;
  messages: ChatMessage[];
  /** False until `rehydrate()` has run, so reads can stay SSR-safe. Never persisted. */
  hasHydrated: boolean;
  setSession: (session: SavedSession) => void;
  /** Unconsumed seam for a future "forget my answers" affordance — a real
   *  privacy need on shared campus machines. No owner issue yet; file one
   *  before wiring it into UI. */
  resetSession: () => void;
  appendMessage: (message: ChatMessage) => void;
  clearChat: () => void;
  updateMessageStatus: (id: string, status: ChatMessageStatus) => void;
}

type PersistedSession = Pick<SessionState, "studentId" | "session" | "messages">;

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
    Array.isArray(s.summary) &&
    s.summary.every((x) => typeof x === "string") &&
    typeof s.modeId === "string"
  );
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    (m.role === "user" || m.role === "assistant" || m.role === "system") &&
    typeof m.content === "string" &&
    typeof m.timestamp === "string" &&
    typeof m.status === "string" &&
    (CHAT_MESSAGE_STATUSES as readonly string[]).includes(m.status)
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
    messages: Array.isArray(v.messages) ? v.messages.filter(isChatMessage) : [],
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
      messages: [],
      hasHydrated: false,

      setSession: (session) => set({ session }),
      resetSession: () => set({ session: null }),

      appendMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
      clearChat: () => set({ messages: [] }),
      updateMessageStatus: (id, status) =>
        set((s) => ({
          messages: s.messages.map((m) => (m.id === id ? { ...m, status } : m)),
        })),
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
          getItem: (name) => localStorage.getItem(name),
          setItem: (name, value) => {
            if (useStudentSession.getState().hasHydrated) {
              localStorage.setItem(name, value);
            }
          },
          removeItem: (name) => localStorage.removeItem(name),
        };
      }),
      // An explicit allowlist, so a field added later doesn't start persisting
      // by accident. Actions and `hasHydrated` are runtime-only.
      partialize: (s): PersistedSession => ({
        studentId: s.studentId,
        session: s.session,
        messages: s.messages,
      }),
      merge: (persisted, current) => ({ ...current, ...parsePersisted(persisted) }),
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
          console.warn("[student-session] stored session unreadable; starting fresh", error);
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
export function useHydrateSession(): void {
  useEffect(() => {
    // `persist` is absent when storage was unavailable as the module loaded
    // (the server, or a browser refusing localStorage). Nothing to rehydrate —
    // `hasHydrated` stays false and every read reports first-time.
    void useStudentSession.persist?.rehydrate();
  }, []);
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
