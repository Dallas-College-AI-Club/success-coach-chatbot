import { DALLAS_COLLEGE_TIME_ZONE } from "@/lib/constants";
import z from "zod";
import {
  AcademicCalendarError,
  CalendarDate,
  DALLAS_COLLEGE_CALENDAR,
  daysBetween,
  resolveSemester,
  toIsoDate,
} from "./academicCalendar";

export { DALLAS_COLLEGE_TIME_ZONE } from "@/lib/constants";

const names = DALLAS_COLLEGE_CALENDAR.terms.map((term) => term.name);
const first = names[0]!;
const last = names[names.length - 1]!;

export const DESCRIPTION = [
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

export const INPUT_SCHEMA = z.object({
  offset: z
    .number()
    .int()
    .optional()
    .describe(
      "Optional integer offset from the current semester: 0 is the current one, positive numbers go forward, negative numbers go back. Do not combine with year.",
    ),
  term: z
    .string()
    .optional()
    .describe(
      "Optional term name, e.g. 'Spring', 'Summer', 'Fall', 'Winter'. Do not combine with year.",
    ),
  year: z
    .number()
    .int()
    .optional()
    .describe(
      "Optional year to resolve a specific named semester, e.g. 2027 for 'Spring 2027'. Do not combine with offset.",
    ),
  asOf: z
    .string()
    .optional()
    .describe(
      "Optional ISO 8601 date string to resolve the semester as if it were that date. Leave empty for the actual present.",
    ),
  timeZone: z
    .string()
    .optional()
    .refine(
      (tz) => {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      },
      {
        message: "Invalid IANA timezone identifier",
      },
    )
    .describe(
      "Optional IANA timezone identifier, e.g. 'America/Chicago', 'Europe/London'. Defaults to America/Chicago.",
    ),
});

export const EXECUTE = async (input: z.infer<typeof INPUT_SCHEMA>) => {
  if (process.env.NODE_ENV !== "production") {
    console.log("[TOOL] get_semester invoked");
  }
  const { timeZone, offset, term, year, asOf } = INPUT_SCHEMA.parse(input);
  const effectiveTimeZone = timeZone ?? DALLAS_COLLEGE_TIME_ZONE;
  const asOfDate =
    asOf ??
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: effectiveTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .format(new Date())
      .replace(" ", "T");
  const targetDate = new Date(asOfDate);
  const today: CalendarDate = {
    year: targetDate.getFullYear(),
    month: targetDate.getMonth() + 1,
    day: targetDate.getDate(),
  };

  const query = {
    ...(offset === undefined ? {} : { offset: offset }),
    ...(term === undefined ? {} : { term: term }),
    ...(year === undefined ? {} : { year: year }),
  };

  const semester = rethrowAsToolInput(() =>
    resolveSemester(today, query, DALLAS_COLLEGE_CALENDAR),
  );
  const current = resolveSemester(
    today,
    { offset: 0 },
    DALLAS_COLLEGE_CALENDAR,
  );
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
};

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
    if (error instanceof AcademicCalendarError) throw new Error(error.message);
    throw error;
  }
}
