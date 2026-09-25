"use client";

import { validateUIMessages, type UIMessage } from "ai";
import { create } from "zustand";
import { isRecord } from "@/lib/course-details";

// A tab keeps its conversation through the sheet, navigation and refresh.
// A new completed onboarding has a new key; another tab has its own history.
const STORAGE_KEY = "major-conversation-v1";
const MAX_STORED_BYTES = 4_000_000;

export interface ConversationDraft {
  key: string;
  messages: UIMessage[];
  input: string;
  askedLabels: string[];
  interrupted: boolean;
}

export async function readConversation(
  raw: string | null,
  key: string,
): Promise<ConversationDraft | null> {
  if (!raw || raw.length > MAX_STORED_BYTES) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.key !== key || !Array.isArray(value.messages))
      return null;
    const messages = await validateUIMessages({ messages: value.messages });
    if (messages.some((m) => m.role === "system")) return null;
    return {
      key,
      // Partial tool inputs cannot be replayed after a disconnected stream.
      messages: messages.map((m) => ({
        ...m,
        parts: m.parts.filter(
          (p) =>
            !p.type.startsWith("tool-") ||
            ("state" in p &&
              (p.state === "output-available" || p.state === "output-error")),
        ),
      })),
      input: typeof value.input === "string" ? value.input.slice(0, 8000) : "",
      askedLabels: Array.isArray(value.askedLabels)
        ? value.askedLabels
            .filter((v): v is string => typeof v === "string")
            .slice(-100)
        : [],
      interrupted:
        value.interrupted === true || messages.at(-1)?.role === "user",
    };
  } catch {
    return null;
  }
}

interface ConversationState {
  readyFor: string | null;
  draft: ConversationDraft | null;
}
export const useConversation = create<ConversationState>(() => ({
  readyFor: null,
  draft: null,
}));
let hydration = 0;

export async function hydrateConversation(key: string): Promise<void> {
  if (useConversation.getState().readyFor === key) return;
  const run = ++hydration;
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(STORAGE_KEY);
  } catch {
    /* Memory still works. */
  }
  const draft = await readConversation(raw, key);
  if (run === hydration) useConversation.setState({ readyFor: key, draft });
}

export function saveConversation(draft: ConversationDraft): void {
  useConversation.setState({ draft });
  try {
    const raw = JSON.stringify(draft);
    if (raw.length <= MAX_STORED_BYTES)
      sessionStorage.setItem(STORAGE_KEY, raw);
  } catch {
    /* Retain the live in-memory copy when browser storage is unavailable. */
  }
}

// A mounted chat can stay ready while its Conversation component is remounted.
// Other callers leave it unhydrated so the next visit reads fresh storage.
export function clearConversation(readyFor: string | null = null): void {
  ++hydration;
  useConversation.setState({ draft: null, readyFor });
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Storage may be blocked. */
  }
}
