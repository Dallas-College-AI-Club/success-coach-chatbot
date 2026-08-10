import type { UIMessage } from "ai";
import {
  authorityNotes,
  coachVerifyLine,
  handoffIntro,
} from "@/features/onboarding/handoff-copy";
import type { SavedSession } from "@/features/onboarding/onboarding-store";

// The hand-off is not a screen — it is the coach's first turn. All of this copy
// already lived in handoff-copy.ts; seeding it via useChat's `messages` option
// ("Initial chat messages to populate the conversation with",
// docs/07-reference/02-ai-sdk-ui/01-use-chat.mdx) is what lets the recap screen
// stay a single button and keeps the model briefed on the student for free.

/** Stable id for the seeded turn — a re-render must not mint a new message,
 *  and the announcer uses it to skip the seed. */
export const SEED_ID = "coach-intro";

const COLD_VISIT_INTRO = [
  "Hey, I'm Major 👋 — your Dallas College planning companion.",
  "Ask me about degree requirements, prerequisites, or planning your semester. A Success Coach reviews everything and makes your plan official.",
].join("\n\n");

/** The coach's opening turn. With a completed onboarding it replays the
 *  student's answers; a cold visit still gets a greeting, so the transcript is
 *  never empty. */
export function seedMessages(session: SavedSession | null): UIMessage[] {
  const text = session
    ? [
        session.summary.length
          ? ["Here's what you told me:", ...session.summary.map((s) => `• ${s}`)].join("\n")
          : "",
        ...authorityNotes(session.payload),
        coachVerifyLine(session.payload),
        // Ends by inviting a question ("You could ask:"), so it goes last —
        // it flows straight into the starter chips rendered underneath.
        handoffIntro(session.payload),
      ]
        .filter(Boolean)
        .join("\n\n")
    : COLD_VISIT_INTRO;

  return [{ id: SEED_ID, role: "assistant", parts: [{ type: "text", text }] }];
}
