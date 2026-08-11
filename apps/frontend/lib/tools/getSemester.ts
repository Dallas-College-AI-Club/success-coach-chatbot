import { systemClock, type Clock } from "./clock";
import {
  AcademicCalendarError,
  assertValidCalendar,
  canonicalTermName,
  DALLAS_COLLEGE_CALENDAR,
  daysBetween,
  MAX_OFFSET,
  parseIsoDate,
  resolveSemester,
  toIsoDate,
  type AcademicCalendar,
  type SemesterInfo,
} from "./academicCalendar";
import { assertIanaTimeZone, describeInstant } from "./getCurrentDate";
import { jsonSchema } from "ai";
import { defineTool, isRecord, ToolInputError, type FlexibleSchema, type Tool } from "./types";

export { GET_SEMESTER_TOOL_NAME } from "./names";
import { GET_SEMESTER_TOOL_NAME } from "./names";

/**
 * Dallas College's zone. Mirrors src/config/runtime.json DISPLAY_TIMEZONE —
 * importing that file directly is not possible here: Turbopack roots the
 * module graph at apps/frontend (where the lockfile is), and repo-root
 * src/config is outside it, so the import type-checks but fails `next build`.
 */
export const DALLAS_COLLEGE_TIME_ZONE = "America/Chicago";

export interface GetSemesterInput {
  /** Position relative to today: 0 this, 1 next, -1 previous. */
  offset?: number;
  /** Restrict to one named term, e.g. `Spring`. */
  term?: string;
  /** Exact calendar year, for a direct lookup. Requires `term`. */
  year?: number;
  /** Resolve relative to this date instead of today, `YYYY-MM-DD`. Hypotheticals only. */
  asOf?: string;
  /** IANA time zone used to decide what "today" is. */
  timeZone?: string;
}

export interface SemesterResult {
  /** The semester the query resolved to. */
  semester: SemesterInfo;
  /** The semester in progress on `asOfDate`, always included for context. */
  current: SemesterInfo;
  /** Whether `semester` is the one currently in progress. */
  isCurrent: boolean;
  /** Days from `asOfDate` to `semester.startDate`. Negative once it has begun. */
  daysUntilStart: number;
  /** Days from `asOfDate` to `semester.endDate`. Negative once it has ended. */
  daysUntilEnd: number;
  /** The date this answer was resolved from, `YYYY-MM-DD`. */
  asOfDate: string;
  /**
   * Where `asOfDate` came from.
   *
   * `"system_clock"` means the tool read the real clock, so the answer is about
   * the actual present. `"argument"` means the caller supplied a date and the
   * answer is hypothetical. Surfacing this lets a reviewer — or the model —
   * notice when an answer about "this semester" was silently resolved from a
   * date the model made up rather than from the clock.
   */
  asOfSource: "system_clock" | "argument";
  timeZone: string;
}

/**
 * Builds the tool description from the calendar, so a deployment using quarters
 * advertises Winter/Spring/Summer/Fall rather than the semester defaults. A
 * hardcoded description would quietly lie to the model about what `term` accepts.
 *
 * The worked examples are the load-bearing part. Routing accuracy on a schema
 * like this comes almost entirely from showing the phrase-to-parameter mapping
 * rather than describing it in prose.
 */
function buildDescription(calendar: AcademicCalendar): string {
  const names = calendar.terms.map((term) => term.name);
  const first = names[0]!;
  const last = names[names.length - 1]!;

  return [
    "Resolves which academic semester a question refers to, reading the current date from the system clock.",
    "",
    `This calendar defines these terms, repeating every year: ${names.join(", ")}.`,
    "",
    "Call this tool for any question about which semester or term something falls in, including which",
    "semester it is now, which one comes next or came before, when a semester starts or ends, how long",
    "until one begins, and questions about registration or scheduling framed around a semester.",
    "",
    "Translate the user's phrasing into these parameters:",
    `  "this semester" / "current semester"   -> {}`,
    `  "next semester"                        -> { "offset": 1 }`,
    `  "last semester" / "previous semester"  -> { "offset": -1 }`,
    `  "two semesters from now"               -> { "offset": 2 }`,
    `  "next ${first}"                             -> { "term": "${first}", "offset": 1 }`,
    `  "last ${last}"                               -> { "term": "${last}", "offset": -1 }`,
    `  "${first} 2027"                             -> { "term": "${first}", "year": 2027 }`,
    "",
    `"offset" counts positions from the term in progress today: 0 is the current one, positive numbers`,
    `go forward, negative numbers go back. Combined with "term", it counts only occurrences of that term,`,
    `so { "term": "${first}", "offset": 1 } is the next ${first} that has not started yet even if a ${first}`,
    "term is running right now.",
    "",
    `Use "year" only for an explicit named semester such as "${first} 2027". Do not combine it with "offset".`,
    "",
    "This tool reads the current date itself. Do NOT call get_current_date first and pass the result in;",
    "call this tool directly.",
    "",
    "Leave 'asOf' empty for any question about the actual present. Only set 'asOf' when the user asks a",
    "hypothetical about a specific other date, such as 'if it were March 2030, what semester would it be?'.",
    "Never put a guessed or remembered date in 'asOf' — you do not know today's date, and supplying a wrong",
    "one produces a confidently wrong answer.",
    "",
    "Returns: semester (label such as 'Spring 2027', term, year, startDate, endDate, academicYear),",
    "current, isCurrent, daysUntilStart, daysUntilEnd, asOfDate, asOfSource, and timeZone.",
    "",
    "startDate/endDate are calendar-partition boundaries: endDate is the day before the next term",
    "begins, not the final day of instruction. A term's year is the year it starts — the Winter",
    "session that begins in December 2026 is 'Winter 2026' even in January 2027.",
  ].join("\n");
}

/**
 * Supplied as JSON Schema rather than Zod: the enum and the descriptions are
 * derived from the configured calendar at construction time, so building the
 * schema object directly keeps that generation in one place.
 *
 * As in `getCurrentDate`, `jsonSchema()` carries no `validate` function, so the
 * AI SDK does not enforce this schema at runtime. `parseInput` is the only
 * validation — which is where the cross-field rules (`year` requires `term`,
 * `year` excludes `offset`) and the term canonicalisation live anyway, since a
 * JSON Schema cannot express them.
 */
function buildInputSchema(calendar: AcademicCalendar): FlexibleSchema<GetSemesterInput> {
  const names = calendar.terms.map((term) => term.name);
  return jsonSchema({
    type: "object",
    properties: {
      offset: {
        type: "integer",
        minimum: -MAX_OFFSET,
        maximum: MAX_OFFSET,
        description:
          "Position relative to the semester in progress today. 0 (the default) is the current " +
          "semester, 1 the next, -1 the previous. With 'term' set, counts only occurrences of that term.",
      },
      term: {
        type: "string",
        enum: names,
        description:
          `Restrict the answer to one named term. Must be one of: ${names.join(", ")}. ` +
          `Use this for phrases like "next ${names[0]}" or "last ${names[names.length - 1]}".`,
      },
      year: {
        type: "integer",
        description:
          `Exact calendar year for a named semester such as "${names[0]} 2027". Requires 'term'. ` +
          "Do not combine with 'offset'.",
      },
      asOf: {
        type: "string",
        description:
          "Optional date in YYYY-MM-DD format to resolve from instead of today. Only for explicit " +
          "hypothetical questions about another date. Omit this for anything about the present.",
      },
      timeZone: {
        type: "string",
        description:
          "Optional IANA time zone name used to determine today's date, e.g. 'America/Chicago'. " +
          "Omit to use the default. Do not pass abbreviations like 'EST' or offsets like 'UTC-6'.",
      },
    },
    required: [],
    additionalProperties: false,
  });
}

export interface GetSemesterOptions {
  /** Source of "now". Defaults to the real system clock. */
  clock?: Clock;
  /**
   * Zone used to decide today's date when the model does not pass one.
   * Defaults to America/Chicago — NOT the host zone, which is UTC on Vercel
   * and would misdate Chicago evenings.
   */
  defaultTimeZone?: string;
  /** Term definitions. Defaults to `DALLAS_COLLEGE_CALENDAR`. */
  calendar?: AcademicCalendar;
}

/**
 * Builds the `get_semester` tool.
 *
 * @example
 * const tool = createGetSemesterTool();
 * tool.execute({}).semester.label;                        // "Fall 2026"
 * tool.execute({ offset: 1 }).semester.label;             // "Spring 2027"
 * tool.execute({ term: "Spring", offset: 1 }).semester;   // next Spring
 */
export function createGetSemesterTool(
  options: GetSemesterOptions = {},
): Tool<GetSemesterInput, SemesterResult> {
  const clock = options.clock ?? systemClock;
  const defaultTimeZone = options.defaultTimeZone ?? DALLAS_COLLEGE_TIME_ZONE;
  const calendar = options.calendar ?? DALLAS_COLLEGE_CALENDAR;

  // Fail at construction rather than on the first model call: a malformed
  // calendar is a deployment bug, and surfacing it as a tool error would let it
  // reach production disguised as the model's problem.
  assertIanaTimeZone(defaultTimeZone);
  assertValidCalendar(calendar);

  return defineTool({
    name: GET_SEMESTER_TOOL_NAME,
    description: buildDescription(calendar),
    inputSchema: buildInputSchema(calendar),

    parseInput(raw: unknown): GetSemesterInput {
      if (raw === undefined || raw === null) return {};
      if (!isRecord(raw)) {
        throw new ToolInputError(
          `Expected an object, received ${Array.isArray(raw) ? "array" : typeof raw}.`,
        );
      }

      const input: GetSemesterInput = {};
      const { offset, term, year, asOf, timeZone } = raw;

      if (isPresent(offset)) {
        // Models routinely send numbers as strings; accept an integral string
        // rather than failing a call that was semantically correct.
        const parsed = coerceInteger(offset, "offset");
        if (Math.abs(parsed) > MAX_OFFSET) {
          throw new ToolInputError(
            `"offset" must be between -${MAX_OFFSET} and ${MAX_OFFSET}, received ${parsed}.`,
          );
        }
        input.offset = parsed;
      }

      if (isPresent(term)) {
        if (typeof term !== "string") {
          throw new ToolInputError(`"term" must be a string, received ${typeof term}.`);
        }
        // Canonicalise here so "spring" becomes "Spring" before it reaches the
        // calendar, and an unknown name becomes a readable, retryable error.
        input.term = rethrowAsToolInput(() => canonicalTermName(term, calendar));
      }

      if (isPresent(year)) {
        input.year = coerceInteger(year, "year");
      }

      if (isPresent(asOf)) {
        if (typeof asOf !== "string") {
          throw new ToolInputError(`"asOf" must be a string in YYYY-MM-DD format, received ${typeof asOf}.`);
        }
        rethrowAsToolInput(() => parseIsoDate(asOf));
        input.asOf = asOf.trim();
      }

      if (isPresent(timeZone)) {
        if (typeof timeZone !== "string") {
          throw new ToolInputError(`"timeZone" must be a string, received ${typeof timeZone}.`);
        }
        assertIanaTimeZone(timeZone);
        input.timeZone = timeZone.trim();
      }

      if (input.year !== undefined && input.term === undefined) {
        throw new ToolInputError(
          `"year" needs "term" alongside it: a year on its own does not identify one semester. ` +
            `For example { "term": "${calendar.terms[0]!.name}", "year": ${input.year} }.`,
        );
      }
      if (input.year !== undefined && input.offset !== undefined) {
        throw new ToolInputError(
          `Pass either "year" (an exact semester) or "offset" (a position relative to today), not both.`,
        );
      }

      return input;
    },

    execute(input: GetSemesterInput): SemesterResult {

      const timeZone = input.timeZone ?? defaultTimeZone;
      assertIanaTimeZone(timeZone);

      // With no asOf, "today" comes from the same clock and the same zone-aware
      // formatting get_current_date uses. The two tools agree about what day
      // it is because the registry constructs BOTH with this module's
      // DALLAS_COLLEGE_TIME_ZONE as the default zone — get_current_date's own
      // fallback is the host zone (UTC on Vercel), which disagrees with
      // Chicago from ~7pm CT onward.
      const asOfDate = input.asOf ?? describeInstant(clock(), timeZone).date;
      const today = parseIsoDate(asOfDate);

      const query = {
        ...(input.offset === undefined ? {} : { offset: input.offset }),
        ...(input.term === undefined ? {} : { term: input.term }),
        ...(input.year === undefined ? {} : { year: input.year }),
      };

      const semester = rethrowAsToolInput(() => resolveSemester(today, query, calendar));
      const current = resolveSemester(today, { offset: 0 }, calendar);
      const todayIso = toIsoDate(today);

      return {
        semester,
        current,
        isCurrent: semester.label === current.label,
        daysUntilStart: daysBetween(todayIso, semester.startDate),
        daysUntilEnd: daysBetween(todayIso, semester.endDate),
        asOfDate,
        asOfSource: input.asOf === undefined ? "system_clock" : "argument",
        timeZone,
      };
    },
  });
}

const isPresent = (value: unknown): boolean =>
  value !== undefined && value !== null && value !== "";

function coerceInteger(value: unknown, field: string): number {
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isInteger(parsed)) {
    throw new ToolInputError(
      `"${field}" must be a whole number, received ${JSON.stringify(value)}.`,
    );
  }
  return parsed;
}

/**
 * Converts a calendar error into a `ToolInputError`.
 *
 * Both carry the same message, but the type matters: a `ToolInputError` is
 * something the model can read and retry from, which is the right handling for
 * "no Spring term is in progress" — a well-formed query with an answer the
 * model needs to hear, not a crash.
 */
function rethrowAsToolInput<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof AcademicCalendarError) throw new ToolInputError(error.message);
    throw error;
  }
}
