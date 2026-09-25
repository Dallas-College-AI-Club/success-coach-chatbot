import { tool } from "ai";
import z from "zod";
import {
  assessPlan,
  assessRequisites,
  comparePlans,
  studentCourseHistory,
} from "@/lib/planning";
import {
  programResultForModel,
  scheduleResultForModel,
  requestedSemesters,
  readCourseDetails,
  isKnownScheduleGap,
} from "@/lib/course-details";
import * as getClassSchedule from "./getClassSchedule";
import * as getCourseInfo from "./getCourseInfo";
import * as currentDateTool from "./getCurrentDate";
import * as getInstructor from "./getInstructor";
import * as getProgramRequirements from "./getProgramRequirements";
import * as getSemesterTool from "./getSemester";
import * as searchKnowledge from "./searchKnowledge";
import * as facultyExpertise from "./searchFacultyExpertise";
import { PROGRAMS } from "@/features/onboarding/programs";

export const TOOL_REGISTRY = {
  compare_programs: tool({
    description:
      "Compare exactly two verified programs using deterministic course-code set arithmetic. Use for shared courses, differences and overlap. Optional courses are not counted as guaranteed shared requirements. Clarify ambiguous program names before comparing.",
    inputSchema: z.object({
      programs: z.array(z.string().trim().min(1).max(200)).length(2),
    }),
    execute: async ({ programs }) => {
      const results = await Promise.all(
        programs.map((programName) =>
          getProgramRequirements.EXECUTE({ programName }),
        ),
      );
      const [left, right] = results;
      if (!("groups" in left) || !("groups" in right))
        return {
          found: false,
          needs_clarification: true,
          program_results: results,
        };
      const comparison = comparePlans(left, right);
      return {
        found: true,
        name: "Program comparison",
        comparison,
        groups: [
          {
            name: "Required in both programs",
            courses: comparison.shared_required_courses,
            slot_kind: "fixed",
          },
          {
            name: `Required only in ${String(left.name)}`,
            courses: comparison.only_first_required_courses,
            slot_kind: "fixed",
          },
          {
            name: `Required only in ${String(right.name)}`,
            courses: comparison.only_second_required_courses,
            slot_kind: "fixed",
          },
        ],
        course_details: [
          ...(left.course_details ?? []),
          ...(right.course_details ?? []),
        ],
      };
    },
    toModelOutput: ({ output }) => ({
      type: "text",
      value: JSON.stringify(programResultForModel(output)),
    }),
  }),
  search_faculty_expertise: tool({
    description: facultyExpertise.DESCRIPTION,
    inputSchema: facultyExpertise.INPUT_SCHEMA,
    execute: facultyExpertise.EXECUTE,
    toModelOutput: ({ output }) => ({
      type: "text",
      value: JSON.stringify(facultyExpertise.modelOutput(output)),
    }),
  }),
  get_current_date: tool({
    description: currentDateTool.DESCRIPTION,
    inputSchema: currentDateTool.INPUT_SCHEMA,
    execute: currentDateTool.EXECUTE,
  }),
  get_semester: tool({
    description: getSemesterTool.DESCRIPTION,
    inputSchema: getSemesterTool.INPUT_SCHEMA,
    execute: getSemesterTool.EXECUTE,
  }),
  get_instructor: tool({
    description: getInstructor.DESCRIPTION,
    inputSchema: getInstructor.INPUT_SCHEMA,
    execute: getInstructor.EXECUTE,
  }),
  get_class_schedule: tool({
    description: getClassSchedule.DESCRIPTION,
    inputSchema: getClassSchedule.INPUT_SCHEMA,
    execute: getClassSchedule.EXECUTE,
    toModelOutput: ({ output }) => ({
      type: "text",
      value: JSON.stringify(scheduleResultForModel(output)),
    }),
  }),
  get_course_info: tool({
    description: getCourseInfo.DESCRIPTION,
    inputSchema: getCourseInfo.INPUT_SCHEMA,
    execute: getCourseInfo.EXECUTE,
    toModelOutput: ({ output }) => ({
      type: "text",
      // Legacy extraction puts recommended references under "prerequisites".
      // Keep the original evidence in the UI; give the model the classified view.
      value: JSON.stringify({
        ...output,
        prerequisites: undefined,
        corequisites: undefined,
        interpretation:
          "Use requisite_assessment and requisites_raw. A recommendation is never a required prerequisite; matching reported history does not confirm eligibility.",
      }),
    }),
  }),
  get_program_requirements: tool({
    description: getProgramRequirements.DESCRIPTION,
    inputSchema: getProgramRequirements.INPUT_SCHEMA.omit({ semesters: true }),
    execute: getProgramRequirements.EXECUTE,
    toModelOutput: ({ output }) => ({
      type: "text",
      value: JSON.stringify(programResultForModel(output)),
    }),
  }),
  search_knowledge: tool({
    description: searchKnowledge.DESCRIPTION,
    inputSchema: searchKnowledge.INPUT_SCHEMA,
    execute: searchKnowledge.EXECUTE,
  }),
};

/** Required structured views must be refreshed instead of answered from an
 * older, differently scoped result in conversation history. */
export function requestedToolChoice(
  text: string,
  step: number,
  context: { programKnown?: boolean; facultySearch?: boolean } = {},
) {
  if (step !== 0) return undefined;
  const schedule = getClassSchedule.scheduleToolChoice(text, step);
  if (schedule) return schedule;
  if (
    (/\b(?:professors|faculty|instructors)\b/i.test(text) ||
      (context.facultySearch && /\b(?:those|both)\b/i.test(text))) &&
    /\b(?:expertise|experience|background|machine learning|large language models?|LLMs?)\b/i.test(
      text,
    )
  )
    return {
      type: "tool" as const,
      toolName: "search_faculty_expertise" as const,
    };
  const namedPrograms = PROGRAMS.filter((program) =>
    getProgramRequirements
      .squash(text)
      .includes(getProgramRequirements.squash(program.label)),
  );
  if (
    namedPrograms.length >= 2 &&
    /\b(?:compare|shared|overlap|common|both)\b/i.test(text)
  )
    return { type: "tool" as const, toolName: "compare_programs" as const };
  if (
    (context.programKnown || namedPrograms.length === 1) &&
    (Object.keys(studentCourseHistory([text])).length > 0 ||
      requestedSemesters(text).length ||
      /\b(?:still need|remain(?:s|ing)?|what(?:'s| is) left|courses? (?:are )?left|take this semester|updated course history)\b/i.test(
        text,
      ) ||
      /\b(?:what|which)(?: courses?| classes?)? (?:should|can|do|would) I (?:take|study)\b/i.test(
        text,
      ) ||
      (/\b(?:completed|passed|withdrew|taking|checklist)\b/i.test(text) &&
        /\b(?:program|certificate|checklist|remaining|left)\b/i.test(text)))
  )
    return {
      type: "tool" as const,
      toolName: "get_program_requirements" as const,
    };
  if (
    /\b[A-Z]{3,4}\s*\d{4}\b/i.test(text) &&
    /\b(?:prerequisites?|requisites?|eligible|eligibility|course details)\b/i.test(
      text,
    )
  )
    return { type: "tool" as const, toolName: "get_course_info" as const };
  return undefined;
}

/** Enforce the current student's explicit scope even if the model omits it. */
export function toolsForTurn(
  userText: string,
  userMessages: string[] = [userText],
) {
  const semesters = requestedSemesters(userText);
  const courseCode = getClassSchedule.scheduleCourseForTurn(userText);
  let missed = false;
  const record = <T extends { found: boolean }>(result: T): T => {
    if (!result.found) missed = true;
    return result;
  };
  return {
    ...TOOL_REGISTRY,
    search_faculty_expertise: tool({
      ...TOOL_REGISTRY.search_faculty_expertise,
      execute: async (input) => record(await facultyExpertise.EXECUTE(input)),
    }),
    get_class_schedule: tool({
      ...TOOL_REGISTRY.get_class_schedule,
      execute: async (input) => {
        // Do not let an old discovery snippet silently choose a historical term.
        // Follow-ups retain their conversation's requested term.
        if (
          userMessages.length === 1 &&
          getClassSchedule.asksWhoTeachesNow(userText)
        ) {
          const calendar = await getSemesterTool.EXECUTE({});
          if (!calendar.found || !calendar.semester)
            return {
              found: false,
              note: "Please specify a semester and year.",
            };
          input = {
            ...input,
            ...getClassSchedule.INPUT_SCHEMA.pick({
              semester: true,
              year: true,
            }).parse({
              semester: calendar.semester.term.toLowerCase(),
              year: calendar.semester.year,
            }),
          };
        }
        const result = await getClassSchedule.EXECUTE({
          ...input,
          ...(courseCode ? { courseCode } : {}),
        });
        return isKnownScheduleGap(result) ? result : record(result);
      },
    }),
    get_program_requirements: tool({
      ...TOOL_REGISTRY.get_program_requirements,
      execute: async (input) => {
        const result = record(
          await getProgramRequirements.EXECUTE({
            ...input,
            semesters: semesters.length ? semesters : undefined,
          }),
        );
        return "groups" in result
          ? { ...result, planning: assessPlan(result, userMessages) }
          : result;
      },
    }),
    get_course_info: tool({
      ...TOOL_REGISTRY.get_course_info,
      execute: async (input) => {
        const result = record(await getCourseInfo.EXECUTE(input));
        const course = readCourseDetails(result);
        if (!course) return result;
        let history = studentCourseHistory(userMessages, [course]);
        const review = assessRequisites(course.requisites_raw, history);
        // Resolve a reported prerequisite by its catalog title as well as code.
        // Already recognized codes need no additional lookup.
        if (
          userMessages.some((text) =>
            /\b(?:completed|passed|taken|took|taking|withdrew)\b/i.test(text),
          )
        ) {
          const references =
            review.referenced_courses
              ?.filter((r) => r.student_status === "unknown")
              .slice(0, 12) ?? [];
          const related = await Promise.allSettled(
            references.map((r) =>
              getCourseInfo.EXECUTE({ courseCode: r.course_code }),
            ),
          );
          const knownCourses = related.flatMap((r) => {
            const detail =
              r.status === "fulfilled" ? readCourseDetails(r.value) : null;
            return detail ? [detail] : [];
          });
          history = studentCourseHistory(userMessages, [
            course,
            ...knownCourses,
          ]);
        }
        return {
          ...result,
          course_history: history,
          student_status: history[course.course_code]?.status ?? "unknown",
          requisite_assessment: assessRequisites(
            course.requisites_raw,
            history,
          ),
        };
      },
    }),
    get_instructor: tool({
      ...TOOL_REGISTRY.get_instructor,
      execute: async (input) => record(await getInstructor.EXECUTE(input)),
    }),
    search_knowledge: tool({
      ...TOOL_REGISTRY.search_knowledge,
      execute: (input) =>
        searchKnowledge.EXECUTE({ ...input, broad: missed || input.broad }),
    }),
  };
}
