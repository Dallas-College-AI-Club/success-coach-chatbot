import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { count, sql as query } from "drizzle-orm";
import { chatSession, knowledgeEntry } from "../../lib/schema.ts";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  console.log("Drizzle starting");

  const db = drizzle(neon(databaseUrl), {
  schema: { knowledgeEntry, chatSession },
});

  const result = await Promise.race([
    db.execute(query`SELECT 1 AS ok`),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Drizzle query timed out after 10 seconds")),
        10_000,
      ),
    ),
  ]);

  console.log("Drizzle connection: OK", result);
  const [knowledgeCount] = await db
  .select({ total: count() })
  .from(knowledgeEntry);

  const [sessionCount] = await db
  .select({ total: count() })
  .from(chatSession);

console.log("knowledge_entry rows:", knowledgeCount.total);
console.log("chat_session rows:", sessionCount.total);
console.log("No database changes were made.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});