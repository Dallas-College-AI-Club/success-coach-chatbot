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
  `Resolves the term labels ${names.join(", ")} using saved 2026-2027 boundaries. Boundaries classify dates; they are not live registration deadlines or verified dates for other academic years. Use search_knowledge for published calendar/deadline facts.`,
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
  "OMIT 'asOf', 'term', 'year', and 'offset' for the actual current semester. Do not supply empty strings. Only set 'asOf' when the user asks a",
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
    .min(-40)
    .max(40)
    .optional()
    .describe(
      "Optional integer offset from the current semester: 0 is the current one, positive numbers go forward, negative numbers go back. Do not combine with year.",
    ),
  term: z
    .string()
    .optional()
    .describe(
      "Optional term name: Spring, May, Summer, Fall, Winter. Combine with year for an explicit term, or with offset for next/previous. Omit for the current term.",
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
      "Optional ISO 8601 date string for a hypothetical date. Omit for the actual present.",
    ),
  timeZone: z
    .string()
    .optional()
    .refine(
      (tz) => {
        if (!tz) return true;
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
  const parsed = INPUT_SCHEMA.parse(input);
  const { timeZone, offset, term, asOf } = parsed;
  // Some compatible providers fill omitted numeric parameters with zero.
  const year = parsed.year === 0 ? undefined : parsed.year;
  const effectiveTimeZone = timeZone || DALLAS_COLLEGE_TIME_ZONE;
  const suppliedDate = asOf?.trim() || undefined;
  const targetDate = suppliedDate ? new Date(suppliedDate) : new Date();
  if (!Number.isFinite(targetDate.getTime()))
    return {
      found: false,
      note: "Use a valid ISO date for a hypothetical, or omit asOf to use today's date.",
    };
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: effectiveTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(targetDate);
  // Date-only inputs already identify a civil date. Timestamps use the chosen
  // zone; never parse a formatted local time using the server's own timezone.
  const civil = suppliedDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const today: CalendarDate = civil
    ? { year: Number(civil[1]), month: Number(civil[2]), day: Number(civil[3]) }
    : {
        year: Number(parts.find((p) => p.type === "year")?.value),
        month: Number(parts.find((p) => p.type === "month")?.value),
        day: Number(parts.find((p) => p.type === "day")?.value),
      };
  const namedTerm = /^(?:current|this)(?: semester| term)?$/i.test(
    term?.trim() ?? "",
  )
    ? undefined
    : term?.trim() || undefined;

  const query = {
    ...(offset === undefined || (year !== undefined && offset === 0)
      ? {}
      : { offset }),
    ...(namedTerm === undefined ? {} : { term: namedTerm }),
    ...(year === undefined ? {} : { year: year }),
  };

  try {
    const semester = resolveSemester(today, query, DALLAS_COLLEGE_CALENDAR);
    const current = resolveSemester(
      today,
      { offset: 0 },
      DALLAS_COLLEGE_CALENDAR,
    );
    const todayIso = toIsoDate(today);

    return {
      found: true,
      semester,
      current,
      isCurrent: semester.label === current.label,
      daysUntilStart: daysBetween(todayIso, semester.startDate),
      daysUntilEnd: daysBetween(todayIso, semester.endDate),
      asOfDate: todayIso,
      asOfSource: suppliedDate === undefined ? "system_clock" : "argument",
      timeZone: effectiveTimeZone,
      note: "Term classification uses saved 2026-2027 boundaries. End dates are partition boundaries, not guaranteed final instruction dates. For registration, withdrawal deadlines or another academic year's exact dates, search the published calendar records.",
    };
  } catch (error) {
    if (error instanceof AcademicCalendarError)
      return { found: false, note: error.message };
    throw error;
  }
};
