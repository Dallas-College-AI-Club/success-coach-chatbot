// Values that are NOT configuration. Each is either a contract with data
// already written to the database, or a fact about Dallas College — an env
// override would not be a setting, it would be a way to silently break a
// working system.
//
// No imports on purpose: client components import this without dragging in
// the DB client (same rule as lib/tools/names.ts).

/**
 * The embedding contract — with the vectors already in knowledge_entry,
 * written by apps/data/dallasai/pipeline/embed_rows.py with this model, at
 * this width, through this gateway. Deliberately not LLM_BASE_URL /
 * LLM_MODEL: the chat model is a choice, but a query vector from a different
 * embedding model is not cosine-comparable with the stored ones — ranking
 * degrades to noise with no error. Changing any of these three means
 * re-embedding the corpus first.
 */
export const EMBED_BASE_URL = "https://openrouter.ai/api/v1";
export const EMBED_MODEL = "openai/text-embedding-3-small";
/** Must equal the halfvec width in lib/schema.ts and in the Alembic DDL. */
export const EMBED_DIMS = 768;

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
