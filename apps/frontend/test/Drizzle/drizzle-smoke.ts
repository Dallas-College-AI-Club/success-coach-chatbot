import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  cosineDistance,
  count,
  desc,
  sql as query,
} from "drizzle-orm";
import {
  chatSession,
  knowledgeEntry,
} from "../../lib/schema.ts";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  console.log("Drizzle starting");

  const db = drizzle(neon(databaseUrl), {
    schema: {
      knowledgeEntry,
      chatSession,
    },
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

  const [knowledgeSample] = await db
    .select({
      courseCode: knowledgeEntry.courseCode,
    })
    .from(knowledgeEntry)
    .limit(1);

  const [sessionSample] = await db
    .select({
      messageCount: chatSession.messageCount,
    })
    .from(chatSession)
    .limit(1);

  console.log("knowledge_entry rows:", knowledgeCount.total);
  console.log("chat_session rows:", sessionCount.total);

  console.log("Generated column reads: OK", {
    courseCode: knowledgeSample?.courseCode,
    messageCount: sessionSample?.messageCount,
  });

  const probeEmbedding = [
    1,
    ...Array.from({ length: 767 }, () => 0),
  ];

  const similarity = query<number>`1 - (${cosineDistance(
  knowledgeEntry.embedding,
  probeEmbedding,
  )})`;

  const vectorSample = await db
    .select({
      id: knowledgeEntry.id,
      similarity,
    })
    .from(knowledgeEntry)
    .orderBy(desc(similarity))
    .limit(1);

  console.log(
    "Vector similarity query: OK",
    vectorSample.length > 0,
  );

  console.log("No database changes were made.");
}

main().catch((error) => {
  console.error(
    "Drizzle smoke test failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});