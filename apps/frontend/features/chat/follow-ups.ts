import {
  COACH,
  listOf,
  TUITION,
  TUTORING,
  type StarterQuestion,
} from "@/features/onboarding/handoff-copy";
import { INTEREST_GUIDE } from "@/features/onboarding/interests";
import type { InterestArea } from "@/features/onboarding/types";
import {
  catalogText,
  isCourseCode,
  isRecord,
  programCourseCode,
  scopeProgramGroups,
} from "@/lib/course-details";

// Follow-up chips that evolve with the conversation. Pure: they read the
// latest coach reply's FINISHED tool results and the courses the student
// ticked, never the model's prose, so a chip only offers a next step the
// data can answer. No model calls; scripts/check-follow-ups.mts guards it.
//
// The path they guide: program plan → tick what's taken → what's left and
// what to take now → professors by interest → the classes they teach.

const MAX_CHIPS = 3;
const MAX_LABEL = 40;
/** The faculty topics to offer when onboarding captured no interest area. */
export const DEFAULT_TOPICS = [
  "machine learning",
  "cybersecurity",
  "data analytics",
];

/** The student's own interest area decides which expertise the chip offers;
 *  INTEREST_GUIDE's topics are live-verified against the indexed CVs. */
export function topicsFor(interest?: InterestArea | null): string[] {
  return interest ? INTEREST_GUIDE[interest].expertiseTopics : DEFAULT_TOPICS;
}

// COACH/TUTORING/TUITION and listOf come from handoff-copy.ts rather than a
// copy here: a chip is skipped when its LABEL was already asked, so the two
// files have to agree on the label exactly, and a duplicate would drift.

/** The sentence lib/planning.ts reads as completed history: every code in one
 *  clause with "completed", then only questions, which its parser skips.
 *  "left" is load-bearing — with "completed" it is what makes registry.ts
 *  force a FRESH requirements lookup, instead of letting the model answer
 *  from the older, semester-scoped result still sitting in the transcript. */
export function takenPrompt(program: string, taken: string[]): string {
  return `I have completed ${listOf(taken)}. Which courses in ${program} are left, and what should I take this semester?`;
}

/** The human question a chip stands for, carried as message metadata.
 *  A chip sends a long instruction prompt so the model keeps its steering;
 *  showing that wall of text under "You:" reads as if the student typed it.
 *  The model still receives the prompt — metadata never reaches it, because
 *  convertToModelMessages builds model messages from `parts` alone. */
export function askedLabel(metadata: unknown): string | undefined {
  return isRecord(metadata) ? (catalogText(metadata.label) ?? undefined) : undefined;
}

export interface FollowUpContext {
  /** Program to name in prompts: the onboarding pick, else the plan shown. */
  program?: string;
  /** Onboarding's interest area, which picks the faculty topics to offer. */
  interest?: InterestArea | null;
  /** The onboarding starters — the opening chips, unchanged. */
  starters: StarterQuestion[];
  /** Finished tool parts of the latest settled coach reply. */
  tools: { name: string; output: unknown }[];
  /** True once the student has sent anything, so the starters retire. */
  started: boolean;
  /** Course codes the student ticked as taken. */
  taken: string[];
  /** Chip labels already sent — never offered twice. */
  askedLabels: string[];
}

function planCodes(plan: Record<string, unknown>): string[] {
  const groups = Array.isArray(plan.groups) ? plan.groups : [];
  // The starting semester where the plan has one; a certificate's flat list
  // otherwise. Up to five keeps the schedule lookups inside the tool budget.
  const scoped = scopeProgramGroups(groups, [1]);
  const codes = (scoped.length ? scoped : groups)
    .filter(isRecord)
    .flatMap((g) => (Array.isArray(g.courses) ? g.courses : []))
    .map(programCourseCode)
    .filter((c): c is string => !!c);
  return [...new Set(codes)].slice(0, 5);
}

function candidates(ctx: FollowUpContext): StarterQuestion[] {
  const output = (name: string) =>
    ctx.tools.find((t) => t.name === name && isRecord(t.output))?.output as
      | Record<string, unknown>
      | undefined;

  const plan = output("get_program_requirements");
  // The plan ON SCREEN wins over the onboarding pick. A student who onboarded
  // with Accounting and then asked about Cyber Security was offered chips
  // naming Accounting, and their Cyber Security ticks were attributed to it.
  const program = catalogText(plan?.name) ?? ctx.program;
  if (plan?.found === true && Array.isArray(plan.groups) && program) {
    const planning = isRecord(plan.planning) ? plan.planning : {};
    const remaining = Array.isArray(planning.remaining_required_courses)
      ? planning.remaining_required_courses.filter(isCourseCode)
      : [];
    // The planning object rides on EVERY plan lookup, and its history records
    // NEGATIVES too ("I haven't taken MATH 1314 yet" is a not_completed
    // entry). Counting those as progress sent the conversation on to "what's
    // left" while the student had finished nothing — and the checkboxes went
    // inert, because the chip that carries them is on the browse step.
    const reported = isRecord(planning.history)
      ? Object.values(planning.history).filter(
          (entry) =>
            isRecord(entry) &&
            (entry.status === "completed" || entry.status === "in_progress"),
        ).length
      : 0;
    if (reported && remaining.length) {
      // planning sorts the remaining codes alphabetically across the WHOLE
      // degree, so the bare first one offered a fourth-year art elective as
      // the next thing to look up. Prefer one the student could take now.
      const next =
        remaining.find((code) => planCodes(plan).includes(code)) ??
        remaining[0];
      const topics = topicsFor(ctx.interest);
      const topic =
        topics.find(
          (t) => !ctx.askedLabels.includes(`Who has ${t} experience?`),
        ) ?? topics[0];
      return [
        {
          label: "What should I take this semester?",
          note: `Which remaining ${program} courses should I take this semester?`,
          prompt: `Using the ${program} checklist and the courses I reported, which remaining required courses should I take this semester and why? Suggest a realistic set, keeping prerequisites in mind; my Success Coach makes it official.`,
        },
        {
          label: `Who teaches ${next}?`,
          prompt: `Who teaches ${next} in the saved class schedule? Use the schedule cards to show every section with instructors, days, times and sources, and say which term each section comes from.`,
        },
        {
          label: `Who has ${topic} experience?`,
          note: `Which professors have ${topic} experience?`,
          prompt: `Which Dallas College professors have ${topic} experience according to their saved CVs? Show every matching faculty profile.`,
        },
        COACH,
      ];
    }
    const codes = planCodes(plan);
    return [
      ...(ctx.taken.length
        ? [
            {
              // The COUNT is in the label because a label, once asked, is
              // never offered again: a fixed one meant that after a single
              // click every later tick was unsendable and the checkboxes
              // quietly stopped doing anything.
              label: `I've taken these ${ctx.taken.length}, what's left?`,
              note: `Which ${program} courses do I still need after ${listOf(ctx.taken)}?`,
              prompt: takenPrompt(program, ctx.taken),
            },
          ]
        : []),
      {
        label: "What do I need before starting?",
        note: `What are the required prerequisites and recommended preparation for semester 1 of ${program}?`,
        prompt: `What prerequisites and recommended preparation does the catalog list for the first-semester courses in ${program}? Keep required prerequisites separate from recommendations.`,
      },
      ...(codes.length
        ? [
            {
              label: "When do these classes meet this Fall?",
              note: `When do ${listOf(codes)} meet this Fall?`,
              prompt: `Check the saved class schedule for this Fall for ${listOf(codes)} in ${program}. Use the schedule cards to show each course's sections with dates, days, times, instructors and sources. Reply with a brief summary of which of these courses have sections listed, without repeating the section list. Missing meeting times are unknown; label the saved schedule date and do not claim live availability.`,
            },
          ]
        : []),
      // Last, so it fills the third slot while the student is still browsing
      // a scoped semester and yields once they start ticking courses off.
      ...(Array.isArray(plan.requested_semesters) &&
      plan.requested_semesters.length
        ? [
            {
              label: "Show the full plan",
              note: `Which courses are required for ${program}?`,
              prompt: `Look up the full published course plan for ${program}, all semesters. The course cards already show the complete checklist and its credits. Reply in at most two sentences introducing those cards, without writing a course list or semester-by-semester breakdown. Keep the published credit total exact; unresolved elective choices do not change that total.`,
            },
          ]
        : []),
      COACH,
    ];
  }

  const schedule = output("get_class_schedule");
  const code = schedule?.course_code;
  if (Array.isArray(schedule?.offerings) && isCourseCode(code)) {
    return [
      {
        label: "Who are these instructors?",
        note: `Who are the instructors listed for ${code}?`,
        prompt: `Who are the instructors listed for ${code} in the saved class schedule? Use the complete instructor roster and say which sections each one teaches; the interface shows their CV details.`,
      },
      {
        label: "Which sections are online?",
        note: `Which ${code} sections are online?`,
        prompt: `Which sections of ${code} in the saved class schedule are online, and which meet in person? Use the loaded section counts by modality and the schedule cards; online does not mean asynchronous.`,
      },
      COACH,
    ];
  }

  const faculty = output("search_faculty_expertise");
  const names = Array.isArray(faculty?.results)
    ? faculty.results
        .filter(isRecord)
        .map((r) => catalogText(r.name))
        .filter((n): n is string => !!n)
        .slice(0, 3)
    : [];
  if (names.length) {
    const full = names[0].split(/\s+/).at(-1) ?? names[0];
    // A chip whose label runs past the limit is dropped, and this branch has
    // no spare candidate — one long surname left the student with two chips
    // instead of three. Shorten the label; the prompt keeps the whole name.
    const surname =
      `What would I take with ${full}?`.length > MAX_LABEL
        ? `${full.slice(0, MAX_LABEL - 25)}…`
        : full;
    return [
      {
        label: "Which classes do they teach this Fall?",
        note: `Which classes do ${listOf(names)} teach this Fall?`,
        prompt: `For ${listOf(names)}, use get_instructor to list the courses and sections each one teaches this Fall according to the saved records, and use the cards to show their backgrounds.`,
      },
      ...(program
        ? [
            {
              label: `What would I take with ${surname}?`,
              note: `Which ${program} courses does ${names[0]} teach?`,
              prompt: `Which courses in ${program} does ${names[0]} teach according to the saved records? Look up ${names[0]} with get_instructor and name only the courses that also appear in the ${program} plan.`,
            },
          ]
        : []),
      COACH,
    ];
  }

  return [COACH, TUTORING, TUITION];
}

/** Up to three chips for the current state of the conversation. */
export function followUpsFor(ctx: FollowUpContext): StarterQuestion[] {
  // The opening keeps the onboarding starters exactly as written.
  if (!ctx.started) return ctx.starters;
  const seen = new Set(ctx.askedLabels);
  return candidates(ctx)
    .filter((q) => {
      if (q.label.length > MAX_LABEL || seen.has(q.label)) return false;
      seen.add(q.label);
      return true;
    })
    .slice(0, MAX_CHIPS);
}
