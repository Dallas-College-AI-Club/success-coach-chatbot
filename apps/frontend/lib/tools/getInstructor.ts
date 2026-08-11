import { jsonSchema } from "ai";
import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/client";
import { knowledgeEntry } from "@/lib/schema";

import {
    defineTool,
    isRecord,
    ToolInputError,
    type FlexibleSchema,
    type Tool,
} from "./types";

// Name lives in the client-safe manifest so the UI can label the tool
// without importing this module (which pulls in the DB client).
export { GET_INSTRUCTOR_TOOL_NAME } from "./names";
import { GET_INSTRUCTOR_TOOL_NAME } from "./names";

export interface GetInstructorInput {
    name: string;
}

export interface InstructorResult {
    found: boolean;
    /** Set when several instructors match; the assistant must ask which one. */
    ambiguous?: boolean;
    matches?: string[];

    name?: string | null;
    /** The instructor's professional record, composed from their published CV. */
    background?: string;
    /** Courses they appear against in the published class schedule. */
    teaches?: string[];
    source_url?: string;
}

const DESCRIPTION = [
    "Returns a Dallas College instructor's professional background — degrees,",
    "where they teach, what they have taught — plus the courses they appear",
    "against in the published class schedule.",
    "",
    "Call this when the user asks who an instructor is, what their background or",
    "credentials are, or what they teach.",
    "",
    "Input is the name as the user said it; first name, last name, or both.",
    "If several instructors match, the tool returns ambiguous:true with the names —",
    "show them and ask which one, then call again with the full name.",
    "",
    "This is a published professional record, not a review: it carries no ratings,",
    "no teaching-quality judgements, and no opinions. Never characterise an",
    "instructor beyond what the record states.",
].join("\n");

const INPUT_SCHEMA: FlexibleSchema<GetInstructorInput> = jsonSchema({
    type: "object",
    properties: {
        name: {
            type: "string",
            description:
                "Instructor name as the user said it, e.g. 'Ava Howard', 'Howard', 'Dr. Gill'.",
        },
    },
    required: ["name"],
    additionalProperties: false,
});

const MAX_MATCHES = 8;
const MAX_COURSES = 25;

/** Titles a student adds that are not part of the stored name. */
const TITLES = /^(dr|prof|professor|mr|mrs|ms|mx)\.?$/;

export function createGetInstructorTool(): Tool<
    GetInstructorInput,
    Promise<InstructorResult>
> {
    return defineTool({
        name: GET_INSTRUCTOR_TOOL_NAME,
        description: DESCRIPTION,
        inputSchema: INPUT_SCHEMA,

        parseInput(raw: unknown): GetInstructorInput {
            if (!isRecord(raw)) {
                throw new ToolInputError(
                    `Expected an object, received ${Array.isArray(raw) ? "array" : typeof raw}.`,
                );
            }
            const { name } = raw;
            if (typeof name !== "string") {
                throw new ToolInputError(`"name" must be a string.`);
            }
            const trimmed = name.trim();
            if (!trimmed) {
                throw new ToolInputError(`"name" must not be empty.`);
            }
            return { name: trimmed };
        },

        async execute(input: GetInstructorInput): Promise<InstructorResult> {
            if (process.env.NODE_ENV !== "production") {
                console.log(`[TOOL] get_instructor invoked for ${input.name}`);
            }

            // Match on instructor_slug ("ava-howard"), the pipeline's stable
            // join key — it is populated on every section and cv row, while
            // the display name is "Howard, Ava" and would not survive a
            // student typing the name in natural order. Every token must
            // appear, in any order, so "Howard", "Ava Howard" and "Howard,
            // Ava" all land on the same person.
            const tokens = input.name
                .toLowerCase()
                .split(/[\s,]+/)
                .filter((t) => t && !TITLES.test(t))
                .map((t) => t.replace(/[^a-z0-9]/g, ""))
                .filter((t) => t.length >= 2)
                .slice(0, 4);

            if (tokens.length === 0) return { found: false };

            const slug = knowledgeEntry.instructorSlug;
            const rows = await getDb()
                .select({
                    slug,
                    name: sql<string | null>`${knowledgeEntry.facts}->>'name'`,
                    text: knowledgeEntry.chunkText,
                    sourceUrl: knowledgeEntry.sourceUrl,
                })
                .from(knowledgeEntry)
                .where(
                    and(
                        eq(knowledgeEntry.docType, "cv"),
                        ...tokens.map((t) => sql`${slug} LIKE ${`%${t}%`}`),
                    ),
                )
                // A whole-name-part match first: typing "Gill" should surface
                // the Gills before the Gillies and Gillilands that also
                // contain the substring.
                .orderBy(
                    sql`CASE WHEN ${slug} ~ ${`(^|-)(${tokens.join("|")})($|-)`} THEN 0 ELSE 1 END`,
                    slug,
                )
                .limit(MAX_MATCHES + 1);

            if (rows.length === 0) return { found: false };

            if (rows.length > 1) {
                return {
                    found: true,
                    ambiguous: true,
                    matches: rows
                        .slice(0, MAX_MATCHES)
                        .map((r) => r.name ?? r.slug ?? "")
                        .filter(Boolean),
                };
            }

            const [row] = rows;
            // Their teaching, from the same join key the pipeline stamps.
            const taught = await getDb()
                .selectDistinct({ courseCode: knowledgeEntry.courseCode })
                .from(knowledgeEntry)
                .where(
                    and(
                        eq(knowledgeEntry.docType, "section"),
                        eq(slug, row.slug ?? ""),
                    ),
                )
                .orderBy(knowledgeEntry.courseCode)
                .limit(MAX_COURSES);

            return {
                found: true,
                name: row.name,
                background: row.text,
                teaches: taught
                    .map((t) => t.courseCode)
                    .filter((c): c is string => !!c),
                source_url: row.sourceUrl,
            };
        },
    });
}
