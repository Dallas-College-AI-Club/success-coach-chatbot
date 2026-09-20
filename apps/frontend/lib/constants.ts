// Values that are NOT configuration. Each is either a contract with data
// already written to the database, or a fact about Dallas College — an env
// override would not be a setting, it would be a way to silently break a
// working system.
//
// Client-safe: the shared JSON contract does not import the database runtime.

/** The query encoder contract is reusable by data ingestion. Changing it
 * requires reviewed corpus re-embedding, not a metadata-only correction. */
import embeddingContract from "./embedding-contract.json";
export const EMBED_MODEL = embeddingContract.model;
/** Must equal the halfvec width in lib/schema.ts and the generated SQL baseline. */
export const EMBED_DIMS = embeddingContract.dimensions;

/**
 * The doc_types search_knowledge reads. A type belongs here only if either a
 * point-read tool can verify its hits (course → get_course_info, program_map
 * → get_program_requirements) or its chunk text is itself the verified answer
 * (resource — the curated student-resources corpus, which has no follow-up
 * tool by design). section and cv stay out: measured live (2026-08-11), dense
 * CV rows out-compete short program rows and strand the model with hits it
 * cannot verify.
 *
 * Search runs as an EXACT scan: the btree on doc_type narrows to the ~1.9k
 * searchable rows, then distances sort (measured 61ms over a 33k-row corpus,
 * 2026-08-21). The demo DB deliberately carries NO HNSW index — approximate
 * scans reproducibly missed the small resource cluster (true rank-1 hits at
 * distance 0.53 absent from the candidate list even at ef_search=150), and
 * at this scale exactness costs nothing. Revisit only if the searchable
 * corpus grows by an order of magnitude — and then verify recall for every
 * doc_type before trusting an index.
 */
export const SEARCHABLE_DOC_TYPES = ["course", "program_map", "resource"];

/**
 * Dallas College's zone: every "today" the tools resolve is Dallas local
 * time, not the server's. Mirrors DISPLAY_TIMEZONE in src/config/runtime.json,
 * which cannot be imported here — the bundler roots the module graph at
 * apps/frontend, so a repo-root import type-checks but fails `next build`.
 */
export const DALLAS_COLLEGE_TIME_ZONE = "America/Chicago";

/**
 * Every host the verified corpus cites: the catalog serves course and
 * program_map rows; Concourse serves section/syllabus and cv rows. Both are
 * Dallas College systems. Add a host only when a row actually emits it.
 */
const CITATION_HOSTS: ReadonlySet<string> = new Set([
  "catalog.dallascollege.edu",
  "dallascollege.campusconcourse.com",
  "www.dallascollege.edu",
  "dallascollege.edu",
]);

/**
 * The only way a tool-result URL becomes an href.
 *
 * Exact host match via URL parsing rather than a string prefix, so
 * lookalike hosts cannot pass. Strips the fragment: catalog rows carry an
 * ingest marker (`#<catalog_year>#facts`) that resolves to no anchor and
 * leaks pipeline internals into the student's address bar.
 *
 * Returns null, never "", so callers have to branch.
 */
export function citationHref(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!CITATION_HOSTS.has(url.hostname)) return null;
  url.hash = "";
  url.username = "";
  url.password = "";
  return url.toString();
}

/**
 * Concourse hosts both syllabi and CVs, and the point-read tools do not
 * return doc_type, so the label stays generic rather than claiming a
 * document kind the URL cannot confirm.
 */
export function citationLabel(href: string): string {
  // Parse rather than substring-search the href: a Concourse URL whose query
  // happens to contain the catalog host would otherwise be mislabelled.
  try {
    return new URL(href).hostname === "catalog.dallascollege.edu"
      ? "Catalog page ↗"
      : "Source page ↗";
  } catch {
    return "Source page ↗";
  }
}
