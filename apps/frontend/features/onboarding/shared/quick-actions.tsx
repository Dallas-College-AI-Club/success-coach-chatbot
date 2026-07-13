"use client";

import type { Skin } from "@/features/onboarding/skin";
import { useRouter } from "next/navigation";

// A short, quiet row of next-step shortcuts at the end of onboarding. Kept
// intentionally minimal so the close stays scannable, not overwhelming. Each
// opens the planning chat, where the topic is answered or routed to the office
// that owns it; when those surfaces ship they can point at the real destination.
const QUICK_ACTIONS = [
  "Register for classes",
  "Academic calendar",
  "Financial aid",
  "Tutoring",
  "Campus events",
  "Talk to a Success Coach",
];

export function QuickActions({ skin }: { skin: Skin }) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-1.5">
      <p className={skin.progressLabel}>Quick actions</p>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_ACTIONS.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => router.push("/chat")}
            className="rounded-full border border-current/15 px-3 py-1 text-xs opacity-80 transition-opacity hover:opacity-100"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
