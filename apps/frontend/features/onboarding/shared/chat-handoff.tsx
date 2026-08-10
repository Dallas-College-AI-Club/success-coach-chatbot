"use client";

import { Button } from "@/components/ui/button";
import type { Skin } from "@/features/onboarding/skin";
import Link from "next/link";

// The door into /chat — the hand-off copy itself now arrives as the coach's
// first turn (features/chat/seed.ts). <Link> so the route prefetches while the
// student is still reading the recap (router.push does not).
export function ChatHandoff({ skin }: { skin: Skin }) {
  return (
    <Button asChild className={`${skin.primaryBtn} mt-1 self-start`}>
      <Link href="/chat">Start chat →</Link>
    </Button>
  );
}
