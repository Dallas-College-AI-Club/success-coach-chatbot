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
    /** One entry per course+term from the published class schedule, with the
     *  offering formats: "COSC 1436 — Fall 2026 (hybrid at RLC; online)".
     *  This IS the instructor's term schedule — no follow-up lookups. */
    teaches?: string[];
    source_url?: string;
}

const DESCRIPTION = [
    "Returns a Dallas College instructor's professional background — degrees,",
    "where they teach, what they have taught — plus their schedule from the",
    "published class listings: one `teaches` entry per course PER TERM with the",
    "offering formats, e.g. \"COSC 1436 — Fall 2026 (hybrid at RLC; online)\".",
    "",
    "Call this when the user asks who an instructor is, what their background or",
    "credentials are, or what they teach — including in a specific term. The",
    "`teaches` list IS their term schedule: answer from it directly, and never",
    "re-derive it course-by-course with get_class_schedule (that path attributes",
    "other instructors' courses to them).",
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
            // Their teaching, from the same join key the pipeline stamps —
            // per TERM with modality/campus, not a bare course list. A bare
            // list forced the model to re-derive "what does X teach this
            // term" course-by-course through get_class_schedule, and it
            // cross-referenced wrong: measured live (2026-08-21), it
            // attributed two other instructors' courses to a professor,
            // dropped one of his real ones, and called a hybrid schedule
            // "all online". With the term on every entry, the tool result
            // IS the term schedule.
            const taught = await getDb()
                .selectDistinct({
                    courseCode: knowledgeEntry.courseCode,
                    year: knowledgeEntry.year,
                    semester: knowledgeEntry.semester,
                    termOrd: knowledgeEntry.termOrd,
                    modality: sql<string | null>`${knowledgeEntry.metadata}->>'modality'`,
                    campus: sql<string | null>`${knowledgeEntry.metadata}->>'campus'`,
                })
                .from(knowledgeEntry)
                .where(
                    and(
                        eq(knowledgeEntry.docType, "section"),
                        eq(slug, row.slug ?? ""),
                    ),
                )
                .orderBy(
                    sql`${knowledgeEntry.termOrd} DESC NULLS LAST`,
                    knowledgeEntry.courseCode,
                )
                .limit(MAX_COURSES * 3);

            // One line per course+term; offerings aggregated ("hybrid at
            // RLC; online"). Campus repeats the modality word for online
            // rows, so it is only shown when it adds information.
            const label = (sem: string | null, yr: number | null) =>
                sem && yr
                    ? `${sem[0].toUpperCase()}${sem.slice(1)} ${yr}`
                    : "term unknown";
            const grouped = new Map<string, Set<string>>();
            for (const t of taught) {
                if (!t.courseCode) continue;
                const key = `${t.courseCode} — ${label(t.semester, t.year)}`;
                const offering =
                    t.campus && t.campus.toLowerCase() !== (t.modality ?? "").toLowerCase()
                        ? `${t.modality ?? "format unlisted"} at ${t.campus}`
                        : (t.modality ?? "format unlisted");
                (grouped.get(key) ?? grouped.set(key, new Set()).get(key)!).add(offering);
            }

            return {
                found: true,
                name: row.name,
                background: row.text,
                teaches: [...grouped.entries()]
                    .slice(0, MAX_COURSES)
                    .map(([key, offerings]) => `${key} (${[...offerings].join("; ")})`),
                source_url: row.sourceUrl,
            };
        },
    });
}
