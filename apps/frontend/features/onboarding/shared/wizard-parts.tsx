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
import { ToggleGroup } from "@/components/ui/toggle-group";
import { AUDIENCE_OPTIONS } from "@/features/onboarding/questions";
import { CapabilityDialog } from "@/features/onboarding/shared/capability-dialog";
import { SkinnedOption } from "@/features/onboarding/shared/skinned-option";
import { TransferStep } from "@/features/onboarding/shared/transfer-step";
import { useHeadingFocus } from "@/features/onboarding/shared/use-heading-focus";
import type { Copy, Skin } from "@/features/onboarding/skin";
import type { OnboardingApi } from "@/features/onboarding/use-onboarding";
type Parts = { api: OnboardingApi; skin: Skin; copy: Copy };

// The interactive body of the current question — identical logic across every
// mode; the shells arrange everything around it differently. The `switch` on the
// question kind is exhaustive: a new QuestionKind won't compile until it's handled.
export const QuestionBody = ({ api, skin, copy }: Parts) => {
  const { current } = api;

  const field = () => {
    switch (current.kind) {
      case "buttons":
        return (
          <ToggleGroup
            type="single"
            aria-label={current.prompt}
            value={api.selectedId(current)}
            onValueChange={(id: string) => id && api.answerOption(current, id)}
            spacing={2}
            orientation="vertical"
            className="w-full items-stretch"
          >
            {current.options?.map((o) => (
              <SkinnedOption key={o.id} option={o} skin={skin} />
            ))}
          </ToggleGroup>
        );
      case "picker":
        return (
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
        );
      case "transferOrigin":
        return (
          <TransferStep
            existing={api.answers[current.id]}
            onAnswer={(a) => api.commit(current.id, a)}
            onClear={() => api.clearAnswer(current.id)}
            skin={skin}
          />
        );
      default: {
        const _exhaustive: never = current.kind;
        return _exhaustive;
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {field()}

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

// The question prompt heading + first-step reassurance, shared by the Focus and
// Playful shells (Simple shows its prompt inside a chat bubble instead). Owns the
// heading focus so the right heading is announced as each step changes.
export const QuestionHeading = ({
  api,
  skin,
  copy,
  className = "gap-2",
}: Parts & { className?: string }) => {
  const headingRef = useHeadingFocus(api.stepIdx);
  return (
    <div className={`flex flex-col ${className}`}>
      <h1 ref={headingRef} tabIndex={-1} className={skin.heading}>
        {api.current.prompt}
      </h1>
      {api.stepIdx === 0 && <p className={skin.helper}>{copy.reassurance}</p>}
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
