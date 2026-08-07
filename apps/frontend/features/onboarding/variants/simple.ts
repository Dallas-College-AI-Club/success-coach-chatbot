import type { Mode } from "@/features/onboarding/skin";
import { SimpleShell } from "@/features/onboarding/shared/shells/simple";

// Simple — the clean/basic look: a calm chat on soft lavender, deep-violet text,
// and filled lavender answer chips. Bright indigo-violet is the accent (ring,
// progress, check); dark violet carries text and primary buttons. Manrope (the
// app default).
export const simple: Mode = {
  id: "simple",
  name: "Simple",
  icon: "💬",
  blurb: "A clean, familiar chat.",
  fontClass: "",
  Wizard: SimpleShell,
  skin: {
    page: "flex min-h-dvh w-full flex-col items-center justify-center gap-3 bg-[#F6F5FF] p-4 text-[#2E2555] md:p-8 [--ring:#6C5CE7]",
    shell: "mx-auto flex w-full max-w-lg flex-col items-center gap-3",
    sectionLabel: "text-sm font-medium text-[#2E2555]/60",
    heading: "text-xl font-semibold text-[#2E2555] outline-none md:text-2xl",
    helper: "text-sm text-[#2E2555]/60",
    option:
      "group/opt flex h-auto! min-h-10 w-full items-center justify-between gap-3 rounded-xl border border-[#2E2555]/12 bg-[#ECEAFE] px-3.5 py-2 text-left text-sm whitespace-normal pointer-coarse:min-h-11 text-[#2E2555] transition-[border-color,box-shadow,background-color] hover:bg-[#DED8FC] focus-visible:ring-2 focus-visible:ring-[#6C5CE7] focus-visible:ring-offset-2 data-[state=on]:border-[#5B4BD6] data-[state=on]:bg-[#D3CBFA] data-[state=on]:ring-2 data-[state=on]:ring-[#6C5CE7]",
    optionCheck:
      "shrink-0 text-lg leading-none text-[#5B4BD6] opacity-0 transition-opacity group-data-[state=on]/opt:opacity-100",
    chip: "inline-flex items-center gap-1.5 rounded-full bg-[#2E2555]/[0.07] px-3 py-1 text-sm text-[#2E2555] transition-colors hover:bg-[#2E2555]/15 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-2",
    chipCheck: "text-[#5B4BD6]",
    primaryBtn:
      "h-11 bg-[#2E2555] px-6 font-medium text-white hover:bg-[#241C46] motion-safe:active:scale-[0.98]",
    ghostBtn: "h-11 px-3 text-[#2E2555]",
    link: "inline-flex items-center text-[#2E2555]/70 underline underline-offset-4 pointer-coarse:min-h-11",
    picker: "rounded-xl border border-[#2E2555]/20 bg-white",
  },
  copy: {
    reassurance: "No wrong answers. You can change anything later.",
    later: "Skip to chat →",
    audienceLead: "Or are you…",
    next: "Next",
    done: "Done",
    back: "← Back",
    pickerPlaceholder: "Try “nursing,” “business,” or “welding”",
    pickerEmpty: "No match yet. Try a shorter word, or pick “I'm still figuring it out.”",
    completionHeadline: "That's a solid start.",
    restart: "Start over",
    capabilityTrigger: "What can Major help with?",
    capabilityTitle: "What Major can help with",
    capabilityDesc: "Major is a planning tool. Here's the kind of thing you can ask.",
  },
};
