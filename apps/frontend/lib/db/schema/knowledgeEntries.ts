import { pgTable, bigserial, text, jsonb } from "drizzle-orm/pg-core";

export const knowledgeEntries = pgTable("knowledge_entry", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  docType: text("doc_type"),
  courseCode: text("course_code"),
  facts: jsonb("facts"),
  metadata: jsonb("metadata"),
});