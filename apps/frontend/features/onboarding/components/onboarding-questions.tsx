"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { onboardingQuestions } from "@/features/onboarding/questions";
import { cn } from "@/lib/utils";
import { useState } from "react";

export const OnboardingQuestions = ({
  state,
}: {
  state: "load" | "onboarding";
}) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answer, setAnswer] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [allAnswers, setAllAnswers] = useState(() =>
    Array.from({ length: onboardingQuestions.length }, () => ""),
  );

  const navigateQuestion = (nextQuestion: number) => {
    if (
      nextQuestion < 0 ||
      nextQuestion > onboardingQuestions.length ||
      !answer.trim()
    ) {
      return;
    }
    setAllAnswers((prev) =>
      prev.map((value, index) =>
        index === currentQuestion ? answer.trim() : value,
      ),
    );
    setAnswer("");
    setCurrentQuestion(nextQuestion);
  };

  return (
    <div
      className={cn(
        "hidden flex-col items-center opacity-0",
        state === "onboarding" &&
          "z-100 flex pt-2 opacity-100 transition-opacity duration-300 md:pt-10",
      )}
    >
      <div className="flex w-full flex-col gap-2 md:w-[50%]">
        <div className="flex flex-col gap-3 rounded-md border border-amber-400 bg-amber-500/5 px-4 pt-4 pb-2 shadow-sm md:px-10 md:pt-10 md:pb-5">
          <h3 className="text-lg font-semibold">
            {onboardingQuestions[currentQuestion]}
          </h3>
          <Input
            className="outline- h-10! rounded-md! border bg-white/50! text-lg! ring-0 focus-visible:border-0 focus-visible:ring-amber-400"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <div className="mt-2 flex items-center justify-end gap-2 md:mt-5">
            {currentQuestion > 0 && (
              <Button
                className="w-fit p-5! text-lg"
                size="lg"
                disabled={!answer.trim()}
                variant="secondary"
                onClick={() => navigateQuestion(currentQuestion - 1)}
              >
                Previous
              </Button>
            )}
            {currentQuestion + 1 < onboardingQuestions.length && (
              <Button
                className="w-fit bg-amber-700! p-5! text-lg"
                size="lg"
                disabled={!answer.trim()}
                onClick={() => navigateQuestion(currentQuestion + 1)}
              >
                Next
              </Button>
            )}
            {currentQuestion + 1 == onboardingQuestions.length && (
              <Button
                className="w-fit bg-amber-700! p-5! text-lg"
                size="lg"
                disabled={!answer.trim()}
              >
                Complete
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 px-2">
          <div className="text-muted-foreground shrink-0 text-sm">
            {currentQuestion + 1} / {onboardingQuestions.length}
          </div>
          <progress
            className="w-full"
            max={onboardingQuestions.length}
            value={currentQuestion + 1}
          />
        </div>
      </div>
    </div>
  );
};
