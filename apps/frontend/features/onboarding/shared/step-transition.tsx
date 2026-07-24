import type { ReactNode } from "react";

// A direction-aware enter transition for the current step. The direction comes
// from the state machine (forward slides in from the right, back from the left)
// — the small cue that makes stepping feel deliberate rather than jumpy.
// Enter-only, so there is never a moment with two questions on screen.
export function StepTransition({
  stepIdx,
  dir = 1,
  children,
  className = "",
}: {
  stepIdx: number;
  dir?: 1 | -1;
  children: ReactNode;
  className?: string;
}) {
  const slide =
    dir >= 0
      ? "motion-safe:slide-in-from-right-6"
      : "motion-safe:slide-in-from-left-6";
  return (
    <div
      key={stepIdx}
      className={`motion-safe:animate-in motion-safe:fade-in motion-safe:duration-[350ms] motion-safe:ease-out ${slide} ${className}`}
    >
      {children}
    </div>
  );
}
