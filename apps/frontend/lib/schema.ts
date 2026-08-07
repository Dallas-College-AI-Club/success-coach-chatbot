/**
 * Drizzle MIRROR of the database schema — issue #114.
 *
 * This file defines nothing in the database. It is a hand-written TypeScript
 * mirror of the Alembic-owned schema so Next.js code gets typed reads/writes.
 *
 * Sources of truth (in order):
 *   1. apps/data/dallasai/models/knowledge_entry.py + chat_session.py (SQLAlchemy)
 *   2. apps/data/alembic/ migrations (the only thing that runs DDL)
 *   3. apps/data/reference/db/schema.sql (readable reference this file follows)
 *   See docs/DATABASE_ARCHITECTURE.md §8.
 *
 * Rules:
 *   - Never edit this file except to match a merged Alembic migration.
 *   - drizzle-kit must NEVER be installed or run (no push/migrate/introspect);
 *     a generated migration from this mirror would fight Alembic.
 *   - Column, constraint, and index names are byte-identical to the DDL so the
 *     two files can be reviewed side by side.
 */
import { sql } from "drizzle-orm";
import {
  pgTable, bigint, integer, smallint, text, timestamp,
  jsonb, uuid, halfvec, customType, index, unique, check,
} from "drizzle-orm/pg-core";

// Drizzle has no native tsvector type; generated + never written by TS code.
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

// ============================================================================
// Table 1 · knowledge_entry — everything the chatbot knows
// One row per retrievable unit: prose chunks (facts NULL) and fact rows,
// discriminated by metadata->>'doc_type'.
// ============================================================================
export const knowledgeEntry = pgTable(
  "knowledge_entry",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),

    // provenance / citation / idempotent ingest ------------------------------
    sourceUrl: text("source_url").notNull(), // citation URL or pseudo-URI (#facts, #<catalog_year>, …)
    chunkIndex: integer("chunk_index").notNull().default(0),
    contentHash: text("content_hash").notNull(), // deliberately NON-unique
    scrapedAt: timestamp("scraped_at", { withTimezone: true }).notNull().defaultNow(),

    // payload -----------------------------------------------------------------
    chunkText: text("chunk_text").notNull(),
    // TODO: per-doc_type facts types from src/config/facts-schemas
    facts: jsonb("facts").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    // 768 dims frozen project-wide: must match the embedding model used by BOTH
    // the Python pipeline (ingest) and the Next.js API route (queries).
    embedding: halfvec("embedding", { dimensions: 768 }).notNull(),

    // promoted filter surface (GENERATED from metadata ⇒ cannot drift) ---------
    docType: text("doc_type").generatedAlwaysAs(sql`metadata->>'doc_type'`),
    module: text("module").generatedAlwaysAs(sql`metadata->>'module'`),
    // normalized to 'ENGL 1302' no matter how the source wrote it
    courseCode: text("course_code").generatedAlwaysAs(
      sql`upper(trim(regexp_replace(regexp_replace(metadata->>'course_code', '([A-Za-z])([0-9])', '\\1 \\2'), '[^A-Za-z0-9]+', ' ', 'g')))`,
    ),
    programCode: text("program_code").generatedAlwaysAs(sql`upper(metadata->>'program_code')`),
    year: integer("year").generatedAlwaysAs(sql`((metadata->>'year'))::integer`),
    semester: text("semester").generatedAlwaysAs(sql`lower(metadata->>'semester')`),
    termOrd: smallint("term_ord").generatedAlwaysAs(
      sql`(((metadata->>'year'))::integer * 10 + CASE lower(metadata->>'semester') WHEN 'spring' THEN 1 WHEN 'may' THEN 2 WHEN 'summer' THEN 3 WHEN 'fall' THEN 4 WHEN 'winter' THEN 5 END)::smallint`,
    ),
    catalogYear: text("catalog_year").generatedAlwaysAs(sql`metadata->>'catalog_year'`),
    eventStartsAt: timestamp("event_starts_at", { withTimezone: true }).generatedAlwaysAs(
      sql`to_timestamp((metadata->>'event_start_epoch')::bigint)`,
    ),
    // professor is display-only; instructor_slug is the stable join key
    professor: text("professor").generatedAlwaysAs(sql`metadata->>'professor'`),
    instructorSlug: text("instructor_slug").generatedAlwaysAs(sql`metadata->>'instructor_slug'`),
    // keyword leg of hybrid search
    chunkTsv: tsvector("chunk_tsv").generatedAlwaysAs(sql`to_tsvector('english', chunk_text)`),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // bumped only when content_hash changes; scraped_at bumps on every verification
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_knowledge_entry_source_chunk").on(t.sourceUrl, t.chunkIndex),

    // write-time validation backstops (primary validation is in the pipeline)
    check("ck_ke_doc_type", sql`metadata->>'doc_type' IS NOT NULL`),
    check(
      "ck_ke_semester",
      sql`metadata->>'semester' IS NULL OR lower(metadata->>'semester') IN ('fall','spring','summer','winter','may')`,
    ),
    check(
      "ck_ke_year",
      sql`(metadata->>'year') IS NULL OR (metadata->>'year')::integer BETWEEN 2020 AND 2035`,
    ),

    index("ix_ke_embedding")
      .using("hnsw", t.embedding.op("halfvec_cosine_ops"))
      .with({ m: 16, ef_construction: 64 }),
    index("ix_ke_tsv").using("gin", t.chunkTsv),
    index("ix_ke_metadata").using("gin", t.metadata.op("jsonb_path_ops")),
    index("ix_ke_course").on(t.courseCode, t.docType, t.catalogYear),
    index("ix_ke_program").on(t.programCode, t.docType, t.catalogYear),
    index("ix_ke_doc_mod").on(t.docType, t.module),
    index("ix_ke_term").on(t.year, t.semester),
    index("ix_ke_instructor").on(t.instructorSlug),
    index("ix_ke_event_start").on(t.eventStartsAt).where(sql`doc_type = 'event'`),
  ],
);

// ============================================================================
// Table 2 · chat_session — anonymous student profiles + chat telemetry
// Server-side analytics/eval log; live chat history is client localStorage.
// Every value written here is PII-scrubbed upstream.
// ============================================================================

/** Durable onboarding answers — the profile allowlist (registry `profile_keys`). */
export type ChatSessionProfile = Partial<{
  campus: string;
  major: string;
  student_type: string;
  transfer_direction: string;
  intl_status: string;
  target_institution: string;
  modality_pref: string;
  dayparts_pref: string[];
  interest_area: string;
  oneoff_purpose: string;
}>;

export const chatSession = pgTable(
  "chat_session",
  {
    id: uuid("id").primaryKey(), // client-generated (crypto.randomUUID()) — no DB default
    // pseudonymous localStorage uuid; nullable, deliberately NOT a foreign key
    studentId: uuid("student_id"),
    profile: jsonb("profile").$type<ChatSessionProfile>(),
    // append-only per-turn events (src/config/telemetry-event.schema.json)
    history: jsonb("history")
      .$type<Record<string, unknown>[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    messageCount: integer("message_count")
      .generatedAlwaysAs(sql`jsonb_array_length(history)`)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }), // set by the weekly archive job
  },
  (t) => [
    // NOTE known drift: the deployed SQLAlchemy model still allowlists only
    // {campus, major, student_type}; schema.sql + registry profile_keys say 10.
    // This mirrors the documented 10-key target — reconcile when the Alembic
    // fix for the allowlist lands.
    check(
      "ck_cs_profile_allowlist",
      sql`profile IS NULL OR profile - 'campus' - 'major' - 'student_type' - 'transfer_direction' - 'intl_status' - 'target_institution' - 'modality_pref' - 'dayparts_pref' - 'interest_area' - 'oneoff_purpose' = '{}'::jsonb`,
    ),
    check("ck_cs_history_cap", sql`jsonb_array_length(history) <= 200`),

    index("ix_cs_student").on(t.studentId),
    index("ix_cs_archive").on(t.updatedAt).where(sql`archived_at IS NULL`),
  ],
);

// inferred row types ----------------------------------------------------------
export type KnowledgeEntry = typeof knowledgeEntry.$inferSelect;
export type NewKnowledgeEntry = typeof knowledgeEntry.$inferInsert;
export type ChatSession = typeof chatSession.$inferSelect;
export type NewChatSession = typeof chatSession.$inferInsert;
