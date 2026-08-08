import type {
  NewChatSession,
  NewKnowledgeEntry,
} from "../../lib/schema.ts";

declare const knowledgeEntry: NewKnowledgeEntry;
declare const chatSession: NewChatSession;

// @ts-expect-error PostgreSQL generates the identity column
knowledgeEntry.id = 1;

// @ts-expect-error PostgreSQL generates courseCode
knowledgeEntry.courseCode = "ENGL1302";

// @ts-expect-error PostgreSQL generates messageCount
chatSession.messageCount = 0;