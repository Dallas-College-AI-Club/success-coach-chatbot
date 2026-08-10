import type { ComponentType } from "react";
import type { OnboardingApi } from "@/features/onboarding/use-onboarding";

/** Set once the flow finishes, so a shell can show the recap in its own scene.
 *  `resumed` marks a returning student who jumped straight here from a saved
 *  session — there is no live transcript, so a shell must recap from `summary`.
 *  (The payload itself lives in the session store; the chat seeds from there.) */
export type DoneState = { summary: string[]; resumed?: boolean } | null;

export interface WizardProps {
  api: OnboardingApi;
  skin: Skin;
  copy: Copy;
  done: DoneState;
  onRestart: () => void;
}

// A Skin is the full set of Tailwind class strings a visual variant supplies to
// the shared onboarding components. Swapping a Skin (plus a Copy and a font)
// produces a completely different look over identical logic.
export interface Skin {
  /** Full-height page background + base text colour. */
  page: string;
  /** Centred content column. */
  shell: string;
  /** Small meta/section label — the progress folio, and the recap + quick-action headings. */
  sectionLabel: string;
  heading: string;
  helper: string;
  option: string;
  optionCheck: string;
  chip: string;
  chipCheck: string;
  /** Primary action (Next / Done). */
  primaryBtn: string;
  /** Secondary/ghost action (Back). */
  ghostBtn: string;
  /** Quiet underline links (later, audience). */
  link: string;
  picker: string;
  /** The mode's panel — colour, border and shadow only. Geometry stays at the
   *  call site, exactly as `picker` carries only radius/border/background. */
  surface: string;
  /** One conversation turn. The student's turn is the same box inverted, via a
   *  `data-[role=user]:` chain — the idiom `option` already uses for
   *  `data-[state=on]:`. One slot, not two. */
  bubble: string;
}

// Variant-specific copy. Question prompts stay shared (questions.ts); this covers
// the framing the tone lives in.
export interface Copy {
  reassurance: string;
  later: string;
  audienceLead: string;
  next: string;
  done: string;
  back: string;
  pickerPlaceholder: string;
  pickerEmpty: string;
  /** The chat composer's placeholder — the one string the chat needs that the
   *  wizard does not. */
  composerPlaceholder: string;
  completionHeadline: string;
  restart: string;
  capabilityTrigger: string;
  capabilityTitle: string;
  capabilityDesc: string;
}

// A style the student can switch to at any time.
export interface Mode {
  id: string;
  /** Short name shown in the switcher. */
  name: string;
  /** Emoji + one-line blurb shown on the welcome page's pick-a-look card. */
  icon: string;
  blurb: string;
  /** next/font className applied while this mode is active. */
  fontClass: string;
  skin: Skin;
  copy: Copy;
  /** The wizard shell — each mode arranges the questions (and the end recap) its
   *  own way, keeping its scene mounted throughout. */
  Wizard: ComponentType<WizardProps>;
}
