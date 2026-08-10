// Tool names and student-facing labels, in a module with NO server imports.
//
// The tool modules themselves pull in server-only dependencies (getCourseInfo
// imports the Drizzle client), so a client component must never import them
// just to learn a tool's name. Both sides import from here instead: the tool
// modules for their `name`, the chat UI for its chips — renaming a tool is a
// one-line change that cannot silently desynchronise the UI.

export const GET_CURRENT_DATE_TOOL_NAME = "get_current_date";
export const GET_SEMESTER_TOOL_NAME = "get_semester";
export const GET_COURSE_INFO_TOOL_NAME = "get_course_info";
/** Lands with PR #140; the label is registered ahead so its chips are never
 *  unlabeled. Harmless while the tool doesn't exist. */
export const GET_PROGRAM_REQUIREMENTS_TOOL_NAME = "get_program_requirements";

/** Chip copy per tool, by lifecycle. Driven off OBSERVED execution state —
 *  never model narration. */
export const TOOL_LABELS: Record<
  string,
  { running: string; done: string; failed: string }
> = {
  [GET_COURSE_INFO_TOOL_NAME]: {
    running: "Checking the course catalog",
    done: "Checked the catalog",
    failed: "Couldn't reach the catalog",
  },
  [GET_SEMESTER_TOOL_NAME]: {
    running: "Checking the academic calendar",
    done: "Checked the calendar",
    failed: "Couldn't check the calendar",
  },
  [GET_CURRENT_DATE_TOOL_NAME]: {
    running: "Checking today's date",
    done: "Checked today's date",
    failed: "Couldn't check the date",
  },
  [GET_PROGRAM_REQUIREMENTS_TOOL_NAME]: {
    running: "Checking program requirements",
    done: "Checked program requirements",
    failed: "Couldn't reach program requirements",
  },
};
