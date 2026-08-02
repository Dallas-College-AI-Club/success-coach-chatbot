import { createGetCurrentDateTool } from "./getCurrentDate";
import { createGetSemesterTool } from "./getSemester";
import { toolSet } from "./types";

export const toolsList = [
    createGetCurrentDateTool(),
    createGetSemesterTool(),
];

export const toolRegistry = toolSet(toolsList);