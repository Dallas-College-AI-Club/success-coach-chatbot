"use client";

import { Button } from "@/components/ui/button";
import { ChatHandoff } from "@/features/onboarding/shared/chat-handoff";
import { QuickActions } from "@/features/onboarding/shared/quick-actions";
import type { Copy, Skin } from "@/features/onboarding/skin";
import type { OnboardingPayload } from "@/features/onboarding/types";
import { useEffect, useRef } from "react";

// The end-of-flow panel. It is a HAND-OFF, not a finish line: a brief recap of
// what the student told me, then the opening of the planning chat (ChatHandoff),
// where the plan is actually crafted and a coach later verifies it. Rendered in
// each mode's panel slot so the mode's scene stays behind it.
export function RecapPanel({
  payload,
  summary,
  onRestart,
  skin,
  copy,
  className = "",
}: {
  payload: OnboardingPayload;
  summary: string[];
  onRestart: () => void;
  skin: Skin;
  copy: Copy;
  className?: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      className={`flex w-full flex-col gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 ${className}`}
    >
      <h1 ref={headingRef} tabIndex={-1} className={skin.heading}>
        {copy.completionHeadline}
      </h1>

      {summary.length > 0 && (
        <div>
          <p className={`mb-1.5 ${skin.progressLabel}`}>What you told me</p>
          <ul className="flex flex-col gap-1.5">
            {summary.map((line, i) => (
              <li key={`${line}-${i}`} className="flex items-center gap-2 text-sm">
                <span aria-hidden className={skin.chipCheck}>
                  ✓
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ChatHandoff payload={payload} skin={skin} />

      <QuickActions skin={skin} />

      <div className="mt-auto">
        <Button variant="ghost" className={skin.ghostBtn} onClick={onRestart}>
          {copy.restart}
        </Button>
      </div>
    </div>
  );
}
