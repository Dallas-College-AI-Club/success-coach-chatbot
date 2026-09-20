import { and, eq, or, sql } from "drizzle-orm";
import z from "zod";
import { getDb } from "@/lib/client";
import { knowledgeEntry } from "@/lib/schema";

export const DESCRIPTION =
  "Find every saved faculty CV with explicit evidence for the requested topics. Use this for 'all professors with machine learning or LLM experience', not semantic top-k search. Pass separate topics and match:any for OR or match:all for AND. Matches cite literal CV evidence, not inferred expertise or teaching quality. Complete means all matching indexed CVs, not all Dallas College faculty. The interface displays the entire result with Show more; do not replace it with a sample.";
export const INPUT_SCHEMA = z.object({
  topics: z.array(z.string().trim().min(2).max(80)).min(1).max(6),
  match: z.enum(["any", "all"]).default("any"),
});

const synonyms: Record<string, string[]> = {
  "machine learning": ["machine learning", "ML"],
  "large language models": [
    "large language model",
    "large language models",
    "LLM",
    "LLMs",
  ],
  "natural language processing": ["natural language processing", "NLP"],
  "artificial intelligence": ["artificial intelligence", "AI"],
};

export function topicTerms(topic: string): { topic: string; terms: string[] } {
  const cleaned = topic.toLowerCase().replace(/\s+/g, " ").trim();
  for (const [name, terms] of Object.entries(synonyms)) {
    if (name === cleaned || terms.some((t) => t.toLowerCase() === cleaned))
      return { topic: name, terms };
  }
  return { topic: topic.trim(), terms: [topic.trim()] };
}

function matchesTerm(text: string, term: string): boolean {
  const escaped = term
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  // Substring matching would match 'LLM' inside 'enrollment'. C++ and C#
  // need non-word boundaries, not a trailing \b after punctuation.
  const regex = new RegExp(
    `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}+#])`,
    "giu",
  );
  const matches = [...text.matchAll(regex)];
  if (!matches.length) return false;
  if (/^(?:ML|LLMs?)$/i.test(term)) {
    return matches.some((match) => {
      const context = text.slice(
        Math.max(0, match.index - 150),
        match.index + 200,
      );
      return /machine|learning|model|artificial|intelligence|generative|\bAI\b|\bNLP\b|transformer/i.test(
        context,
      );
    });
  }
  return true;
}

export function matchFacultyEvidence(
  spans: string[],
  topics: string[],
  match: "any" | "all",
) {
  const unique = [
    ...new Set(spans.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean)),
  ];
  const requested = topics.map(topicTerms);
  const matched = requested
    .map(({ topic, terms }) => ({
      topic,
      spans: unique.filter((span) =>
        terms.some((term) => matchesTerm(span, term)),
      ),
    }))
    .filter((item) => item.spans.length);
  if (
    !matched.length ||
    (match === "all" && matched.length !== requested.length)
  )
    return null;
  return {
    topics: matched.map((item) => item.topic),
    evidence: [...new Set(matched.flatMap((item) => item.spans))],
  };
}

export const EXECUTE = async (input: z.infer<typeof INPUT_SCHEMA>) => {
  const { topics, match } = INPUT_SCHEMA.parse(input);
  // Search source evidence, not generated summaries/topic labels. The database
  // scans every CV; the cheap substring prefilter cannot omit a literal match.
  const evidence = sql<
    string[]
  >`jsonb_path_query_array(${knowledgeEntry.facts}, '$.**.raw_text') || jsonb_path_query_array(${knowledgeEntry.facts}, '$.**.evidence')`;
  const needles = [
    ...new Set(
      topics.flatMap((t) =>
        topicTerms(t).terms.map((term) => term.split(/\s+/)[0].toLowerCase()),
      ),
    ),
  ];
  const [rows, coverage] = await Promise.all([
    getDb()
      .select({
        name: sql<string>`${knowledgeEntry.facts}->>'name'`,
        source_url: knowledgeEntry.sourceUrl,
        evidence,
        identity: sql<
          string[]
        >`jsonb_path_query_array(${knowledgeEntry.facts}, '$.education[*].raw_text')`,
        scraped_at: knowledgeEntry.scrapedAt,
      })
      .from(knowledgeEntry)
      .where(
        and(
          eq(knowledgeEntry.docType, "cv"),
          or(
            ...needles.map(
              (word) => sql`strpos(lower((${evidence})::text), ${word}) > 0`,
            ),
          ),
        ),
      ),
    getDb()
      .select({
        total: sql<number>`count(*)::int`,
        oldest: sql<string>`min(${knowledgeEntry.scrapedAt})`,
        newest: sql<string>`max(${knowledgeEntry.scrapedAt})`,
      })
      .from(knowledgeEntry)
      .where(eq(knowledgeEntry.docType, "cv")),
  ]);
  const results = facultyProfiles(rows, topics, match);
  return {
    found: results.length > 0,
    topics: topics.map((t) => topicTerms(t).topic),
    match,
    total_matches: results.length,
    complete: true,
    indexed_cv_records: coverage[0]?.total ?? 0,
    oldest_source: coverage[0]?.oldest,
    newest_source: coverage[0]?.newest,
    coverage_note:
      "All matching indexed CVs, using explicit saved evidence and the listed keyword variants. Repeat CVs with identical names and education evidence are grouped with every source retained. Missing or unindexed experience cannot be ruled out. Source dates describe saved records, not current employment.",
    keyword_variants: topics.map(topicTerms),
    results,
  };
};

/** Stable grouping keeps every source and never merges names without education evidence. */
export function facultyProfiles(
  rows: {
    name: string | null;
    source_url: string;
    evidence: unknown;
    identity: unknown;
    scraped_at: unknown;
  }[],
  topics: string[],
  match: "any" | "all",
) {
  const profiles = new Map<
    string,
    {
      name: string;
      source_url: string;
      source_urls: string[];
      spans: string[];
      source_checked_at: string;
    }
  >();
  for (const row of [...rows].sort((a, b) =>
    a.source_url.localeCompare(b.source_url),
  )) {
    if (!row.name || !Array.isArray(row.evidence)) continue;
    const education = Array.isArray(row.identity)
      ? [
          ...new Set(
            row.identity
              .filter((s) => typeof s === "string")
              .map((s) => s.toLowerCase().replace(/\s+/g, " ").trim()),
          ),
        ]
          .filter(Boolean)
          .sort()
      : [];
    // Group repeat CVs only with the same published name AND education evidence.
    // Preserve every source; same-name records with different evidence stay separate.
    const key = `${row.name.toLowerCase().trim()}|${education.length ? JSON.stringify(education) : row.source_url.split("#")[0]}`;
    const previous = profiles.get(key);
    profiles.set(key, {
      name: previous?.name ?? row.name.trim(),
      source_url: previous?.source_url ?? row.source_url,
      source_urls: [
        ...new Set([...(previous?.source_urls ?? []), row.source_url]),
      ].sort(),
      spans: [
        ...new Set([
          ...(previous?.spans ?? []),
          ...row.evidence.filter((s): s is string => typeof s === "string"),
        ]),
      ].sort(),
      // This date belongs to the primary source, not an arbitrary later row.
      source_checked_at:
        previous?.source_checked_at ??
        (row.scraped_at instanceof Date
          ? row.scraped_at.toISOString()
          : String(row.scraped_at)),
    });
  }
  return [...profiles.values()]
    .flatMap(({ spans, ...profile }) => {
      const result = matchFacultyEvidence(spans, topics, match);
      return result ? [{ ...profile, ...result }] : [];
    })
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, "en") ||
        a.source_url.localeCompare(b.source_url),
    );
}

export function modelOutput(output: Awaited<ReturnType<typeof EXECUTE>>) {
  const { results, ...coverage } = output;
  return {
    ...coverage,
    // A name sample encouraged the model to repeat a partial list. Large
    // results are enumerated by the UI; the model needs the verified count.
    ...(results.length <= 10
      ? {
          results: results.map((r) => ({
            name: r.name,
            topics: r.topics,
            source_url: r.source_url,
          })),
        }
      : {}),
    display_note: `The interface has all ${results.length} matching profiles, with every name, source and evidence excerpt available through Show more. Give a brief count and coverage explanation. Do not write a separate name list or suggest only a sample is available.`,
  };
}
