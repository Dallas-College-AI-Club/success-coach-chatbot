import { createGetCurrentDateTool } from "./getCurrentDate";
import { createGetSemesterTool } from "./getSemester";
import { toolSet } from "./types";
import { createGetCourseInfoTool } from "./getCourseInfo";

export const toolsList = [
    createGetCurrentDateTool(),
    createGetSemesterTool(),
    createGetCourseInfoTool(),
];

export const toolRegistry = toolSet(toolsList);