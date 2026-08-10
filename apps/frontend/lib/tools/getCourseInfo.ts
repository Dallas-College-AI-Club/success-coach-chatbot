import { jsonSchema } from "ai";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/client";
import { knowledgeEntry } from "@/lib/schema";

import {
    defineTool,
    isRecord,
    ToolInputError,
    type FlexibleSchema,
    type Tool,
} from "./types";

export const GET_COURSE_INFO_TOOL_NAME = "get_course_info";

export interface GetCourseInfoInput {
    courseCode: string;
}

export interface CourseInfoResult {
    found: boolean;

    course_code?: string;
    title?: string | null;
    credit_hours?: number | null;
    description?: string | null;

    prerequisites?: unknown[];
    corequisites?: unknown[];

    campus_locations?: string | null;
}

const DESCRIPTION = [
    "Returns verified catalog course information for a Dallas College course.",
    "",
    "Call this tool when the user asks about a specific course.",
    "",
    "Examples:",
    '- "What is MATH 2414?"',
    '- "How many credit hours is BIOL 1406?"',
    '- "What are the prerequisites for ENGL 1302?"',
    '- "Where is BIOL 1406 offered?"',
    "",
    "Input must be a course code such as MATH 2414, BIOL 1406, or ENGL 1302.",
    "",
    "The tool returns verified course facts stored in the knowledge base.",
].join("\n");

const INPUT_SCHEMA: FlexibleSchema<GetCourseInfoInput> = jsonSchema({
    type: "object",
    properties: {
        courseCode: {
            type: "string",
            description:
                "Dallas College course code such as 'MATH 2414', 'BIOL 1406', or 'ENGL 1302'.",
        },
    },
    required: ["courseCode"],
    additionalProperties: false,
});

// Mirrors the course_code generated column (schema.sql:96) so a lookup matches
// what the database stored: split letter->digit (first match only, as Postgres
// does without the 'g' flag), collapse non-alphanumeric runs, trim, upper.
// Without this, 'engl-1302' and 'ENGL1302' miss rows stored as 'ENGL 1302'.
export function normalizeCourseCode(courseCode: string): string {
    return courseCode
        .replace(/([A-Za-z])([0-9])/, "$1 $2")
        .replace(/[^A-Za-z0-9]+/g, " ")
        .trim()
        .toUpperCase();
}

export function createGetCourseInfoTool(): Tool<
    GetCourseInfoInput,
    Promise<CourseInfoResult>
> {
    return defineTool({
        name: GET_COURSE_INFO_TOOL_NAME,
        description: DESCRIPTION,
        inputSchema: INPUT_SCHEMA,

        parseInput(raw: unknown): GetCourseInfoInput {
            if (!isRecord(raw)) {
                throw new ToolInputError(
                    `Expected an object, received ${Array.isArray(raw) ? "array" : typeof raw}.`,
                );
            }

            const { courseCode } = raw;

            if (typeof courseCode !== "string") {
                throw new ToolInputError(
                    `"courseCode" must be a string.`,
                );
            }

            const normalized = normalizeCourseCode(courseCode);

            if (!normalized) {
                throw new ToolInputError(
                    `"courseCode" cannot be empty.`,
                );
            }

            return {
                courseCode: normalized,
            };
        },

        async execute(
            input: GetCourseInfoInput,
        ): Promise<CourseInfoResult> {
            if (process.env.NODE_ENV !== "production") {
                console.log(
                    `[TOOL] get_course_info invoked for ${input.courseCode}`,
                );
            }

            const [row] = await db
                .select({
                    facts: knowledgeEntry.facts,
                    courseCode: knowledgeEntry.courseCode,
                })
                .from(knowledgeEntry)
                .where(
                    and(
                        eq(
                            knowledgeEntry.courseCode,
                            input.courseCode,
                        ),
                        eq(
                            knowledgeEntry.docType,
                            "course",
                        ),
                    ),
                )
                .limit(1);

            if (!row?.facts) {
                return {
                    found: false,
                };
            }

            const facts = row.facts as Record<string, unknown>;

            return {
                found: true,

                course_code:
                    (facts.course_code as string | undefined) ??
                    row.courseCode ??
                    undefined,

                title:
                    (facts.title as string | null | undefined) ??
                    null,

                credit_hours:
                    (facts.credit_hours as number | null | undefined) ??
                    null,

                description:
                    (facts.description as string | null | undefined) ??
                    null,

                prerequisites:
                    (facts.prerequisites as unknown[] | undefined) ??
                    [],

                corequisites:
                    (facts.corequisites as unknown[] | undefined) ??
                    [],

                campus_locations:
                    (facts.campus_locations as string | null | undefined) ??
                    null,
            };
        },
    });
}