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

import { jsonSchema } from "ai";
import { cosineDistance, inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/client";
import { SEARCHABLE_DOC_TYPES } from "@/lib/constants";
import { knowledgeEntry } from "@/lib/schema";

import { embedText } from "@/lib/embedding";
import { SEARCH_KNOWLEDGE_TOOL_NAME } from "./names";
import {
  defineTool,
  isRecord,
  ToolInputError,
  type FlexibleSchema,
  type Tool,
} from "./types";

// Name lives in the client-safe manifest so the UI can label the tool
// without importing this module (which pulls in the DB client).
export { SEARCH_KNOWLEDGE_TOOL_NAME } from "./names";

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

export interface SearchKnowledgeInput {
  query: string;
}

export interface SearchKnowledgeHit {
  /** The stored chunk, verbatim. */
  text: string;
  /** Provenance for the model's citation. */
  source_url: string;
  /** 'course' | 'program_map' | 'resource' — tells the model which
   *  point-read to call next (resource hits have none; their text is the
   *  answer). */
  doc_type: string | null;
  /** Exact catalog program name (program_map hits — the string to pass to
   *  get_program_requirements VERBATIM) or the resource row's display name.
   *  Structured because a small model paraphrases names it extracts from
   *  prose ("Emergency Medical Services Program" for "Emergency Medical
   *  Services/Paramedic A.A.S.", observed live) and the exact-lookup then
   *  misses. */
  name?: string | null;
  /** Exact course code (course hits) — the string for get_course_info. */
  course_code?: string | null;
}

export interface SearchKnowledgeResult {
  found: boolean;
  /** Most similar first. Rank order IS the score — an uncalibrated cosine
   *  distance is a number the model would misread, so it is never exposed. */
  results?: SearchKnowledgeHit[];
  /** Set when the per-turn search cap is hit — instructs the model to stop
   *  searching and use what it has. */
  note?: string;
}

/** Searches allowed per turn. The DESCRIPTION says "search once"; a small
 *  model does not reliably obey prose (observed live: six rephrasings of the
 *  same query in one turn). The cap makes it deterministic. Two, not one, so
 *  a genuinely different second angle ("paramedic" → "EMS") stays possible. */
const MAX_CALLS_PER_TURN = 2;

const DESCRIPTION = [
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
  "records. Use the results you get.",
  "",
  "Course and program results are short summaries for FINDING the right record",
  "— never answer a requirements question from them. Each result carries the",
  "exact identifier: pass a result's `name` to get_program_requirements, or its",
  "`course_code` to get_course_info, copied EXACTLY — do not retype or shorten",
  "them. Student-resource results (doc_type \"resource\") are different: they",
  "have no follow-up tool — their text IS the verified answer, so quote the",
  "figures and dates from it directly.",
  "",
  "If this tool finds nothing, the information is not in the verified records —",
  "give the standard fallback and do not guess.",
].join("\n");

const INPUT_SCHEMA: FlexibleSchema<SearchKnowledgeInput> = jsonSchema({
  type: "object",
  properties: {
    query: {
      type: "string",
      description:
        "What to search for, in the student's own words, e.g. 'python certificate requirements'.",
    },
  },
  required: ["query"],
  additionalProperties: false,
});

export function createSearchKnowledgeTool(): Tool<
  SearchKnowledgeInput,
  Promise<SearchKnowledgeResult>
> {
  // Per-request state: the registry is constructed per POST (registry.ts),
  // so this counts one conversation turn, not one process lifetime.
  let calls = 0;

  return defineTool({
    name: SEARCH_KNOWLEDGE_TOOL_NAME,
    description: DESCRIPTION,
    inputSchema: INPUT_SCHEMA,

    parseInput(raw: unknown): SearchKnowledgeInput {
      if (!isRecord(raw)) {
        throw new ToolInputError(
          `Expected an object, received ${Array.isArray(raw) ? "array" : typeof raw}.`,
        );
      }
      const { query } = raw;
      if (typeof query !== "string") {
        throw new ToolInputError(`"query" must be a string.`);
      }
      const trimmed = query.trim();
      if (!trimmed) {
        throw new ToolInputError(`"query" must not be empty.`);
      }
      // The embedding endpoint 400s past ~8k tokens, and embed() does
      // not retry 4xx — cap instead of failing the whole turn.
      return { query: trimmed.slice(0, 2000) };
    },

    async execute(input: SearchKnowledgeInput): Promise<SearchKnowledgeResult> {
      if (++calls > MAX_CALLS_PER_TURN) {
        return {
          found: false,
          note: "Search limit reached for this question. Use the results already returned above — or, if none were useful, give the standard fallback. Do not search again.",
        };
      }
      if (process.env.NODE_ENV !== "production") {
        // Length only: this is the one tool input that can carry a
        // student's free text, and logs must stay PII-clean.
        console.log(
          `[TOOL] search_knowledge invoked (query length ${input.query.length})`,
        );
      }

      const embedding = await embedText(input.query);

      const distance = cosineDistance(knowledgeEntry.embedding, embedding);

      // Scope to SEARCHABLE_DOC_TYPES (see lib/constants.ts for the
      // membership rule AND the exact-scan posture): measured live, the
      // unscoped corpus returns five instructor CVs and zero programs for a
      // program query — 2,709 dense CV rows out-compete 318 short program
      // rows, and cv has no point-read tool to complete the hop. The demo
      // DB has no vector index on purpose; the btree on doc_type narrows
      // the sort to the searchable rows and results are exact.
      try {
        const rows = await getDb()
          .select({
            text: knowledgeEntry.chunkText,
            sourceUrl: knowledgeEntry.sourceUrl,
            docType: knowledgeEntry.docType,
            name: sql<string | null>`${knowledgeEntry.facts}->>'name'`,
            courseCode: knowledgeEntry.courseCode,
            distance,
          })
          .from(knowledgeEntry)
          .where(inArray(knowledgeEntry.docType, SEARCHABLE_DOC_TYPES))
          .orderBy(distance)
          .limit(FETCH);

        const results = rows
          .filter((r) => Number(r.distance) <= OFF_CORPUS_FLOOR)
          .slice(0, TOP_K)
          .map((r) => {
            const isCourse = r.docType === "course";
            return {
              text: r.text,
              source_url: r.sourceUrl,
              doc_type: r.docType,
              name: isCourse ? null : r.name,
              course_code: isCourse ? r.courseCode : null,
            };
          });

        if (results.length === 0) {
          return { found: false };
        }
        return { found: true, results };
      } catch (error) {
        // A retrieval outage must not end the turn: the tool loop treats an
        // undefined return as a malformed result, and `next build` rejects
        // the implicit-undefined path outright (TS2366). Report "nothing
        // found" instead — the model then gives the standard fallback rather
        // than inventing an answer, which is the same behaviour as a genuine
        // zero-hit search.
        console.error(error);
        return { found: false };
      }
    },
  });
}
