import { createGetCurrentDateTool } from "./getCurrentDate";
import { createGetSemesterTool } from "./getSemester";
import { toolSet } from "./types";
import { createGetCourseInfoTool } from "./getCourseInfo";
import { createGetProgramRequirementsTool } from "./getProgramRequirements";
import { createSearchKnowledgeTool } from "./searchKnowledge";

/**
 * Built PER REQUEST (route.ts calls this inside POST), not as a module
 * singleton: search_knowledge carries a per-turn call cap in its closure,
 * and a shared instance would count calls across every user's requests.
 * Construction is five object literals — there is nothing worth caching.
 */
export function createToolRegistry() {
    return toolSet([
        createGetCurrentDateTool(),
        createGetSemesterTool(),
        createGetCourseInfoTool(),
        createGetProgramRequirementsTool(),
        createSearchKnowledgeTool(),
    ]);
}
