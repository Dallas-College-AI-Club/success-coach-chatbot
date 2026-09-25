import {
  AID,
  COACH,
  COLD_VISIT_QUESTIONS,
  courseHistoryCheck,
  coursePlan,
  DART,
  DEADLINE,
  fitLabel,
  goalFromLabel,
  HOUSING,
  listOf,
  MAX_LABEL,
  PICK_AREA,
  remainingCredits,
  TUITION,
  TUTORING,
  type StarterQuestion,
} from "@/features/onboarding/handoff-copy";
import { INTEREST_GUIDE } from "@/features/onboarding/interests";
import type { InterestArea } from "@/features/onboarding/types";
import {
  courseHistoryChanged,
  type CompletionOverrides,
} from "@/features/chat/completion-state";
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
/** The faculty topics to offer when onboarding captured no interest area. */
export const DEFAULT_TOPICS = ["teaching"];

/** Shared by course-card actions and the single-course follow-up. */
export function courseScheduleQuestion(courseCode: string): StarterQuestion {
  return {
    label: `When does ${courseCode} meet this Fall?`,
    note: `When does ${courseCode} meet this Fall?`,
    prompt: `Check the saved class schedule for this Fall for ${courseCode}. Use the schedule cards to show its sections with dates, days, times, instructors and sources. Reply with a brief summary, without repeating the section list. Missing meeting times are unknown; label the saved schedule date and do not claim live availability.`,
  };
}

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
  return isRecord(metadata)
    ? (catalogText(metadata.label) ?? undefined)
    : undefined;
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
  completionOverrides?: CompletionOverrides;
  /** Most recent plan, even after a schedule or resource answer. */
  latestPlan?: unknown;
  /** Chip labels already sent — never offered twice. */
  askedLabels: string[];
  /** Why the student said they came, in their own words from onboarding. A
   *  whole-degree checklist continues differently for someone graduating. */
  goal?: string;
  /** Onboarding's schedule preference ("evening", "weekend", "online"), so a
   *  schedule or instructor follow-up asks about the time the student has. */
  preference?: string;
}

/** The student-resource chips, in the order a support conversation tends to
 *  move. Filtered by what was already asked, so a resource answer always has a
 *  next resource under it instead of the same three links. */
const RESOURCE_NEXT = [TUITION, AID, DEADLINE, TUTORING, HOUSING, DART, COACH];

/** Chip labels have 40 characters; a catalog name's award suffix is the least
 *  informative part of it, so that is what goes first. */
function shortProgram(name: string): string {
  return (
    name
      .replace(/\s*(?:A\.A\.S\.|A\.A\.|A\.S\.|Certificate|Degree)$/i, "")
      .trim() || name
  );
}

/** The surname a chip can fit, from a full name the prompt still carries. */
function surnameOf(name: string): string {
  return name.split(/\s+/).at(-1) ?? name;
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

/** The next step on the student's OWN path, for a turn with no tool result to
 *  read: their program, else their area's first verified example, else the
 *  picker that asks them which area to start from. */
function onwards(ctx: FollowUpContext): StarterQuestion {
  if (ctx.program) return coursePlan(ctx.program, true);
  if (!ctx.interest) return PICK_AREA;
  const example = INTEREST_GUIDE[ctx.interest].examplePrograms[0];
  return {
    ...coursePlan(example, true),
    label: fitLabel((n) => `Start with ${n}?`, shortProgram(example)),
  };
}

function candidates(ctx: FollowUpContext): StarterQuestion[] {
  // Nothing was looked up at all. Either the coach asked the STUDENT something
  // — which course code, which area, which of these have you finished — or it
  // gave the governed refusal without searching first, which the prompt tells
  // it not to do but which it does. This file reads tool results and never the
  // model's prose, so it cannot tell those two apart, and the refusal is the
  // one turn where an empty row is a genuine dead end: nothing said, nothing
  // to click. Two chips rather than the old support trio — the next step on
  // the student's own path, and a human. Walked 2026-09-22, four separate
  // paths ended "tell me the course code" under [Success Coach] [tutoring]
  // [tuition], three chips that answered none of it; those two still do not
  // answer "which course code", but they do not pretend to, and they leave
  // somewhere to go when the coach has said it cannot help.
  if (!ctx.tools.length) return [onwards(ctx), COACH];
  // The optional predicate matters when one turn ran the same tool several
  // times: "which classes do they teach" looks up three professors, and the
  // first of those can be an ambiguous-name result with nothing to offer.
  const output = (
    name: string,
    usable?: (o: Record<string, unknown>) => boolean,
  ) =>
    ctx.tools.find(
      (t) =>
        t.name === name && isRecord(t.output) && (!usable || usable(t.output)),
    )?.output as Record<string, unknown> | undefined;
  const topic = () => {
    const topics = topicsFor(ctx.interest);
    return (
      topics.find(
        (t) => !ctx.askedLabels.includes(`Who has ${t} experience?`),
      ) ?? topics[0]
    );
  };

  // A comparison is the end of the undecided path's opening chips, and today
  // it offered nothing: the student read what two programs share and the row
  // fell back to support links. Both programs, then the people who teach in
  // the area.
  const compared = output("compare_programs");
  const pair = isRecord(compared?.comparison)
    ? (compared.comparison.programs as unknown[])
    : undefined;
  const comparedNames = Array.isArray(pair)
    ? pair.filter(isRecord).flatMap((p) => catalogText(p.name) ?? [])
    : [];
  if (compared?.found === true && comparedNames.length === 2) {
    return [
      ...comparedNames.map((name) => ({
        ...coursePlan(name, true),
        label: fitLabel((n) => `Start with ${n}?`, shortProgram(name)),
      })),
      {
        label: `Who has ${topic()} experience?`,
        note: `Which professors have ${topic()} experience?`,
        prompt: `Which Dallas College professors have ${topic()} experience according to their saved CVs? Show every matching faculty profile.`,
      },
      COACH,
    ];
  }

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
      const area = topic();
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
          label: `Who has ${area} experience?`,
          note: `Which professors have ${area} experience?`,
          prompt: `Which Dallas College professors have ${area} experience according to their saved CVs? Show every matching faculty profile.`,
        },
        COACH,
      ];
    }
    const codes = planCodes(plan);
    // Which way the plan on screen is scoped decides the escape hatch: a
    // semester-1 view offers the whole plan, a whole plan offers semester 1.
    // Without that second direction, clicking the opening's first chip
    // RETIRED the path's own next step — the student saw eight semesters and
    // was never offered "which would I start with" again (walked, 2026-09-22).
    const scoped =
      Array.isArray(plan.requested_semesters) &&
      plan.requested_semesters.length > 0;
    // A student checking what is left to graduate is not preparing for day
    // one. Their whole-degree checklist continues into what they have
    // finished and what that leaves, which is the sequence the graduation
    // hand-off opens with — the same two chips, so neither is offered twice.
    const graduating = goalFromLabel(ctx.goal) === "graduation_check";
    return [
      ...(ctx.completionOverrides === undefined && ctx.taken.length
        ? [
            {
              // Compatibility for callers without a completion snapshot.
              // The app uses the state-aware refresh action below instead.
              label: `I've taken these ${ctx.taken.length}, what's left?`,
              note: `Which ${program} courses do I still need after ${listOf(ctx.taken)}?`,
              prompt: takenPrompt(program, ctx.taken),
            },
          ]
        : []),
      ...(graduating && !scoped
        ? [courseHistoryCheck(program), remainingCredits(program)]
        : []),
      ...(!graduating && !scoped ? [coursePlan(program, true)] : []),
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
      ...(scoped
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
    // A student who told onboarding they can only study at weekends should
    // not be offered "which of these are online" as their next question.
    const daypart =
      ctx.preference === "evening" || ctx.preference === "weekend"
        ? ctx.preference
        : null;
    return [
      {
        label: "Who are these instructors?",
        note: `Who are the instructors listed for ${code}?`,
        prompt: `Who are the instructors listed for ${code} in the saved class schedule? Use the complete instructor roster and say which sections each one teaches; the interface shows their CV details.`,
      },
      daypart
        ? {
            label: `Any ${daypart} sections of ${code}?`,
            note: `Which ${code} sections meet at the ${daypart}?`,
            prompt: `Which sections of ${code} in the saved class schedule have published meeting times in the ${daypart}? Use the schedule cards; a missing meeting time is unknown, not a match, and do not substitute a closest time for a matching time. If none of the listed sections match, say so plainly.`,
          }
        : {
            label: "Which sections are online?",
            note: `Which ${code} sections are online?`,
            prompt: `Which sections of ${code} in the saved class schedule are online, and which meet in person? Use the loaded section counts by modality and the schedule cards; online does not mean asynchronous.`,
          },
      COACH,
    ];
  }

  // A single course lookup — the whole of the non-degree path, and wherever a
  // student names one course. Nothing followed it before: the row fell back to
  // support links the moment the catalog answered.
  const course = output("get_course_info");
  const courseCode = course?.course_code;
  if (course?.found === true && isCourseCode(courseCode)) {
    return [
      courseScheduleQuestion(courseCode),
      {
        label: `Who teaches ${courseCode}?`,
        prompt: `Who teaches ${courseCode} in the saved class schedule? Use the schedule cards to show every section with instructors, days, times and sources, and say which term each section comes from.`,
      },
      {
        label: `What do I need before ${courseCode}?`,
        note: `What are the prerequisites for ${courseCode}?`,
        prompt: `What prerequisites and recommended preparation does the catalog list for ${courseCode}? Quote the catalog's requisite wording, and keep required prerequisites separate from recommendations.`,
      },
      TUITION,
      COACH,
    ];
  }

  // One named instructor — where the faculty path lands on its second turn.
  const teacher = output(
    "get_instructor",
    (o) => o.found === true && o.ambiguous !== true && !!catalogText(o.name),
  );
  const teacherName = catalogText(teacher?.name);
  if (teacherName) {
    const surname = surnameOf(teacherName);
    const taught = (Array.isArray(teacher?.teaches) ? teacher.teaches : [])
      .flatMap((entry) =>
        typeof entry === "string"
          ? (entry.match(/^[A-Z]{3,4} \d{4}/)?.[0] ?? [])
          : [],
      )
      .filter(isCourseCode);
    const preference = ctx.preference?.trim();
    return [
      {
        label: preference
          ? fitLabel((n) => `Any ${preference} classes with ${n}?`, surname)
          : fitLabel((n) => `When do ${n}'s classes meet?`, surname),
        note: `When do ${teacherName}'s classes meet this Fall${preference ? `, and are any ${preference}` : ""}?`,
        prompt: `Which courses does ${teacherName} teach this Fall according to their saved record? Then check the saved class schedule for at most two of those courses and say when those sections meet${preference ? `, and which of them have published times matching ${preference} classes. Do not substitute a closest time for a matching time, and if none match, say so plainly` : ""}. Missing meeting times are unknown; do not claim live availability.`,
      },
      ...(taught.length
        ? [
            {
              label: `What is ${taught[0]} about?`,
              note: `What does ${taught[0]} cover?`,
              prompt: `What does the catalog say ${taught[0]} covers, how many credit hours is it, and what does it list as prerequisites? Quote the catalog's requisite wording.`,
            },
          ]
        : []),
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
    // A chip whose label runs past the limit is dropped, and this branch has
    // no spare candidate — one long surname left the student with two chips
    // instead of three. Shorten the label; the prompt keeps the whole name.
    return [
      {
        label:
          names.length === 3
            ? "Classes taught by the first 3 faculty?"
            : "Which classes do they teach this Fall?",
        note: `Which classes do ${listOf(names)} teach this Fall?`,
        prompt: `For ${listOf(names)}, use get_instructor to list the courses and sections each one teaches this Fall according to the saved records, and use the cards to show their backgrounds.`,
      },
      ...(program
        ? [
            {
              label: fitLabel(
                (n) => `What would I take with ${n}?`,
                surnameOf(names[0]),
              ),
              note: `Which ${program} courses does ${names[0]} teach?`,
              prompt: `Which courses in ${program} does ${names[0]} teach according to the saved records? Look up ${names[0]} with get_instructor and name only the courses that also appear in the ${program} plan.`,
            },
          ]
        : ctx.interest
          ? [
              // An undecided student has no program to tie the faculty back
              // to, which left this row two chips wide. The bridge from people
              // back to programs is their own area's first verified example.
              {
                ...coursePlan(
                  INTEREST_GUIDE[ctx.interest].examplePrograms[0],
                  true,
                ),
                label: fitLabel(
                  (n) => `Start with ${n}?`,
                  shortProgram(INTEREST_GUIDE[ctx.interest].examplePrograms[0]),
                ),
              },
            ]
          : []),
      COACH,
    ];
  }

  // A student-resource answer. The corpus is eleven rows, so the next question
  // is one of the other rows — and a money answer leads to the other half of
  // the money question, which is the pair a coach would actually put together.
  const knowledge = output("search_knowledge");
  const resource = (
    Array.isArray(knowledge?.results) ? knowledge.results : []
  ).filter((r) => isRecord(r) && r.doc_type === "resource");
  if (resource.length) {
    const top = (
      catalogText((resource[0] as Record<string, unknown>).name) ?? ""
    ).toLowerCase();
    const paired = /tuition|surcharge/.test(top)
      ? [AID]
      : /financial aid/.test(top)
        ? [TUITION]
        : [];
    return [...paired, ...RESOURCE_NEXT];
  }

  return [COACH, TUTORING, TUITION];
}

/** Up to three chips for the current state of the conversation. */
export function followUpsFor(ctx: FollowUpContext): StarterQuestion[] {
  // The opening keeps the onboarding starters exactly as written — except for
  // a visitor who skipped onboarding, who has none: an empty chip row is a
  // dead end on the one screen with nothing else to click.
  if (!ctx.started)
    return ctx.starters.length ? ctx.starters : COLD_VISIT_QUESTIONS;
  const seen = new Set(ctx.askedLabels);
  const plan =
    ctx.latestPlan ??
    ctx.tools.find(
      (t) => t.name === "get_program_requirements" && isRecord(t.output),
    )?.output;
  const planning =
    isRecord(plan) && isRecord(plan.planning) ? plan.planning : {};
  const history = isRecord(planning.history) ? planning.history : {};
  const program = isRecord(plan) ? catalogText(plan.name) : ctx.program;
  const changed = courseHistoryChanged(history, ctx.completionOverrides ?? {});
  const refresh =
    program && changed
      ? [
          {
            label: "Update my remaining courses",
            note: `Which courses in ${program} remain after my updated course history?`,
            prompt: `Refresh the full ${program} checklist using my current reported course history. Which courses are left, and what should I take this semester?`,
          },
        ]
      : [];
  return [
    ...refresh,
    ...candidates(ctx).filter((q) => {
      if (q.label.length > MAX_LABEL || seen.has(q.label)) return false;
      seen.add(q.label);
      return true;
    }),
  ].slice(0, MAX_CHIPS);
}
