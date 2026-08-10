"use client";

import { Button } from "@/components/ui/button";
import { ChatHandoff } from "@/features/onboarding/shared/chat-handoff";
import { QuickActions } from "@/features/onboarding/shared/quick-actions";
import type { Copy, Skin } from "@/features/onboarding/skin";
import { useHeadingFocus } from "@/features/onboarding/shared/use-heading-focus";
// The end-of-flow panel. It is a HAND-OFF, not a finish line: a brief recap of
// what the student told me, then the door into the planning chat (ChatHandoff),
// where the payload arrives as the coach's first turn. Rendered in each mode's
// panel slot so the mode's scene stays behind it.
export function RecapPanel({
  summary,
  onRestart,
  skin,
  copy,
  className = "",
}: {
  summary: string[];
  onRestart: () => void;
  skin: Skin;
  copy: Copy;
  className?: string;
}) {
  const headingRef = useHeadingFocus(null);

  return (
    <div
      className={`flex w-full flex-col gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 ${className}`}
    >
      <h1 ref={headingRef} tabIndex={-1} className={skin.heading}>
        {copy.completionHeadline}
      </h1>

      {summary.length > 0 && (
        <div>
          <p className={`mb-1.5 ${skin.sectionLabel}`}>What you told me</p>
          <ul className="flex flex-col gap-1.5">
            {summary.map((line, i) => (
              <li key={`${line}-${i}`} className="flex items-start gap-2 text-sm">
                <span aria-hidden className={`${skin.chipCheck} mt-0.5`}>
                  ✓
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ChatHandoff skin={skin} />

      <QuickActions skin={skin} />

      <div className="mt-auto">
        <Button variant="ghost" className={skin.ghostBtn} onClick={onRestart}>
          {copy.restart}
        </Button>
      </div>
    </div>
  );
}
