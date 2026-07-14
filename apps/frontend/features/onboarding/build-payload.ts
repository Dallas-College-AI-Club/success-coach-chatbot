import { ONBOARDING_VERSION } from "@/features/onboarding/questions";
import type {
  OnboardingPayload,
  OnboardingQuestion,
  StepAnswer,
} from "@/features/onboarding/types";

/**
 * Assemble the console payload from the answers of the *resolved* branch.
 *
 * A step present in `answers` is answered (even when its value is null, e.g.
 * "Not sure yet"); a step in the branch but absent from `answers` is a skip.
 * Deriving `skippedSteps` here — rather than tracking it as the user clicks —
 * keeps the record correct across Back-navigation and branch changes.
 */
export function buildPayload(
  answers: Record<string, StepAnswer>,
  branch: OnboardingQuestion[],
  international = false,
): OnboardingPayload {
  const payload: OnboardingPayload = {
    goal: null,
    major: null,
    target_institution: null,
    student_type: null,
    modality_pref: null,
    dayparts_pref: null,
    transfer_direction: null,
    interest_area: null,
    oneoff_purpose: null,
    skippedSteps: [],
    onboardingVersion: ONBOARDING_VERSION,
    completedAt: new Date().toISOString(),
    international,
  };

  for (const step of branch) {
    const answer = answers[step.id];
    if (answer) Object.assign(payload, answer.contribs);
  }

  payload.skippedSteps = branch
    .map((step) => step.id)
    .filter((id) => !answers[id]);

  return payload;
}
