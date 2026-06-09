# INFRASTRUCTURE_ARCHITECTURE.md

## Project Overview

This document defines the infrastructure architecture for a fully subsidized MVP chatbot system (aka free tier, but there is no such thing as free, and availability may change over time).

The design prioritizes:

- Minimal operational overhead
- Free-tier resource utilization
- Provider-agnostic flexibility
- Clear migration paths for scaling
- Avoidance of premature architectural complexity

The architecture follows an Agile MVP philosophy:

> Build the minimum reliable system first, then evolve complexity only when justified by real requirements.

---

# 1. Infrastructure Comparison Matrix

| Service | Storage Ceiling | Vector Support | Framework Compatibility | Operational Limitations & Constraints |
|----------|------------------|----------------|---------------------------|---------------------------------------|
| **Convex** | ~1 GB data / 10k docs | ✅ Native Vector Search | TypeScript / Node.js | Higher platform coupling and proprietary runtime model |
| **Neon PostgreSQL** | 512 MB (0.5 GiB) | ✅ pgvector (HNSW / IVFFlat) | Universal SQL Standard | Shared compute scales to zero after inactivity, causing 3–5s wake latency |
| **Pinecone** | Starter tier limits (~2 GB) | ✅ Native ANN Indexing | Multi-language SDK/API | Additional distributed service and synchronization complexity |
| **LanceDB** | Local filesystem / persistent disk | ✅ Native OSS Vector Engine | Python / TypeScript | Requires persistent storage management; less suited for serverless multi-user deployments |

---

# 2. Evaluation Summary

## Convex
- Strong TypeScript-first developer experience
- Supports vector search and RAG workflows
- Well suited for reactive real-time applications

### Tradeoffs
- Greater ecosystem coupling
- Less portable than standard PostgreSQL solutions

### Final Assessment
Convex is significantly more capable than originally evaluated. However, PostgreSQL was ultimately preferred due to stronger portability, migration flexibility, and SQL ecosystem familiarity.

---

## Neon PostgreSQL + pgvector
- Supports both relational and vector queries
- Easily accommodates current scale (~3K vectors)
- Uses standard PostgreSQL tooling and migration paths
- Simplifies hybrid retrieval by keeping relational and vector data unified

### Tradeoffs
- Cold-start latency after inactivity
- Shared free-tier compute constraints

✅ Selected for MVP unified storage strategy

---

## Pinecone
- Excellent dedicated vector database
- Strong scalability and ANN indexing support

### Tradeoffs
- Adds another service dependency
- Requires maintaining synchronization between relational and vector storage
- Benefits are not fully realized at current scale

❌ Deferred for MVP

---

## LanceDB
- Strong embedded/offline vector database
- Excellent local-first development option

### Tradeoffs
- More difficult persistence management in ephemeral serverless environments
- Less appropriate for shared cloud multi-user deployments

❌ Not selected as the primary cloud vector layer

---

# 3. Hosting & Compute Comparison

| Service | Strengths | Constraints |
|----------|------------|-------------|
| **Vercel** | Automatic SSL, easy deployments, excellent React/Next.js support | Function execution limits and serverless cold starts |
| **Cloudflare Workers** | Global edge execution and very fast response times | Restricted runtime environment and CPU limits |
| **OCI** | Large free compute allocation and full infrastructure control | Higher operational and infrastructure management overhead |

---

# 4. Hosting & Compute Decision

## Selected Hosting Strategy
✅ Vercel

### Rationale
- Minimal deployment friction
- Automatic SSL provisioning
- Native support for Next.js and React
- Strong alignment with zero-maintenance MVP goals

---

## Backend Orchestration Decision

Initial architecture discussions considered introducing a dedicated FastAPI backend for:
- preprocessing pipelines
- reranking workflows
- embedding refresh jobs
- logging and observability
- retrieval orchestration

However, after architectural review, this was identified as premature complexity at MVP scale.

At the current dataset size (~3K vectors), TypeScript API routes provide sufficient orchestration capability while:
- minimizing service count
- reducing deployment complexity
- avoiding additional network boundaries
- limiting infrastructure overhead

A dedicated Python/FastAPI service may become appropriate later if:
- hybrid retrieval pipelines emerge
- Python-native NLP tooling becomes necessary
- background embedding workers are introduced
- reranking models are deployed

---

# 5. MVP Stack Selection

## Final Architecture

```text
Frontend:
  Next.js / React (Vercel)

API Orchestration:
  TypeScript API Routes (Vercel Serverless)

Database:
  Neon PostgreSQL + pgvector

LLM Layer:
  OpenRouter

SDK Strategy:
  OpenAI-compatible TypeScript client / Vercel AI SDK
```

---

## Media Storage Strategy

Lost-and-found image uploads should not be stored directly inside PostgreSQL.

Instead, uploaded media assets should be stored within low-cost S3-compatible object storage such as:
- Backblaze B2
- Cloudflare R2
- AWS S3 (future scaling)

The relational database should only store:
- metadata
- object URLs
- timestamps
- ownership/retrieval references

This minimizes database growth while aligning media handling with standard object-storage architectural practices.

---

# 6. LLM Strategy

## OpenRouter Selection

### Benefits
- Access to multiple providers and open-weight models
- Prevents vendor lock-in
- OpenAI-compatible API interface
- Environment-variable-driven provider switching

### Architectural Rationale
Provider abstraction is prioritized to ensure:
- portability
- migration flexibility
- reduced long-term vendor dependence

---

# 7. SDK Proof of Concept

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL:
    process.env.LLM_BASE_URL ||
    "https://openrouter.ai/api/v1",

  apiKey: process.env.LLM_API_KEY,

  defaultHeaders: {
    "HTTP-Referer":
      "https://dallascollege-mvp-placeholder.vercel.app",

    "X-Title": "MVP Chatbot",
  },
});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const responseStream =
      await client.chat.completions.create({
        model:
          process.env.LLM_MODEL ||
          "google/gemma-3-27b-it:free",

        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],

        stream: true,
      });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        for await (const chunk of responseStream) {
          const text =
            chunk.choices[0]?.delta?.content || "";

          if (text) {
            controller.enqueue(
              encoder.encode(text)
            );
          }
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type":
          "text/event-stream; charset=utf-8",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: String(error),
      }),
      {
        status: 502,
      }
    );
  }
}
```

---

## Example Environment Switching

### OpenRouter

```env
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=google/gemma-3-27b-it:free
```

### OpenAI

```env
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

### Alternative Free/Open Models

```env
# Examples:
# LLM_MODEL=qwen/qwen3-next-80b-a3b-instruct:free
# LLM_MODEL=meta-llama/llama-3.3-70b-instruct:free
# LLM_MODEL=openai/gpt-4o-mini
```

✅ No business-logic changes required

---

# 8. Environment Variables

```env
# LLM Provider
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=

# Database
DATABASE_URL=

# Runtime
NODE_ENV=production
```

---

# 9. Storage Capacity & Vector Size Mathematics

Current projected scale:
- ~800 courses
- ~300 academic programs
- Estimated maximum of ~3,000 vector embeddings

Using a common embedding model with approximately 1,536 dimensions:

- Each dimension uses a 4-byte float (`float4`)
- Total memory calculation:

```text
3,000 vectors × 1,536 dimensions × 4 bytes
= 18,432,000 bytes
≈ 18.43 MB
```

### Capacity Analysis
Neon's free tier allows approximately 512 MB of storage.

Estimated vector storage consumption:
- ~18.43 MB (~3.6% of available capacity)

Remaining available storage:
- ~493 MB for:
  - relational metadata
  - event records
  - logs
  - application state

This confirms the MVP comfortably fits within Neon’s free-tier storage constraints.

---

# 10. Risk & Mitigation

## Cold-Start Latency

### Risk
- Serverless functions and Neon compute may introduce delayed first responses after inactivity

### Mitigation
- Retry logic
- Connection pooling
- User-facing loading indicators
- Optional keepalive ping strategy

---

## API Rate Limits

### Risk
- OpenRouter free-tier rate limiting

### Mitigation
- Environment-based model switching
- Provider fallback strategy
- Retry handling
- Request queueing if necessary

---

## Storage Limits

### Risk
- Long-term growth beyond free-tier thresholds

### Mitigation
- Retention policies
- Compact embedding dimensions
- Future migration to larger PostgreSQL tiers if required

---

## Object Storage Availability

### Risk
- Free-tier object storage availability and pricing models may change over time

### Mitigation
- Use S3-compatible storage APIs where possible
- Preserve abstraction between metadata and media storage
- Maintain the ability to migrate between:
  - Backblaze B2
  - Cloudflare R2
  - AWS S3
  - alternative object-storage providers

---

# 11. Disaster Recovery & Portability Playbook

## Playbook 1: Relational / Vector State Restoration

In the event of:
- database corruption
- accidental deletion
- provider suspension
- migration to another provider

### Recovery Strategy

1. Maintain source academic content within the repository under:

```text
/data/source/
```

2. Rebuild schema and embeddings through deployment scripts:

```bash
npm run db:deploy-schema
npm run db:seed-embeddings
```

This enables rebuilding the database and vector state from source documents without relying on proprietary backups.

---

## Playbook 2: Database Connection Pool Exhaustion

### Risk
Neon free tier enforces concurrent connection limits.

### Mitigation

Use Neon pooled connection strings:

```text
?sslmode=require&pgbouncer=true
```

This routes requests through Neon's transaction-level pooler to reduce dropped connections during usage spikes.

---

# 12. Migration Strategy

## If Storage Limits Are Reached

```text
Neon PostgreSQL
    ↓
Supabase / Managed PostgreSQL
```

Because the architecture uses standard PostgreSQL tooling and pgvector, migration remains straightforward.

---

## If Vector Performance Degrades

```text
pgvector
    ↓
Pinecone
```

Dedicated vector infrastructure can be introduced later without redesigning the overall system architecture.

---

## If API Limits Are Reached

```text
OpenRouter
    ↓
Alternative OpenAI-compatible provider
```

Provider switching occurs primarily through environment variables.

---

## If Object Storage Providers Change

```text
Backblaze B2 / Cloudflare R2
    ↓
Alternative S3-Compatible Storage Provider
```

Using S3-compatible APIs reduces migration friction between object-storage vendors.

---

# 13. Final Engineering Principle

This architecture prioritizes:

> Simplicity and correctness over premature optimization.

The system intentionally minimizes:
- service count
- infrastructure maintenance
- operational complexity

while preserving:
- extensibility
- migration flexibility
- provider independence

Additional complexity should only be introduced when justified by real application requirements rather than anticipated future scale.
