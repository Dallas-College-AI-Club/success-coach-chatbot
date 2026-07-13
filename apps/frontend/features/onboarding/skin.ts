import type { ComponentType } from "react";
import type { OnboardingApi } from "@/features/onboarding/use-onboarding";
import type { OnboardingPayload } from "@/features/onboarding/types";

/** Set once the flow finishes, so a shell can show the recap in its own scene. */
export type DoneState = { payload: OnboardingPayload; summary: string[] } | null;

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
  progressLabel: string;
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
  /** next/font className applied while this mode is active. */
  fontClass: string;
  skin: Skin;
  copy: Copy;
  /** The wizard shell — each mode arranges the questions (and the end recap) its
   *  own way, keeping its scene mounted throughout. */
  Wizard: ComponentType<WizardProps>;
}
