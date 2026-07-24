/**
 * Centralized database client for the Next.js app.
 *
 * There are two ways to talk to Postgres here, and both go through the *pooled*
 * `DATABASE_URL` (the Neon connection string whose host contains `-pooler`):
 *
 *   - `sql`        — a stateless HTTP client for one-shot queries. This is the
 *                    default for API route handlers: every query is a single
 *                    HTTPS request, connection pooling is handled server-side by
 *                    Neon's pooler, and there is nothing to close.
 *   - `getPool()`  — a WebSocket connection pool for work that needs a real
 *                    session, e.g. a multi-statement transaction. Reuses one
 *                    pool per runtime; call `closePool()` to drain it on
 *                    shutdown.
 *
 * Migrations and bulk ingest do NOT use this file — they run from Python
 * against the *unpooled* `DATABASE_URL_UNPOOLED`. See the repo README
 * ("Which connection string does what") for the split.
 */
import { neon, neonConfig, Pool } from "@neondatabase/serverless"
import ws from "ws"

// The connection Pool talks WebSockets. Edge runtimes and Node 22+ expose a
// global `WebSocket`; the Node 20.x we also support does not, so supply one.
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
// serverless invocations don't open a fresh client — or leak pool connections —
// on every request.
type DbGlobal = {
  sql?: ReturnType<typeof neon>
  pool?: Pool
  hooksRegistered?: boolean
}
const globalForDb = globalThis as unknown as { __dallasDb?: DbGlobal }
const cache: DbGlobal = (globalForDb.__dallasDb ??= {})

/**
 * HTTP query client — use for the common case of one query per request.
 * Tagged-template values are parameterized (injection-safe):
 *
 *   const rows = await sql`SELECT * FROM knowledge_entry WHERE id = ${id}`
 */
export const sql = (cache.sql ??= neon(connectionString()))

/**
 * Lazily create (and then reuse) the WebSocket pool for transactions and other
 * session-bound work:
 *
 *   const pool = getPool()
 *   const client = await pool.connect()
 *   try {
 *     await client.query("BEGIN")
 *     // ...
 *     await client.query("COMMIT")
 *   } finally {
 *     client.release()
 *   }
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

// Drain the pool cleanly when the process is going away. Guarded so it only runs
// in a Node runtime (serverless/edge isolates are torn down for us) and only
// registers the listeners once, even across dev hot-reloads.
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
