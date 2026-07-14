"use client";

import { ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Skin } from "@/features/onboarding/skin";

// One skinned single-select option row: a toggle button with a check mark.
// Shared by the question body and the transfer step so the option chip stays
// identical everywhere. Pass a `key` at the call site.
export const SkinnedOption = ({
  option,
  skin,
}: {
  option: { id: string; label: string };
  skin: Skin;
}) => (
  <ToggleGroupItem value={option.id} className={skin.option}>
    <span>{option.label}</span>
    <span aria-hidden className={skin.optionCheck}>
      ✓
    </span>
  </ToggleGroupItem>
);
