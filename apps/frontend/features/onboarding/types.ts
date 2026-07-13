// Local-only types for the landing & onboarding page (issue #52).
// No server or persistence types live here — the wizard holds its answers in
// React state and emits the payload below to the console on completion, which
// is the hand-off seam a later global-state task consumes.

export type GoalValue =
  | "first_semester_plan"
  | "graduation_check"
  | "transfer_check"
  | "schedule_fit"
  | "figure_out_major"
  | "nondegree_oneoff";

export type StudentType = "dual_credit" | "parent_guardian";

export type TransferDirection = "outbound" | "transfer_back" | "inbound";

/**
 * A step contributes one or more fields to the final payload. Every value comes
 * from a closed option list; `null` means "answered, no preference" (distinct
 * from a skipped step). Keys mirror the profile allowlist so the payload can be
 * persisted later without reshaping.
 */
export type PayloadContribs = Partial<{
  goal: GoalValue | null;
  major: string | null;
  target_institution: string | null;
  modality_pref: "online" | null;
  dayparts_pref: string[] | null;
  student_type: StudentType | null;
  // Client-only until the profile allowlist is extended (see the design doc).
  transfer_direction: TransferDirection | null;
  interest_area: string | null;
  oneoff_purpose: string | null;
}>;

export interface QuestionOption {
  id: string;
  label: string;
  contribs: PayloadContribs;
}

export type QuestionKind = "buttons" | "picker" | "transferOrigin";

export interface OnboardingQuestion {
  id: string;
  prompt: string;
  kind: QuestionKind;
  options?: QuestionOption[];
  skippable: boolean;
  /** Staging gate: an option/step whose backing intent has not shipped is hidden. */
  shipped: boolean;
}

/** What the wizard stores per answered step. */
export interface StepAnswer {
  contribs: PayloadContribs;
  /** Acknowledgment label shown back to the student ("Biology, A.S."). */
  display: string;
  /** Maps a render slot ("main", or "direction"/"school") to the chosen option id. */
  optionIds: Record<string, string>;
}

/**
 * Console-logged on completion; the shape a later global store will persist.
 * Every answerable field comes from `PayloadContribs` (one source of truth),
 * made non-optional, plus the completion metadata.
 */
export type OnboardingPayload = Required<PayloadContribs> & {
  skippedSteps: string[];
  onboardingVersion: string;
  completedAt: string;
};
