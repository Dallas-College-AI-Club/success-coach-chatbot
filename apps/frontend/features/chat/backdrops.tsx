"use client";

import { PlayfulField } from "@/features/onboarding/shared/scenes/playful-field";
import { FocusMountain } from "@/features/onboarding/shared/scenes/focus-mountain";

// Each mode's onboarding scene, continued behind the chat — so arriving does
// not cut to a blank page. Purely decorative (aria-hidden, pointer-events
// none); legibility over the busy playful scene is carried by the panel's
// bg-white/95 + backdrop-blur surface, which exists for exactly this.
// Simple has no scene in onboarding, so it gets none here either.
export function ChatBackdrop({ modeId }: { modeId: string }) {
  if (modeId === "playful") {
    return <PlayfulField />;
  }
  if (modeId === "focus") {
    // The mountain, summited — full-screen, not a floating card. The wash
    // reuses the SVG's own sky stops (#E6EEF4→#F6EFE4) so its internal sky
    // rect blends invisibly, and the two ridge fills exit the SVG's right
    // edge flat (y=190 and y=224 of 320), so plain colour bands at matching
    // heights continue the horizon seamlessly across the page.
    return (
      <div
        aria-hidden
        className="coach-landscape pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#E6EEF4] to-[#F6EFE4]" />
        <div className="absolute inset-x-0 bottom-0 h-[46vh] md:h-[64vh]">
          {/* far ridge (exits at y=190 → bottom 40.6%) then near ridge (y=224 → 30%) */}
          <div className="absolute inset-x-0 bottom-0 h-[40.6%] bg-[#C3D0DD]" />
          <div className="absolute inset-x-0 bottom-0 h-[30%] bg-[#AEBFCF]" />
          <div className="absolute bottom-0 left-0 aspect-[200/320] h-full w-auto">
            <FocusMountain stepIdx={0} total={1} done />
          </div>
        </div>
      </div>
    );
  }
  return null;
}
