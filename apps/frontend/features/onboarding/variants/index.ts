import type { Mode } from "@/features/onboarding/skin";
import { focus } from "@/features/onboarding/variants/focus";
import { playful } from "@/features/onboarding/variants/playful";
import { simple } from "@/features/onboarding/variants/simple";

// The experiences a student can pick on the first screen. `simple` is first and
// is the fallback default. To remove a mode, delete its file and drop it here.
export const MODES: Mode[] = [simple, playful, focus];

/** The saved-look lookup, with the fallback rule stated above living in code. */
export function modeFromId(id: string | undefined | null): Mode {
  return MODES.find((m) => m.id === id) ?? MODES[0];
}

export { simple, playful, focus };
