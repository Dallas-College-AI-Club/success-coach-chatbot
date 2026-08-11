import { z } from "zod";

import { PROGRAMS } from "@/features/onboarding/programs";
import type { SavedSession } from "@/features/onboarding/onboarding-store";
import {
  AUDIENCE_OPTIONS,
  goalQuestion,
  schoolOptions,
  settleInOption,
} from "@/features/onboarding/questions";

// The student profile the chat sends with every request. One schema, imported
// by both sides: the client builds it, the route validates it before any of it
// reaches the system prompt.
//
// Values are the words a person would use, never internal ids — the model gets
// "Accounting A.A.S.", not the catalog poid the picker stores, and "See how
// credits transfer", not the routing token `transfer_check`. A field is
// omitted rather than guessed: nothing here may become a fact the model
// repeats back.
// Every value comes from a closed list the app itself owns, so the schema
// checks MEMBERSHIP, not length: a free-text field here would be a way to
// append arbitrary text to the system prompt from localStorage, after the
// refusal rules. Each field fails soft (`.catch(undefined)`) so one stale
// value drops that line instead of the whole profile.
const oneOf = (values: readonly string[]) =>
  z
    .string()
    .refine((v) => values.includes(v))
    .optional()
    .catch(undefined);

const GOAL_LABELS = [
  ...(goalQuestion.options ?? []).map((o) => o.label),
  settleInOption.label,
];
const PROGRAM_LABELS = PROGRAMS.map((p) => p.label);
const SCHOOL_LABELS = schoolOptions.map((s) => s.label);
const STUDENT_TYPE_LABELS = AUDIENCE_OPTIONS.map((a) => a.label);

export const studentProfileSchema = z.object({
  goal: oneOf(GOAL_LABELS),
  major: oneOf(PROGRAM_LABELS),
  transferTo: oneOf(SCHOOL_LABELS),
  transferFrom: oneOf(SCHOOL_LABELS),
  studentType: oneOf(STUDENT_TYPE_LABELS),
  // Free-form-ish but short and app-generated; capped rather than enumerated
  // because the option lists live in the question definitions per branch.
  modality: z.string().min(1).max(60).optional().catch(undefined),
  dayparts: z.string().min(1).max(80).optional().catch(undefined),
});

export type StudentProfile = z.infer<typeof studentProfileSchema>;

/** The student's own words for why they came, not the routing token. */
function goalLabel(goal: string | null): string | undefined {
  if (!goal) return undefined;
  return [...(goalQuestion.options ?? []), settleInOption].find(
    (o) => o.contribs.goal === goal,
  )?.label;
}

/** Exact program title, or nothing. majorLabel() in handoff-copy falls back to
 *  "your program" for UI copy; a fallback phrase in a system prompt is a
 *  half-truth the model can repeat, so an unknown code is simply omitted. */
function programLabel(code: string | null): string | undefined {
  if (!code) return undefined;
  return PROGRAMS.find((p) => p.code === code)?.label;
}

/** The audience label, not the routing token — "a high schooler (dual credit)
 *  or parent", not `dual_credit`. Omitted when it matches nothing. */
function studentTypeLabel(t: string | null): string | undefined {
  if (!t) return undefined;
  return AUDIENCE_OPTIONS.find((a) => a.studentType === t)?.label;
}

/** Every school option resolves to its picker label — the named partners to a
 *  real institution, the region buckets to their plain phrase. */
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
    ...(studentTypeLabel(p.student_type)
      ? { studentType: studentTypeLabel(p.student_type) }
      : {}),
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
