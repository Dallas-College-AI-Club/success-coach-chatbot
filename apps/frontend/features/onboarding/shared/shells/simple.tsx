"use client";

import { Button } from "@/components/ui/button";
import type { Skin, WizardProps } from "@/features/onboarding/skin";
import { ChatHandoff } from "@/features/onboarding/shared/chat-handoff";
import { QuickActions } from "@/features/onboarding/shared/quick-actions";
import { StepTransition } from "@/features/onboarding/shared/step-transition";
import { useHeadingFocus } from "@/features/onboarding/shared/use-heading-focus";
import {
  QuestionBody,
  WizardControls,
} from "@/features/onboarding/shared/wizard-parts";
import { useEffect, useRef, type ReactNode } from "react";

// A compact greeter avatar for each bot message.
const MiniBot = () => (
  <svg viewBox="0 0 32 32" className="mt-0.5 size-7 shrink-0" role="img" aria-hidden>
    <rect x="5" y="8" width="22" height="18" rx="7" fill="#2E2555" />
    <rect x="9" y="12" width="14" height="10" rx="4" fill="#ECEAFE" />
    <circle cx="14" cy="17" r="1.8" fill="#2E2555" />
    <circle cx="20" cy="17" r="1.8" fill="#2E2555" />
    <line x1="16" y1="4" x2="16" y2="8" stroke="#2E2555" strokeWidth="2" strokeLinecap="round" />
    <circle cx="16" cy="3.5" r="2" fill="#6C5CE7" />
  </svg>
);

// Palette comes from skin.bubble — the same token the chat's transcript uses,
// so the wizard and the chat cannot drift apart.
const BotBubble = ({ skin, children }: { skin: Skin; children: ReactNode }) => (
  <div className="flex items-start gap-2">
    <MiniBot />
    <div data-role="assistant" className={skin.bubble}>
      {children}
    </div>
  </div>
);

// Simple — a familiar chat. The bot asks each question in a message bubble; your
// answers sit back as your own bubbles; new questions slide in like a real
// conversation. When finished, the recap arrives as one more bot message, so the
// chat simply continues instead of cutting to a new page.
export const SimpleShell = ({ api, skin, copy, done, onRestart }: WizardProps) => {
  const headingRef = useHeadingFocus(
    done ? "done" : `${api.stepIdx}:${api.current.kind}`,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  // Normal finish: the transcript above IS the recap, so show only the steps the
  // student actually answered — a skip-all can finish with unanswered steps still
  // in the branch. Resumed (a returning student jumped straight here): the wizard
  // beneath is fresh, so the completion bubble recaps from the saved summary.
  const convo = (
    done && !done.resumed ? api.steps : api.steps.slice(0, api.stepIdx)
  ).filter((s) => api.answers[s.id]?.display);

  // Keep the newest message in view as the conversation grows. An explicit
  // ScrollToOptions.behavior overrides the reduced-motion `scroll-behavior:
  // auto` from globals.css, so honour the preference here directly.
  useEffect(() => {
    const el = scrollRef.current;
    el?.scrollTo({
      top: el.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [api.stepIdx, done]);

  return (
    <div className={`${skin.surface} flex h-[min(720px,calc(100dvh_-_8.5rem))] w-full flex-col gap-3 p-3 sm:p-4`}>
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 py-1"
      >
        {convo.map((s, i) => (
          <div key={s.id} className="flex flex-col gap-3">
            <BotBubble skin={skin}>{s.prompt}</BotBubble>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => !done && api.goToStep(i)}
                title={done ? undefined : "Change this answer"}
                data-role="user"
                className={`${skin.bubble} text-left ${
                  done ? "cursor-default" : "transition-opacity hover:opacity-90"
                }`}
              >
                {api.answers[s.id]?.display}
              </button>
            </div>
          </div>
        ))}

        {done ? (
          <div className="flex flex-col gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
            <div className="flex items-start gap-2">
              <MiniBot />
              <div data-role="assistant" className={skin.bubble}>
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-[15px] font-semibold outline-none"
                >
                  {copy.completionHeadline}
                </h1>
                {done.resumed && done.summary.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[13px] font-semibold text-[#2E2555]/70">
                      Here&apos;s what you told me last time
                    </p>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {done.summary.map((line, i) => (
                        <li
                          key={`${line}-${i}`}
                          className="flex items-start gap-2 text-[15px] leading-snug"
                        >
                          <span aria-hidden className="mt-0.5 text-[#6C5CE7]">
                            ✓
                          </span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-2">
                  <ChatHandoff skin={skin} />
                </div>
                <div className="mt-3">
                  <QuickActions skin={skin} />
                </div>
              </div>
            </div>
            <div className="pl-9">
              <Button
                variant="ghost"
                className={skin.ghostBtn}
                onClick={onRestart}
              >
                {copy.restart}
              </Button>
            </div>
          </div>
        ) : (
          <StepTransition
            stepIdx={api.stepIdx}
            dir={api.dir}
            className="flex flex-col gap-3"
          >
            <div className="flex items-start gap-2">
              <MiniBot />
              <div data-role="assistant" className={skin.bubble}>
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-[15px] leading-snug font-semibold outline-none"
                >
                  {api.current.prompt}
                </h1>
                {api.stepIdx === 0 && (
                  <p className="mt-1 text-sm text-[#2E2555]/70">
                    {copy.reassurance}
                  </p>
                )}
              </div>
            </div>
            <div className="pl-9">
              <QuestionBody api={api} skin={skin} copy={copy} />
            </div>
          </StepTransition>
        )}
      </div>

      {!done && <WizardControls api={api} skin={skin} copy={copy} />}
    </div>
  );
};
