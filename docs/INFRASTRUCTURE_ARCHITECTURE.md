# INFRASTRUCTURE_ARCHITECTURE.md

## Project Overview

This document defines the infrastructure architecture for a zero-cost MVP chatbot system. The design prioritizes:

- Minimal operational overhead
- Free-tier resource utilization
- Provider-agnostic flexibility
- Clear migration paths for scaling

---

# 1. Infrastructure Comparison Matrix

| Service | Storage Limit | Vector Support | Framework Compatibility | Key Constraints |
|--------|-------------|---------------|------------------------|----------------|
| Convex | ~500MB | ❌ No native ANN | TypeScript-first | Not suited for RAG workloads |
| Neon Postgres | ~500MB | ✅ pgvector | Python / TypeScript | Cold start latency |
| Pinecone | ~2GB | ✅ Native | All stacks | Additional service complexity |
| LanceDB | Local disk | ✅ Native | Python / Node / Electron | Not ideal for cloud multi-user |

---

# 2. Evaluation Summary

## Convex
- Optimized for frontend-driven state
- Not suitable for vector retrieval systems

## Neon Postgres
- Supports both relational and vector queries
- Fits within dataset size constraints (~3K vectors)
- Requires handling cold start latency

✅ Selected for unified storage

---

## Pinecone
- High-performance vector database
- Not required at MVP scale
- Introduces additional complexity

❌ Not selected for MVP

---

## LanceDB
- Strong for local/offline applications
- Not suitable as primary backend store

---

# 3. Hosting & Compute Comparison

| Service | Strengths | Constraints |
|--------|----------|------------|
| Vercel | Auto SSL, easy deploy | Function timeouts |
| Cloudflare | Global edge | Limited runtime |
| OCI | High compute capacity | High setup overhead |

---

## Decision

- **Frontend**: Vercel ✅
- **Backend**: Serverless FastAPI ✅

Reason:
Minimizes infrastructure management while maintaining flexibility.

---

# 4. MVP Stack Selection

## Final Architecture

```text
Frontend:
  React (Vercel)

Backend:
  FastAPI (serverless)

Database:
  Neon Postgres (pgvector)

LLM:
  OpenRouter

SDK:
  OpenAI-compatible client
````

***

# 5. LLM Strategy

## OpenRouter Selection

* Provides access to multiple models
* Prevents vendor lock-in
* Supports OpenAI-compatible APIs

***

# 6. SDK Proof of Concept

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url=os.getenv("LLM_BASE_URL"),
    api_key=os.getenv("LLM_API_KEY"),
)

def generate_response(prompt: str):
    return client.chat.completions.create(
        model=os.getenv("LLM_MODEL"),
        messages=[{"role": "user", "content": prompt}],
    )
```

***

## Example Environment Switching

### OpenRouter

```
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=google/gemma-4-31b-it:free
```

### OpenAI

```
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

✅ No code changes required

***

# 7. Environment Variables

```
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=

DATABASE_URL=

ENV=production
```

***

# 8. Risk & Mitigation

## Cold Start Latency

* Neon and serverless functions may introduce delays
* Mitigation:
  * connection pooling
  * user feedback during loading

***

## API Rate Limits

* OpenRouter free-tier limits

Mitigation:

* switch models via environment variables
* fallback providers

***

## Storage Limits (500MB)

Mitigation:

* data retention policies
* migration to Supabase or paid tier

***

# 9. Migration Strategy

## If storage exceeds limits

* migrate Neon → Supabase or managed Postgres

***

## If vector performance degrades

* migrate pgvector → Pinecone

***

## If API limits reached

* switch providers via environment variables
* fallback to alternative models

***

# 10. Final Engineering Principle

This architecture prioritizes:

> Simplicity and correctness over premature optimization.

The system remains modular, allowing future upgrades without requiring major redesign.
