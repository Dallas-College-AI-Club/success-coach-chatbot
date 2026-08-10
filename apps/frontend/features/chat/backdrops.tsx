"use client";

import { CampusCritters } from "@/features/onboarding/shared/scenes/campus-critters";
import { PlayfulScene } from "@/features/onboarding/shared/scenes/campus-scene";
import { FocusMountain } from "@/features/onboarding/shared/scenes/focus-mountain";

// Each mode's onboarding scene, continued behind the chat — so arriving does
// not cut to a blank page. Purely decorative (aria-hidden, pointer-events
// none); legibility over the busy playful scene is carried by the panel's
// bg-white/95 + backdrop-blur surface, which exists for exactly this.
// Simple has no scene in onboarding, so it gets none here either.
export function ChatBackdrop({ modeId }: { modeId: string }) {
  if (modeId === "playful") {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <PlayfulScene />
        <CampusCritters />
      </div>
    );
  }
  if (modeId === "focus") {
    // The mountain, summited — the flag the student planted at the recap stays
    // planted. Kept to wide screens; on phones the panel needs the room.
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-6 left-4 hidden h-[60vh] max-h-[560px] w-[236px] lg:block"
      >
        <FocusMountain stepIdx={0} total={1} done />
      </div>
    );
  }
  return null;
}
