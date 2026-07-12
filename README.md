# Dallas College AI Club: Success Coach Chatbot

Chatbot to assist students at Dallas College acting as a Success Coach in their pocket.

## Frontend

- Next.js
- Tailwind CSS
- Shadcn UI

## Backend

- Node.js (Next.js)

## Data Scraping

- Python

## Database

Neon serverless PostgreSQL with the `pgvector` extension. Two tables hold everything: `knowledge_entry` (the vector-searchable knowledge base) and `chat_session` (anonymous student profiles + chat telemetry).

- **Design & rationale**: [`docs/DATABASE_ARCHITECTURE.md`](docs/DATABASE_ARCHITECTURE.md)
- **Schema DDL**: [`db/schema.sql`](db/schema.sql) · **Sample data**: [`db/seed_mock.sql`](db/seed_mock.sql)
- **Implementing the ORM models (issue #51)**: [`docs/handoff/ISSUE_51_HANDOFF.md`](docs/handoff/ISSUE_51_HANDOFF.md)

### Set up a database on Neon

1. Create a free project at [console.neon.tech](https://console.neon.tech) (Postgres 16+; pgvector is preinstalled — the schema runs `CREATE EXTENSION` for you).
2. On the project dashboard, open **Connect** and copy **both** connection strings:
   - the **pooled** string (host contains `-pooler`) → `DATABASE_URL`
   - the **direct** string (toggle *Connection pooling* off) → `DATABASE_URL_UNPOOLED`
3. Copy [`.env.example`](.env.example) to `.env` and paste the two strings. Never commit `.env` — real credentials live only in `.env` files and platform secret stores (Vercel, GitHub Actions, Colab).

### Initialize and seed

```bash
psql "$DATABASE_URL_UNPOOLED" -f db/schema.sql
psql "$DATABASE_URL_UNPOOLED" -f db/seed_mock.sql   # sample rows + smoke-test queries
```

The seed script prints smoke-test results (fact lookups, enumeration, event listing, contact routing, a vector similarity query) proving the core query patterns work. `psql` ships with PostgreSQL (`winget install PostgreSQL.PostgreSQL` / `scoop install postgresql` / `brew install libpq`); alternatively, paste both files into the Neon console's **SQL Editor**.

### Which connection string does what

| Env var | Used by | Why |
|---|---|---|
| `DATABASE_URL` (pooled) | Next.js API routes — TypeScript via [`@neondatabase/serverless`](https://github.com/neondatabase/serverless) (and Drizzle in a later issue) | pooled one-shot HTTP queries fit serverless; pooling is handled for you |
| `DATABASE_URL_UNPOOLED` (direct) | Python — SQLAlchemy/psycopg for Alembic migrations and bulk ingest | DDL and long transactions need a real session, not transaction-mode pooling |

Quick connectivity checks:

```bash
# Python (from apps/data; uv fetches psycopg on the fly — no project deps needed yet)
uv run --with psycopg python -c "import os, psycopg; print(psycopg.connect(os.environ['DATABASE_URL_UNPOOLED']).execute('SELECT count(*) FROM knowledge_entry').fetchone())"
```

```ts
// TypeScript (from apps/frontend, after `npm install @neondatabase/serverless`)
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

(async () => {
  console.log(await sql`SELECT count(*) FROM knowledge_entry`);
})();
```

### What lives where

This layer defines the **schema, the sample data, and the connection contract** (which
string to use, from which runtime, and why). The reusable application connection code is
owned by the code that consumes it:

- **Python** — the pooled SQLAlchemy engine + session/teardown lands with the ORM models
  ([`docs/handoff/ISSUE_51_HANDOFF.md`](docs/handoff/ISSUE_51_HANDOFF.md)); it reads
  `DATABASE_URL_UNPOOLED` exactly as documented above.
- **TypeScript** — the Next.js app's shared Neon client (and its Drizzle mirror) lands with
  the frontend data layer; it reads the pooled `DATABASE_URL`.

**Verifying the seed.** `db/seed_mock.sql` is idempotent and ends with smoke-test queries
(row counts by `doc_type`, a fact lookup, an enumeration, event/contact routing, and a
vector-similarity query). Running it against a `pgvector`-enabled instance (a Neon project,
or local Postgres with the extension) exercises the whole schema including the HNSW vector
index; the vector path is confirmed as part of the first Neon run.
