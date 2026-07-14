"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { shippedIntents } from "@/features/onboarding/shipped-intents";
import type { Copy, Skin } from "@/features/onboarding/skin";
import { emit } from "@/features/onboarding/telemetry";

export const CapabilityDialog = ({
  skin,
  copy,
}: {
  skin: Skin;
  copy: Copy;
}) => {
  return (
    <Dialog onOpenChange={(open) => open && emit("capability_opened")}>
      <DialogTrigger className={skin.link}>{copy.capabilityTrigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.capabilityTitle}</DialogTitle>
          <DialogDescription>{copy.capabilityDesc}</DialogDescription>
        </DialogHeader>
        <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
          {shippedIntents().map((intent) => (
            <li
              key={intent.id}
              className="rounded-md border border-current/15 px-4 py-3 text-sm opacity-90"
            >
              {intent.example}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
};
