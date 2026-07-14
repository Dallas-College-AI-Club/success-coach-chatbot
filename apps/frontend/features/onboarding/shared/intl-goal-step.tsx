"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { INTL_STATUSES, intlGoalOptions } from "@/features/onboarding/questions";
import { SkinnedOption } from "@/features/onboarding/shared/skinned-option";
import type { Skin } from "@/features/onboarding/skin";
import type { IntlStatus, StepAnswer } from "@/features/onboarding/types";
import { useState } from "react";

// The goal step, refined for an international student (rendered in place of the
// standard goal buttons once they tap "an international student"). A small
// new/returning toggle filters the doors — "plan my first semester" and "settle
// in" only make sense for someone just arriving — and the shared goals sit below.
// Picking a goal commits it TOGETHER with the international status, so no extra
// question is needed and the flow stays within the four-question budget.
export const IntlGoalStep = ({
  existing,
  onAnswer,
  onClear,
  onExit,
  skin,
}: {
  existing?: StepAnswer;
  onAnswer: (a: StepAnswer) => void;
  /** Drop a committed goal back to the international placeholder (status kept). */
  onClear: () => void;
  /** Leave the international path entirely, back to the standard goal question. */
  onExit: () => void;
  skin: Skin;
}) => {
  // Default to "incoming": a student prepping to move is the likeliest visitor,
  // and it's the only status that shows every door. Restore on Back.
  const restored = existing?.contribs.intl_status as IntlStatus | undefined;
  const [status, setStatus] = useState<IntlStatus>(restored ?? "incoming");

  const statusId = INTL_STATUSES.find((s) => s.value === status)!.id;
  const options = intlGoalOptions(status);
  // Only highlight a goal that survives the current filter (switching to
  // "already studying" drops "plan my first semester").
  const selectedGoal = options.some((o) => o.id === existing?.optionIds.main)
    ? (existing?.optionIds.main ?? "")
    : "";

  const chooseStatus = (id: string) => {
    const next = INTL_STATUSES.find((s) => s.id === id);
    if (!next || next.value === status) return;
    setStatus(next.value);
    // A goal picked under the old status carries the old intl_status; drop it so
    // the committed answer can never disagree with the toggle now on screen.
    if (existing?.contribs.goal != null) onClear();
  };

  const chooseGoal = (goalId: string) => {
    const opt = options.find((o) => o.id === goalId);
    if (!opt) return;
    onAnswer({
      contribs: {
        ...opt.contribs,
        student_type: "international",
        intl_status: status,
      },
      display: opt.label,
      optionIds: { main: goalId, status: statusId },
    });
  };

  return (
    <div className="flex w-full flex-col gap-4">
      {/* New vs. returning: a compact segmented pair on one line, distinct from
          the goal rows below. */}
      <ToggleGroup
        type="single"
        aria-label="Are you new to Dallas College or already studying here?"
        value={statusId}
        onValueChange={(id: string) => id && chooseStatus(id)}
        spacing={2}
        className="flex w-full"
      >
        {INTL_STATUSES.map((s) => (
          <ToggleGroupItem
            key={s.id}
            value={s.id}
            className="min-h-9 flex-1 rounded-lg border border-current/20 px-2 py-1.5 text-center text-sm font-medium whitespace-normal text-current/70 transition-colors hover:border-current/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] data-[state=on]:border-current data-[state=on]:bg-current/[0.07] data-[state=on]:font-semibold data-[state=on]:text-current pointer-coarse:min-h-11"
          >
            {s.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <ToggleGroup
        type="single"
        aria-label="What would you like help with?"
        value={selectedGoal}
        onValueChange={(id: string) => id && chooseGoal(id)}
        spacing={2}
        orientation="vertical"
        className="w-full items-stretch"
      >
        {options.map((o) => (
          <SkinnedOption key={o.id} option={o} skin={skin} />
        ))}
      </ToggleGroup>
      <button type="button" onClick={onExit} className={`${skin.link} self-start`}>
        Not an international student?
      </button>
    </div>
  );
};
