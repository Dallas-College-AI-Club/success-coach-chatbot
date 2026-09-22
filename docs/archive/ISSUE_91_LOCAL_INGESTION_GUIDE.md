# Issue #91: Local Data Ingestion & Neon Vector Orchestration Guide

> **Target Audience**: AI Club Developers & Collaborators  
> **Module Path**: `apps/data/dallasai/main.py` & `apps/data/dallasai/db_setup.py`  
> **Status**: Feature Branch `feature/issue-91-local-ingestion`

---

## 1. High-Level Overview (Feynman Intuition)

Imagine you have a giant 20-page college syllabus or a full course catalog. If a student asks a specific question like *"What is the late work policy for Biology 1406?"*, asking an AI model to read the entire 20-page document every single time is slow, expensive, and unreliable.

To solve this, our **Local Ingestion Engine** automates a 5-step assembly line:
1. **Clean**: Strip web page noise (sidebars, menus, popups) and convert raw HTML into clean Markdown text.
2. **Chunk**: Break the clean text into small, focused sections (e.g., grading policy, exam schedule).
3. **Package**: Assign a SHA-256 content hash, metadata, and extracted facts into a standard JSON record.
4. **Embed**: Convert each text chunk into a 768-dimensional mathematical vector (a numerical fingerprint).
5. **Upsert**: Store the chunks, metadata, and vectors inside a remote **Neon PostgreSQL** database equipped with `pgvector`.

---

## 2. The 5-Function Architecture

`apps/data/dallasai/main.py` strictly follows a **5-Function Deep Module Design** kept under 400 lines of clean code:

```
[Raw Document (HTML or MD)] 
         │
         ▼
 ┌────────────────────────────────────────────────────────┐
 │ Function 1: preprocess_document()                      │
 │ Clean DOM noise & extract Markdown + metadata          │
 └──────────────────────────┬─────────────────────────────┘
                            │
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │ Function 2: chunk_markdown()                           │
 │ Semantic section chunking via SemanticChunker           │
 └──────────────────────────┬─────────────────────────────┘
                            │
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │ Function 3: extract_to_json_payload()                  │
 │ Issue #61 JSON record assembly & SHA-256 hashing       │
 └──────────────────────────┬─────────────────────────────┘
                            │
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │ Function 4: generate_embeddings()                      │
 │ Pluggable 768-dim float vector embedding generation     │
 └──────────────────────────┬─────────────────────────────┘
                            │
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │ Function 5: validate_and_upsert_payload()              │
 │ Schema validation gate & Neon PostgreSQL ORM upserts   │
 └────────────────────────────────────────────────────────┘
```

---

## 3. Adaptability Guide for Team Members

Every team member can run this pipeline on their own computer, pointing to custom file locations and starting at whichever pipeline function fits their data.

### Step 1: Database Setup (Neon PostgreSQL)

Before running ingestion, configure your Neon connection string in your local `.env` file at the project root:

```env
DATABASE_URL="postgresql://neondb_owner:YOUR_SECRET_KEY@ep-your-endpoint-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

Initialize the database schema and enable the `pgvector` extension by running:

```bash
python3 apps/data/dallasai/db_setup.py --init
```

---

### Step 2: Running the Pipeline (CLI Flags)

`main.py` provides flexible command-line arguments:

| Flag | Full Flag | Description | Default |
| :--- | :--- | :--- | :--- |
| `-i` | `--input` | Path to directory containing input files (`.md` or `.html`) | `apps/data/cleaned/2026SP` |
| `-o` | `--output` | Path to temporary output directory for staged JSON payloads | `.tmp/chunk_ready` |
| `-s` | `--stage` | Starting pipeline function (Stage 1 to 5) | `2` |
| `-w` | `--workers` | Number of CPU worker processes (1 for safe execution, >1 for multi-core) | `1` |

---

## 4. Practical Usage Examples for Team Members

### Scenario A: Processing Pre-Converted Markdown Files (Fastest)
If your folder already contains converted `.md` Markdown files (e.g. `apps/data/cleaned/2026SP/`), start directly at **Function 2 (Chunking)**:

```bash
python3 apps/data/dallasai/main.py -i apps/data/cleaned/2026SP --stage 2 -w 1
```

### Scenario B: Processing Raw HTML Pages from Scratch
If you downloaded raw HTML files from Concourse or course catalog web scrapers, start at **Function 1 (Preprocessing)**:

```bash
python3 apps/data/dallasai/main.py -i /path/to/raw_html_folder -o .tmp/my_output --stage 1 -w 1
```

### Scenario C: High-Performance Multi-Core Desktop Acceleration
If you are working on a high-performance multi-core desktop (not a Chromebook), enable multi-core CPU workers:

```bash
python3 apps/data/dallasai/main.py -i apps/data/cleaned/2026SP --stage 2 -w 4
```

---

## 5. Python Import Developer Guide

Developers building custom scrapers or batch handlers can import and use any of the 5 functions directly:

```python
from pathlib import Path
from dallasai.main import (
    preprocess_document,
    chunk_markdown,
    extract_to_json_payload,
    generate_embeddings,
    validate_and_upsert_payload
)

# 1. Read input document
text = Path("my_document.md").read_text()

# 2. Function 2: Semantic Chunking
chunks = chunk_markdown(text, chunk_size=800, chunk_overlap=100)

# 3. Function 3: Assemble JSON Payload
records = extract_to_json_payload("my_document.md", chunks, metadata={"doc_type": "syllabus"})

# 4. Function 4: Generate Embeddings
embedded_records = generate_embeddings(records)

# 5. Function 5: Validate and Upsert to Neon
status = validate_and_upsert_payload(embedded_records)
print("Pipeline Result:", status)
```
