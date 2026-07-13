"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AUDIENCE_OPTIONS } from "@/features/onboarding/questions";
import { CapabilityDialog } from "@/features/onboarding/shared/capability-dialog";
import { TransferStep } from "@/features/onboarding/shared/transfer-step";
import type { Copy, Skin } from "@/features/onboarding/skin";
import type { OnboardingApi } from "@/features/onboarding/use-onboarding";
import { useEffect, useRef } from "react";

// Focus the current question's heading whenever the step changes.
export function useHeadingFocus(dep: unknown) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [dep]);
  return ref;
}

type Parts = { api: OnboardingApi; skin: Skin; copy: Copy };

// The interactive body of the current question — identical logic across every
// mode; the shells arrange everything around it differently.
export const QuestionBody = ({ api, skin, copy }: Parts) => {
  const { current } = api;
  const option = (o: { id: string; label: string }) => (
    <ToggleGroupItem key={o.id} value={o.id} className={skin.option}>
      <span>{o.label}</span>
      <span aria-hidden className={skin.optionCheck}>
        ✓
      </span>
    </ToggleGroupItem>
  );

  return (
    <div className="flex flex-col gap-4">
      {current.kind === "buttons" && (
        <ToggleGroup
          role="radiogroup"
          type="single"
          aria-label={current.prompt}
          value={api.selectedId(current)}
          onValueChange={(id: string) => id && api.answerOption(current, id)}
          spacing={2}
          orientation="vertical"
          className="w-full items-stretch"
        >
          {current.options?.map(option)}
        </ToggleGroup>
      )}

      {current.kind === "picker" && (
        <Command className={skin.picker}>
          <CommandInput
            placeholder={copy.pickerPlaceholder}
            aria-label={current.prompt}
          />
          <CommandList>
            <CommandEmpty>{copy.pickerEmpty}</CommandEmpty>
            <CommandGroup>
              {current.options?.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.label}
                  onSelect={() => api.answerOption(current, o.id)}
                >
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      )}

      {current.kind === "transferOrigin" && (
        <TransferStep
          existing={api.answers[current.id]}
          onAnswer={(a) => api.commit(current.id, a)}
          onClear={() => api.clearAnswer(current.id)}
          skin={skin}
        />
      )}

      {api.stepIdx === 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-sm opacity-80">
          <span>{copy.audienceLead}</span>
          {AUDIENCE_OPTIONS.map((aud) => (
            <button
              key={aud.id}
              type="button"
              onClick={() => api.chooseAudience(aud)}
              className={skin.link}
            >
              {aud.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const AnswerChips = ({ api, skin }: { api: OnboardingApi; skin: Skin }) => {
  const prev =
    api.stepIdx > 0
      ? api.answeredChips[api.answeredChips.length - 1]?.display
      : null;
  return (
    <>
      {api.answeredChips.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2"
          aria-label="Your answers so far — tap to change"
        >
          {api.answeredChips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => api.goToStep(c.idx)}
              className={skin.chip}
            >
              <span aria-hidden className={skin.chipCheck}>
                ✓
              </span>
              {c.display}
            </button>
          ))}
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {prev ? `Saved: ${prev}` : ""}
      </p>
    </>
  );
};

export const WizardControls = ({
  api,
  skin,
  copy,
  border = true,
}: Parts & { border?: boolean }) => (
  <div
    className={`flex flex-col gap-3 ${border ? "border-t border-current/10 pt-4" : ""}`}
  >
    <div className="flex items-center justify-between">
      <div>
        {api.stepIdx > 0 && (
          <Button variant="ghost" className={skin.ghostBtn} onClick={api.back}>
            {copy.back}
          </Button>
        )}
      </div>
      {api.answered && (
        <Button className={skin.primaryBtn} onClick={api.goNext}>
          {api.isLast ? copy.done : copy.next}
        </Button>
      )}
    </div>
    <div className="flex items-center justify-between text-sm">
      <button
        type="button"
        onClick={() => api.finishNow("skip_all")}
        className={skin.link}
      >
        {copy.later}
      </button>
      <CapabilityDialog skin={skin} copy={copy} />
    </div>
  </div>
);
