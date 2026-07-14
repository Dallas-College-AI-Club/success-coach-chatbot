"use client";

import { FocusMountain } from "@/features/onboarding/shared/scenes/focus-mountain";
import type { WizardProps } from "@/features/onboarding/skin";
import { RecapPanel } from "@/features/onboarding/shared/recap-panel";
import { StepTransition } from "@/features/onboarding/shared/step-transition";
import {
  AnswerChips,
  QuestionBody,
  QuestionHeading,
  WizardControls,
} from "@/features/onboarding/shared/wizard-parts";

// Focus — calm and motivating. A marker climbs a mountain trail beside the
// question, one leg per answer, and a flag is planted at the summit on the last
// step. The mountain stays mounted through the finish, so the recap slides in
// beside the summit rather than cutting to a new page.
export const FocusShell = ({ api, skin, copy, done, onRestart }: WizardProps) => {
  const folio = `${String(api.stepIdx + 1).padStart(2, "0")} / ${String(
    api.total,
  ).padStart(2, "0")}`;

  return (
    <div className="flex min-h-[460px] w-full flex-col-reverse gap-4 sm:h-[min(720px,calc(100dvh_-_8.5rem))] sm:min-h-0 sm:flex-row sm:items-stretch sm:gap-8">
      {/* the mountain — mounted once; at the summit once the climb is done */}
      <div className="h-48 shrink-0 sm:h-auto sm:w-[34%]">
        <FocusMountain stepIdx={api.stepIdx} total={api.total} done={!!done} />
      </div>

      {/* the question, or the recap once finished — beside the same mountain */}
      <div className="flex flex-1 flex-col gap-6 sm:min-h-0 sm:overflow-y-auto">
        {done ? (
          <RecapPanel
            payload={done.payload}
            summary={done.summary}
            onRestart={onRestart}
            skin={skin}
            copy={copy}
            className="sm:flex-1"
          />
        ) : (
          <>
            <p className={skin.sectionLabel}>{folio}</p>
            <StepTransition
              stepIdx={api.stepIdx}
              dir={api.dir}
              className="flex flex-col gap-6"
            >
              <AnswerChips api={api} skin={skin} />
              <QuestionHeading api={api} skin={skin} copy={copy} />
              <QuestionBody api={api} skin={skin} copy={copy} />
            </StepTransition>
            <div className="mt-auto">
              <WizardControls api={api} skin={skin} copy={copy} border={false} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
