import { jsonSchema } from "ai";
import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/client";
import { knowledgeEntry } from "@/lib/schema";

import { normalizeCourseCode } from "./getCourseInfo";
import {
    defineTool,
    isRecord,
    ToolInputError,
    type FlexibleSchema,
    type Tool,
} from "./types";

// Name lives in the client-safe manifest so the UI can label the tool
// without importing this module (which pulls in the DB client).
export { GET_CLASS_SCHEDULE_TOOL_NAME } from "./names";
import { GET_CLASS_SCHEDULE_TOOL_NAME } from "./names";

export interface GetClassScheduleInput {
    courseCode: string;
}

/** One row per instructor/term/modality/campus, not per section: a popular
 *  course has dozens of near-identical sections, and the student is choosing
 *  between people, places and formats, not section numbers. */
export interface ScheduleOffering {
    term: string;
    professor: string | null;
    /** "online" | "in person" | "hybrid" | "unknown" — from the schedule feed. */
    modality: string | null;
    campus: string | null;
    sections: number;
    /** "MW 10:00 AM-11:20 AM (lecture)" per scheduled meeting. Empty for an
     *  online section: those have no set meeting time, which is not the same
     *  as a time we failed to record. */
    meets: string[];
}

export interface ClassScheduleResult {
    found: boolean;
    course_code?: string;
    /** Returned so the model never has to supply a title itself. Omitting it
     *  is not neutral: asked "who teaches BIOL 1406", the model invented
     *  "Introduction to Biology" for a course actually titled "Biology for
     *  Science Majors I" (observed live 2026-08-11). */
    title?: string | null;
    credit_hours?: number | null;
    /** Every term this course appears in, newest first — stated separately
     *  because a popular course fills the offerings cap with one term and the
     *  others would silently vanish. */
    terms_on_record?: string[];
    offerings?: ScheduleOffering[];
    /** Set when more offerings exist than were returned. */
    truncated?: boolean;
    /** Stated on every hit: the schedule feed carries no meeting days or
     *  times, so the model must not imply it knows when a class meets. */
    note?: string;
}

const DESCRIPTION = [
    "Returns the terms a Dallas College course was offered, who taught it, whether",
    "it was online or in person, and at which campus.",
    "",
    "Call this when the user asks who teaches a course, where it is held, whether",
    "it is available online, or which term it runs in.",
    "",
    "Each offering lists its meeting days and times in `meets`. An EMPTY `meets`",
    "means the section has no set meeting time — it is online, or the catalog",
    "says the pattern varies — so say that rather than implying a time exists.",
    "",
    "No seat availability, and these are past terms rather than a live",
    "registration feed: describe them as what was offered and send the student to",
    "the Dallas College class schedule to register.",
].join("\n");

const INPUT_SCHEMA: FlexibleSchema<GetClassScheduleInput> = jsonSchema({
    type: "object",
    properties: {
        courseCode: {
            type: "string",
            description:
                "Course code, e.g. 'BIOL 1406'. Spacing and case do not matter.",
        },
    },
    required: ["courseCode"],
    additionalProperties: false,
});

const MAX_OFFERINGS = 20;

/** "2026 spring" -> "Spring 2026", for text the model repeats verbatim. */
function termLabel(year: number | null, semester: string | null): string {
    if (!year && !semester) return "unknown term";
    const s = semester ? semester[0].toUpperCase() + semester.slice(1) : "";
    return [s, year].filter(Boolean).join(" ");
}

export function createGetClassScheduleTool(): Tool<
    GetClassScheduleInput,
    Promise<ClassScheduleResult>
> {
    return defineTool({
        name: GET_CLASS_SCHEDULE_TOOL_NAME,
        description: DESCRIPTION,
        inputSchema: INPUT_SCHEMA,

        parseInput(raw: unknown): GetClassScheduleInput {
            if (!isRecord(raw)) {
                throw new ToolInputError(
                    `Expected an object, received ${Array.isArray(raw) ? "array" : typeof raw}.`,
                );
            }
            const { courseCode } = raw;
            if (typeof courseCode !== "string") {
                throw new ToolInputError(`"courseCode" must be a string.`);
            }
            const normalized = normalizeCourseCode(courseCode);
            if (!normalized) {
                throw new ToolInputError(
                    `"courseCode" must contain letters or digits.`,
                );
            }
            return { courseCode: normalized };
        },

        async execute(
            input: GetClassScheduleInput,
        ): Promise<ClassScheduleResult> {
            if (process.env.NODE_ENV !== "production") {
                console.log(
                    `[TOOL] get_class_schedule invoked for ${input.courseCode}`,
                );
            }

            // Modality and campus live in the section's chunk_text, not in
            // facts (the schedule loader writes facts: {}), so they are read
            // back out of the sentence it composed. Kept in SQL so one query
            // serves the whole answer.
            const modality = sql<
                string | null
            >`CASE WHEN ${knowledgeEntry.chunkText} ILIKE '%, hybrid,%' THEN 'hybrid'
                    WHEN ${knowledgeEntry.chunkText} ILIKE '%, online,%' THEN 'online'
                    WHEN ${knowledgeEntry.chunkText} ILIKE '%, in person,%' THEN 'in person'
                    ELSE NULL END`;
            const campus = sql<
                string | null
            >`NULLIF(substring(${knowledgeEntry.chunkText} from 'Location: ([^.]+)'), '')`;

            const rows = await getDb()
                .select({
                    year: knowledgeEntry.year,
                    semester: knowledgeEntry.semester,
                    professor: knowledgeEntry.professor,
                    modality,
                    campus,
                    sections: sql<number>`count(*)::int`,
                    // One row per group carries the schedule; sections grouped
                    // together share an instructor, term, modality and campus,
                    // so any of their meeting lists represents the group.
                    meetings: sql<
                        unknown
                    >`(array_agg(${knowledgeEntry.facts}->'meetings'))[1]`,
                })
                .from(knowledgeEntry)
                .where(
                    and(
                        eq(knowledgeEntry.docType, "section"),
                        eq(knowledgeEntry.courseCode, input.courseCode),
                    ),
                )
                .groupBy(
                    knowledgeEntry.termOrd,
                    knowledgeEntry.year,
                    knowledgeEntry.semester,
                    knowledgeEntry.professor,
                    modality,
                    campus,
                )
                // term_ord, not year: every loaded term is 2026, so ordering
                // by year alone interleaves Spring and Summer. term_ord
                // encodes year*10 + season, which is what actually sorts them.
                .orderBy(
                    sql`${knowledgeEntry.termOrd} DESC NULLS LAST`,
                    sql`count(*) DESC`,
                )
                .limit(MAX_OFFERINGS + 1);

            if (rows.length === 0) return { found: false };

            const shown = rows.slice(0, MAX_OFFERINGS);

            // Its own query, not derived from `rows`: those are already capped
            // at MAX_OFFERINGS, and one busy term fills the cap — deriving the
            // term list from them reports exactly the terms the cap let
            // through, which is the omission this field exists to prevent.
            // Title and credits are parsed from the section sentence in JS,
            // not SQL — one regex, no escaping through the query layer. They
            // are returned because leaving them out is not neutral: asked
            // "who teaches BIOL 1406", the model invented the title
            // "Introduction to Biology" for a course actually called "Biology
            // for Science Majors I" (observed live 2026-08-11). Give it the
            // fact and it has no gap to fill.
            const [meta] = await getDb()
                .select({ text: knowledgeEntry.chunkText })
                .from(knowledgeEntry)
                .where(
                    and(
                        eq(knowledgeEntry.docType, "section"),
                        eq(knowledgeEntry.courseCode, input.courseCode),
                    ),
                )
                .limit(1);
            // "BIOL 1406 — Biology for Science Majors I (4 cr), section 284, …"
            const titleMatch = (meta?.text ?? "").match(
                /—\s*(.+?)\s*\((\d+|\?)\s*cr\)/,
            );
            const parsedTitle = titleMatch?.[1] ?? null;
            const parsedCredits =
                titleMatch && /^\d+$/.test(titleMatch[2])
                    ? Number(titleMatch[2])
                    : null;

            const termRows = await getDb()
                .selectDistinct({
                    termOrd: knowledgeEntry.termOrd,
                    year: knowledgeEntry.year,
                    semester: knowledgeEntry.semester,
                })
                .from(knowledgeEntry)
                .where(
                    and(
                        eq(knowledgeEntry.docType, "section"),
                        eq(knowledgeEntry.courseCode, input.courseCode),
                    ),
                )
                .orderBy(sql`${knowledgeEntry.termOrd} DESC NULLS LAST`);
            const terms = termRows.map((t) => termLabel(t.year, t.semester));
            return {
                found: true,
                course_code: input.courseCode,
                title: parsedTitle,
                credit_hours: parsedCredits,
                terms_on_record: terms,
                offerings: shown.map((r) => ({
                    term: termLabel(r.year, r.semester),
                    professor: r.professor,
                    modality: r.modality,
                    campus: r.campus,
                    sections: Number(r.sections),
                    meets: (Array.isArray(r.meetings) ? r.meetings : [])
                        .map((m) => {
                            const rec = (m ?? {}) as Record<string, unknown>;
                            const days = String(rec.days ?? "").trim();
                            const from = String(rec.start_time ?? "").trim();
                            const to = String(rec.end_time ?? "").trim();
                            if (!days || !from || !to) return "";
                            const where = rec.room ? ` in ${rec.room}` : "";
                            return `${days} ${from}-${to} (${rec.type ?? "class"})${where}`;
                        })
                        .filter(Boolean),
                })),
                ...(rows.length > MAX_OFFERINGS ? { truncated: true } : {}),
                note: "These are past terms from the published class schedule, not live registration. An empty `meets` means the section has no set meeting time (online, or a schedule the catalog says varies) — not that the time is unknown. Send the student to the Dallas College class schedule to register or to confirm current times.",
            };
        },
    });
}
