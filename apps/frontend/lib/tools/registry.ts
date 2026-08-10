import { createGetCurrentDateTool } from "./getCurrentDate";
import { createGetSemesterTool } from "./getSemester";
import { toolSet } from "./types";
import { createGetCourseInfoTool } from "./getCourseInfo";
import { createGetProgramRequirementsTool } from "./getProgramRequirements";

export const toolsList = [
    createGetCurrentDateTool(),
    createGetSemesterTool(),
    createGetCourseInfoTool(),
    createGetProgramRequirementsTool(),
];

export const toolRegistry = toolSet(toolsList);