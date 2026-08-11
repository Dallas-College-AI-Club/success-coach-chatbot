import type { Mode } from "@/features/onboarding/skin";
import { PlayfulShell } from "@/features/onboarding/shared/shells/playful";
import { nunito } from "@/features/onboarding/variants/fonts";

// Playful — the lively look: a stroll across a continuous campus with the Dallas
// College mascots cheering you on, in the official colors (blue #003385, red
// #E52626, silver #D6D2C4). Blue leads text and buttons; red is the accent (white
// on red fails AA, so red never fills a text button). Nunito keeps it friendly.
export const playful: Mode = {
  id: "playful",
  name: "Playful",
  icon: "🐾",
  blurb: "A bright, colorful world with the mascots.",
  fontClass: nunito.className,
  Wizard: PlayfulShell,
  skin: {
    page: "flex min-h-dvh w-full flex-col items-center justify-center gap-3 bg-[#F2EFE6] p-4 text-[#1E2A3A] md:p-8 [--ring:#E52626]",
    shell: "mx-auto flex w-full max-w-2xl flex-col items-stretch gap-3",
    sectionLabel: "text-sm font-semibold text-[#E52626]",
    heading: "text-2xl font-bold text-[#003385] outline-none",
    helper: "text-sm text-[#1E2A3A]/65",
    option:
      "group/opt flex h-auto! min-h-10 w-full items-center justify-between gap-3 rounded-2xl border-2 border-[#003385]/15 bg-white px-3.5 py-2 text-left text-sm whitespace-normal pointer-coarse:min-h-11 text-[#1E2A3A] transition-all hover:border-[#003385] hover:bg-[#003385]/5 focus-visible:ring-2 focus-visible:ring-[#E52626] focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5 data-[state=on]:border-[#E52626] data-[state=on]:bg-[#E52626]/10 data-[state=on]:ring-2 data-[state=on]:ring-[#E52626]",
    optionCheck:
      "shrink-0 text-xl leading-none text-[#E52626] opacity-0 transition-all group-data-[state=on]/opt:opacity-100 motion-safe:group-data-[state=on]/opt:animate-in motion-safe:group-data-[state=on]/opt:zoom-in-50",
    chip: "inline-flex items-center gap-1.5 rounded-full bg-[#003385]/10 px-3 py-1 text-sm font-medium text-[#1E2A3A] transition-colors hover:bg-[#003385]/20 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-2",
    chipCheck: "text-[#E52626]",
    primaryBtn:
      "h-12 rounded-full bg-[#003385] px-7 font-bold text-white hover:bg-[#00276a] motion-safe:active:scale-[0.97]",
    ghostBtn: "h-11 rounded-full px-4 text-[#1E2A3A]",
    link: "inline-flex items-center font-medium text-[#003385] underline underline-offset-4 pointer-coarse:min-h-11",
    picker: "rounded-2xl border-2 border-[#003385]/20 bg-white",
    // bg-white/95 + backdrop-blur is load-bearing, not decoration: transcript
    // text over the animated campus panorama is a WCAG 1.4.3 failure otherwise.
    surface:
      "rounded-3xl bg-white/95 shadow-[0_10px_30px_rgba(51,65,92,.14)] backdrop-blur-md",
    // Blue fills the student's turn; red never fills a text surface (white on
    // red fails AA — see the palette note above).
    bubble:
      "max-w-[85%] rounded-2xl rounded-tl-sm border-2 border-[#003385]/12 bg-white px-4 py-2.5 text-[15px] leading-snug whitespace-pre-wrap text-[#1E2A3A] data-[role=user]:rounded-tl-2xl data-[role=user]:rounded-br-sm data-[role=user]:border-transparent data-[role=user]:bg-[#003385] data-[role=user]:text-white",
  },
  copy: {
    reassurance: "No wrong answers. Tweak anything later 👍",
    later: "Finish this later",
    audienceLead: "Or are you…",
    next: "Next →",
    done: "Finish 🎉",
    back: "← Back",
    pickerPlaceholder: "Try “nursing,” “business,” or “welding”",
    pickerEmpty: "Hmm, no match. Try a shorter word, or “I'm still figuring it out.”",
    composerPlaceholder: "Ask Major anything 💬",
    completionHeadline: "Woohoo, solid start! 🎉",
    restart: "Start over",
    capabilityTrigger: "What can Major do?",
    capabilityTitle: "What Major can help with",
    capabilityDesc: "Major's a planning tool. Here's the kind of stuff you can ask.",
  },
};
