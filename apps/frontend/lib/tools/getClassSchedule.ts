import { and, eq, inArray, sql } from "drizzle-orm";
import z from "zod";
import { getDb } from "@/lib/client";
import { knowledgeEntry } from "@/lib/schema";
import { instructorCvLinks, scheduleSection } from "@/lib/course-details";
import { normalizeCourseCode } from "./getCourseInfo";

export const DESCRIPTION = `Returns individual published class sections, instructors, dates, and meeting times when loaded. Call for schedules, who teaches a course, campus or modality. Set semester and year for the requested term (Fall/Spring is different from curriculum semester 1/2). Never merge sections just because their instructor is the same. Empty meets means UNKNOWN unless meeting_info_raw explicitly explains the pattern. Do not claim online means no fixed time. This is a saved schedule, not live registration or seat availability. The interface displays section details; keep prose brief. If truncated, state the count and use next_offset for further results.`;

export const INPUT_SCHEMA = z.object({
  courseCode: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .describe("Course code, e.g. ITSE 1370. Spacing/case do not matter."),
  semester: z.enum(["spring", "summer", "fall", "winter", "may"]).optional(),
  year: z.number().int().min(2020).max(2035).optional(),
  offset: z.number().int().min(0).max(10000).optional(),
});
const PAGE_SIZE = 100;

/** An explicit one-course schedule request must read the database this turn. */
export function scheduleCourseForTurn(text: string): string | undefined {
  if (
    !/\b(?:schedules?|sections?|meeting (?:times?|days?)|who (?:teaches|is teaching))\b/i.test(
      text,
    )
  )
    return undefined;
  const codes = [
    ...new Set(
      [...text.matchAll(/\b[A-Z]{3,4}[\s._-]*\d{4}\b/gi)]
        .map((match) => normalizeCourseCode(match[0]))
        .filter((code) => !/^(?:FALL|MAY|YEAR) /.test(code)),
    ),
  ];
  return codes.length === 1 ? codes[0] : undefined;
}

export function scheduleToolChoice(text: string, stepNumber: number) {
  if (stepNumber !== 0) return undefined;
  if (scheduleCourseForTurn(text))
    return { type: "tool" as const, toolName: "get_class_schedule" as const };
  // A course-title question needs discovery, not one instructor's biography.
  return /\bwho(?:['’]s| is)?\s+(?:teaches|teaching)\b/i.test(text)
    ? { type: "tool" as const, toolName: "search_knowledge" as const }
    : undefined;
}

export const EXECUTE = async (input: z.infer<typeof INPUT_SCHEMA>) => {
  const args = INPUT_SCHEMA.parse(input);
  const code = normalizeCourseCode(args.courseCode);
  if (!/^[A-Z]{3,4} \d{4}$/.test(code))
    return { found: false, note: "Use a course code such as ITSE 1370." };
  const base = and(
    eq(knowledgeEntry.docType, "section"),
    eq(knowledgeEntry.courseCode, code),
  );
  const where = and(
    base,
    ...(args.semester ? [eq(knowledgeEntry.semester, args.semester)] : []),
    ...(args.year ? [eq(knowledgeEntry.year, args.year)] : []),
  );
  const offset = args.offset ?? 0;
  const [rows, counts, terms, instructorRows] = await Promise.all([
    getDb()
      .select({
        year: knowledgeEntry.year,
        semester: knowledgeEntry.semester,
        professor: knowledgeEntry.professor,
        instructorSlug: knowledgeEntry.instructorSlug,
        metadata: knowledgeEntry.metadata,
        facts: knowledgeEntry.facts,
        sourceUrl: knowledgeEntry.sourceUrl,
        text: knowledgeEntry.chunkText,
      })
      .from(knowledgeEntry)
      .where(where)
      .orderBy(
        sql`${knowledgeEntry.termOrd} DESC NULLS LAST`,
        sql`CASE WHEN ${knowledgeEntry.metadata}->>'section' ~ '^[0-9]+$' THEN (${knowledgeEntry.metadata}->>'section')::numeric END ASC NULLS LAST`,
        sql`${knowledgeEntry.metadata}->>'section'`,
        knowledgeEntry.id,
      )
      .limit(PAGE_SIZE)
      .offset(offset),
    getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(knowledgeEntry)
      .where(where),
    getDb()
      .selectDistinct({
        year: knowledgeEntry.year,
        semester: knowledgeEntry.semester,
        term: knowledgeEntry.termOrd,
      })
      .from(knowledgeEntry)
      .where(base)
      .orderBy(sql`${knowledgeEntry.termOrd} DESC NULLS LAST`),
    getDb()
      .selectDistinct({
        professor: knowledgeEntry.professor,
        slug: knowledgeEntry.instructorSlug,
      })
      .from(knowledgeEntry)
      .where(where)
      .orderBy(knowledgeEntry.professor),
  ]);
  const slugs = [
    ...new Set(instructorRows.flatMap((row) => (row.slug ? [row.slug] : []))),
  ];
  let cvLinks = new Map<string, string>();
  let cvRows: {
    slug: string | null;
    sourceUrl: string;
    text: string;
    name: string | null;
  }[] = [];
  if (slugs.length) {
    // One exact-key batch lookup; never fuzzy-match a professor to a CV.
    // CV availability is optional and must not hide the section schedule.
    try {
      cvRows = await getDb()
        .select({
          slug: knowledgeEntry.instructorSlug,
          sourceUrl: knowledgeEntry.sourceUrl,
          text: knowledgeEntry.chunkText,
          name: sql<string | null>`${knowledgeEntry.facts}->>'name'`,
        })
        .from(knowledgeEntry)
        .where(
          and(
            eq(knowledgeEntry.docType, "cv"),
            inArray(knowledgeEntry.instructorSlug, slugs),
          ),
        );
      cvLinks = instructorCvLinks(cvRows);
    } catch {
      console.warn(
        "[TOOL] get_class_schedule: instructor CV links unavailable",
      );
    }
  }
  const total = counts[0]?.count ?? 0;
  const title = rows[0]?.text.match(/—\s*(.+?)\s*\((\d+|\?)\s*cr\)/);
  const truncated = offset + rows.length < total;
  return {
    found: total > 0,
    course_code: code,
    title: title?.[1] ?? null,
    requested_term:
      [args.semester, args.year].filter(Boolean).join(" ") || null,
    terms_on_record: terms.map((t) =>
      [t.semester, t.year].filter(Boolean).join(" "),
    ),
    total_sections: total,
    // Complete across the selected term, independently of section pagination.
    instructors: instructorRows
      .filter(
        (row, index, all) =>
          row.professor &&
          !/^(?:to be announced|tba)$/i.test(row.professor.trim()) &&
          all.findIndex(
            (candidate) => candidate.professor === row.professor,
          ) === index,
      )
      .map((row) => ({
        name: row.professor!,
        professor_cv_url: row.slug ? (cvLinks.get(row.slug) ?? null) : null,
      })),
    unassigned_instructor: instructorRows.some(
      (row) =>
        !row.professor ||
        /^(?:to be announced|tba)$/i.test(row.professor.trim()),
    ),
    instructor_profiles: [...cvLinks].flatMap(([slug, url]) => {
      const profile = cvRows.find(
        (row) => row.slug === slug && row.sourceUrl === url,
      );
      return profile
        ? [{ name: profile.name, source_url: url, background: profile.text }]
        : [];
    }),
    offset,
    offerings: rows.map((row) => ({
      ...scheduleSection(row),
      professor_cv_url: row.instructorSlug
        ? (cvLinks.get(row.instructorSlug) ?? null)
        : null,
    })),
    truncated,
    ...(truncated ? { next_offset: offset + rows.length } : {}),
    note: "Saved published schedule, not live registration. Dates and times are unknown when absent; an empty meets array does not establish that a class is asynchronous. No matching section means absent from this snapshot, not proof that the college does not offer it.",
  };
};
