// Shared serializable catalog fields. No database or browser dependencies.
export interface CourseDetails {
  course_code: string;
  title: string | null;
  credit_hours: number | null;
  description: string | null;
  requisites_raw: string | null;
  campus_locations: string | null;
  catalog_year: string | null;
  source_url?: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function catalogText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isCourseCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z]{3,4} \d{4}$/.test(value);
}

// Structured program records sometimes store "CODE 1234 - Title (3 credits)".
// Resolve only an unambiguous leading code; an OR/AND choice stays a requirement.
export function programCourseCode(value: unknown): string | null {
  if (isCourseCode(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.match(/^([A-Z]{3,4})\s*(\d{4})\s*[-–—:]\s+/);
  if (!match || /\b[A-Z]{3,4}\s*\d{4}\b/.test(value.slice(match[0].length)))
    return null;
  return `${match[1]} ${match[2]}`;
}

// Keep the catalog's wording, including "Recommended" and prose requirements.
// Older records may only retain that wording inside the structured groups.
function requisiteText(value: Record<string, unknown>): string | null {
  const raw = catalogText(value.requisites_raw);
  if (raw) return raw;
  const sentences = ["prerequisites", "corequisites"].flatMap((kind) => {
    const groups = value[kind];
    return Array.isArray(groups)
      ? groups.flatMap((g) => {
          const text = isRecord(g) ? catalogText(g.raw_text) : null;
          if (!text) return [];
          return [
            /^(?:Pre|Co)requisites?\s*:/i.test(text)
              ? text
              : `${kind === "corequisites" ? "Corequisites" : "Prerequisites"}: ${text}`,
          ];
        })
      : [];
  });
  return [...new Set(sentences)].join("\n") || null;
}

export function readCourseDetails(value: unknown): CourseDetails | null {
  if (!isRecord(value) || !isCourseCode(value.course_code)) return null;
  return {
    course_code: value.course_code,
    title: catalogText(value.title),
    credit_hours:
      typeof value.credit_hours === "number" &&
      Number.isFinite(value.credit_hours) &&
      value.credit_hours >= 0
        ? value.credit_hours
        : null,
    description: catalogText(value.description),
    requisites_raw: requisiteText(value),
    campus_locations: catalogText(value.campus_locations),
    catalog_year: catalogText(value.catalog_year),
    source_url: catalogText(value.source_url) ?? undefined,
  };
}

export function courseDetailsFromRow(row: {
  courseCode: string | null;
  facts: unknown;
  sourceUrl: string;
  catalogYear: string | null;
}): CourseDetails | null {
  if (!isRecord(row.facts)) return null;
  return readCourseDetails({
    ...row.facts,
    course_code: row.courseCode,
    source_url: row.sourceUrl,
    catalog_year: row.catalogYear,
  });
}

// Descriptions belong in expandable UI rows, not in every model-context replay.
// Keep the plan, rules, exact titles and individual credits available for answers.
export function programResultForModel(output: unknown): unknown {
  if (!isRecord(output) || !Array.isArray(output.course_details)) return output;
  const result = { ...output };
  const courses = output.course_details
    .map(readCourseDetails)
    .filter((c): c is CourseDetails => c !== null);
  delete result.course_details;
  return {
    ...result,
    course_details_available: courses.map((c) => c.course_code),
    course_credits: Object.fromEntries(
      courses.map((c) => [c.course_code, c.credit_hours]),
    ),
    course_requisites: Object.fromEntries(
      courses.map((c) => [c.course_code, c.requisites_raw]),
    ),
  };
}

const ordinals = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
  "eleventh",
  "twelfth",
];

// Asking to START is asking for semester 1, even with no number in the
// sentence. A reader who TYPED the starter's own words ("Which classes would I
// start with?") instead of clicking it got the whole eight-semester degree
// back, because only the chip's hidden prompt carried "only semester 1"
// (production walk, 2026-09-22).
//
// Every alternative needs start/begin, a "do I", or a class word, and NONE of
// them can appear in a catalog group name. That matters more than it looks:
// this function also classifies group names for scopeProgramGroups, 12 of the
// 314 published group names contain "First" — including "Semester 2 (First
// Year Continued)" — and a bare /\bfirst\b/ rule would file that group under
// semester 1 and put semester 2 back on screen. Guarded with those real names.
const FIRST_SEMESTER =
  /\b(?:start|starting|begin|beginning)\s+(?:out\s+)?with\b|\b(?:do|would|should|can|could)\s+i\s+(?:start|begin)\b|\bbefore\s+(?:i\s+)?start(?:ing)?\b|\b(?:first|starting)\s+(?:class|classes|course|courses)\b|\bstart(?:ing)?\s+(?:my|the|this)\s+(?:program|degree|certificate|major|plan)\b/;

/** Explicit numbered curriculum semesters, never a Fall/Spring schedule term. */
export function requestedSemesters(text: string): number[] {
  const value = text.toLowerCase();
  // A named full checklist may mention a semester as context, not as a filter.
  const fullPlan = value.match(
    /\b(?:full|entire|complete)\s+([^.!?;\n]{0,140}?)\b(?:plan|checklist|requirements|curriculum|map)\b/,
  );
  if (
    (fullPlan && !/\bsemesters?\b/.test(fullPlan[1])) ||
    /\b(?:all|every)\s+semesters?\b|\b(?:full|entire|complete)\s+(?:program|course|degree)\s*(?:plan|map)?\b/.test(
      value,
    )
  )
    return [];
  const found = new Set<number>();
  if (FIRST_SEMESTER.test(value)) found.add(1);
  const ordinal = (token: string) =>
    /^\d/.test(token)
      ? Number.parseInt(token, 10)
      : ordinals.indexOf(token) + 1;
  const atom = `(?:\\d{1,2}(?:st|nd|rd|th)?|${ordinals.join("|")})`;
  const range = new RegExp(
    `\\bsemesters?\\s+(${atom})\\s*(?:-|–|to|through)\\s*(${atom})\\b|\\b(${atom})\\s*(?:-|–|to|through)\\s*(${atom})[ -]+semesters?\\b`,
    "g",
  );
  for (const match of value.matchAll(range)) {
    const first = ordinal(match[1] ?? match[3]);
    const last = ordinal(match[2] ?? match[4]);
    for (
      let semester = Math.min(first, last);
      semester <= Math.max(first, last);
      semester++
    )
      found.add(semester);
  }
  for (const match of value.matchAll(
    /\b(\d{1,2})(?:st|nd|rd|th)?[ -]+semester\b|\bsemester\s+(\d{1,2})\b/g,
  )) {
    found.add(Number(match[1] ?? match[2]));
  }
  ordinals.forEach((word, index) => {
    if (new RegExp(`\\b${word}[ -]+semester\\b`).test(value))
      found.add(index + 1);
  });
  // Lists such as "semesters 1 and 2" or "first and second semesters".
  for (const match of value.matchAll(
    /\bsemesters?\s+(\d{1,2}(?:(?:\s*,\s*|\s+and\s+)\d{1,2})+)/g,
  )) {
    for (const number of match[1].matchAll(/\d+/g))
      found.add(Number(number[0]));
  }
  const wordList = value.match(
    new RegExp(
      `\\b((?:${ordinals.join("|")})(?:(?:,?\\s+and\\s+|,\\s*)(?:${ordinals.join("|")}))+)\\s+semesters?\\b`,
    ),
  );
  if (wordList)
    for (const word of ordinals)
      if (wordList[1].includes(word)) found.add(ordinals.indexOf(word) + 1);
  return [...found].filter((n) => n >= 1 && n <= 99).sort((a, b) => a - b);
}

export function scopeProgramGroups(groups: unknown[], semesters: number[]) {
  if (!semesters.length) return groups;
  return groups.filter((group) => {
    if (!isRecord(group) || typeof group.name !== "string") return false;
    return requestedSemesters(group.name).some((n) => semesters.includes(n));
  });
}

/** One source section per row. Missing facts never imply an asynchronous class. */
export function scheduleSection(row: {
  year: number | null;
  semester: string | null;
  professor: string | null;
  metadata: unknown;
  facts: unknown;
  sourceUrl: string;
}) {
  const dayNames: Record<string, string> = {
    M: "Mon",
    T: "Tue",
    W: "Wed",
    R: "Thu",
    F: "Fri",
    S: "Sat",
    U: "Sun",
  };
  const facts = isRecord(row.facts) ? row.facts : {};
  const meta = isRecord(row.metadata) ? row.metadata : {};
  const meets = (Array.isArray(facts.meetings) ? facts.meetings : [])
    .filter(isRecord)
    .flatMap((m) => {
      const days = catalogText(m.days),
        start = catalogText(m.start_time),
        end = catalogText(m.end_time);
      return days && start && end
        ? [
            `${days
              .split(/\s+/)
              .map((day) => dayNames[day] ?? day)
              .join(
                " / ",
              )} ${start}–${end}${catalogText(m.type) ? ` (${m.type})` : ""}${catalogText(m.room) ? ` · ${m.room}` : ""}`,
          ]
        : [];
    });
  const raw = catalogText(facts.meeting_info_raw);
  const season = row.semester
    ? row.semester[0].toUpperCase() + row.semester.slice(1)
    : "";
  return {
    section_number:
      catalogText(facts.section_number) ?? catalogText(meta.section),
    term: [season, row.year].filter(Boolean).join(" ") || "Term not listed",
    professor: row.professor,
    modality: catalogText(facts.modality) ?? catalogText(meta.modality),
    campus: catalogText(facts.campus) ?? catalogText(meta.campus),
    start_date: catalogText(facts.start_date),
    end_date: catalogText(facts.end_date),
    meets,
    meeting_info_raw: raw,
    timing_status: meets.length
      ? "published_times"
      : raw
        ? "source_text_only"
        : "not_loaded",
    source_url: row.sourceUrl,
  };
}

export type ScheduleGrouping =
  | "section"
  | "day"
  | "professor"
  | "time"
  | "campus";

/** Group the loaded page only; retain every source section and all its meetings. */
export function groupScheduleSections(
  sections: Record<string, unknown>[],
  by: ScheduleGrouping,
) {
  const groups = new Map<string, Record<string, unknown>[]>();
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const times = ["Morning", "Afternoon", "Evening"];
  for (const section of sections) {
    const meetings = Array.isArray(section.meets)
      ? section.meets.filter((m): m is string => typeof m === "string")
      : [];
    let labels: string[];
    if (by === "day") {
      labels = days.filter((day) =>
        meetings.some((m) => m.split(/\d/)[0].includes(day)),
      );
    } else if (by === "time") {
      labels = meetings.flatMap((m) => {
        const start = m.match(/\b(\d{1,2}):\d{2}\s*(AM|PM)\b/i);
        if (!start) return [];
        const hour =
          (Number(start[1]) % 12) + (start[2].toUpperCase() === "PM" ? 12 : 0);
        return [hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening"];
      });
    } else {
      labels = [
        by === "section"
          ? "Sections"
          : (catalogText(section[by]) ??
            (by === "professor"
              ? "Instructor not listed"
              : "Campus not listed")),
      ];
    }
    if (!labels.length) labels = ["No published clock times"];
    for (const label of new Set(labels)) {
      const group = groups.get(label) ?? [];
      group.push(section);
      groups.set(label, group);
    }
  }
  const order = by === "day" ? days : by === "time" ? times : [];
  return [...groups].sort(([a], [b]) => {
    if (order.length) {
      const ai = order.indexOf(a),
        bi = order.indexOf(b);
      return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi);
    }
    return a.localeCompare(b);
  });
}

/** The pipeline's exact instructor key may link only to one distinct CV. */
export function instructorCvLinks(
  rows: { slug: string | null; sourceUrl: string }[],
) {
  const candidates = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.slug) continue;
    const urls = candidates.get(row.slug) ?? new Set<string>();
    urls.add(row.sourceUrl);
    candidates.set(row.slug, urls);
  }
  return new Map(
    [...candidates].flatMap(([slug, urls]) =>
      urls.size === 1 ? [[slug, [...urls][0]] as const] : [],
    ),
  );
}

/** Inline CV text is UI detail; avoid replaying every biography to the model. */
export function scheduleResultForModel(output: unknown) {
  if (!isRecord(output)) return output;
  const result = { ...output };
  delete result.instructor_profiles;
  if (Array.isArray(output.offerings)) {
    const sections = output.offerings.filter(isRecord);
    const byModality = new Map<string, number>();
    for (const section of sections) {
      const modality =
        catalogText(section.modality)?.toLowerCase() ?? "unknown";
      byModality.set(modality, (byModality.get(modality) ?? 0) + 1);
    }
    // Count rows, including unassigned instructors. Pagination never turns a
    // loaded-page count into a total for every section of the course.
    result.loaded_section_counts = {
      scope: "loaded_page",
      total: sections.length,
      by_modality: Object.fromEntries(byModality),
      with_published_times: sections.filter(
        (section) => Array.isArray(section.meets) && section.meets.length > 0,
      ).length,
      without_published_times: sections.filter(
        (section) =>
          !Array.isArray(section.meets) || section.meets.length === 0,
      ).length,
    };
    result.timing_guidance =
      "Sections without published times have UNKNOWN schedule fit. Report them separately; do not count them as unavailable, non-matching, evening, or asynchronous.";
  }
  return result;
}
