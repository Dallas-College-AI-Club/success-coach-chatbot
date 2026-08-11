import { z } from "zod";

import {
  majorLabel,
  schoolLabel,
} from "@/features/onboarding/handoff-copy";
import type { SavedSession } from "@/features/onboarding/onboarding-store";

// The student profile the chat sends with every request. One schema, imported
// by both sides: the client builds it, the route validates it before any of it
// reaches the system prompt.
//
// Values are display strings, never internal ids — `major` carries "Accounting
// A.A.S.", not the catalog poid the picker stores, because the poid means
// nothing to the model and nothing downstream.
export const studentProfileSchema = z.object({
  goal: z.string().min(1).max(120).optional(),
  major: z.string().min(1).max(120).optional(),
  targetInstitution: z.string().min(1).max(120).optional(),
  studentType: z.string().min(1).max(60).optional(),
  modality: z.string().min(1).max(60).optional(),
  dayparts: z.string().min(1).max(60).optional(),
});

export type StudentProfile = z.infer<typeof studentProfileSchema>;

/** Builds the profile from a completed onboarding. Null when nothing is known,
 *  so the route can skip the prompt block entirely. */
export function studentProfile(
  session: SavedSession | null,
): StudentProfile | null {
  if (!session) return null;
  const p = session.payload;
  const profile: StudentProfile = {
    ...(p.goal ? { goal: p.goal } : {}),
    ...(p.major ? { major: majorLabel(p) } : {}),
    ...(p.target_institution
      ? { targetInstitution: schoolLabel(p) }
      : {}),
    ...(p.student_type ? { studentType: p.student_type } : {}),
    ...(p.modality_pref ? { modality: p.modality_pref } : {}),
    // dayparts_pref is a multi-select; the prompt wants one readable phrase.
    ...(p.dayparts_pref?.length
      ? { dayparts: p.dayparts_pref.join(", ") }
      : {}),
  };
  return Object.keys(profile).length ? profile : null;
}

/** The prompt block. Kept next to the schema so the shape and its rendering
 *  cannot drift apart. */
export function profilePromptBlock(profile: StudentProfile): string {
  const lines = [
    profile.goal && `- Why they came: ${profile.goal}`,
    profile.major && `- Program: ${profile.major}`,
    profile.targetInstitution && `- Transferring to: ${profile.targetInstitution}`,
    profile.studentType && `- Student type: ${profile.studentType}`,
    profile.modality && `- Prefers: ${profile.modality}`,
    profile.dayparts && `- Can take classes: ${profile.dayparts}`,
  ].filter(Boolean);
  return [
    "",
    "STUDENT PROFILE — what they told the onboarding. Use it to keep answers relevant; it is not a source of catalog facts, so never state a course or requirement from it.",
    ...lines,
  ].join("\n");
}
