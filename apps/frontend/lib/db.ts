/**
 * Centralized database client for the Next.js app.
 *
 * There are two main ways to talk to Postgres here (both go through the *pooled*
 * `DATABASE_URL` whose host contains `-pooler`):
 *
 *   - `db`         — Strongly typed Drizzle ORM client (neon-http driver).
 *                    Preferred for type-safe queries, AI tool executions, and ORM operations.
 *   - `sql`        — Raw stateless HTTP client for one-shot raw SQL queries.
 *   - `getPool()`  — WebSocket connection pool for work needing a real session
 *                    (e.g. multi-statement transactions). Reuses one pool per runtime.
 *
 * Migrations and bulk ingest do NOT use this file — they run from Python
 * against the *unpooled* `DATABASE_URL_UNPOOLED`. See the repo README for details.
 */
import { neon, neonConfig, Pool } from "@neondatabase/serverless"
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http"
import ws from "ws"
import * as schema from "./db/schema"

// The connection Pool talks WebSockets. Edge runtimes and Node 22+ expose a
// global `WebSocket`; Node 20.x does not, so supply one.
if (typeof globalThis.WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws
}

function connectionString(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and paste the " +
        "pooled Neon connection string (its host ends in `-pooler`).",
    )
  }
  return url
}

// Cache the clients on `globalThis` so Next.js dev hot-reloads and reused
// serverless invocations don't open fresh clients or leak pool connections.
type DbGlobal = {
  sql?: ReturnType<typeof neon>
  db?: NeonHttpDatabase<typeof schema>
  pool?: Pool
  hooksRegistered?: boolean
}
const globalForDb = globalThis as unknown as { __dallasDb?: DbGlobal }
const cache: DbGlobal = (globalForDb.__dallasDb ??= {})

/**
 * Raw HTTP query client — use for single raw SQL queries.
 */
export const sql = (cache.sql ??= neon(connectionString()))

/**
 * Primary strongly typed Drizzle ORM client instance.
 * Import this for tool executions, services, and type-safe DB queries.
 *
 * Example:
 *   import { db } from "@/lib/db"
 *   import { knowledgeEntries } from "@/lib/db/schema"
 *   const rows = await db.select().from(knowledgeEntries)
 */
export const db = (cache.db ??= drizzle(sql, { schema }))

/**
 * Lazily create (and then reuse) the WebSocket pool for transactions and other
 * session-bound work.
 */
export function getPool(): Pool {
  return (cache.pool ??= new Pool({ connectionString: connectionString() }))
}

/** Safe disconnection hook — drain the pool on shutdown. Idempotent. */
export async function closePool(): Promise<void> {
  const pool = cache.pool
  if (pool) {
    cache.pool = undefined
    await pool.end()
  }
}

// Drain the pool cleanly when the process is going away.
if (
  !cache.hooksRegistered &&
  typeof process !== "undefined" &&
  typeof process.on === "function"
) {
  cache.hooksRegistered = true
  const shutdown = () => {
    void closePool()
  }
  process.on("beforeExit", shutdown)
  process.on("SIGTERM", shutdown)
  process.on("SIGINT", shutdown)
}