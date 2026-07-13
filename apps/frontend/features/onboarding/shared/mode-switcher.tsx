"use client";

import type { Mode } from "@/features/onboarding/skin";

// Always-available style switcher. Uses currentColor so it adapts to whichever
// mode's palette is active (light or dark). Switching keeps the student's
// answers — only the look changes.
export const ModeSwitcher = ({
  modes,
  current,
  onSwitch,
}: {
  modes: Mode[];
  current: Mode;
  onSwitch: (m: Mode) => void;
}) => {
  if (modes.length < 2) return null;
  return (
    <div
      role="group"
      aria-label="Choose a style"
      className="flex items-center gap-1 rounded-full border border-current/15 p-1 text-xs pointer-coarse:gap-1.5"
    >
      {modes.map((m) => {
        const active = m.id === current.id;
        return (
          <button
            key={m.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSwitch(m)}
            className={`inline-flex items-center justify-center rounded-full px-3 py-1 transition-colors pointer-coarse:min-h-11 ${
              active
                ? "bg-current/15 font-semibold"
                : "opacity-60 hover:opacity-100"
            }`}
          >
            {m.name}
          </button>
        );
      })}
    </div>
  );
};
