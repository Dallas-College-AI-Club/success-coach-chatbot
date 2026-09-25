/** Deterministic, conservative planning from catalog facts and student statements.
 * This is a planning checklist, never an official transcript/degree audit. */
import {
  isRecord,
  programCourseCode,
  type CourseDetails,
} from "./course-details";

export type CourseStatus =
  | "completed"
  | "in_progress"
  | "not_completed"
  | "planned"
  | "transfer_pending"
  | "unknown";
export type CourseHistory = Record<
  string,
  { status: CourseStatus; statement: string }
>;
export function readCourseHistory(value: unknown): CourseHistory {
  const history: CourseHistory = {};
  if (isRecord(value))
    for (const [code, record] of Object.entries(value)) {
      if (
        /^[A-Z]{3,4} \d{4}$/.test(code) &&
        isRecord(record) &&
        typeof record.status === "string" &&
        [
          "completed",
          "in_progress",
          "not_completed",
          "planned",
          "transfer_pending",
          "unknown",
        ].includes(record.status)
      ) {
        history[code] = {
          status: record.status as CourseStatus,
          statement:
            typeof record.statement === "string" ? record.statement : "",
        };
      }
    }
  return history;
}
const codesIn = (text: string) => [
  ...new Set(
    [...text.toUpperCase().matchAll(/\b([A-Z]{3,4})\s*(\d{4})\b/g)].map(
      (m) => `${m[1]} ${m[2]}`,
    ),
  ),
];
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Resolve only unique catalog titles and narrow, unambiguous introductory aliases. */
function titleResolver(courses: CourseDetails[]): (text: string) => string {
  const aliases = new Map<string, Set<string>>();
  for (const course of courses) {
    if (!course.title) continue;
    const names = [course.title];
    const intro = course.title.match(
      /^Introduction to (.+?)(?: Programming)?$/i,
    );
    if (intro) names.push(`intro to ${intro[1]}`, `intro ${intro[1]}`);
    for (const name of names) {
      const key = name.toLowerCase();
      aliases.set(
        key,
        new Set([...(aliases.get(key) ?? []), course.course_code]),
      );
    }
  }
  const unique = new Map(
    [...aliases]
      .filter(([, codes]) => codes.size === 1)
      .sort((a, b) => b[0].length - a[0].length)
      .map(([name, codes]) => [name, [...codes][0]]),
  );
  if (!unique.size) return (text) => text;
  // Compile once per assessment, then scan each message once. A replacement
  // is never scanned again as though it were a second catalog title.
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${[...unique.keys()].map(escape).join("|")})(?![\\p{L}\\p{N}])`,
    "giu",
  );
  return (text) =>
    text.replace(pattern, (name) => unique.get(name.toLowerCase()) ?? name);
}

/** Split changes of status, while keeping lists such as "passed A and B" intact. */
function historyClauses(text: string): string[] {
  const nextStatement = String.raw`(?:I|I'm|am|didn't|did not|haven't|have not|have taken|already taken|currently enrolled|can|what|which|failed|passed|finished|took|transferred|enrolled|not|withdrew|dropped|taking|completed|will|plan to|want to|need to|[A-Z]{3,4}\s*\d{4}\s+(?:is|was|has|in progress|completed|passed))\b`;
  // Retain question punctuation so "ITSE 1370 completed?" is not an assertion.
  return text.split(
    new RegExp(
      String.raw`(?<=[.!?;])\s*|\n+|\b(?:but|however|while|then)\b|,?\s+(?:and|so)\s+(?=${nextStatement})|,(?=\s*${nextStatement})`,
      "i",
    ),
  );
}

function analyzeHistory(messages: string[], courses: CourseDetails[] = []) {
  const history: CourseHistory = {};
  const unparsed = new Set<string>();
  const replaceTitles = titleResolver(courses);
  let lastCodes: string[] = [];
  for (const original of messages) {
    const text = replaceTitles(original.replace(/[’‘]/g, "'"));
    for (const clause of historyClauses(text)) {
      let codes = codesIn(clause);
      const previous = lastCodes;
      if (codes.length) lastCodes = codes;
      // Questions, third-person history and hypothetical achievements never
      // become completed credits. "took" is student-reported completion only.
      if (
        /^\s*(?:who|what|which|how|can|could|should|did(?!\s+not\b)|have I|is|are|does)\b/i.test(
          clause,
        ) ||
        /\b(?:my friend|my brother|my sister|he|she|they|if|suppose|assuming|when I)\b/i.test(
          clause,
        ) ||
        /\?\s*$/.test(clause)
      )
        continue;
      if (/^\s*forget my course history for\b/i.test(clause)) {
        for (const code of codes) delete history[code];
        continue;
      }
      let status: CourseStatus | undefined;
      if (
        /\b(?:not sure|unsure|uncertain|don't think|do not think|I think|don't remember|do not remember|may have|might have|probably|maybe|either|except)\b/i.test(
          clause,
        ) ||
        (codes.length > 1 && /\bor\b/i.test(clause))
      )
        status = "unknown";
      else if (
        /\b(?:remove|do not count|don't count|do not mark|don't mark)\b.*\bcompleted\b/i.test(
          clause,
        )
      )
        status = "not_completed";
      else if (
        /\btransfer(?:red)?\b/i.test(clause) &&
        (!/\b(?:approved|accepted)\b/i.test(clause) ||
          /\b(?:not|never|isn't|wasn't|hasn't been)\s+(?:yet\s+)?(?:approved|accepted)\b/i.test(
            clause,
          ))
      )
        status = "transfer_pending";
      else if (
        /\b(?:failed|withdrew|withdrawn|dropped|not yet (?:completed|taken|passed|finished)|haven't yet (?:completed|taken|passed|finished)|(?:almost|nearly) (?:completed|finished)|not taking|(?:not|never) (?:completed|taken|passed|took|finished)|haven't (?:taken|completed|passed|finished)|didn't (?:take|pass|complete|finish)|did not (?:take|pass|complete|finish)|have not (?:taken|completed|passed|finished))\b/i.test(
          clause,
        ) ||
        /^\s*not\b/i.test(clause)
      )
        status = "not_completed";
      else if (
        /\b(?:plan to|planning to|will|would|might|must|should|need to|want to)\b/i.test(
          clause,
        )
      )
        status = "planned";
      else if (
        /\b(?:taking|in progress|currently enrolled|enrolled in)\b/i.test(
          clause,
        )
      )
        status = "in_progress";
      else if (
        /\b(?:completed|passed|finished|already taken|have taken|I've taken|took)\b/i.test(
          clause,
        )
      )
        status = "completed";
      if (!status) continue;
      if (
        !codes.length &&
        /\b(?:it|that course)\b/i.test(clause) &&
        previous.length === 1
      )
        codes = previous;
      for (const code of codes) history[code] = { status, statement: original };
      // A partially recognized list is not a complete transcript. Keep matched
      // codes useful, but withhold arithmetic until the rest is clarified.
      const list = clause.replace(/\b[A-Z]{3,4}\s*\d{4}\b/gi, "__COURSE__");
      if (
        !codes.length ||
        /__COURSE__\s*(?:,|and|&)\s+(?!__COURSE__)(?=\S)/i.test(list) ||
        /\b(?:completed|passed|finished|taken|took)\s+(?!__COURSE__)\S.*?(?:,|\band\b|&)\s*__COURSE__/i.test(
          list,
        )
      )
        unparsed.add(original);
    }
  }
  return { history, unparsed: [...unparsed] };
}

export function studentCourseHistory(
  messages: string[],
  courses: CourseDetails[] = [],
): CourseHistory {
  return analyzeHistory(messages, courses).history;
}

export function assessRequisites(raw: string | null, history: CourseHistory) {
  if (!raw)
    return {
      status: "unknown",
      required: [],
      recommended: [],
      corequisites: [],
      note: "No requisite details are recorded; eligibility cannot be confirmed.",
    };
  if (
    /^\s*(?:prerequisites?:?\s*)?(?:none|no prerequisites?)(?:\.|\s*)$/i.test(
      raw,
    )
  ) {
    return {
      status: "none_stated",
      required: [],
      recommended: [],
      corequisites: [],
      note: raw,
    };
  }
  const required: string[] = [],
    recommended: string[] = [],
    corequisites: string[] = [];
  for (const section of raw
    .split(/(?=\b(?:Prerequisites?|Corequisites?(?:\/Concurrent)?)\s*:)/i)
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (/^Corequisites?/i.test(section)) {
      if (
        /^Corequisites?(?:\/Concurrent)?\s*:\s*Recommended\s*:/i.test(section)
      )
        recommended.push(section);
      else corequisites.push(section);
      continue;
    }
    for (const clause of section
      .replace(/^Prerequisites?\s*:\s*/i, "")
      .split(/(?=\bRecommended\s*:|\bRequired\s*:)/i)
      .map((s) => s.trim())
      .filter(Boolean)) {
      if (/^Recommended\s*:/i.test(clause)) recommended.push(clause);
      else required.push(clause);
    }
  }
  const referenced_courses = codesIn(raw).map((code) => ({
    course_code: code,
    student_status: Object.hasOwn(history, code)
      ? history[code].status
      : "unknown",
  }));
  return {
    status:
      required.length || corequisites.length
        ? "review_required"
        : "recommendation_only",
    required,
    recommended,
    corequisites,
    referenced_courses,
    note: "Course history is self-reported. Grades, placement, recency, permissions and concurrent-enrollment rules require official review; no eligibility decision has been made.",
  };
}

interface PlanLike {
  groups?: unknown[];
  course_details?: CourseDetails[];
  total_credits?: unknown;
  requested_semesters?: number[];
  name?: unknown;
  catalog_year?: unknown;
  source_url?: string;
}

function choiceMemberships(choices: { courses: string[] }[]) {
  const counts = new Map<string, number>();
  for (const choice of choices)
    for (const code of choice.courses)
      counts.set(code, (counts.get(code) ?? 0) + 1);
  return counts;
}

/** A fixed row can still contain alternatives in its rule (BAT capstone).
 * Never call both sides of that OR mandatory just because extraction put the
 * whole semester in one fixed group. */
function conditionalCodes(group: Record<string, unknown>): Set<string> {
  const rule = typeof group.rule === "string" ? group.rule : "";
  const codes = Array.isArray(group.courses)
    ? group.courses.flatMap((c) => programCourseCode(c) ?? [])
    : [];
  const conditional = new Set<string>();
  for (let i = 0; i < codes.length; i++)
    for (let j = i + 1; j < codes.length; j++) {
      const a = rule.indexOf(codes[i]),
        b = rule.indexOf(codes[j]);
      if (
        a >= 0 &&
        b >= 0 &&
        /\bOR\b/i.test(rule.slice(Math.min(a, b), Math.max(a, b)))
      ) {
        conditional.add(codes[i]);
        conditional.add(codes[j]);
      }
    }
  return conditional;
}

export function planRequirements(plan: PlanLike) {
  const groups = (plan.groups ?? []).filter(isRecord);
  // Elective/track tables describe alternatives to semester placeholders.
  // Explicit prerequisites and support requirements are additional obligations.
  const primary = groups.some((g) => /^Semesters?\s+\d/i.test(String(g.name)))
    ? groups.filter((g) =>
        /^(?:Semesters?\s+\d|Prerequisites?\b|Required\b)|Requirement$/i.test(
          String(g.name),
        ),
      )
    : groups;
  const fixed = new Set<string>(),
    optional = new Set<string>();
  const unresolved: string[] = [];
  const courses = new Map(
    (plan.course_details ?? []).map((c) => [c.course_code, c]),
  );
  const choices: {
    name: string;
    courses: string[];
    credits_required: number;
    credits_per_course: number;
  }[] = [];
  for (const group of primary) {
    const alternatives = conditionalCodes(group);
    const entries = Array.isArray(group.courses) ? group.courses : [];
    const choiceCodes = [...new Set(entries.map(programCourseCode))];
    const perCourse = courses.get(choiceCodes[0] ?? "")?.credit_hours;
    // A simple, exhaustive choose-N group can be allocated mechanically.
    // Specialization sequences, open options and exclusions need review.
    const simpleChoice =
      group.slot_kind === "choose" &&
      group.options_exhaustive === true &&
      !(Array.isArray(group.exclusions) && group.exclusions.length) &&
      !/\b(?:all|specialization|sequence|pair|combination)\b/i.test(
        String(group.rule ?? ""),
      ) &&
      typeof group.credits_required === "number" &&
      group.credits_required > 0 &&
      typeof perCourse === "number" &&
      perCourse > 0 &&
      group.credits_required % perCourse === 0 &&
      choiceCodes.length >= group.credits_required / perCourse &&
      choiceCodes.every(
        (code) => !!code && courses.get(code)?.credit_hours === perCourse,
      );
    if (simpleChoice)
      choices.push({
        name: String(group.name),
        courses: choiceCodes.filter((c): c is string => !!c),
        credits_required: Number(group.credits_required),
        credits_per_course: perCourse!,
      });
    for (const value of entries) {
      const code = programCourseCode(value);
      if (code && group.slot_kind === "fixed" && !alternatives.has(code))
        fixed.add(code);
      else {
        if (code) optional.add(code);
        if (!simpleChoice)
          unresolved.push(
            `${String(group.name ?? "Requirement")}: ${String(value)}`,
          );
      }
    }
    if (Array.isArray(group.exclusions) && group.exclusions.length)
      unresolved.push(
        `${String(group.name)}: published exclusions require review`,
      );
  }
  const membership = choiceMemberships(choices);
  for (const choice of choices)
    if (
      choice.courses.some(
        (code) => fixed.has(code) || (membership.get(code) ?? 0) > 1,
      )
    )
      unresolved.push(
        `${choice.name}: overlapping choices require allocation review; credits cannot be counted twice`,
      );
  const creditSum =
    [...fixed].reduce(
      (sum, code) => sum + (courses.get(code)?.credit_hours ?? 0),
      0,
    ) + choices.reduce((sum, choice) => sum + choice.credits_required, 0);
  const knownCredits = [...fixed].every(
    (code) => courses.get(code)?.credit_hours != null,
  );
  const published = plan.requested_semesters?.length
    ? primary.every((g) => typeof g.credits_required === "number")
      ? primary.reduce((sum, g) => sum + Number(g.credits_required), 0)
      : null
    : typeof plan.total_credits === "number"
      ? plan.total_credits
      : null;
  const exact =
    !unresolved.length &&
    knownCredits &&
    published != null &&
    creditSum === published;
  if (!unresolved.length && published !== creditSum)
    unresolved.push(
      "Course credits do not reconcile with the published requirement total",
    );
  return {
    fixed: [...fixed].sort(),
    optional: [...optional].sort(),
    choices,
    unresolved: [...new Set(unresolved)],
    published,
    exact,
  };
}

export function assessPlan(plan: PlanLike, messages: string[]) {
  const courses = plan.course_details ?? [];
  const byCode = new Map(courses.map((course) => [course.course_code, course]));
  const { history, unparsed } = analyzeHistory(messages, courses);
  const uncertain = Object.values(history).some(
    (record) => record.status === "unknown",
  );
  const requirements = planRequirements(plan);
  const completed = requirements.fixed.filter(
    (code) => history[code]?.status === "completed",
  );
  const inProgress = requirements.fixed.filter(
    (code) => history[code]?.status === "in_progress",
  );
  const remaining = requirements.fixed.filter(
    (code) => !["completed", "in_progress"].includes(history[code]?.status),
  );
  const credits = (codes: string[]) =>
    codes.reduce((sum, code) => sum + (byCode.get(code)?.credit_hours ?? 0), 0);
  const completedCreditsKnown = completed.every(
    (code) => byCode.get(code)?.credit_hours != null,
  );
  const allocated = new Set(completed);
  const membership = choiceMemberships(requirements.choices);
  const electiveAllocations = requirements.choices.map((choice) => {
    const eligible = choice.courses.filter(
      (code) =>
        history[code]?.status === "completed" &&
        !allocated.has(code) &&
        membership.get(code) === 1,
    );
    const selected = eligible.slice(
      0,
      choice.credits_required / choice.credits_per_course,
    );
    selected.forEach((code) => allocated.add(code));
    return {
      group: choice.name,
      completed_courses: selected,
      completed_credits: selected.length * choice.credits_per_course,
      credits_required: choice.credits_required,
    };
  });
  const electiveCredits = electiveAllocations.reduce(
    (sum, choice) => sum + choice.completed_credits,
    0,
  );
  return {
    scope: plan.requested_semesters?.length
      ? "requested semesters"
      : "whole program",
    history,
    completed_required_courses: completed,
    in_progress_required_courses: inProgress,
    remaining_required_courses: remaining,
    completed_required_credits: completedCreditsKnown
      ? credits(completed)
      : null,
    elective_allocations: electiveAllocations,
    remaining_credits:
      requirements.exact &&
      !unparsed.length &&
      !uncertain &&
      requirements.published != null
        ? requirements.published - credits(completed) - electiveCredits
        : null,
    published_credits: requirements.published,
    exact_credit_total: requirements.exact,
    unresolved_requirements: [
      ...requirements.unresolved,
      ...(uncertain
        ? [
            "Some course completion statuses are uncertain. Confirm them before calculating remaining credits.",
          ]
        : []),
      ...(unparsed.length
        ? [
            "Some reported course history could not be matched. Confirm the course codes and completion status before calculating remaining credits.",
          ]
        : []),
    ],
    unparsed_history_statements: unparsed,
    needs_history_clarification: unparsed.length > 0 || uncertain,
    unallocated_completed_courses: Object.keys(history).filter(
      (code) => history[code].status === "completed" && !allocated.has(code),
    ),
    requisites: Object.fromEntries(
      courses.map((c) => [
        c.course_code,
        assessRequisites(c.requisites_raw, history),
      ]),
    ),
    note: "Completed courses are student-reported and separated from courses to consider. In-progress courses still count toward unfinished credits. Elective allocation, transfer credit and official eligibility require your Success Coach.",
  };
}

export function comparePlans(left: PlanLike, right: PlanLike) {
  const a = planRequirements(left),
    b = planRequirements(right);
  const leftCodes = new Set(a.fixed),
    rightCodes = new Set(b.fixed);
  const leftDetails = new Map(
    left.course_details?.map((c) => [c.course_code, c]),
  );
  const rightDetails = new Map(
    right.course_details?.map((c) => [c.course_code, c]),
  );
  const shared = a.fixed.filter((code) => rightCodes.has(code));
  const sharedCredits = shared.map((code) => {
    const x = leftDetails.get(code)?.credit_hours;
    const y = rightDetails.get(code)?.credit_hours;
    return x != null && x === y ? x : null;
  });
  return {
    programs: [left, right].map((p) => ({
      name: p.name,
      catalog_year: p.catalog_year,
      source_url: p.source_url,
    })),
    shared_required_courses: shared,
    only_first_required_courses: a.fixed.filter(
      (code) => !rightCodes.has(code),
    ),
    only_second_required_courses: b.fixed.filter(
      (code) => !leftCodes.has(code),
    ),
    shared_required_credits:
      typeof left.catalog_year === "string" &&
      !!left.catalog_year.trim() &&
      left.catalog_year === right.catalog_year &&
      sharedCredits.every((n) => n != null)
        ? sharedCredits.reduce<number>((sum, n) => sum + (n ?? 0), 0)
        : null,
    unresolved_requirements: [a, b].map((r) => [
      ...r.unresolved,
      ...r.choices.map(
        (c) =>
          `${c.name}: choose ${c.credits_required} credits from ${c.courses.join(", ")}; alternatives are not guaranteed shared requirements`,
      ),
    ]),
    note: "Exact comparison of explicitly required course codes. Elective options and specialization alternatives are not guaranteed shared requirements; this does not determine transfer or graduation eligibility.",
  };
}
