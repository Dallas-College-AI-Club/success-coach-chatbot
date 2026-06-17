# Dallas College Catalog Scraping & Semantic Chunking Guide
> **Title**: Ingestion Architecture & Data Pipeline Guide
> **Status**: APPROVED PROTOCOLS
> **Target Issue**: #20
> **Deciders**: Dallas College AI Club (Engineering Team)

---

## 1. Scraping the Dallas College Catalog

We analyzed the existing catalog scraper script (`scraper.py`) retrieved from our Git history. 

### A. How Our Scraper Was Designed
Our scraper uses an **async parallel fetch architecture** written in Python using `aiohttp` and `BeautifulSoup` (`lxml`).

1. **Two-Pass Discovery Pattern**:
   * **Pass 1 (Discovery)**: Fetches paginated list index pages at `content.php?catoid=5&navoid=1222` to collect all course IDs (`coid`) and program IDs (`poid`).
   * **Pass 2 (Extraction)**: Fires parallel async workers to fetch the details for each unique ID (e.g. `preview_course_nopop.php?catoid=5&coid=15128`).
2. **Anti-Scraping & Rate Limiting**:
   * Limits concurrency to `MAX_CONCURRENT = 5` concurrent workers.
   * Introduces a `0.5s` delay between requests per worker to avoid triggering server firewalls.
   * Catches anti-scraping responses (specifically **HTTP 202 Throttling**, **HTTP 429**, and **HTTP 503**) and backs off exponentially:
     $$\text{Wait Duration} = 2^{\text{attempt} + 2} + 2 \text{ seconds}$$
3. **HTML Extraction**:
   * Uses BeautifulSoup to target `<td class="block_content">`—which contains the raw catalog texts—stripping away navigation sidebars, headers, and footer bloat.

### B. The Best Approach for Catalog Scraping
* **Avoid Headless Browsers (Playwright/Puppeteer)**: The Dallas College catalog is server-rendered PHP. Because the pages do not rely on client-side React/JS rendering, headless browsers are unnecessary. Using raw `aiohttp` requests uses 95% less CPU and RAM—critical for Chromebook developers.
* **Keep the Discovery & Extraction Split**: Scraping a pre-fetched list of IDs is far more reliable than standard crawler spiders. Standard spiders easily get trapped in infinite loop links (e.g., clicking pagination links back and forth).
* **Respectful Scraping Guidelines**: Always run with a custom `User-Agent` indicating the project's educational nature (e.g., `DallasAI-SuccessCoach-Scraper/1.0`) so the IT department can contact us instead of outright blacklisting the IP address.

---

## 2. Chunking Methodologies for RAG

Chunking is the process of splitting a long document (like an 8-page syllabus) into smaller, discrete text blocks so they fit within an LLM's context window and can be retrieved with high vector search relevance.

We compare four chunking strategies:

```
[Syllabus PDF] ──> [Parsed Text]
                     │
                     ├─► 1. Character-Based ──► [Fixed Char Chunks] (Mangles tables/sentences)
                     ├─► 2. Semantic/Header ──► [Header Sections] (Keeps topics unified)
                     └─► 3. Parent-Child     ──► [Sub-chunks for search] ──► [Parent for LLM]
```

### A. Fixed-Size Character Chunking (Traditional)
* **How it works**: Splits text strictly by a character limit (e.g., 500 characters, with 50 characters overlap).
* **Why it fails for Syllabi**:
  * If a weekly schedule table is split in half, the week number is separated from the assignment description.
  * If a grading rubric is split, the text `"Exams: 40%"` may land in Chunk A while `"Quizzes: 20%"` lands in Chunk B, preventing the database from returning the full grading policy.

### B. Semantic / Header-Based Chunking (Recommended)
* **How it works**: Uses the document's structural hierarchy. The PDF parser translates headers (`#`, `##`, `###`) into Markdown. The splitter then breaks the document only when it hits a header.
* **Why it works for Syllabi**: It keeps logical modules together. The entire "Required Materials" section or the "Attendance Policy" section becomes a single, self-contained chunk.

### C. Hierarchical / Parent-Child Chunking
* **How it works**:
  * **Child Chunks**: The document is split into small sentences/paragraphs (e.g., 100–200 words) and indexed as vectors.
  * **Parent Chunks**: The larger parent section (e.g., the 1000-word grading rubric section) is linked to the child.
  * **Search Path**: The query matches the highly specific child chunk, but the system retrieves the entire parent chunk and sends it to the LLM. This provides high search accuracy with complete context.

---

## 3. How & Where to Perform Chunking

### ❌ Where NOT to do it: The Serverless/Edge Runtime
Do not run PDF parsing or text chunking inside Next.js edge API routes on Vercel. 
* *Reason*: PDF parsing and chunking are CPU-heavy operations. Running them on-the-fly will exceed Vercel's serverless execution timeout limits (10s) and slow down user response times.

### ✅ Where to do it: The Ingestion Pipeline
All parsing, chunking, embedding generation, and vector insertion must be done **offline** in a background Python script before deployment.
* *Reason*: The serverless database (Neon) should receive already-chunked rows and pre-computed vector embeddings. When a student asks a question, the Next.js API route only needs to run a simple, low-latency SQL similarity query, keeping response times under 1.2 seconds.

---

## 4. MVP Database Schema & Metadata Architecture

In Neon Postgres (using `pgvector`), we will structure the database to map course data and syllabus content:

```sql
-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Table for Course Catalog details
CREATE TABLE course_catalog_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id VARCHAR(50) NOT NULL,       -- e.g. "ACCT-2301"
    course_title VARCHAR(255) NOT NULL,   -- e.g. "Principles of Financial Accounting"
    chunk_index INT NOT NULL,             -- Sequence index
    content TEXT NOT NULL,                -- Scraped text block
    embedding VECTOR(384),                -- 384-dimensional local embeddings
    metadata JSONB                        -- e.g. {"url": "...", "credits": "3"}
);

-- Table for parsed Course Syllabi
CREATE TABLE syllabus_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id VARCHAR(50) NOT NULL,       -- e.g. "BIOL-1406"
    professor_name VARCHAR(100) NOT NULL, -- e.g. "Dr. Jane Doe"
    semester VARCHAR(50) NOT NULL,        -- e.g. "Fall 2026"
    section_name VARCHAR(100) NOT NULL,   -- e.g. "Required Materials", "Grading Scale"
    content TEXT NOT NULL,                -- Parsed Markdown text block
    embedding VECTOR(384),                -- 384-dimensional local embeddings
    metadata JSONB                        -- e.g. {"inclusive_access": true}
);

-- Create fast HNSW indexes for sub-100ms vector similarity searches
CREATE INDEX ON course_catalog_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON syllabus_chunks USING hnsw (embedding vector_cosine_ops);
```
