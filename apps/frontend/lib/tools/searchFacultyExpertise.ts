import { and, eq, or, sql } from "drizzle-orm";
import z from "zod";
import { getDb } from "@/lib/client";
import { knowledgeEntry } from "@/lib/schema";

export const DESCRIPTION =
  "Find every saved faculty CV with explicit evidence for the requested topics. Use this for 'all professors with machine learning or LLM experience', not semantic top-k search. Pass separate topics and match:any for OR or match:all for AND. Matches cite literal CV evidence, not inferred expertise or teaching quality. Complete means all matching indexed CVs, not all Dallas College faculty. Evidence includes the venue names printed in a CV's publication list, labelled as publication evidence. Results are ordered by surname; keep that order. The interface displays the entire result with Show more; do not replace it with a sample.";
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

/** Publication evidence is source text, so it is labelled, not merged into
 *  experience. A full entry names the paper; a sample names only its venue. */
export const VENUE_PREFIX = "Publication venue: ";
export const PUBLICATION_PREFIX = "Publication: ";

// Suffixes and surname particles, normalised without dots: "Ph.D." -> "phd".
const NAME_SUFFIXES = new Set([
  "jr",
  "sr",
  "ii",
  "iii",
  "iv",
  "v",
  "phd",
  "edd",
  "md",
  "dds",
  "dnp",
  "jd",
  "mba",
  "mfa",
  "rn",
  "cpa",
  "esq",
]);
// Particles belong to the surname ("van der Berg", "De La Cruz"). Deliberately
// short: tokens that double as given names ("Al", "St") would mis-split more
// names than they would fix.
const NAME_PARTICLES = new Set([
  "van",
  "von",
  "der",
  "den",
  "de",
  "del",
  "della",
  "di",
  "da",
  "das",
  "dos",
  "du",
  "la",
  "le",
  "los",
  "ter",
  "ten",
  "bin",
  "ibn",
]);

/** Split a printed name into surname / given names, or null when it is one token. */
function nameParts(raw: string) {
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name) return null;
  // Already stored "Last, First" — trust the printed order, never re-split it.
  const comma = name.indexOf(",");
  if (comma > 0)
    return {
      surname: name.slice(0, comma).trim(),
      given: name.slice(comma + 1).trim(),
      suffixes: [] as string[],
      inverted: true,
    };
  const tokens = name.split(" ");
  const suffixes: string[] = [];
  const bare = (t: string) => t.toLowerCase().replace(/\./g, "");
  while (
    tokens.length > 2 &&
    NAME_SUFFIXES.has(bare(tokens[tokens.length - 1]))
  )
    suffixes.unshift(tokens.pop() as string);
  let start = tokens.length - 1;
  // start > 1 keeps at least one given name, so "Al Smith" never becomes a surname.
  while (start > 1 && NAME_PARTICLES.has(tokens[start - 1].toLowerCase()))
    start--;
  return {
    surname: tokens.slice(Math.max(start, 0)).join(" "),
    given: tokens.slice(0, Math.max(start, 0)).join(" "),
    suffixes,
    inverted: false,
  };
}

/** Sort key: surname first, because that is how a faculty list is read. */
export function surnameSortKey(name: string): string {
  const parts = nameParts(name);
  if (!parts) return "";
  // Particles sort as printed ("van der Berg" under V), which is what a reader
  // scanning the rendered list expects.
  return `${parts.surname} ${parts.given}`
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** "Bracewell, David" — the label that makes a surname-sorted list look sorted. */
export function directoryName(name: string): string {
  const printed = name.replace(/\s+/g, " ").trim();
  const parts = nameParts(printed);
  if (!parts || parts.inverted || !parts.given) return printed;
  return `${parts.surname}, ${[parts.given, ...parts.suffixes].join(" ")}`;
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
  // Extraction censuses publications into {count, years, venues_sample}, so the
  // sampled venue names were long the only publication evidence left — and they
  // sit under no raw_text/evidence key. Where the full list has since been
  // recovered verbatim from the source CV it is stored as publications.entries,
  // which supersedes the sample: an entry carries the paper's title as well as
  // its venue, so "A Machine Learning Approach to ..." becomes findable. Both
  // are copied from the CV, not model-written, so scanning them keeps grounding
  // intact; derived_profile and every generated summary stay excluded.
  const entries = sql<
    string[]
  >`jsonb_path_query_array(${knowledgeEntry.facts}, '$.publications.entries[*]')`;
  const venues = sql<
    string[]
  >`case when jsonb_array_length(${entries}) > 0 then '[]'::jsonb
         else jsonb_path_query_array(${knowledgeEntry.facts}, '$.publications.venues_sample[*]') end`;
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
        entries,
        venues,
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
              (word) =>
                sql`strpos(lower((${evidence} || ${entries} || ${venues})::text), ${word}) > 0`,
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
    entries?: unknown;
  venues?: unknown;
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
          ...(Array.isArray(row.entries) ? row.entries : [])
            .filter((s): s is string => typeof s === "string")
            .map((entry) => `${PUBLICATION_PREFIX}${entry}`),
          ...(Array.isArray(row.venues) ? row.venues : [])
            .filter((s): s is string => typeof s === "string")
            .map((venue) => `${VENUE_PREFIX}${venue}`),
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
      // The interface labels rows from display_name, so the tool owns the
      // surname rule and the two orderings cannot drift apart.
      return result
        ? [{ ...profile, display_name: directoryName(profile.name), ...result }]
        : [];
    })
    .sort(
      (a, b) =>
        // By surname: a faculty list is read and remembered by last name, and
        // the full-name sort put Adriana Badulescu before Casandra Toler by
        // first name. The interface labels rows the same way.
        surnameSortKey(a.name).localeCompare(surnameSortKey(b.name), "en") ||
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
