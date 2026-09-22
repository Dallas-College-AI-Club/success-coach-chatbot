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

// Small, static composer translations advertise multilingual chat without a
// translation request or a second language preference to keep in sync.
const COMPOSER_COPY: Record<string, string> = {
  es: "Pregúntale lo que quieras a Major",
  ko: "Major에게 무엇이든 물어보세요",
  vi: "Hỏi Major bất cứ điều gì",
  zh: "有什么问题都可以问 Major",
  "zh-Hant": "有什麼問題都可以問 Major",
  fr: "Posez vos questions à Major",
  pt: "Pergunte o que quiser ao Major",
  ar: "اسأل Major أي سؤال",
  hi: "Major से कुछ भी पूछें",
  ur: "Major سے کوئی بھی سوال پوچھیں",
};

export function composerCopy(
  languages: readonly string[],
  englishPlaceholder: string,
) {
  for (const tag of languages) {
    const normalized = tag.trim().replaceAll("_", "-").toLowerCase();
    const base = normalized.split("-")[0];
    if (base === "en") break;
    const language =
      base === "zh" &&
      !normalized.split("-").includes("hans") &&
      /(?:^|-)(hant|tw|hk|mo)(?:-|$)/.test(normalized)
        ? "zh-Hant"
        : base;
    const copy = Object.hasOwn(COMPOSER_COPY, language)
      ? COMPOSER_COPY[language]
      : undefined;
    if (copy)
      return {
        language,
        placeholder: copy,
        direction:
          language === "ar" || language === "ur"
            ? ("rtl" as const)
            : ("ltr" as const),
      };
  }
  return {
    language: "en",
    placeholder: englishPlaceholder,
    direction: "ltr" as const,
  };
}

// A visitor who skipped onboarding has told us nothing, so this greeting says
// exploring first — the same place the undecided hand-off starts.
const COLD_VISIT_INTRO = [
  "Hey, I'm Major 👋 — your Dallas College planning companion.",
  "Ask me what programs there are, what you would study in one, or what a degree requires and how to plan your semester. A Success Coach reviews everything and makes your plan official.",
].join("\n\n");

/** The coach's opening turn. With a completed onboarding it replays the
 *  student's answers; a cold visit still gets a greeting, so the transcript is
 *  never empty. */
export function seedMessages(session: SavedSession | null): UIMessage[] {
  const text = session
    ? [
        session.summary.length
          ? [
              "Here's what you told me:",
              ...session.summary.map((s) => `- ${s}`),
            ].join("\n")
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
