import { tool } from "ai";
import {
  programResultForModel,
  scheduleResultForModel,
  requestedSemesters,
} from "@/lib/course-details";
import * as getClassSchedule from "./getClassSchedule";
import * as getCourseInfo from "./getCourseInfo";
import * as currentDateTool from "./getCurrentDate";
import * as getInstructor from "./getInstructor";
import * as getProgramRequirements from "./getProgramRequirements";
import * as getSemesterTool from "./getSemester";
import * as searchKnowledge from "./searchKnowledge";

export const TOOL_REGISTRY = {
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
  }),
  get_program_requirements: tool({
    description: getProgramRequirements.DESCRIPTION,
    inputSchema: getProgramRequirements.INPUT_SCHEMA,
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

/** Enforce the current student's explicit scope even if the model omits it. */
export function toolsForTurn(userText: string) {
  const semesters = requestedSemesters(userText);
  const courseCode = getClassSchedule.scheduleCourseForTurn(userText);
  let missed = false;
  const record = <T extends { found: boolean }>(result: T): T => {
    if (!result.found) missed = true;
    return result;
  };
  return {
    ...TOOL_REGISTRY,
    get_class_schedule: tool({
      ...TOOL_REGISTRY.get_class_schedule,
      execute: async (input) =>
        record(
          await getClassSchedule.EXECUTE({
            ...input,
            ...(courseCode ? { courseCode } : {}),
          }),
        ),
    }),
    get_program_requirements: tool({
      ...TOOL_REGISTRY.get_program_requirements,
      execute: async (input) =>
        record(
          await getProgramRequirements.EXECUTE({
            ...input,
            ...(semesters.length ? { semesters } : {}),
          }),
        ),
    }),
    get_course_info: tool({
      ...TOOL_REGISTRY.get_course_info,
      execute: async (input) => record(await getCourseInfo.EXECUTE(input)),
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
