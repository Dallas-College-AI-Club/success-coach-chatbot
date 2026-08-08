# Drizzle Local Setup and Deployment Workflow

## Purpose

This document provides a verified workflow for configuring Drizzle ORM with Neon PostgreSQL in the Success Coach Chatbot project.

This workflow was validated using a live Neon database and a populated `knowledge_entry` table.

---

## Architecture Ownership

Database ownership is intentionally split as follows:

```text
SQLAlchemy Models
        ↓
Alembic Migrations
        ↓
PostgreSQL / Neon
        ↓
Drizzle Schema Mirror
        ↓
Next.js Runtime
```

Sources of truth:

1. SQLAlchemy models
2. Alembic migrations
3. apps/data/reference/db/schema.sql
4. Drizzle schema mirror

### Important

Alembic owns all schema migrations.

Do not install or use:

```text
drizzle-kit
drizzle-kit push
drizzle-kit migrate
drizzle-kit introspect
```

Drizzle exists only as a typed frontend access layer.

---

## Frontend Dependencies

Install frontend dependencies:

```bash
npm install
```

Required packages already present:

```text
drizzle-orm
@neondatabase/serverless
next
typescript
```

---

## Environment Configuration

Frontend environment file:

```text
apps/frontend/.env
```

or

```text
apps/frontend/.env.local
```

Required variable:

```env
DATABASE_URL=postgresql://<user>:<password>@<pooled-neon-host>/neondb?sslmode=require
```

### Common Mistake

Incorrect:

```env
OPENROUTER_API_KEY=...

postgresql://...
```

Correct:

```env
OPENROUTER_API_KEY=...

DATABASE_URL=postgresql://...
```

The connection string must be assigned to the `DATABASE_URL` variable.

---

## Pooled vs Direct Neon URLs

### Pooled Connection

Used by:

```text
Next.js
Drizzle ORM
Request-time application queries
```

Configured as:

```env
DATABASE_URL=...
```

The host contains:

```text
-pooler
```

### Direct Connection

Used by:

```text
Alembic
SQLAlchemy
Bulk ingestion
Administrative operations
```

Configured as:

```env
DATABASE_URL_UNPOOLED=...
```

Direct endpoints do not contain:

```text
-pooler
```

---

## Drizzle Runtime Client

Location:

```text
apps/frontend/lib/client.ts
```

Exports:

```ts
export const db = drizzle(sql, { schema });
```

Usage:

```ts
import { db } from "@/lib/client";
```

---

## Drizzle Schema Mirror

Location:

```text
apps/frontend/lib/schema.ts
```

The schema mirror provides type-safe access to Neon.

Do not modify independently of Alembic.

---

## Local Database Initialization

Initialize the database:

```bash
python -m dallasai.database --init
```

Expected output:

```text
✅ pgvector extension verified/enabled.
✅ Database tables ('knowledge_entry', 'chat_session') successfully initialized.
```

---

## Data Ingestion Workflow

Dataset source:

```text
Teams / SharePoint
```

Downloaded datasets are intentionally excluded from source control.

Example structure:

```text
2026-2027/
└── courses/
    ├── *.md
    └── *_clean.html
```

Run ingestion:

```bash
python -m dallasai.main -i .\downloaded-dataset\2026-2027\courses
```

Successful ingestion performs:

```text
Markdown / HTML
        ↓
Chunking
        ↓
Embeddings
        ↓
Validation
        ↓
load_into_neon()
        ↓
knowledge_entry
```

Observed validation:

```text
1001 source documents processed
knowledge_entry populated
```

---

## Smoke Test Verification

The following verification was successfully completed during local setup.

Run Next.js:

```bash
npm run dev
```

Create a temporary verification route that imports:

```ts
import { db } from "@/lib/client";
import { knowledgeEntry } from "@/lib/schema";
```

Execute:

```ts
await db
  .select({
    id: knowledgeEntry.id,
    sourceUrl: knowledgeEntry.sourceUrl,
    chunkText: knowledgeEntry.chunkText,
  })
  .from(knowledgeEntry)
  .limit(5);
```

Expected result:

```json
{
  "success": true,
  "count": 5
}
```

Actual verification succeeded and returned records from `knowledge_entry`.

Verified chain:

```text
DATABASE_URL loaded
        ↓
Drizzle initialized
        ↓
Neon connected
        ↓
knowledge_entry queried successfully
```

---

## Vercel Configuration

Configure:

```text
DATABASE_URL
```

using the pooled Neon connection string.

---

## Raw SQL Guidance

Preferred:

```text
Drizzle Query Builder
Drizzle Schema Types
```

Use raw SQL only as an escape hatch when Drizzle cannot express the required operation.

---

## Repository Hygiene

Never commit:

```text
.env
.env.local
downloaded-dataset/
.tmp/
```

SharePoint remains the approved distribution mechanism for cleaned datasets.

---

## Current Status

Verified:

```text
✅ Neon connectivity
✅ pgvector
✅ Database initialization
✅ Data ingestion
✅ knowledge_entry population
✅ Drizzle client initialization
✅ Successful Drizzle read query
✅ End-to-end smoke test
```

Not covered by this document:

```text
Tool implementation
Retrieval layer
Chat integration
Issue #110 completion
```

### Ingestion Runtime Requirements

Use the DallasAI project virtual environment when running ingestion commands.

Windows:

```powershell
.\apps\data\dallasai\.venv\Scripts\python.exe `
    apps\data\dallasai\main.py `
    -i <input-directory> `
    -s 2
```

Using a system Python interpreter may fail because required dependencies (for example SQLAlchemy) are installed in the DallasAI virtual environment rather than the system Python environment.

Verification:

```powershell
.\apps\data\dallasai\.venv\Scripts\python.exe `
    -c "import sqlalchemy; print(sqlalchemy.__version__)"
```

Expected:

```text
<version number>
```

---

### Catalog Markdown Metadata Validation

Catalog markdown files may contain YAML frontmatter generated by `MarkdownConverter`.

Example:

```yaml
---
document_type: course
course_code: ABDR 1419
title: Basic Metal Repair
credit_hours: 4
---
```

The ingestion pipeline must:

1. Parse frontmatter metadata.
2. Remove frontmatter from the markdown body before chunking.
3. Preserve metadata through payload generation.
4. Map:

```text
document_type -> doc_type
```

for markdown ingestion paths.

Expected payload metadata:

```json
{
  "document_type": "course",
  "course_code": "ABDR 1419",
  "title": "Basic Metal Repair",
  "doc_type": "course"
}
```

Expected Neon verification:

```sql
SELECT
    doc_type,
    course_code
FROM knowledge_entry
WHERE source_url = 'file://15115.md';
```

Expected result:

```text
course | ABDR 1419
```

---

### Troubleshooting

#### Error

```text
No module named 'sqlalchemy'
```

#### Cause

```text
Ingestion executed with the system Python interpreter instead of the DallasAI virtual environment.
```

#### Resolution

```powershell
.\apps\data\dallasai\.venv\Scripts\python.exe `
    apps\data\dallasai\main.py `
    -i <input-directory> `
    -s 2
```

#### Validation

Successful ingestion should produce output similar to:

```text
Preparing to load X rows into Neon...
Loaded X/X rows

Dataset load completed successfully.
```

and verification queries should show catalog records correctly classified:

```sql
SELECT
    doc_type,
    course_code
FROM knowledge_entry
WHERE source_url LIKE '%15115%';
```

Expected:

```text
course | ABDR 1419
```