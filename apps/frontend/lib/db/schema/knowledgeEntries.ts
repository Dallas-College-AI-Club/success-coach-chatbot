import {
  pgTable,
  bigint,
  text,
  timestamp,
  jsonb,
  customType,
  integer,
} from "drizzle-orm/pg-core";
import { sql, type InferSelectModel, type InferInsertModel } from "drizzle-orm";

// Custom type helper for halfvec(768) vector columns
const halfvec768 = customType<{ data: number[] }>({
  dataType() {
    return "halfvec(768)";
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: unknown): number[] {
    return typeof value === "string" ? JSON.parse(value) : (value as number[]);
  },
});

// Custom type helper for tsvector search columns
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const knowledgeEntries = pgTable("knowledge_entry", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity(),
  sourceUrl: text("source_url").notNull(),
  chunkIdentity: text("chunk_identity").notNull(),
  contentHash: text("content_hash").notNull(),
  content: text("content").notNull(),
  facts: jsonb("facts"),
  metadata: jsonb("metadata"),
  embedding: halfvec768("embedding").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  // Generated Columns
  termOrder: integer("term_order").generatedAlwaysAs(
    sql`((metadata ->> 'term_order'::text))::integer`
  ),
  eventTimestamp: timestamp("event_timestamp", { withTimezone: true }).generatedAlwaysAs(
    sql`((metadata ->> 'event_timestamp'::text))::timestamp with time zone`
  ),
  searchVector: tsvector("search_vector").generatedAlwaysAs(
    sql`to_tsvector('english'::regconfig, content)`
  ),
});

// Inferred TypeScript Types
export type SelectKnowledgeEntry = InferSelectModel<typeof knowledgeEntries>;
export type InsertKnowledgeEntry = InferInsertModel<typeof knowledgeEntries>;