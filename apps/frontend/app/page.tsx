"use client";
import { OnboardingHeader } from "@/features/onboarding/components/onboarding-header";
import { OnboardingQuestions } from "@/features/onboarding/components/onboarding-questions";
import { OnboardingTitle } from "@/features/onboarding/components/onboarding-title";
import { useState } from "react";

export default function Home() {
  const [state, setState] = useState<"load" | "onboarding">("load");
  return (
    <div className="flex flex-1 flex-col bg-[#EAECE5] p-2 md:p-10">
      <OnboardingHeader />
      <OnboardingTitle state={state} setState={setState} />
      <OnboardingQuestions state={state} />
    </div>
  );
}
