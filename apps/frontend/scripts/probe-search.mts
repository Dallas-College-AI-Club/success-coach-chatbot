/**
 * End-to-end RAG probe for the local-MiniLM search path.
 *
 * Uses the SAME code path as production `search_knowledge`:
 *   - embedText() from lib/embedding-core (Xenova/all-MiniLM-L6-v2 int8 ONNX)
 *   - Drizzle cosine query on knowledge_entry via getDb()
 *   - Full doc_type search (course, program_map, section, syllabus, event)
 * Plus two dev-only extras:
 *   - vector_dims() diagnostic: prints Neon's actual stored width + row
 *     counts at startup, so a dim mismatch reads as a clear "your DB has
 *     768d rows, your query is 384d" message instead of a cryptic pgvector
 *     error.
 *   - Two modes: pass a query on the CLI for one-shot use, or run with no
 *     args for an interactive REPL loop that keeps the model warm between
 *     queries (subsequent queries are sub-100ms instead of ~2s).
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/probe-search.mts "your query"
 *   npx tsx --env-file=.env.local scripts/probe-search.mts    # interactive
 *
 * Requires DATABASE_URL (or DATABASE_URL_UNPOOLED) in .env.local.
 * Read-only: never writes to Neon.
 */

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { cosineDistance, inArray, sql } from "drizzle-orm";

import { getDb } from "../lib/client";
import { embedText } from "../lib/embedding-core";
import { knowledgeEntry } from "../lib/schema";

async function runDiagnostic() {
  console.log("\n== Neon vector-dims diagnostic ==");
  try {
    const db = getDb();
    // Raw SQL: pgvector's vector_dims() is not exposed via Drizzle helpers.
    const rows = await db.execute<{ dims: number; count: number }>(sql`
      SELECT vector_dims(embedding) AS dims, COUNT(*)::int AS count
      FROM knowledge_entry
      GROUP BY vector_dims(embedding)
      ORDER BY count DESC
    `);
    const list = Array.isArray(rows)
      ? rows
      : ((rows as { rows?: unknown[] }).rows ?? []);
    if (list.length === 0) {
      console.log("  (knowledge_entry is empty)");
      return;
    }
    for (const row of list as { dims: number; count: number }[]) {
      const flag = Number(row.dims) === 384 ? "✓ aligned" : "⚠ MISMATCH";
      console.log(
        `  stored=${row.dims}d  rows=${Number(row.count).toLocaleString()}  ${flag}`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  diagnostic failed: ${msg}`);
  }
}

async function runSearch(query: string) {
  console.log(`\n> query: ${JSON.stringify(query)}`);
  console.log("  embedding via Xenova/all-MiniLM-L6-v2 (int8 ONNX)...");
  const t0 = Date.now();
  const raw = await embedText(query);
  const embedding = Array.from(raw) as number[];
  console.log(
    `  vec: ${embedding.length}-dim, embed took ${Date.now() - t0}ms`,
  );
  if (embedding.length !== 384) {
    console.error(
      `\n! embedText returned ${embedding.length} dims, not 384. Check lib/embedding-core.ts.`,
    );
    return;
  }

  const distance = cosineDistance(knowledgeEntry.embedding, embedding);
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
    .where(
      inArray(knowledgeEntry.docType, [
        "course",
        "program_map",
        "section",
        "syllabus",
        "event",
      ]),
    )
    .orderBy(distance)
    .limit(3);

  if (rows.length === 0) {
    console.log(
      "\n(no rows returned — doc_type filter may have excluded everything, or the DB is empty)",
    );
    return;
  }

  console.log(
    "\nTop 3 hits (distance = cosine distance, lower = more similar):",
  );
  rows.forEach((r, i) => {
    const d = Number(r.distance);
    const sim = 1 - d;
    console.log(
      `\n  [${i + 1}] distance=${d.toFixed(4)}  similarity=${sim.toFixed(4)}  doc_type=${r.docType}`,
    );
    if (r.courseCode) console.log(`      course_code: ${r.courseCode}`);
    if (r.name) console.log(`      name:        ${r.name}`);
    console.log(`      source_url:  ${r.sourceUrl}`);
    const text = (r.text ?? "").replace(/\s+/g, " ").trim();
    console.log(
      `      chunk:       ${text.slice(0, 240)}${text.length > 240 ? "…" : ""}`,
    );
  });
  console.log();
}

async function interactiveLoop() {
  const rl = readline.createInterface({ input, output });
  try {
    // Warm the model once. First embedText() call downloads and loads
    // ONNX weights (~2s cold). Every subsequent call is sub-100ms.
    console.log("\nWarming model (first-time weight load ~2s)...");
    await embedText("warmup");
    console.log("Model warm. Type a query to search, blank line or 'q' to exit.");

    await runDiagnostic();

    // The loop: prompt, search, repeat. Model stays hot the whole time.
    while (true) {
      const answer = (
        await rl.question("\n> Enter a search prompt (blank/q to quit): ")
      ).trim();
      if (!answer || answer.toLowerCase() === "q" || answer.toLowerCase() === "quit") {
        console.log("\nBye.\n");
        return;
      }
      await runSearch(answer);
    }
  } finally {
    rl.close();
  }
}

async function main() {
  const cliArgs = process.argv.slice(2).join(" ").trim();
  if (cliArgs) {
    // One-shot mode: query on CLI, run once, exit. Useful for scripts.
    await runDiagnostic();
    await runSearch(cliArgs);
    process.exit(0);
  }
  // Interactive REPL: prompt in a loop, keep the model warm.
  await interactiveLoop();
  process.exit(0);
}

main().catch((err) => {
  console.error("\nPROBE FAILED:", err);
  process.exit(1);
});
