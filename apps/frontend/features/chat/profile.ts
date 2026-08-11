import { z } from "zod";

import { PROGRAMS } from "@/features/onboarding/programs";
import type { SavedSession } from "@/features/onboarding/onboarding-store";
import { goalQuestion, schoolOptions } from "@/features/onboarding/questions";

// The student profile the chat sends with every request. One schema, imported
// by both sides: the client builds it, the route validates it before any of it
// reaches the system prompt.
//
// Values are the words a person would use, never internal ids — the model gets
// "Accounting A.A.S.", not the catalog poid the picker stores, and "See how
// credits transfer", not the routing token `transfer_check`. A field is
// omitted rather than guessed: nothing here may become a fact the model
// repeats back.
export const studentProfileSchema = z.object({
  goal: z.string().min(1).max(120).optional(),
  major: z.string().min(1).max(120).optional(),
  transferTo: z.string().min(1).max(120).optional(),
  transferFrom: z.string().min(1).max(120).optional(),
  studentType: z.string().min(1).max(60).optional(),
  modality: z.string().min(1).max(60).optional(),
  dayparts: z.string().min(1).max(60).optional(),
});

export type StudentProfile = z.infer<typeof studentProfileSchema>;

/** The student's own words for why they came, not the routing token. */
function goalLabel(goal: string | null): string | undefined {
  if (!goal) return undefined;
  return goalQuestion.options?.find((o) => o.contribs.goal === goal)?.label;
}

/** Exact program title, or nothing. majorLabel() in handoff-copy falls back to
 *  "your program" for UI copy; a fallback phrase in a system prompt is a
 *  half-truth the model can repeat, so an unknown code is simply omitted. */
function programLabel(code: string | null): string | undefined {
  if (!code) return undefined;
  return PROGRAMS.find((p) => p.code === code)?.label;
}

/** Named partner universities resolve to a real name; the region buckets are
 *  category codes, so they are omitted rather than printed raw. */
function schoolName(code: string | null): string | undefined {
  if (!code) return undefined;
  return schoolOptions.find((s) => s.contribs.target_institution === code)
    ?.label;
}

/** Builds the profile from a completed onboarding. Null when nothing is known,
 *  so the route can skip the prompt block entirely. */
export function studentProfile(
  session: SavedSession | null,
): StudentProfile | null {
  if (!session) return null;
  const p = session.payload;

  const school = schoolName(p.target_institution);
  // The same field means opposite things by direction: outbound students are
  // leaving for that school, inbound students are coming from it. Rendering
  // both as "Transferring to" told the model the wrong thing half the time.
  const transfer =
    school && p.transfer_direction === "inbound"
      ? { transferFrom: school }
      : school
        ? { transferTo: school }
        : {};

  // dayparts_pref is a multi-select; a hand-edited localStorage blob could
  // hold anything, so filter to strings before joining.
  const dayparts = Array.isArray(p.dayparts_pref)
    ? p.dayparts_pref.filter((d): d is string => typeof d === "string")
    : [];

  const profile: StudentProfile = {
    ...(goalLabel(p.goal) ? { goal: goalLabel(p.goal) } : {}),
    ...(programLabel(p.major) ? { major: programLabel(p.major) } : {}),
    ...transfer,
    ...(p.student_type ? { studentType: p.student_type } : {}),
    ...(p.modality_pref ? { modality: p.modality_pref } : {}),
    ...(dayparts.length ? { dayparts: dayparts.join(", ") } : {}),
  };
  return Object.keys(profile).length ? profile : null;
}

/** The prompt block. Kept next to the schema so the shape and its rendering
 *  cannot drift apart. Returns "" when there is nothing to say, so the prompt
 *  never carries a heading with no content under it. */
export function profilePromptBlock(profile: StudentProfile): string {
  const lines = [
    profile.goal && `- Why they came: ${profile.goal}`,
    profile.major && `- Program: ${profile.major}`,
    profile.transferTo && `- Wants to transfer to: ${profile.transferTo}`,
    profile.transferFrom && `- Transferring credits in from: ${profile.transferFrom}`,
    profile.studentType && `- Student type: ${profile.studentType}`,
    profile.modality && `- Prefers: ${profile.modality}`,
    profile.dayparts && `- Can take classes: ${profile.dayparts}`,
  ].filter(Boolean);
  if (!lines.length) return "";
  return [
    "",
    "STUDENT PROFILE — what they told the onboarding. Use it to keep answers relevant; it is not a source of catalog facts, so never state a course or requirement from it.",
    ...lines,
  ].join("\n");
}
