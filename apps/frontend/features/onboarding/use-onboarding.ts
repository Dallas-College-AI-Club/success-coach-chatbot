"use client";

import { buildPayload } from "@/features/onboarding/build-payload";
import {
  AUDIENCE_OPTIONS,
  followUpsFor,
  goalQuestion,
  MIN_STEPS,
} from "@/features/onboarding/questions";
import { emit } from "@/features/onboarding/telemetry";
import type {
  GoalValue,
  OnboardingPayload,
  OnboardingQuestion,
  StepAnswer,
} from "@/features/onboarding/types";
import { useRef, useState } from "react";

const stepsFor = (answers: Record<string, StepAnswer>): OnboardingQuestion[] => [
  goalQuestion,
  ...followUpsFor(answers).filter((q) => q.shipped),
];

/**
 * The onboarding state machine, shared by every visual variant. All the logic
 * that has to be correct (branch switching, derived skips, single guarded exit,
 * audience routing) lives here; variants only render.
 */
export function useOnboarding(
  onComplete: (p: OnboardingPayload, summary: string[]) => void,
) {
  const [answers, setAnswers] = useState<Record<string, StepAnswer>>({});
  const [stepIdx, setStepIdx] = useState(0);
  // Which way the last move went, so the step transition can slide accordingly.
  const [dir, setDir] = useState<1 | -1>(1);
  const submitted = useRef(false);

  const steps = stepsFor(answers);
  const current = steps[stepIdx];
  const isLast = stepIdx >= steps.length - 1;
  const answered = Boolean(answers[current.id]);
  const studentType = answers["goal"]?.contribs.student_type ?? null;
  // Before a goal is chosen the branch is unknown, so seed the count with the
  // shortest possible flow; once a goal is picked it becomes the real length.
  // This way the progress count only grows, never snaps down.
  const total = answers["goal"]?.contribs.goal ? steps.length : MIN_STEPS;

  const answeredChips = steps
    .slice(0, stepIdx)
    .map((s, i) => ({ id: s.id, idx: i, display: answers[s.id]?.display }))
    .filter((c): c is { id: string; idx: number; display: string } =>
      Boolean(c.display),
    );

  const selectedId = (q: OnboardingQuestion): string => {
    if (q.id === "goal") {
      const g = answers["goal"]?.contribs.goal ?? null;
      return q.options?.find((o) => o.contribs.goal === g)?.id ?? "";
    }
    return answers[q.id]?.optionIds.main ?? "";
  };

  const finishWith = (
    finalAnswers: Record<string, StepAnswer>,
    branch: OnboardingQuestion[],
    reason: "completed" | "skip_all",
  ) => {
    if (submitted.current) return;
    submitted.current = true;
    const payload = buildPayload(finalAnswers, branch);
    // The exact labels the student chose, in order — so every answer (including
    // the last one, and "Anytime"/"Undecided") is shown back, not re-derived.
    const summary = branch
      .filter((s) => finalAnswers[s.id])
      .map((s) => finalAnswers[s.id].display);
    emit(reason === "skip_all" ? "onboarding_skipped" : "onboarding_completed", {
      skippedSteps: payload.skippedSteps,
    });
    onComplete(payload, summary);
  };

  const commit = (stepId: string, answer: StepAnswer) => {
    const existing = answers[stepId];
    const goalSwitched =
      stepId === "goal" &&
      existing &&
      existing.optionIds.main !== answer.optionIds.main;
    const next = goalSwitched
      ? { goal: answer }
      : { ...answers, [stepId]: answer };

    setAnswers(next);
    emit("question_answered", { step: stepId });

    const nextSteps = stepsFor(next);
    const idx = nextSteps.findIndex((s) => s.id === stepId);
    if (idx >= nextSteps.length - 1) finishWith(next, nextSteps, "completed");
    else {
      setDir(1);
      setStepIdx(idx + 1);
    }
  };

  const clearAnswer = (stepId: string) =>
    setAnswers((prev) => {
      if (!prev[stepId]) return prev;
      const next = { ...prev };
      delete next[stepId];
      return next;
    });

  const answerOption = (question: OnboardingQuestion, optionId: string) => {
    const option = question.options?.find((o) => o.id === optionId);
    if (!option) return;
    commit(question.id, {
      contribs: option.contribs,
      display: option.label,
      optionIds: { main: optionId },
    });
  };

  const chooseAudience = (aud: (typeof AUDIENCE_OPTIONS)[number]) => {
    const goal: GoalValue | null =
      aud.studentType === "dual_credit" ? "graduation_check" : null;
    const answer: StepAnswer = {
      contribs: { goal, student_type: aud.studentType },
      display: aud.label,
      optionIds: { main: aud.id },
    };
    emit("audience_link_tap", { student_type: aud.studentType });
    const next = { goal: answer };
    setAnswers(next);
    const nextSteps = stepsFor(next);
    if (nextSteps.length <= 1) finishWith(next, nextSteps, "completed");
    else {
      setDir(1);
      setStepIdx(1);
    }
  };

  return {
    answers,
    steps,
    current,
    stepIdx,
    dir,
    total,
    isLast,
    answered,
    studentType,
    answeredChips,
    selectedId,
    answerOption,
    commit,
    clearAnswer,
    chooseAudience,
    goNext: () => {
      if (isLast) return finishWith(answers, steps, "completed");
      setDir(1);
      setStepIdx(stepIdx + 1);
    },
    back: () => {
      setDir(-1);
      setStepIdx((i) => Math.max(0, i - 1));
    },
    goToStep: (idx: number) => {
      setDir(idx >= stepIdx ? 1 : -1);
      setStepIdx(idx);
    },
    finishNow: (reason: "completed" | "skip_all" = "skip_all") =>
      finishWith(answers, steps, reason),
  };
}

export type OnboardingApi = ReturnType<typeof useOnboarding>;
