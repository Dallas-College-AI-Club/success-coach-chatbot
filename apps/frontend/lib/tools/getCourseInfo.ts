import { and, eq, sql } from "drizzle-orm";
import { isCourseCode } from "@/lib/course-details";

import { getDb } from "@/lib/client";
import { knowledgeEntry } from "@/lib/schema";

import z from "zod";

export const DESCRIPTION = [
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
  "",
  "Reporting requisites correctly:",
  "- `prerequisites` contains extracted course references; it may include recommendations. Use `requisites_raw` to distinguish required, recommended and unknown conditions.",
  "- `requisites_raw` is the catalog's requisite sentence, word for word.",
  "- A course can have an EMPTY `prerequisites` array and still have a real",
  "  requirement, because readiness requirements are prose, not course codes",
  '  (e.g. ENGL 1301: "Required: College level ready in Reading and Writing.").',
  "- So when `prerequisites` is empty and `requisites_raw` is not, quote",
  "  `requisites_raw`. Never say a course has no prerequisites in that case.",
  "- Empty arrays or missing requisite text mean no details were recorded, not proof that no prerequisites apply. Say no prerequisites only when the returned catalog text explicitly states that.",
  "",
].join("\n");

export const INPUT_SCHEMA = z.object({
  courseCode: z
    .string()
    .describe(
      "Dallas College course code such as 'MATH 2414', 'BIOL 1406', or 'ENGL 1302'.",
    ),
});

export function normalizeCourseCode(courseCode: string): string {
  return courseCode
    .replace(/([A-Za-z])([0-9])/, "$1 $2")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

export const EXECUTE = async (input: z.infer<typeof INPUT_SCHEMA>) => {
  if (process.env.NODE_ENV !== "production") {
    console.log("[TOOL] get_course_info invoked");
  }
  INPUT_SCHEMA.parse(input);
  if (!isCourseCode(normalizeCourseCode(input.courseCode)))
    return { found: false };
  const [row] = await getDb()
    .select({
      facts: knowledgeEntry.facts,
      courseCode: knowledgeEntry.courseCode,
      sourceUrl: knowledgeEntry.sourceUrl,
      catalogYear: knowledgeEntry.catalogYear,
    })
    .from(knowledgeEntry)
    .where(
      and(
        eq(knowledgeEntry.courseCode, normalizeCourseCode(input.courseCode)),
        eq(knowledgeEntry.docType, "course"),
      ),
    )
    .orderBy(
      sql`${knowledgeEntry.catalogYear} DESC NULLS LAST`,
      sql`${knowledgeEntry.scrapedAt} DESC NULLS LAST`,
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
      (facts.course_code as string | undefined) ?? row.courseCode ?? undefined,

    title: (facts.title as string | null | undefined) ?? null,

    credit_hours: (facts.credit_hours as number | null | undefined) ?? null,

    description: (facts.description as string | null | undefined) ?? null,

    prerequisites: (facts.prerequisites as unknown[] | undefined) ?? [],

    corequisites: (facts.corequisites as unknown[] | undefined) ?? [],

    requisites_raw: (facts.requisites_raw as string | null | undefined) ?? null,

    campus_locations:
      (facts.campus_locations as string | null | undefined) ?? null,

    source_url: row.sourceUrl,

    catalog_year: row.catalogYear ?? null,
  };
};
