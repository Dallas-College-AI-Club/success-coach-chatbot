import { DALLAS_COLLEGE_TIME_ZONE } from "@/lib/tools/getSemester";
import z from "zod";

export const DESCRIPTION = [
  "Returns the current date and time read from the host system clock.",
  "",
  "Call this tool whenever answering the user requires knowing what 'now' is. That includes:",
  "- direct questions about today's date, the current time, or the day of the week",
  "- relative expressions such as 'today', 'tonight', 'tomorrow', 'this week', 'next month', 'right now'",
  "- arithmetic anchored to the present, such as how long until an event, how long since an event, or someone's age",
  "- deciding whether a date mentioned by the user is in the past or the future",
  "",
  "You have no internal clock and your training data does not tell you the current date.",
  "Never guess or assume the date; call this tool instead. It is cheap and always available.",
  "",
  "Do not call this tool for questions that do not depend on the current date or time.",
  "",
  "Returns the current date in the given timezone or America/Chicago if none is provided, formatted as 'MM/DD/YYYY'.",
].join("\n");

export const INPUT_SCHEMA = z.object({
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
    console.log("[TOOL] get_current_date invoked");
  }
  const { timeZone } = INPUT_SCHEMA.parse(input);
  const effectiveTimeZone = timeZone ?? DALLAS_COLLEGE_TIME_ZONE;
  const today = new Date();
  return Intl.DateTimeFormat("en-US", { timeZone: effectiveTimeZone }).format(
    today,
  );
};
