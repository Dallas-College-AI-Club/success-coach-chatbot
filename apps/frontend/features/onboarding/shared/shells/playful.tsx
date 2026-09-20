"use client";

import { PlayfulField } from "@/features/onboarding/shared/scenes/playful-field";
import type { WizardProps } from "@/features/onboarding/skin";
import { RecapPanel } from "@/features/onboarding/shared/recap-panel";
import { StepTransition } from "@/features/onboarding/shared/step-transition";
import {
  AnswerChips,
  QuestionBody,
  QuestionHeading,
  WizardControls,
} from "@/features/onboarding/shared/wizard-parts";

// Playful keeps the shared question flow in a centered card. The full viewport
// field is decorative and remains behind the card through the recap.

// The progress bar. Fills proportionally to the step position (step of total),
// then completes to 100% on the recap. No numeric percentage is shown — with only
// a few short steps a precise % reads as a false claim; the "Step X of Y" label
// carries the honest progress. Rendered once, above both card states, so the fill
// animates smoothly into the finish — the "reached the end" payoff.
const ProgressBar = ({ pct, label }: { pct: number; label: string }) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-xs font-extrabold tracking-wide text-[#E52626] uppercase">
      {label}
    </span>
    <div
      className="h-3 w-full overflow-hidden rounded-full bg-[#003385]/12 shadow-[inset_0_1px_2px_rgba(0,51,133,.12)]"
      role="progressbar"
      aria-label="Progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={label}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#E52626] to-[#ff5a48] transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  </div>
);

export const PlayfulShell = ({
  api,
  skin,
  copy,
  done,
  onRestart,
}: WizardProps) => {
  // Fill tracks the step position (step of total), counting the recap as the final
  // fraction, so the bar rises evenly and only reaches 100% at the recap — never a
  // dramatic jump on a short flow, and never full while a question is still open.
  const progress = ((api.stepIdx + 1) / (api.total + 1)) * 100;

  return (
    <div className="w-full">
      <PlayfulField />

      {/* the note — a stable-height card so the frame never resizes between
          steps; long content scrolls within the card. */}
      <div className="relative z-20 flex flex-col items-center justify-start p-4 sm:p-6">
        <div className="flex h-[min(720px,calc(100dvh_-_11.5rem))] w-full flex-col gap-3 overflow-y-auto rounded-3xl bg-white/95 p-5 shadow-[0_10px_30px_rgba(51,65,92,.14)] backdrop-blur-md sm:w-[470px] md:p-6">
          {/* Above both branches so it carries into the recap and fills to 100%. */}
          <ProgressBar
            pct={done ? 100 : progress}
            label={
              done ? "All done!" : `Step ${api.stepIdx + 1} of ${api.total}`
            }
          />
          {done ? (
            <RecapPanel
              summary={done.summary}
              onRestart={onRestart}
              skin={skin}
              copy={copy}
            />
          ) : (
            <>
              <AnswerChips api={api} skin={skin} />

              <StepTransition
                stepIdx={api.stepIdx}
                dir={api.dir}
                className="flex flex-col gap-4"
              >
                <QuestionHeading
                  api={api}
                  skin={skin}
                  copy={copy}
                  className="gap-1"
                />
                <QuestionBody api={api} skin={skin} copy={copy} />
              </StepTransition>

              <div className="mt-auto">
                <WizardControls api={api} skin={skin} copy={copy} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
