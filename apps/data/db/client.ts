/**
 * THE TypeScript connection module (ADR-008's one-file adapter).
 *
 * Every TS/JS consumer — the future chatbot API, admin scripts — imports the
 * pool from here. No other file may create a connection. Exit off Neon stays
 * a config change: pg_dump -> pg_restore -> repoint the settings.
 *
 * Settings come from the environment (git-ignored .env loaded via dotenv —
 * see .env.example):
 *
 *   DATABASE_URL  full connection string (Neon dashboard -> Connect)
 *   — or the standard libpq variables (PGHOST, PGPORT, PGUSER, PGPASSWORD,
 *     PGDATABASE), which node-postgres honors when DATABASE_URL is unset.
 *   DB_POOL_MAX   pool ceiling (default 5)
 *
 * Usage:
 *   import { pool, closePool } from "./db/client";
 *   const { rows } = await pool.query("SELECT count(*) FROM sections");
 *   await closePool();          // on shutdown (also wired to SIGINT/SIGTERM)
 */

import "dotenv/config";
import pg from "pg";

function buildConfig(): pg.PoolConfig {
  const max = Number(process.env.DB_POOL_MAX ?? 5);
  const url = (process.env.DATABASE_URL ?? "").trim();
  if (url) return { connectionString: url, max };
  if (!process.env.PGHOST && !process.env.PGDATABASE) {
    throw new Error(
      "No database settings found: set DATABASE_URL or the PG* variables " +
        "in your environment/.env (see .env.example).",
    );
  }
  return { max }; // node-postgres falls back to PG* environment variables
}

export const pool = new pg.Pool(buildConfig());

let closed = false;

/** Drain and close the pool; safe to call more than once. */
export async function closePool(): Promise<void> {
  if (!closed) {
    closed = true;
    await pool.end();
  }
}

// Shutdown hygiene: close cleanly on SIGINT/SIGTERM and at loop exit.
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.once(sig, () => {
    void closePool().finally(() => process.exit(sig === "SIGINT" ? 130 : 143));
  });
}
process.once("beforeExit", () => {
  void closePool();
});
