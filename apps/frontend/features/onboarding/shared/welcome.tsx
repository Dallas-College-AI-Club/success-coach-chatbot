"use client";

import { Button } from "@/components/ui/button";
import {
  useSavedSession,
  type SavedSession,
} from "@/features/onboarding/onboarding-store";
import { AiClubLogo, SuccessCoachCover } from "@/features/onboarding/shared/brand";
import type { Mode } from "@/features/onboarding/skin";
import { useEffect, useRef, useState } from "react";

const BLURB: Record<string, string> = {
  simple: "A clean chat — quick and familiar.",
  playful: "A bright, colourful world with the mascots.",
  focus: "Calm and steady; climb toward the summit.",
};
const ICON: Record<string, string> = {
  simple: "💬",
  playful: "🐾",
  focus: "⛰️",
};

// The Success Coach mascot — a friendly rounded robot: blue-grey head, mint face
// screen with two bright eyes and a little smile, an orange antenna and side ears.
const BotAvatar = () => (
  <svg viewBox="0 0 64 64" className="size-14 shrink-0" role="img" aria-hidden>
    {/* antenna */}
    <line x1="32" y1="18" x2="32" y2="11" stroke="#2A2E36" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="32" cy="9" r="3.6" fill="#F7A22B" stroke="#2A2E36" strokeWidth="2" />
    {/* side ears */}
    <rect x="6" y="30" width="7" height="15" rx="3.5" fill="#F7A22B" stroke="#2A2E36" strokeWidth="2" />
    <rect x="51" y="30" width="7" height="15" rx="3.5" fill="#F7A22B" stroke="#2A2E36" strokeWidth="2" />
    {/* head */}
    <rect x="12" y="19" width="40" height="34" rx="13" fill="#BBC7D4" stroke="#2A2E36" strokeWidth="2.6" />
    {/* face screen */}
    <rect x="17" y="26" width="30" height="20" rx="9" fill="#A9E7E1" stroke="#2A2E36" strokeWidth="2" />
    {/* eyes + shine */}
    <circle cx="26" cy="35" r="3.4" fill="#2A2E36" />
    <circle cx="38" cy="35" r="3.4" fill="#2A2E36" />
    <circle cx="27.2" cy="33.8" r="1.1" fill="#FFFFFF" />
    <circle cx="39.2" cy="33.8" r="1.1" fill="#FFFFFF" />
    {/* smile */}
    <path d="M28 40.5 q4 2.6 8 0" stroke="#2A2E36" strokeWidth="1.6" fill="none" strokeLinecap="round" />
  </svg>
);

export function Welcome({
  modes,
  onStart,
  onResume,
}: {
  modes: Mode[];
  onStart: (m: Mode) => void;
  onResume: (session: SavedSession) => void;
}) {
  const [picked, setPicked] = useState<Mode>(modes[0]);
  // A saved session (from a previous visit) turns this into the returning-user
  // view. Read SSR-safely: null on the server and during hydration, then the
  // stored value on the client — so the "Welcome back" option appears without a
  // hydration mismatch.
  const returning = useSavedSession();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  const canPick = modes.length > 1;

  return (
    <main className="relative flex min-h-dvh w-full flex-col items-center justify-center gap-7 bg-[#ECECEC] p-6 text-[#1E2A3A]">
      <AiClubLogo className="absolute top-5 left-5 text-[#1E2A3A]" />

      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500">
        <h1
          ref={headingRef}
          tabIndex={-1}
          aria-label="Success Coach — Dallas College AI Club chat bot"
          className="outline-none"
        >
          <SuccessCoachCover />
        </h1>

        <div className="flex items-center gap-2 text-left">
          <BotAvatar />
          <p className="max-w-xs text-sm text-[#1E2A3A]/70">
            {canPick
              ? "Hey there — pick a look and I'll ask a few quick questions to point you the right way."
              : "Hey there — I'll ask a few quick questions to point you the right way."}
          </p>
        </div>

        {returning && (
          <>
            <button
              type="button"
              onClick={() => onResume(returning)}
              className="flex w-full items-center gap-3 rounded-2xl border-2 border-[#003385] bg-white px-4 py-3 text-left shadow-sm transition-all hover:bg-[#003385]/[0.04] focus-visible:ring-2 focus-visible:ring-[#003385] focus-visible:ring-offset-2 motion-safe:active:scale-[0.99]"
            >
              <span className="text-2xl" aria-hidden>
                👋
              </span>
              <span className="flex flex-col">
                <span className="font-semibold text-[#003385]">Welcome back!</span>
                <span className="text-sm text-[#1E2A3A]/60">
                  Pick up where you left off — jump to your summary.
                </span>
              </span>
              <span aria-hidden className="ml-auto text-lg text-[#003385]">
                →
              </span>
            </button>
            {canPick && (
              <p className="-mb-1 text-xs font-medium tracking-wide text-[#1E2A3A]/40 uppercase">
                Or start fresh
              </p>
            )}
          </>
        )}

        {canPick && (
          <div
            role="radiogroup"
            aria-label="Choose a look"
            className="flex w-full flex-col gap-2.5"
          >
            {modes.map((m) => {
              const on = m.id === picked.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPicked(m)}
                  className={`flex items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left transition-all focus-visible:ring-2 focus-visible:ring-[#E52626] focus-visible:ring-offset-2 ${
                    on
                      ? "border-[#E52626] ring-2 ring-[#E52626]/25"
                      : "border-[#003385]/12 hover:border-[#003385]/35"
                  }`}
                >
                  <span className="text-2xl" aria-hidden>
                    {ICON[m.id]}
                  </span>
                  <span className="flex flex-col">
                    <span className="font-semibold text-[#003385]">{m.name}</span>
                    <span className="text-sm text-[#1E2A3A]/60">{BLURB[m.id]}</span>
                  </span>
                  <span
                    aria-hidden
                    className={`ml-auto text-lg text-[#E52626] transition-opacity ${
                      on ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    ✓
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <Button
          onClick={() => onStart(picked)}
          className="h-12 w-full max-w-xs rounded-full bg-[#003385] text-base font-semibold text-white hover:bg-[#00276a] motion-safe:active:scale-[0.98]"
        >
          Start →
        </Button>

        <p className="text-xs text-[#1E2A3A]/45">
          Your answers are saved only in this browser — never to your student record.
        </p>
      </div>
    </main>
  );
}
