import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/client";
import { knowledgeEntry } from "@/lib/schema";
import { readSyllabusLink, type SyllabusLink } from "@/lib/syllabus-links";

/** Public, metadata-only corrections for sections saved before the update.
 * One cached response serves every card; no student data or model call. */
export async function GET() {
  try {
    const rows = await getDb()
      .select({
        source: knowledgeEntry.sourceUrl,
        link: sql<unknown>`${knowledgeEntry.metadata}->'syllabus_link'`,
      })
      .from(knowledgeEntry)
      .where(
        and(
          eq(knowledgeEntry.docType, "section"),
          eq(knowledgeEntry.year, 2026),
          eq(knowledgeEntry.semester, "fall"),
          sql`${knowledgeEntry.metadata}->'syllabus_link'->>'kind' = 'direct'`,
        ),
      )
      .limit(15000);
    const links: Record<string, SyllabusLink> = {};
    const ambiguous = new Set<string>();
    for (const row of rows) {
      const link = readSyllabusLink(row.link);
      if (!link) continue;
      if (links[row.source] && links[row.source].url !== link.url)
        ambiguous.add(row.source);
      links[row.source] = link;
    }
    for (const source of ambiguous) delete links[source];
    return Response.json(links, {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate, s-maxage=600",
      },
    });
  } catch {
    // The official library remains usable if the database is unavailable.
    return Response.json(
      {},
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
