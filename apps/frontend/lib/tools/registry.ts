import { createGetCurrentDateTool } from "./getCurrentDate";
import { toolSet } from "./types";

export const toolsList = [
    createGetCurrentDateTool(),
];

export const toolRegistry = toolSet(toolsList);