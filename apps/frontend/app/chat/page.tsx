import Link from "next/link";
import { AiClubLogo } from "@/features/onboarding/shared/brand";
import { SuccessCoachBot } from "@/features/onboarding/shared/success-coach-bot";

// Placeholder for the planning chat (issue #3 / strategy View 3). The onboarding
// "Start planning chat" button routes here; the real chat — LLM + RAG over the
// verified Dallas College catalog — replaces this page. Kept intentionally minimal
// so it reads as "your chat opens here," not a broken link. Styled in Dallas
// College colours (blue #003385, red #E52626) and carrying the club branding.
export default function ChatPage() {
  return (
    <main className="relative flex min-h-dvh w-full flex-col items-center justify-center bg-gradient-to-b from-[#F4F7FC] to-[#E4ECF8] p-6 text-[#1E2A3A]">
      {/* Club branding — the AI Club logo and the Success Coach wordmark. */}
      <div className="absolute top-5 left-5 flex items-center gap-2.5">
        <AiClubLogo className="text-[#003385]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/title.png"
          alt="Success Coach"
          width={1182}
          height={852}
          style={{ height: 40, width: "auto" }}
        />
      </div>

      <div className="flex w-full max-w-md flex-col gap-4 rounded-3xl border border-[#003385]/12 bg-white p-6 shadow-[0_1px_3px_rgba(0,51,133,.06),0_12px_34px_rgba(0,51,133,.10)]">
        <div className="flex items-start gap-3">
          <SuccessCoachBot className="size-11" />
          <div className="rounded-2xl rounded-tl-sm bg-[#EAF1FB] px-4 py-3 text-[15px] leading-snug">
            <p className="font-semibold text-[#003385]">
              Hey, I&apos;m Koa 👋
            </p>
            <p className="mt-1.5 text-[#1E2A3A]/70">
              Your Dallas College planning companion. I&apos;m an AI, here to help
              you get a plan together from the official catalog: degree
              requirements, prerequisites, transfer credits, a first-semester map.
              Your answers carry over, so we pick up right where you left off. A
              Success Coach reviews everything and makes your plan official.
            </p>
          </div>
        </div>

        <div
          aria-hidden
          className="flex items-center gap-2 rounded-full border border-[#003385]/15 bg-[#F5F7FC] py-1.5 pr-1.5 pl-4 text-sm text-[#1E2A3A]/45"
        >
          <span className="flex-1">Ask Koa anything…</span>
          <span className="flex size-8 items-center justify-center rounded-full bg-[#003385] text-sm text-white">
            ➤
          </span>
        </div>

        <Link
          href="/"
          className="text-sm font-medium text-[#003385] underline underline-offset-4 hover:text-[#00276a]"
        >
          ← Back to start
        </Link>
      </div>
    </main>
  );
}
