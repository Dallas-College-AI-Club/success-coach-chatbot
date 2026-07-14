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
  | "nondegree_oneoff"
  // Incoming international students only: getting set up to move to Dallas.
  | "settle_in";

// "a dual-credit student or parent" routes both to dual_credit — a parent is
// asking on their student's behalf, same path. (No separate parent type: nothing
// sets it.)
export type StudentType = "dual_credit" | "international";

/** Where an international student is in their journey — set alongside the goal on
 *  the international goal step, so it never needs its own question. */
export type IntlStatus = "incoming" | "current";

export type TransferDirection = "outbound" | "transfer_back" | "inbound";

export type TargetInstitution = "UTD" | "UNT" | "TX_OTHER" | "US_OTHER" | "INTL";

export type InterestArea = "health" | "tech" | "business" | "arts" | "trades";

export type OneoffPurpose = "prerequisite" | "job_licensure" | "enrichment";

/**
 * A step contributes one or more fields to the final payload. Every value comes
 * from a closed option list; `null` means "answered, no preference" (distinct
 * from a skipped step). Keys mirror the profile allowlist so the payload can be
 * persisted later without reshaping.
 */
export type PayloadContribs = Partial<{
  goal: GoalValue | null;
  major: string | null;
  target_institution: TargetInstitution | null;
  modality_pref: "online" | null;
  dayparts_pref: string[] | null;
  student_type: StudentType | null;
  // Client-only until the profile allowlist is extended (see the design doc).
  transfer_direction: TransferDirection | null;
  interest_area: InterestArea | null;
  oneoff_purpose: OneoffPurpose | null;
  intl_status: IntlStatus | null;
}>;

export interface QuestionOption {
  id: string;
  label: string;
  contribs: PayloadContribs;
}

export type QuestionKind = "buttons" | "picker" | "transferOrigin" | "intlGoal";

export interface OnboardingQuestion {
  id: string;
  prompt: string;
  kind: QuestionKind;
  options?: QuestionOption[];
  /** Staging gate: an option/step whose backing intent has not shipped is hidden. */
  shipped: boolean;
}

/** The render slots a step can fill: most questions use "main"; the transfer
 *  step fills "direction" and "school"; the international goal step fills "main"
 *  (the goal) and "status" (new vs. already studying). */
export type RenderSlot = "main" | "direction" | "school" | "status";

/** What the wizard stores per answered step. */
export interface StepAnswer {
  contribs: PayloadContribs;
  /** Acknowledgment label shown back to the student ("Biology, A.S."). */
  display: string;
  /** The chosen option id per render slot. */
  optionIds: Partial<Record<RenderSlot, string>>;
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
