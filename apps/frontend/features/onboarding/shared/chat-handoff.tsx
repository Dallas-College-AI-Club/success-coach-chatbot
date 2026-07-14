"use client";

import { Button } from "@/components/ui/button";
import {
  authorityNotes,
  coachVerifyLine,
  handoffIntro,
  internationalNote,
  starterPromptsFor,
} from "@/features/onboarding/handoff-copy";
import type { Skin } from "@/features/onboarding/skin";
import type { OnboardingPayload } from "@/features/onboarding/types";
import { useRouter } from "next/navigation";

// The chat hand-off shown at the end of onboarding. The wizard doesn't finish
// here — it opens INTO the planning chat (strategy §6/§9.2: "exits into the first
// cited answer, not a 'you're all set' screen"). Until the chat backend lands this
// previews that chat: what it will help with, the kind of questions it takes, and
// the human-coach step that makes a plan official. It states no academic outcome.
export function ChatHandoff({
  payload,
  skin,
}: {
  payload: OnboardingPayload;
  skin: Skin;
}) {
  const router = useRouter();
  const notes = [...authorityNotes(payload), ...internationalNote(payload)];
  const prompts = starterPromptsFor(payload);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <p className="text-sm">{handoffIntro(payload)}</p>
        <div aria-hidden className="flex flex-wrap gap-1.5">
          {prompts.map((q) => (
            <span
              key={q}
              className="rounded-full border border-current/15 px-3 py-1 text-xs opacity-70"
            >
              {q}
            </span>
          ))}
        </div>
      </div>

      {notes.map((n) => (
        <p key={n} className="flex items-start gap-2 text-sm">
          <span aria-hidden className={`${skin.chipCheck} mt-0.5`}>
            →
          </span>
          {n}
        </p>
      ))}

      <p className="flex items-start gap-2 text-sm">
        <span aria-hidden className={`${skin.chipCheck} mt-0.5`}>
          ★
        </span>
        {coachVerifyLine(payload)}
      </p>

      <Button
        className={`${skin.primaryBtn} mt-1 self-start`}
        onClick={() => router.push("/chat")}
      >
        Start planning chat →
      </Button>
    </div>
  );
}
