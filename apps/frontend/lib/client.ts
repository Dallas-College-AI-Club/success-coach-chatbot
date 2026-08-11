import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
// Lazily initialised on first query, NOT at import. The old module-scope
// throw took down the entire /api/chat bundle (including the pure clock
// tools) whenever DATABASE_URL was unset, and broke `next build`'s
// page-data collection on any machine without an env file — CI only passes
// because it stubs the URL. neon() opens no connection, so deferring the
// check costs nothing: a missing URL still fails with the same message,
// just per-query instead of per-process.
function makeDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is missing from environment variables");
  }
  return drizzle(neon(url));
}

// Cached on globalThis, not a module-local: in dev, HMR re-evaluates modules
// on every edit, so a module-scoped memo is discarded each time. One instance
// per process keeps behaviour identical between dev and production.
const globalForDb = globalThis as unknown as {
  __successCoachDb?: ReturnType<typeof makeDb>;
};

export function getDb(): ReturnType<typeof makeDb> {
  return (globalForDb.__successCoachDb ??= makeDb());
}
