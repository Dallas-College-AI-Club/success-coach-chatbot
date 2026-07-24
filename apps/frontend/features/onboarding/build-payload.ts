import { ONBOARDING_VERSION } from "@/features/onboarding/questions";
import type {
  OnboardingPayload,
  OnboardingQuestion,
  StepAnswer,
} from "@/features/onboarding/types";

/**
 * Whether a step counts as answered. The goal step is special: tapping an
 * audience link ("an international student") fills `answers["goal"]` with a
 * placeholder whose `goal` is still null, so a present-but-null goal is a skip,
 * not a pick. One source of truth, shared with the wizard's `answered`
 * derivation, so "skipped" and "can advance" never disagree.
 */
export function isStepAnswered(
  id: string,
  answers: Record<string, StepAnswer>,
): boolean {
  if (id === "goal") return answers["goal"]?.contribs.goal != null;
  return Boolean(answers[id]);
}

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
    intl_status: null,
    skippedSteps: [],
    onboardingVersion: ONBOARDING_VERSION,
    completedAt: new Date().toISOString(),
  };

  for (const step of branch) {
    const answer = answers[step.id];
    if (answer) Object.assign(payload, answer.contribs);
  }

  payload.skippedSteps = branch
    .map((step) => step.id)
    .filter((id) => !isStepAnswered(id, answers));

  return payload;
}
