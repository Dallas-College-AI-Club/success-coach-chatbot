"use client";

import { buildPayload, isStepAnswered } from "@/features/onboarding/build-payload";
import {
  AUDIENCE_OPTIONS,
  followUpsFor,
  goalStepFor,
  MIN_STEPS,
} from "@/features/onboarding/questions";
import { emit } from "@/features/onboarding/telemetry";
import type {
  OnboardingPayload,
  OnboardingQuestion,
  StepAnswer,
} from "@/features/onboarding/types";
import { useRef, useState } from "react";

const stepsFor = (answers: Record<string, StepAnswer>): OnboardingQuestion[] => [
  goalStepFor(answers),
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
  // Shared with buildPayload's skip accounting: on the goal step the audience
  // placeholder (student_type set, goal still null) is not a real answer yet.
  const answered = isStepAnswered(current.id, answers);
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
      // Audience links (dual-credit/parent) set a goal contrib but aren't one of
      // the six goal buttons — don't highlight a button the student never tapped.
      if (!answers["goal"]?.optionIds.main?.startsWith("goal_")) return "";
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
    const answer: StepAnswer = {
      contribs: { goal: null, student_type: aud.studentType },
      display: aud.label,
      optionIds: { main: aud.id },
    };
    emit("audience_link_tap", { student_type: aud.studentType });
    const next = { goal: answer };
    setAnswers(next);
    setDir(1);
    // International refines the goal step in place (a new/returning toggle + the
    // same goals), so stay on step 0 as it re-renders. Dual-credit is a shortcut
    // straight to the one question it needs.
    if (aud.studentType === "international") {
      setStepIdx(0);
      return;
    }
    const nextSteps = stepsFor(next);
    if (nextSteps.length <= 1) finishWith(next, nextSteps, "completed");
    else setStepIdx(1);
  };

  // Drop a committed international goal back to the just-tapped placeholder
  // (student_type kept, goal cleared), staying on step 0. Used when the
  // new/returning toggle flips so a stale goal never ships under the wrong
  // status. Reuses the exact placeholder chooseAudience creates.
  const clearIntlGoal = () => {
    const intl = AUDIENCE_OPTIONS.find((a) => a.studentType === "international");
    if (!intl) return;
    setAnswers({
      goal: {
        contribs: { goal: null, student_type: "international" },
        display: intl.label,
        optionIds: { main: intl.id },
      },
    });
    setDir(1);
    setStepIdx(0);
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
    clearIntlGoal,
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
