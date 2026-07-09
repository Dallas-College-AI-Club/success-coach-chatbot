import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Image from "next/image";

export const OnboardingTitle = ({
  state,
  setState,
}: {
  state: "load" | "onboarding";
  setState: (state: "load" | "onboarding") => void;
}) => {
  return (
    <div className="mx-auto flex max-w-120 flex-col items-center">
      <div>
        <Image
          src="/title.png"
          alt="Success Coach Chatbot"
          width={state === "load" ? 640 : 320}
          height={state === "load" ? 461 : 230}
          loading="eager"
          className="transition-all duration-700"
          style={{ width: "auto", height: "auto" }}
        />
      </div>
      <h2
        className={cn(
          "hidden text-center text-xl font-medium text-neutral-700 italic text-shadow-2xs",
          state === "load" && "flex",
        )}
      >
        Helping you on your path to an education.
      </h2>
      <Button
        size="lg"
        className={cn(
          "mt-4 hidden max-w-80 p-7! text-lg!",
          state === "load" && "flex",
        )}
        onClick={() => setState("onboarding")}
      >
        Get Started
      </Button>
    </div>
  );
};
