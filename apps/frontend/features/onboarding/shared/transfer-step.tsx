"use client";

import { ToggleGroup } from "@/components/ui/toggle-group";
import { directionOptions, schoolOptions } from "@/features/onboarding/questions";
import { SkinnedOption } from "@/features/onboarding/shared/skinned-option";
import type { Skin } from "@/features/onboarding/skin";
import type { StepAnswer, TransferDirection } from "@/features/onboarding/types";
import { useEffect, useRef, useState } from "react";

const SHORT: Record<TransferDirection, string> = {
  outbound: "Transferring to a university",
  transfer_back: "Taking one class here",
  inbound: "Bringing in past credits",
};

// Direction chip + school picker on one step (keeps the transfer branch within
// the three-question budget). "Inbound" completes on its own; the other
// directions reveal the school picker.
export const TransferStep = ({
  existing,
  onAnswer,
  onClear,
  skin,
}: {
  existing?: StepAnswer;
  onAnswer: (a: StepAnswer) => void;
  onClear: () => void;
  skin: Skin;
}) => {
  const restoredDir = existing?.optionIds.direction;
  const [dirId, setDirId] = useState<string | undefined>(restoredDir);

  const dir = directionOptions.find((d) => d.id === dirId);
  const direction = dir?.contribs.transfer_direction as
    | TransferDirection
    | undefined;

  const dirGroupRef = useRef<HTMLDivElement>(null);
  const schoolPromptRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (dir && direction !== "inbound") schoolPromptRef.current?.focus();
    else dirGroupRef.current?.focus();
  }, [dirId, dir, direction]);

  const chooseDirection = (id: string) => {
    if (!id) return;
    const opt = directionOptions.find((d) => d.id === id);
    if (!opt) return;
    if (existing && existing.optionIds.direction !== id) onClear();
    if (opt.contribs.transfer_direction === "inbound") {
      onAnswer({
        contribs: { transfer_direction: "inbound", target_institution: null },
        display: SHORT.inbound,
        optionIds: { direction: id },
      });
      return;
    }
    setDirId(id);
  };

  const chooseSchool = (schoolId: string) => {
    if (!schoolId || !dir || !direction) return;
    const school = schoolOptions.find((s) => s.id === schoolId);
    if (!school) return;
    onAnswer({
      contribs: { ...dir.contribs, ...school.contribs },
      display: `${SHORT[direction]} · ${school.label}`,
      optionIds: { direction: dir.id, school: schoolId },
    });
  };

  if (!dir || !direction || direction === "inbound") {
    return (
      <ToggleGroup
        ref={dirGroupRef}
        tabIndex={-1}
        type="single"
        aria-label="Which of these sounds like you?"
        value={dirId ?? ""}
        onValueChange={chooseDirection}
        spacing={2}
        orientation="vertical"
        className="w-full items-stretch outline-none"
      >
        {directionOptions.map((o) => (
          <SkinnedOption key={o.id} option={o} skin={skin} />
        ))}
      </ToggleGroup>
    );
  }

  const schoolPrompt =
    direction === "outbound"
      ? "Where are you hoping to transfer?"
      : "Which college do you normally attend?";

  // The bucket options fit both directions; "Not sure yet" only fits the outbound
  // "where are you transferring" question, not the visiting "where do you attend".
  const visibleSchools = schoolOptions.filter(
    (s) => s.showFor === "both" || (direction === "outbound" && s.showFor === "outbound"),
  );

  return (
    <div className="flex w-full flex-col gap-4">
      <button
        type="button"
        onClick={() => {
          if (existing) onClear();
          setDirId(undefined);
        }}
        className={skin.link}
      >
        {SHORT[direction]} — change
      </button>
      <p ref={schoolPromptRef} tabIndex={-1} className="font-medium outline-none">
        {schoolPrompt}
      </p>
      <ToggleGroup
        type="single"
        aria-label={schoolPrompt}
        value={existing?.optionIds.school ?? ""}
        onValueChange={chooseSchool}
        spacing={2}
        className="flex flex-wrap justify-start"
      >
        {visibleSchools.map((o) => (
          <SkinnedOption key={o.id} option={o} skin={skin} />
        ))}
      </ToggleGroup>
    </div>
  );
};
