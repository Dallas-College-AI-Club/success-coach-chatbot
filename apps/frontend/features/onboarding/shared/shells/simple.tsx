"use client";

import { Button } from "@/components/ui/button";
import type { WizardProps } from "@/features/onboarding/skin";
import { ChatHandoff } from "@/features/onboarding/shared/chat-handoff";
import { QuickActions } from "@/features/onboarding/shared/quick-actions";
import { StepTransition } from "@/features/onboarding/shared/step-transition";
import {
  QuestionBody,
  useHeadingFocus,
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

const BotBubble = ({ children }: { children: ReactNode }) => (
  <div className="flex items-start gap-2">
    <MiniBot />
    <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[#EEEBFE] px-4 py-2.5 text-[15px] leading-snug text-[#2E2555]">
      {children}
    </div>
  </div>
);

// Simple — a familiar chat. The bot asks each question in a message bubble; your
// answers sit back as your own bubbles; new questions slide in like a real
// conversation. When finished, the recap arrives as one more bot message, so the
// chat simply continues instead of cutting to a new page.
export const SimpleShell = ({ api, skin, copy, done, onRestart }: WizardProps) => {
  const headingRef = useHeadingFocus(done ? "done" : api.stepIdx);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Normal finish: the whole transcript above IS the recap. Resumed (a returning
  // student jumped straight here): the wizard beneath is fresh, so there is no
  // transcript — the completion bubble recaps from the saved summary instead.
  const convo = done && !done.resumed ? api.steps : api.steps.slice(0, api.stepIdx);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [api.stepIdx, done]);

  return (
    <div className="flex h-[min(720px,calc(100dvh_-_8.5rem))] w-full flex-col gap-3 rounded-3xl border border-[#2E2555]/10 bg-white p-3 shadow-[0_1px_3px_rgba(51,65,92,.06),0_10px_30px_rgba(51,65,92,.07)] sm:p-4">
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 py-1"
      >
        {convo.map((s, i) => (
          <div key={s.id} className="flex flex-col gap-3">
            <BotBubble>{s.prompt}</BotBubble>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => !done && api.goToStep(i)}
                title={done ? undefined : "Change this answer"}
                className={`max-w-[85%] rounded-2xl rounded-br-sm bg-[#2E2555] px-4 py-2.5 text-left text-[15px] leading-snug text-white ${
                  done ? "cursor-default" : "transition-colors hover:bg-[#241C46]"
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
              <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-[#EEEBFE] px-4 py-3 text-[#2E2555]">
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-[15px] font-semibold outline-none"
                >
                  {copy.completionHeadline}
                </h2>
                {done.resumed && done.summary.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[13px] font-semibold text-[#2E2555]/55">
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
                  <ChatHandoff payload={done.payload} skin={skin} />
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
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[#EEEBFE] px-4 py-2.5 text-[#2E2555]">
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-[15px] leading-snug font-semibold outline-none"
                >
                  {api.current.prompt}
                </h2>
                {api.stepIdx === 0 && (
                  <p className="mt-1 text-sm text-[#2E2555]/55">
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

      {!done && (
        <div
          aria-hidden
          className="flex items-center gap-2 rounded-full border border-[#2E2555]/20 bg-white py-1.5 pr-1.5 pl-4 text-sm text-[#2E2555]/45 shadow-[0_1px_2px_rgba(15,61,54,.05)]"
        >
          <span className="flex-1">Chat is coming soon — tap an answer above</span>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#6C5CE7] text-base text-white">
            ➤
          </span>
        </div>
      )}
    </div>
  );
};
