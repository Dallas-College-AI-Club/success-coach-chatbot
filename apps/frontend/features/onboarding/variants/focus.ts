import type { Mode } from "@/features/onboarding/skin";
import { FocusShell } from "@/features/onboarding/shared/shells/focus";
import { spaceGrotesk } from "@/features/onboarding/variants/fonts";

// Focus — calm and motivating. A marker climbs a mountain trail beside the
// question, one leg per answer, and a flag is planted at the summit at the end.
// Cool slate-and-sky palette, one coral accent for the marker and selection.
// Space Grotesk keeps it modern.
export const focus: Mode = {
  id: "focus",
  name: "Focus",
  icon: "⛰️",
  blurb: "Calm and steady. Climb toward the summit.",
  fontClass: spaceGrotesk.className,
  Wizard: FocusShell,
  skin: {
    page: "flex min-h-dvh w-full flex-col items-center justify-center gap-5 bg-[#EDF2F7] p-4 text-[#2B3A4A] md:p-8 [--ring:#ec5f56]",
    shell: "mx-auto flex w-full max-w-3xl flex-col items-stretch gap-4",
    sectionLabel: "font-mono text-sm tabular-nums tracking-wide text-[#5E7690]",
    heading: "text-3xl font-semibold text-[#2B3A4A] outline-none md:text-4xl",
    helper: "text-sm text-[#2B3A4A]/55",
    option:
      "group/opt flex h-auto! min-h-10 w-full items-center justify-between gap-3 rounded-xl border border-[#2B3A4A]/15 bg-white/60 px-3.5 py-2 text-left text-sm whitespace-normal pointer-coarse:min-h-11 text-[#2B3A4A] backdrop-blur-[1px] transition-all hover:border-[#7C93AC] hover:bg-[#7C93AC]/[0.10] focus-visible:ring-2 focus-visible:ring-[#ec5f56] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EDF2F7] motion-safe:hover:-translate-y-0.5 data-[state=on]:border-[#ec5f56] data-[state=on]:bg-[#ec5f56]/[0.07] data-[state=on]:ring-2 data-[state=on]:ring-[#ec5f56]",
    optionCheck:
      "shrink-0 text-lg leading-none text-[#ec5f56] opacity-0 transition-opacity group-data-[state=on]/opt:opacity-100",
    chip: "inline-flex items-center gap-1.5 rounded-full bg-[#7C93AC]/15 px-3 py-1 text-sm text-[#2B3A4A] transition-colors hover:bg-[#7C93AC]/25 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-2",
    chipCheck: "text-[#5E7690]",
    primaryBtn:
      "h-11 rounded-full bg-[#2B3A4A] px-6 font-medium text-white hover:bg-[#212d3a] motion-safe:active:scale-[0.98]",
    ghostBtn: "h-11 rounded-full px-3 text-[#2B3A4A]/75",
    link: "inline-flex items-center text-[#2B3A4A]/60 underline underline-offset-4 hover:text-[#2B3A4A] pointer-coarse:min-h-11",
    picker: "rounded-xl border border-[#2B3A4A]/20 bg-white/85",
    surface:
      "rounded-2xl border border-[#2B3A4A]/12 bg-white/70 shadow-[0_10px_30px_rgba(43,58,74,.08)] backdrop-blur-[1px]",
    // The hairline border the other modes don't need: at bg-white/70 over the
    // page's #EDF2F7 the text contrast is fine but the turn boundary is not.
    bubble:
      "max-w-[85%] rounded-xl border border-[#2B3A4A]/12 bg-white/70 px-4 py-2.5 text-[15px] leading-snug whitespace-pre-wrap text-[#2B3A4A] backdrop-blur-[1px] data-[role=user]:border-transparent data-[role=user]:bg-[#2B3A4A] data-[role=user]:text-white",
  },
  copy: {
    reassurance: "No wrong answers. Change anything later.",
    later: "I'll do this later",
    audienceLead: "Or are you…",
    next: "Next",
    done: "Done",
    back: "← Back",
    pickerPlaceholder: "Try “nursing,” “business,” or “welding”",
    pickerEmpty: "No match yet. Try a shorter word, or pick “I'm still figuring it out.”",
    composerPlaceholder: "Ask a question.",
    completionHeadline: "That's a solid start.",
    restart: "Start over",
    capabilityTrigger: "What can Major help with?",
    capabilityTitle: "What Major can help with",
    capabilityDesc: "Major is a planning tool. Here's the kind of thing you can ask.",
  },
};
