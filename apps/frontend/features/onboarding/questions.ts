import { PROGRAMS } from "@/features/onboarding/programs";
import type {
  IntlStatus,
  OnboardingQuestion,
  QuestionOption,
  StepAnswer,
} from "@/features/onboarding/types";

export const ONBOARDING_VERSION = "v7-clarified";

// --- Q1: goal -------------------------------------------------------------
// All six options render as routing signals while the chat/auto-fire layer is
// still being built. Staging happens at the step level, not per option: the
// `shipped` flag on a follow-up question keeps that step out of the flow until
// its backing intent ships (use-onboarding filters on it). Every step here is
// shipped, so the full set shows.
//
// Labels carry a certainty cue where two doors could fit the same student: the
// decided newcomer taps "…(I know what I want to study)", the undecided one taps
// "…(I'm not sure yet)", so the fork is explicit before the tap.
export const goalQuestion: OnboardingQuestion = {
  id: "goal",
  prompt: "What brings you here today?",
  kind: "buttons",
  shipped: true,
  options: [
    { id: "goal_first_semester", label: "Plan my first semester (I know what I want to study)", contribs: { goal: "first_semester_plan" } },
    { id: "goal_graduation", label: "See what I still need to graduate", contribs: { goal: "graduation_check" } },
    { id: "goal_transfer", label: "See how my credits transfer", contribs: { goal: "transfer_check" } },
    { id: "goal_schedule", label: "Fit classes around my schedule", contribs: { goal: "schedule_fit" } },
    { id: "goal_major", label: "Help me figure out what to study (I'm not sure yet)", contribs: { goal: "figure_out_major" } },
    { id: "goal_oneoff", label: "Not working toward a degree here (one class, a certificate, or license prep)", contribs: { goal: "nondegree_oneoff" } },
  ],
};

// --- Q2: program picker ---------------------------------------------------
export const programOptions: QuestionOption[] = [
  ...PROGRAMS.map((p) => ({ id: p.code, label: p.label, contribs: { major: p.code } })),
  { id: "program_unsure", label: "I'm still figuring it out", contribs: { major: null } },
];

export const programQuestion: OnboardingQuestion = {
  id: "major",
  prompt: "What do you want to study?",
  kind: "picker",
  shipped: true,
  options: programOptions,
};

// The program picker, phrased for who's asking. A student already enrolled in a
// Dallas program (checking requirements, or sending Dallas credits out) is
// naming the program they're *in* — present tense. Everyone else (planning a
// first semester, bringing credits in, exploring) is choosing one. Same options,
// right question — so we never ask "what do you want to study?" of someone who's
// already studying it.
export function programFor(
  answers: Record<string, StepAnswer>,
): OnboardingQuestion {
  const goal = answers["goal"]?.contribs.goal ?? null;
  const studentType = answers["goal"]?.contribs.student_type ?? null;
  const intlStatus = answers["goal"]?.contribs.intl_status ?? null;
  const dir = answers["transfer_origin"]?.contribs.transfer_direction ?? null;
  // "Working toward" only fits someone already in a Dallas program — not a
  // dual-credit student, and not an incoming international student who hasn't
  // started here yet. Everyone else is choosing a program, not naming one.
  const enrolled =
    studentType !== "dual_credit" &&
    intlStatus !== "incoming" &&
    (goal === "graduation_check" ||
      (goal === "transfer_check" && dir === "outbound"));
  return {
    ...programQuestion,
    prompt: enrolled
      ? "What degree or certificate are you working toward?"
      : "What do you want to study?",
  };
}

// --- Q3: schedule fit (single choice; one tap sets the section filters) ----
export const scheduleQuestion: OnboardingQuestion = {
  id: "schedule",
  prompt: "When can you take classes?",
  kind: "buttons",
  shipped: true,
  options: [
    { id: "sched_anytime", label: "Anytime", contribs: { modality_pref: null, dayparts_pref: null } },
    { id: "sched_evenings", label: "Evenings", contribs: { dayparts_pref: ["evening"] } },
    { id: "sched_weekends", label: "Weekends", contribs: { dayparts_pref: ["weekend"] } },
    { id: "sched_online", label: "Online only", contribs: { modality_pref: "online" } },
  ],
};

// --- figure-out-major: interest area --------------------------------------
export const interestQuestion: OnboardingQuestion = {
  id: "interest",
  prompt: "Which area interests you most?",
  kind: "buttons",
  shipped: true,
  options: [
    { id: "int_health", label: "Health & medical", contribs: { interest_area: "health" } },
    { id: "int_tech", label: "Computers & IT", contribs: { interest_area: "tech" } },
    { id: "int_business", label: "Business", contribs: { interest_area: "business" } },
    { id: "int_arts", label: "Arts & design", contribs: { interest_area: "arts" } },
    { id: "int_trades", label: "Skilled trades (welding, HVAC, auto)", contribs: { interest_area: "trades" } },
    { id: "int_undecided", label: "Still figuring it out", contribs: { interest_area: null } },
  ],
};

// --- non-degree / one-off: why are you here? ------------------------------
// A student not pursuing a degree here (a single prerequisite, a job/licensure
// need, or personal interest). This path never shows the program picker; the
// purpose alone gives a coach the context to follow up.
//
// Note: "a class to count toward a degree at another college" is deliberately
// NOT here — that student is a visiting/transient student and is served by the
// transfer question's "I go to another college — just taking one class here"
// option, which also captures their home school. Keeping it in both places
// captured different data for the same student depending on an arbitrary tap.
export const oneoffPurposeQuestion: OnboardingQuestion = {
  id: "oneoff_purpose",
  prompt: "What do you need?",
  kind: "buttons",
  shipped: true,
  options: [
    { id: "oneoff_prereq", label: "A class I need before I can apply to a program (like science before nursing)", contribs: { oneoff_purpose: "prerequisite" } },
    { id: "oneoff_job", label: "A class I need for a job or a license", contribs: { oneoff_purpose: "job_licensure" } },
    { id: "oneoff_interest", label: "Just for my own interest, or to learn something new", contribs: { oneoff_purpose: "enrichment" } },
  ],
};

// --- transfer branch: direction chip + school on ONE step ------------------
// The options self-identify by the student's HOME school, which is the real
// difference between them — not the abstract "direction" the credit moves. A
// Dallas student transferring out and a visiting student taking one class here
// both move Dallas credit "outward", so a direction framing made options 1 and 2
// read as duplicates; "I'm a Dallas College student…" vs "I go to another
// college…" puts the discriminator in the first three words.
export const directionOptions: QuestionOption[] = [
  { id: "dir_outbound", label: "I'm a Dallas College student, planning to transfer later", contribs: { transfer_direction: "outbound" } },
  { id: "dir_back", label: "I go to another college, just taking one class here", contribs: { transfer_direction: "transfer_back" } },
  { id: "dir_inbound", label: "I already earned college credit somewhere else (another college, the military, or exams like AP, IB, or CLEP)", contribs: { transfer_direction: "inbound" } },
];

export type SchoolShowFor = "both" | "outbound";
export interface SchoolOption extends QuestionOption {
  showFor: SchoolShowFor;
}

// Categorized by what the planning chat can actually ground an answer in, not by
// listing universities we hold no equivalency data for. UT Dallas and UNT are
// named because Dallas College has coordinated articulation with them (shown in the
// catalog); everyone else is a bucket that routes to the right process and caveat.
// "Not sure yet" fits the outbound "where are you transferring" case but not the
// visiting "which college do you attend" case (a visitor knows their home school).
export const schoolOptions: SchoolOption[] = [
  { id: "sch_utd", label: "UT Dallas", contribs: { target_institution: "UTD" }, showFor: "both" },
  { id: "sch_unt", label: "UNT", contribs: { target_institution: "UNT" }, showFor: "both" },
  { id: "sch_tx", label: "Another Texas school", contribs: { target_institution: "TX_OTHER" }, showFor: "both" },
  { id: "sch_us", label: "Out of state", contribs: { target_institution: "US_OTHER" }, showFor: "both" },
  { id: "sch_intl", label: "International", contribs: { target_institution: "INTL" }, showFor: "both" },
  { id: "sch_unsure", label: "Not sure yet", contribs: { target_institution: null }, showFor: "outbound" },
];

export const transferOriginQuestion: OnboardingQuestion = {
  id: "transfer_origin",
  prompt: "Which of these sounds like you?",
  kind: "transferOrigin",
  shipped: true,
};

// --- conditional follow-ups -----------------------------------------------
// The next questions depend on the answers so far, not just the goal, so the
// flow never asks something that doesn't fit the path — e.g. no program/major
// question for a transient student taking a one-off class, and "I'm still
// figuring it out" reroutes to the interest question instead of marching on.
// Every path stays at <= 3 follow-ups after the goal.
const programUndecided = (answers: Record<string, StepAnswer>) =>
  answers["major"]?.optionIds.main === "program_unsure";

export function followUpsFor(
  answers: Record<string, StepAnswer>,
): OnboardingQuestion[] {
  const goal = answers["goal"]?.contribs.goal ?? null;
  const studentType = answers["goal"]?.contribs.student_type ?? null;
  // Dual-credit / high-school students (and the parents asking for them) take
  // one-off classes, not a Dallas program (the dedicated dual-credit program
  // handles the full plan), so we only ask when they can take classes, then finish.
  if (studentType === "dual_credit") {
    return [scheduleQuestion];
  }
  const program = programFor(answers);
  switch (goal) {
    case "graduation_check":
      if (!answers["major"]) return [program];
      // Undecided about the program they're graduating from → explore interest
      // rather than dead-end, same as every other path that hits "still figuring
      // it out".
      return programUndecided(answers)
        ? [program, interestQuestion]
        : [program];

    case "figure_out_major":
      return [interestQuestion];

    case "first_semester_plan":
      if (!answers["major"]) return [program];
      // Undecided → help pick a direction rather than schedule unchosen courses.
      return [
        program,
        programUndecided(answers) ? interestQuestion : scheduleQuestion,
      ];

    case "schedule_fit":
      if (!answers["schedule"]) return [scheduleQuestion];
      if (!answers["major"]) return [scheduleQuestion, program];
      return programUndecided(answers)
        ? [scheduleQuestion, program, interestQuestion]
        : [scheduleQuestion, program];

    case "transfer_check": {
      const dir =
        answers["transfer_origin"]?.contribs.transfer_direction ?? null;
      if (!dir) return [transferOriginQuestion];
      // Transient / transfer-back: a one-off class to count elsewhere — they are
      // not pursuing a Dallas program, so never ask their major here.
      if (dir === "transfer_back") return [transferOriginQuestion];
      // Outbound / inbound: they credit toward a Dallas program → ask it.
      if (!answers["major"]) return [transferOriginQuestion, program];
      return programUndecided(answers)
        ? [transferOriginQuestion, program, interestQuestion]
        : [transferOriginQuestion, program];
    }

    case "nondegree_oneoff":
      return [oneoffPurposeQuestion];

    // Incoming international "help me settle in" — no course planning to do yet;
    // the hand-off points to arrival resources. Terminal, so the flow is one step.
    case "settle_in":
      return [];

    default:
      return [];
  }
}

/**
 * Shortest possible flow: the goal plus one follow-up. Used as the progress
 * denominator before a goal is chosen, so the count only ever *grows* as the
 * path reveals more questions — it never snaps down from an over-guess, which
 * read as a glitch.
 */
export const MIN_STEPS = 2;

// --- secondary row + audience link ----------------------------------------
// Visiting students are served by the "See how my credits transfer" goal and its
// self-ID option ("I go to another college — just taking one class here"), so
// they are not duplicated here. (A dedicated top-level "Visiting from another
// college" link is a recommended addition — see the UIUX doc's open questions.)
export const AUDIENCE_OPTIONS = [
  {
    id: "aud_dual",
    label: "a dual-credit student or parent",
    studentType: "dual_credit" as const,
  },
  {
    id: "aud_intl",
    label: "an international student",
    studentType: "international" as const,
  },
];

// --- international goal step -----------------------------------------------
// Tapping "an international student" doesn't add a step — it refines the SAME
// goal question (id "goal"), so the flow stays the same length as everyone
// else's. The refined step (kind "intlGoal", rendered by IntlGoalStep) pairs a
// small new/returning toggle with the shared goals, and commits the goal AND the
// international status together. `goalStepFor` swaps in this step once the student
// has flagged themselves international; `followUpsFor`/`programFor` need no
// special case because the real goal lands in the same `answers["goal"]` slot.

// New vs. already-studying decides which doors make sense. Kept as a toggle on
// the goal page (not its own question) to hold the four-question budget.
export const INTL_STATUSES: {
  id: string;
  label: string;
  value: IntlStatus;
}[] = [
  { id: "intl_incoming", label: "New to Dallas College", value: "incoming" },
  { id: "intl_current", label: "Already studying here", value: "current" },
];

// Incoming-only door: getting set up to move to Dallas (housing, culture,
// getting around, orientation). No course planning — the hand-off routes to
// arrival resources.
export const settleInOption: QuestionOption = {
  id: "goal_settle",
  label:
    "Help me get ready to move to Dallas (housing, culture, getting around, orientation)",
  contribs: { goal: "settle_in" },
};

// The goals an international student sees, filtered by where they are:
// international students always have a degree plan, so the non-degree one-off
// door never applies; "plan my first semester" and "settle in" only fit someone
// who hasn't started here yet.
export function intlGoalOptions(status: IntlStatus): QuestionOption[] {
  const base = goalQuestion.options!.filter(
    (o) => o.contribs.goal !== "nondegree_oneoff",
  );
  if (status === "current") {
    return base.filter((o) => o.contribs.goal !== "first_semester_plan");
  }
  return [...base, settleInOption];
}

export const intlGoalQuestion: OnboardingQuestion = {
  id: "goal",
  prompt: "What would you like help with?",
  kind: "intlGoal",
  shipped: true,
};

// Step 0 is the goal question — the international variant once the student taps
// "an international student", the standard one otherwise.
export function goalStepFor(
  answers: Record<string, StepAnswer>,
): OnboardingQuestion {
  return answers["goal"]?.contribs.student_type === "international"
    ? intlGoalQuestion
    : goalQuestion;
}
