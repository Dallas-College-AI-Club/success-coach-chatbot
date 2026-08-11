import { DALLAS_COLLEGE_TIME_ZONE } from "@/lib/constants";
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
        // Chicago default, same as get_semester's: left to its own fallback
        // the tool reports the HOST zone — UTC on Vercel — so from ~7pm CT
        // the two tools disagreed about what day it is (2026-08-11 audit).
        createGetCurrentDateTool({ defaultTimeZone: DALLAS_COLLEGE_TIME_ZONE }),
        createGetSemesterTool(),
        createGetCourseInfoTool(),
        createGetProgramRequirementsTool(),
        createSearchKnowledgeTool(),
    ]);
}
