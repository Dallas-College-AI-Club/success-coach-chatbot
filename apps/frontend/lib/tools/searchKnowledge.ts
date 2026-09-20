// Server-only: this module reads OPENROUTER_API_KEY and opens DB queries, so
// it must never be bundled into a client component. "server-only" makes that
// a build error instead of a convention.
//
// It sits here rather than in lib/client.ts (which would cover all three
// DB-backed tools) because the package throws outside a react-server
// condition, and scripts/check-course-code-normalization.mts imports
// getCourseInfo under plain tsx in CI. The other two tools carry no secret of
// their own, and Next blanks non-NEXT_PUBLIC_ env vars in client bundles.
import "server-only";

import { and, cosineDistance, inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/client";
import { SEARCHABLE_DOC_TYPES } from "@/lib/constants";
import { knowledgeEntry } from "@/lib/schema";

import { embedText } from "@/lib/embedding";
import { isRecord } from "@/lib/course-details";

import z from "zod";

// Distance floor, calibrated against live data 2026-08-11 (cosine distance,
// 0 = identical). Direct queries land ≤ 0.59 ("college algebra" 0.40,
// "paramedic program" 0.43, misspelled "python cerificate" 0.59); the
// farthest USEFUL topical neighbour measured was 0.611 ("phlebotomy" → the
// Medical Assistant lab course that covers it); off-corpus junk starts at
// 0.646 ("tuition per class" → an unrelated costuming certificate) and runs
// up through 0.714 ("drop deadline" → a fashion internship). 0.62 sits in
// the measured gap: related-pathway discovery survives, and questions with
// no data home return nothing so the model gives the governed refusal
// instead of citing an irrelevant record with confidence.
const OFF_CORPUS_FLOOR = 0.62;

// Top-1 is trustworthy, the tail is not (live: a Java cert ranked #3 for a
// python query). 3 gives the model enough to disambiguate without feeding it
// wrong-language neighbours to weave in.
const TOP_K = 3;

// Fetch a few past k so the floor trims noise without emptying a good result.
const FETCH = 8;

export const DESCRIPTION = [
  "Searches verified Dallas College course, program, and student-resource",
  "records by meaning and returns the closest matching entries. Student",
  "resources cover tuition rates, academic-calendar deadlines (withdraw/drop",
  "dates, breaks), financial aid contacts, housing/food/transit assistance,",
  "tutoring, and Success Coach contact info.",
  "",
  "Call this tool when you do not know the exact course code or catalog program",
  "name, or when get_course_info or get_program_requirements found nothing.",
  "",
  "Examples:",
  '- "what do I need for the python certificate" (you do not know the catalog name yet)',
  '- "which classes cover databases"',
  '- "is there a program for becoming a paramedic"',
  '- "how much does a class cost" / "last day to drop"',
  "",
  "Search ONCE per question — rewording the same query does not find different",
  "records. A failed focused search automatically checks all supported document types.",
  "Set broad:true after an exact lookup fails or to find possible instructor expertise or syllabus information.",
  "Broad results are related candidates, never an exhaustive list or proof of a requirement. Verify course/program facts with their exact tool; attribute CV/syllabus excerpts to their source and ask the student to narrow when needed.",
  "",
  "Course and program results are short summaries for FINDING the right record",
  "— never answer a requirements question from them. Each result carries the",
  "exact identifier: pass a result's `name` to get_program_requirements, or its",
  "`course_code` to get_course_info, copied EXACTLY — do not retype or shorten",
  'them. Student-resource results (doc_type "resource") are different: they',
  "have no follow-up tool — their text IS the verified answer, so quote the",
  "figures and dates from it directly.",
  "",
  "If this tool finds nothing, the information is not in the verified records —",
  "give the standard fallback and do not guess.",
].join("\n");

export const INPUT_SCHEMA = z.object({
  broad: z
    .boolean()
    .optional()
    .describe(
      "Search across course, program, resource, instructor CV, section and syllabus records for related information.",
    ),
  query: z
    .string()
    .trim()
    .min(1)
    .max(1000)
    .describe(
      "What to search for, in the student's own words, e.g. 'python certificate requirements'.",
    ),
});

const BROAD_DOC_TYPES = [...SEARCHABLE_DOC_TYPES, "cv", "section", "syllabus"];

const SEARCH_FILLER = new Set(
  "a an the and or of in at to for with about what which who how is are do does can i my me all any find show list tell please dallas college course courses class classes program programs degree certificate instructor instructors professor professors faculty background information records".split(
    " ",
  ),
);

/** Broad matches also need topical words; vector proximity alone is not evidence. */
export function searchTerms(query: string) {
  return [
    ...new Set(
      (query.toLowerCase().match(/[\p{L}\p{N}+#]+/gu) ?? []).filter(
        (word) => word.length > 2 && !SEARCH_FILLER.has(word),
      ),
    ),
  ].slice(0, 12);
}

export function hasTopicEvidence(text: string, terms: string[]) {
  if (!terms.length) return false;
  const words = new Set(
    (text.toLowerCase().match(/[\p{L}\p{N}+#]+/gu) ?? []).map((w) =>
      w.replace(/s$/, ""),
    ),
  );
  return (
    terms.filter((t) => words.has(t.replace(/s$/, ""))).length >=
    Math.min(2, terms.length)
  );
}

/** Keep actual matching passages, even when a long CV's opening has no evidence. */
export function searchExcerpt(text: string, terms: string[], limit = 2400) {
  if (text.length <= limit) return text;
  const wanted = new Set(terms.map((term) => term.replace(/s$/, "")));
  const ranges: { start: number; end: number }[] = [];
  for (const match of text.matchAll(/[\p{L}\p{N}+#]+/gu)) {
    if (!wanted.has(match[0].toLowerCase().replace(/s$/, ""))) continue;
    const start = Math.max(0, match.index - 160);
    const end = Math.min(text.length, match.index + match[0].length + 240);
    const previous = ranges.at(-1);
    if (previous && start <= previous.end) previous.end = end;
    else ranges.push({ start, end });
  }
  // Whole passages are separated explicitly; never concatenate distant facts
  // into what looks like a single sentence from the source.
  return (ranges.length ? ranges : [{ start: 0, end: limit }])
    .map(
      ({ start, end }) =>
        `${start ? "… " : ""}${text.slice(start, end)}${end < text.length ? " …" : ""}`,
    )
    .join("\n\n")
    .slice(0, limit);
}

/** One broad recovery per turn, including after an earlier focused discovery. */
export function recoveryToolChoice(
  steps: readonly {
    toolResults: readonly { toolName: string; output: unknown }[];
  }[],
) {
  const results = steps.flatMap((step) => step.toolResults);
  const searchedBroadly = results.some(
    (result) =>
      result.toolName === "search_knowledge" &&
      isRecord(result.output) &&
      result.output.search_scope === "all",
  );
  const missed = results.some(
    (result) =>
      [
        "get_course_info",
        "get_program_requirements",
        "get_class_schedule",
        "get_instructor",
      ].includes(result.toolName) &&
      isRecord(result.output) &&
      result.output.found === false,
  );
  return missed && !searchedBroadly
    ? { type: "tool" as const, toolName: "search_knowledge" as const }
    : undefined;
}

export const EXECUTE = async (input: z.infer<typeof INPUT_SCHEMA>) => {
  if (process.env.NODE_ENV !== "production") {
    // Length only: this is the one tool input that can carry a
    // student's free text, and logs must stay PII-clean.
    console.log(
      `[TOOL] search_knowledge invoked (query length ${input.query.length})`,
    );
  }
  INPUT_SCHEMA.parse(input);

  // Scope to SEARCHABLE_DOC_TYPES (see lib/constants.ts for the
  // membership rule AND the exact-scan posture): measured live, the
  // unscoped corpus returns five instructor CVs and zero programs for a
  // program query — 2,709 dense CV rows out-compete 318 short program
  // rows, and cv has no point-read tool to complete the hop. The demo
  // DB has no vector index on purpose; the btree on doc_type narrows
  // the sort to the searchable rows and results are exact.
  let broad = input.broad === true;
  try {
    const embedding = await embedText(input.query);
    const distance = cosineDistance(knowledgeEntry.embedding, embedding);
    const terms = searchTerms(input.query);
    const keywords = sql`websearch_to_tsquery('english', ${terms.join(" OR ")})`;
    const document = sql`to_tsvector('english', ${knowledgeEntry.chunkText})`;
    const read = (types: string[], lexical = false) =>
      getDb()
        .select({
          text: knowledgeEntry.chunkText,
          sourceUrl: knowledgeEntry.sourceUrl,
          docType: knowledgeEntry.docType,
          name: sql<string | null>`${knowledgeEntry.facts}->>'name'`,
          courseCode: knowledgeEntry.courseCode,
          distance,
        })
        .from(knowledgeEntry)
        .where(
          and(
            inArray(knowledgeEntry.docType, types),
            // Legacy XXXX option pages must never masquerade as enrollable courses.
            sql`(${knowledgeEntry.docType} <> 'course' OR ${knowledgeEntry.courseCode} ~ '^[A-Z]{3,4} [0-9]{4}$')`,
            lexical ? sql`${document} @@ ${keywords}` : undefined,
          ),
        )
        .orderBy(
          lexical ? sql`ts_rank(${document}, ${keywords}) DESC` : distance,
          distance,
        )
        .limit(FETCH);
    const relevant = (rows: Awaited<ReturnType<typeof read>>) =>
      rows.filter((r) => Number(r.distance) <= OFF_CORPUS_FLOOR);
    let rows = broad ? [] : relevant(await read(SEARCHABLE_DOC_TYPES));
    if (!rows.length) broad = true;
    if (broad) {
      // Separate short catalog/resource records from dense CVs; one type
      // cannot occupy every candidate slot. One embedding is reused.
      rows = (
        await Promise.all(
          BROAD_DOC_TYPES.map(async (type) => {
            const seen = new Set<string>();
            const [semantic, lexical] = await Promise.all([
              read([type]),
              terms.length ? read([type], true) : Promise.resolve([]),
            ]);
            return [...lexical, ...relevant(semantic)]
              .filter((row) => hasTopicEvidence(row.text, terms))
              .filter((row) => {
                if (seen.has(row.sourceUrl)) return false;
                seen.add(row.sourceUrl);
                return true;
              })
              .slice(0, 2);
          }),
        )
      )
        .flat()
        .sort((a, b) => Number(a.distance) - Number(b.distance));
    }
    const results = rows.slice(0, broad ? 6 : TOP_K).map((r) => {
      const isCourse = r.docType === "course";
      return {
        text: broad ? searchExcerpt(r.text, terms) : r.text,
        source_url: r.sourceUrl,
        doc_type: r.docType,
        name: isCourse ? null : r.name,
        course_code: isCourse ? r.courseCode : null,
      };
    });

    if (results.length === 0) {
      return { found: false, search_scope: broad ? "all" : "catalog" };
    }
    return {
      found: true,
      results,
      search_scope: broad ? "all" : "catalog",
      ...(broad
        ? {
            related_only: true,
            note: "Possible related records, not an exhaustive list or a verified exact answer. Confirm course/program requirements with exact lookups. Excerpts may be shortened; do not infer missing facts.",
          }
        : {}),
    };
  } catch (error) {
    // A retrieval outage must not end the turn: the tool loop treats an
    // undefined return as a malformed result, and `next build` rejects
    // the implicit-undefined path outright (TS2366). Report "nothing
    // found" instead — the model then gives the standard fallback rather
    // than inventing an answer, which is the same behaviour as a genuine
    // zero-hit search.
    console.error(
      "[TOOL] search_knowledge unavailable:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return {
      found: false,
      search_scope: broad ? "all" : "catalog",
      unavailable: true,
    };
  }
};
