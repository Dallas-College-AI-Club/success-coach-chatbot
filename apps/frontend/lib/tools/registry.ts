import { tool } from "ai";
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
  }),
  search_knowledge: tool({
    description: searchKnowledge.DESCRIPTION,
    inputSchema: searchKnowledge.INPUT_SCHEMA,
    execute: searchKnowledge.EXECUTE,
  }),
};
