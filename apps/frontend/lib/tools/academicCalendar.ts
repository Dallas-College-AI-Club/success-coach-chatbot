/**
 * The academic calendar: what a "semester" is, and how to find the next one.
 *
 * This module is pure. It takes a calendar date in and gives term information
 * out, with no clock, no time zone, and no I/O. That keeps the tricky part —
 * year rollover, boundary days, leap years — testable without a model or a
 * frozen clock in sight.
 */

/**
 * A term, defined by its start date only.
 *
 * Deliberately *not* a start-and-end pair. Real academic calendars have gaps
 * between terms (winter break, reading periods), and a start/end model forces a
 * decision about what December 27th "is" — a decision every institution makes
 * differently, and one this tool has no business inventing.
 *
 * Defining a term by its start alone makes the year a total partition: a term
 * runs until the next term begins. Every date belongs to exactly one term, so
 * "what comes next" is always answerable and never needs a null case. The
 * trade-off is that `endDate` below means "the day before the next term starts",
 * not "the last day of instruction" — see `SemesterInfo.endDate`.
 */
export interface TermDefinition {
  /** Display name, e.g. `Spring`. Used verbatim in labels like "Spring 2027". */
  readonly name: string;
  /** Month the term begins, 1-12. */
  readonly startMonth: number;
  /** Day of month the term begins, 1-31. */
  readonly startDay: number;
}

export interface AcademicCalendar {
  /** Terms in the annual cycle. Order in this array does not matter. */
  readonly terms: readonly TermDefinition[];
  /**
   * Name of the term that opens a new academic year. For most US institutions
   * this is Fall, making Fall 2026 and Spring 2027 both part of AY 2026-2027.
   */
  readonly academicYearStartsWith: string;
}

/**
 * Default calendar: a three-term US semester system.
 *
 * These boundaries classify dates into terms; they are not claimed to be any
 * particular institution's first and last day of instruction. Pass your own
 * `AcademicCalendar` if you need exact local dates.
 */
export const US_SEMESTER_CALENDAR: AcademicCalendar = {
  terms: [
    { name: "Spring", startMonth: 1, startDay: 1 },
    { name: "Summer", startMonth: 5, startDay: 16 },
    { name: "Fall", startMonth: 8, startDay: 16 },
  ],
  academicYearStartsWith: "Fall",
};

/** A four-term quarter system, included to keep the model genuinely pluggable. */
export const US_QUARTER_CALENDAR: AcademicCalendar = {
  terms: [
    { name: "Winter", startMonth: 1, startDay: 1 },
    { name: "Spring", startMonth: 3, startDay: 25 },
    { name: "Summer", startMonth: 6, startDay: 15 },
    { name: "Fall", startMonth: 9, startDay: 20 },
  ],
  academicYearStartsWith: "Fall",
};

/** One resolved term in a specific year. */
export interface SemesterInfo {
  /** Human-facing label, e.g. `Spring 2027`. */
  label: string;
  /** Term name on its own, e.g. `Spring`. */
  term: string;
  /** Calendar year the term starts in. */
  year: number;
  /** First day of the term, `YYYY-MM-DD`. */
  startDate: string;
  /** Day before the following term starts, `YYYY-MM-DD`. See `TermDefinition`. */
  endDate: string;
  /** Academic year this term belongs to, e.g. `2026-2027`. */
  academicYear: string;
}

export interface SemesterResolution {
  /** The term that begins after `asOfDate`. */
  next: SemesterInfo;
  /** The term `asOfDate` falls in. Included because it is nearly always useful. */
  current: SemesterInfo;
  /** Whole days from `asOfDate` to the first day of `next`. */
  daysUntilNextStarts: number;
}

/** Raised for a malformed `AcademicCalendar` or an invalid date. */
export class AcademicCalendarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcademicCalendarError";
  }
}

/** Calendar year, month (1-12) and day, with no time or zone attached. */
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
const MS_PER_DAY = 86_400_000;

/**
 * Resolves the current and next term for a given date.
 *
 * @param today - The date to resolve from.
 * @param calendar - Term definitions. Defaults to `US_SEMESTER_CALENDAR`.
 *
 * @example
 * resolveSemesters({ year: 2026, month: 10, day: 15 });
 * // current: "Fall 2026", next: "Spring 2027"
 */
export function resolveSemesters(
  today: CalendarDate,
  calendar: AcademicCalendar = US_SEMESTER_CALENDAR,
): SemesterResolution {
  const current = resolveSemester(today, { offset: 0 }, calendar);
  const next = resolveSemester(today, { offset: 1 }, calendar);
  return {
    current,
    next,
    daysUntilNextStarts: daysBetween(toIsoDate(today), next.startDate),
  };
}

/**
 * Which semester a query refers to.
 *
 * The tool exposes these three fields rather than a natural-language string
 * because parsing "next spring" is the model's job, not the calendar's. The
 * model translates the phrase into structure; this function does arithmetic on
 * it. Keeping the split there means new phrasings need no code change.
 */
export interface SemesterQuery {
  /**
   * Position relative to today. `0` is the term in progress, `1` the one after
   * it, `-1` the one before. Ignored when `year` is set.
   */
  offset?: number;
  /**
   * Restrict to occurrences of one named term, e.g. `Spring`. Combined with
   * `offset` this expresses "next spring" (`offset: 1`) or "last fall"
   * (`offset: -1`). Matched case-insensitively.
   */
  term?: string;
  /** Exact calendar year, for a direct lookup like "Spring 2027". Requires `term`. */
  year?: number;
}

/** Widest offset accepted, in either direction. */
export const MAX_OFFSET = 40;

/**
 * Resolves a single semester from a query.
 *
 * One rule covers every case, whether or not a term filter is applied:
 *
 * - `offset === 0` — the instance whose span contains today
 * - `offset >= 1`  — the Nth instance *starting* strictly after today
 * - `offset <= -1` — the Nth instance *ending* strictly before today
 *
 * With no `term`, the timeline is every term in the cycle, so the rule reduces
 * to index arithmetic around the current term. With a `term`, the timeline is
 * filtered first, which is what makes "next spring" behave correctly even while
 * a Spring term is in progress: Spring 2027 has already started, so it is not
 * "starting strictly after today", and `offset: 1` correctly yields Spring 2028.
 *
 * Defining negative offsets by *end* date rather than start is the mirror of
 * that: in March of Spring 2027, Spring 2027 has not ended, so "last spring"
 * skips past it to Spring 2026 as a person would mean it.
 *
 * @example
 * resolveSemester(today, { offset: 1 });                    // next semester
 * resolveSemester(today, { term: "Spring", offset: 1 });    // next spring
 * resolveSemester(today, { term: "Spring", year: 2027 });   // Spring 2027
 */
export function resolveSemester(
  today: CalendarDate,
  query: SemesterQuery = {},
  calendar: AcademicCalendar = US_SEMESTER_CALENDAR,
): SemesterInfo {
  assertValidCalendar(calendar);
  assertValidCalendarDate(today);

  const { offset = 0, year } = query;
  const term = query.term === undefined ? undefined : canonicalTermName(query.term, calendar);

  if (year !== undefined) {
    if (term === undefined) {
      throw new AcademicCalendarError(
        `A "year" needs a "term" alongside it: a year on its own does not identify one semester. ` +
          `For example { term: "${calendar.terms[0]!.name}", year: ${year} }.`,
      );
    }
    if (query.offset !== undefined) {
      throw new AcademicCalendarError(
        `Pass either "year" (an exact semester) or "offset" (a position relative to today), not both.`,
      );
    }
    assertValidYear(year);
    // A one-year window still needs its neighbour to compute the end date.
    const timeline = materialiseTimeline(calendar, year, 1);
    const found = timeline.find((entry) => entry.term === term && entry.year === year);
    if (!found) {
      throw new AcademicCalendarError(`No ${term} term exists in ${year}.`);
    }
    return found;
  }

  if (!Number.isInteger(offset) || Math.abs(offset) > MAX_OFFSET) {
    throw new AcademicCalendarError(
      `Invalid offset ${offset}; expected an integer between -${MAX_OFFSET} and ${MAX_OFFSET}.`,
    );
  }

  const todayIso = toIsoDate(today);
  // Radius scales with the offset so even a filtered timeline (one instance of
  // the term per year) always reaches far enough. +2 covers the boundary years.
  const timeline = materialiseTimeline(calendar, today.year, Math.abs(offset) + 2);
  const candidates = term === undefined ? timeline : timeline.filter((e) => e.term === term);

  if (offset === 0) {
    const containing = candidates.find(
      (entry) => entry.startDate <= todayIso && todayIso <= entry.endDate,
    );
    if (!containing) {
      // Only reachable with a term filter: today sits in some other term.
      const actual = timeline.find((e) => e.startDate <= todayIso && todayIso <= e.endDate);
      throw new AcademicCalendarError(
        `No ${term} term is in progress on ${todayIso}` +
          (actual ? `; the current term is ${actual.label}` : "") +
          `. Use offset 1 for the next ${term} term, or -1 for the previous one.`,
      );
    }
    return containing;
  }

  if (offset > 0) {
    const upcoming = candidates.filter((entry) => entry.startDate > todayIso);
    return pick(upcoming, offset - 1, offset, term, todayIso);
  }

  const past = candidates.filter((entry) => entry.endDate < todayIso);
  return pick(past, past.length + offset, offset, term, todayIso);
}

function pick(
  candidates: readonly SemesterInfo[],
  index: number,
  offset: number,
  term: string | undefined,
  todayIso: string,
): SemesterInfo {
  const found = candidates[index];
  if (!found) {
    // Unreachable given the radius above; checked so a future edit to the
    // window fails loudly rather than returning a quietly wrong semester.
    throw new AcademicCalendarError(
      `Could not resolve offset ${offset}${term ? ` for term ${term}` : ""} relative to ${todayIso}.`,
    );
  }
  return found;
}

/** Matches a model-supplied term name case-insensitively, or explains what is valid. */
export function canonicalTermName(name: string, calendar: AcademicCalendar): string {
  const wanted = name.trim().toLowerCase();
  const match = calendar.terms.find((term) => term.name.toLowerCase() === wanted);
  if (!match) {
    throw new AcademicCalendarError(
      `Unknown term ${JSON.stringify(name)}. This calendar defines: ` +
        `${calendar.terms.map((t) => t.name).join(", ")}.`,
    );
  }
  return match.name;
}

function assertValidYear(year: number): void {
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new AcademicCalendarError(`Invalid year ${year}; expected an integer 1-9999.`);
  }
}

/**
 * Builds every term instance from `centerYear - radius` to `centerYear + radius`,
 * sorted by start date, with end dates filled in.
 */
function materialiseTimeline(
  calendar: AcademicCalendar,
  centerYear: number,
  radius: number,
): SemesterInfo[] {
  const years: number[] = [];
  // One extra year at each end: the first entry's end date depends on nothing,
  // but the last entry's depends on the instance after it.
  for (let year = centerYear - radius - 1; year <= centerYear + radius + 1; year++) {
    years.push(year);
  }

  const starts = materialiseStarts(calendar, years);
  const described: SemesterInfo[] = [];
  for (let i = 0; i < starts.length - 1; i++) {
    described.push(describeTerm(starts[i]!, starts[i + 1]!, calendar));
  }
  return described;
}

interface MaterialisedStart {
  definition: TermDefinition;
  year: number;
  isoDate: string;
}

function materialiseStarts(calendar: AcademicCalendar, years: number[]): MaterialisedStart[] {
  const starts: MaterialisedStart[] = [];
  for (const year of years) {
    for (const definition of calendar.terms) {
      starts.push({
        definition,
        year,
        isoDate: toIsoDate({ year, month: definition.startMonth, day: definition.startDay }),
      });
    }
  }
  starts.sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  return starts;
}

function describeTerm(
  start: MaterialisedStart,
  following: MaterialisedStart,
  calendar: AcademicCalendar,
): SemesterInfo {
  return {
    label: `${start.definition.name} ${start.year}`,
    term: start.definition.name,
    year: start.year,
    startDate: start.isoDate,
    endDate: previousDay(following.isoDate),
    academicYear: academicYearFor(start, calendar),
  };
}

/**
 * Which academic year a term belongs to.
 *
 * A term is in AY `Y..Y+1` if it starts on or after the AY-opening term within
 * the same calendar year, and in AY `Y-1..Y` otherwise. So with Fall opening
 * the year: Fall 2026, Spring 2027 and Summer 2027 all report `2026-2027`.
 */
function academicYearFor(start: MaterialisedStart, calendar: AcademicCalendar): string {
  const opener = calendar.terms.find((t) => t.name === calendar.academicYearStartsWith)!;
  const openerKey = monthDayKey(opener.startMonth, opener.startDay);
  const termKey = monthDayKey(start.definition.startMonth, start.definition.startDay);
  const first = termKey >= openerKey ? start.year : start.year - 1;
  return `${first}-${first + 1}`;
}

const monthDayKey = (month: number, day: number): number => month * 100 + day;

/** Validates an `AcademicCalendar`, throwing on the first problem found. */
export function assertValidCalendar(calendar: AcademicCalendar): void {
  const { terms, academicYearStartsWith } = calendar;

  if (terms.length < 2) {
    throw new AcademicCalendarError(
      `An academic calendar needs at least 2 terms to have a "next" term; got ${terms.length}.`,
    );
  }

  const names = new Set<string>();
  const startKeys = new Set<number>();

  for (const term of terms) {
    if (term.name.trim() === "") {
      throw new AcademicCalendarError("Term names cannot be empty.");
    }
    if (names.has(term.name)) {
      throw new AcademicCalendarError(`Duplicate term name: ${JSON.stringify(term.name)}.`);
    }
    names.add(term.name);

    if (!Number.isInteger(term.startMonth) || term.startMonth < 1 || term.startMonth > 12) {
      throw new AcademicCalendarError(
        `Term ${JSON.stringify(term.name)} has startMonth ${term.startMonth}; expected an integer 1-12.`,
      );
    }

    // February is capped at 28 rather than 29: a term starting on Feb 29 would
    // simply not exist in three years out of four, and silently sliding it to
    // Feb 28 or Mar 1 would be this module inventing policy. Rejected instead.
    const maxDay = DAYS_IN_MONTH[term.startMonth - 1]!;
    if (!Number.isInteger(term.startDay) || term.startDay < 1 || term.startDay > maxDay) {
      throw new AcademicCalendarError(
        `Term ${JSON.stringify(term.name)} has startDay ${term.startDay}; expected an integer 1-${maxDay} ` +
          `for month ${term.startMonth}${term.startMonth === 2 ? " (Feb 29 is not a valid term start)" : ""}.`,
      );
    }

    const key = monthDayKey(term.startMonth, term.startDay);
    if (startKeys.has(key)) {
      throw new AcademicCalendarError(
        `Two terms start on the same day (month ${term.startMonth}, day ${term.startDay}); ` +
          `term boundaries must be distinct.`,
      );
    }
    startKeys.add(key);
  }

  if (!names.has(academicYearStartsWith)) {
    throw new AcademicCalendarError(
      `academicYearStartsWith is ${JSON.stringify(academicYearStartsWith)}, which is not one of the ` +
        `defined terms: ${[...names].join(", ")}.`,
    );
  }
}

/** Validates a `CalendarDate`, including day-of-month and leap years. */
export function assertValidCalendarDate(date: CalendarDate): void {
  const { year, month, day } = date;
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new AcademicCalendarError(`Invalid year ${year}; expected an integer 1-9999.`);
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new AcademicCalendarError(`Invalid month ${month}; expected an integer 1-12.`);
  }
  const maxDay = daysInMonth(year, month);
  if (!Number.isInteger(day) || day < 1 || day > maxDay) {
    throw new AcademicCalendarError(
      `Invalid day ${day} for ${year}-${pad2(month)}; that month has ${maxDay} days.`,
    );
  }
}

/** Parses and validates a `YYYY-MM-DD` string. */
export function parseIsoDate(value: string): CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new AcademicCalendarError(
      `Invalid date ${JSON.stringify(value)}; expected the format YYYY-MM-DD, for example "2027-01-15".`,
    );
  }
  const date: CalendarDate = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  assertValidCalendarDate(date);
  return date;
}

export function toIsoDate({ year, month, day }: CalendarDate): string {
  return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
}

export function daysInMonth(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1]!;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Whole days from `fromIso` to `toIso`.
 *
 * Uses `Date.UTC`, so this is pure calendar arithmetic: no local zone, and no
 * chance of a DST transition making a day 23 or 25 hours long and rounding the
 * count off by one.
 */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((utcMillis(toIso) - utcMillis(fromIso)) / MS_PER_DAY);
}

function previousDay(isoDate: string): string {
  const stamp = new Date(utcMillis(isoDate) - MS_PER_DAY);
  return toIsoDate({
    year: stamp.getUTCFullYear(),
    month: stamp.getUTCMonth() + 1,
    day: stamp.getUTCDate(),
  });
}

function utcMillis(isoDate: string): number {
  const { year, month, day } = parseIsoDate(isoDate);
  return Date.UTC(year, month - 1, day);
}

const pad2 = (n: number): string => String(n).padStart(2, "0");
