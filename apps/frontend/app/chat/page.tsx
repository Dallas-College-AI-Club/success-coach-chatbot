import Link from "next/link";

// Placeholder for the planning chat (issue #3 / strategy View 3). The onboarding
// "Start planning chat" button routes here; the real chat — LLM + RAG over the
// verified Dallas College catalog — replaces this page. Kept intentionally minimal
// so it reads as "your chat opens here," not a broken link.
export default function ChatPage() {
  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center bg-[#ECECEC] p-4 text-[#33415c]">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-3xl border border-[#33415c]/10 bg-white p-6 shadow-[0_1px_3px_rgba(51,65,92,.06),0_10px_30px_rgba(51,65,92,.07)]">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#33415c] text-lg text-white">
            💬
          </div>
          <div className="rounded-2xl rounded-tl-sm bg-[#EEF1F6] px-4 py-3 text-[15px] leading-snug">
            <p className="font-semibold">Your planning chat opens here.</p>
            <p className="mt-1.5 text-[#33415c]/70">
              I&apos;m the Dallas College Success Coach assistant. I can look up
              degree requirements, check prerequisites, map transfer credits, and
              help draft a semester plan — every answer linked to the official
              catalog. Your onboarding answers carry over so we start where you
              left off.
            </p>
          </div>
        </div>

        <div
          aria-hidden
          className="flex items-center gap-2 rounded-full border border-[#33415c]/12 bg-[#F5F6F8] px-4 py-2.5 text-sm text-[#33415c]/45"
        >
          <span className="flex-1">Message the Success Coach…</span>
          <span className="text-lg">➤</span>
        </div>

        <Link
          href="/"
          className="text-sm font-medium text-[#33415c]/70 underline underline-offset-4"
        >
          ← Back to start
        </Link>
      </div>
    </main>
  );
}
