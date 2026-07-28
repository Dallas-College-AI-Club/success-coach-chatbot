# Issue #90 Explainer: Concourse Syllabus Data Preprocessing Engine

> **Scope Boundary**: Issue #90 focuses **solely** on Data Preprocessing (converting raw Concourse HTML into normalized Clean HTML `.html` and Clean Markdown `.md`). It does **NOT** generate JSON payloads (all JSON generation, rule harvesting, and `Draft7Validator` testing are owned by Issue #61).

---

## 1. Executive Summary & Why Data Preprocessing Matters

Raw academic HTML files from Concourse Syllabus management systems are heavily bloated with non-content elements: CSS styling frameworks, JavaScript bundles, navigation widgets, responsive layout wrappers, and district-wide institutional disclaimers. 

In a Retrieval-Augmented Generation (RAG) system, passing raw HTML directly to vector chunkers or LLMs introduces severe issues:
1. **Token Exhaustion & High Cost**: Up to 70% of the document payload consists of HTML markup (`<div class="...">`, `<style>`, `<script>`).
2. **Context Window Contamination**: District policies (e.g., Title IX, campus safety, ADA compliance) repeat on every syllabus, causing vector databases to retrieve generic policy text instead of specific course grading rules.
3. **Chunk Boundary Distortion**: HTML tags split awkwardly across chunk boundaries, creating invalid syntax and mangling tables.

---

## 2. System Architecture: The Four Agile Sections of Issue #90

```
┌─────────────────────────────────────────────────────────────┐
│               ISSUE #90: Data Preprocessing                 │
│                                                             │
│  Section 1: HTML DOM Cleaning Engine (`html_cleaner.py`)    │
│  Section 2: Clean HTML ──► Clean Markdown Engine            │
│  Section 3: Automated Diff Validation Suite vs Raw HTML     │
│  Section 4: Human Baseline Spot-Check Audit (5 Files)       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                          Emits TWO Clean Files:
                               │
             ┌─────────────────┴─────────────────┐
             │                                   │
             ▼                                   ▼
  `clean_syllabus.html`               `clean_syllabus.md`
  (Input to #61 $0 Harvester)         (Input to #35 & #61 LLM)
```

---

## 3. Detailed Breakdown of the Four Sections

### Section 1: Standalone HTML DOM Cleaning Engine (`html_cleaner.py`)
* **Purpose**: Decomposes layout noise and truncates institutional boilerplate disclaimers.
* **Mechanism**: Strips `<script>`, `<style>`, `<iframe`, `<form>`, `<button>`, `<nav>`, `<header>`, `<footer`.
* **Boilerplate Truncation**: Truncates raw HTML at generic district disclaimer headers (`Dallas College Policies`, `Support Contacts`, `Institutional Policies`).
* **Output**: Clean HTML (`clean_syllabus.html`).

### Section 2: Clean HTML to Clean Markdown Converter (`markdown_converter.py`)
* **Rule 1 (Table Cell Line Break Unrolling)**: Replaces `<br>` / `<br/>` tags inside `<td>`/`<th>` cells with spaces/commas to prevent table lines from splitting across rows.
* **Rule 2 (Strict Table Preservation)**: Converts all HTML `<table>` elements into valid GFM pipe-delimited Markdown tables (`| Header 1 | Header 2 |`), retaining full row and column alignment.
* **Rule 3 (UTF-8 Character Encoding Enforcement)**: Enforces `encoding="utf-8"` across all read and write operations (handling emojis 📝, ⏰, 📚 cleanly).
* **Output**: Clean Markdown (`clean_syllabus.md`).

### Section 3: Automated Structural & Section Diff Checks
* **Script**: `apps/data/tests/test_preprocessing_diff.py`.
* **Header Count Assertion**: Compares raw `<h1>`/`<h2>`/`<h3>` tags against `#`/`##`/`###` in Markdown.
* **Table Row Count Assertion**: Compares raw `<tr>` elements against pipe table rows (`| ... |`) in Markdown.
* **Key Section Keyword Check**: Asserts presence of required keywords ("Prerequisites", "Grading Scale", "Course Schedule", "ISBN").

### Section 4: Human Baseline Spot-Check Audit & Corpus Delivery
* Manual side-by-side spot check on 5 representative syllabi (`84063.html`, `98305.html`, `98301.html`, `98296.html`, `98326.html`) confirming 100% course data retention and 0% policy bloat.
* Batch output `{id}_clean.html` and `{id}.md` in `apps/data/cleaned/2026SP/`.

---

## 4. Definition of Done & Deliverables List

1. **Deliverable 1 (HTML Cleaner)**: Standalone DOM Cleaner (`apps/data/pipeline/html_cleaner.py`).
2. **Deliverable 2 (Markdown Converter)**: Preprocessor Engine (`apps/data/dallasai/markdown_converter.py`) with 3 structural rules.
3. **Deliverable 3 (Test Suite)**: Automated Diff Check Test Script (`apps/data/tests/test_preprocessing_diff.py`).
4. **Deliverable 4 (Processed Corpus)**: Clean Markdown & Clean HTML files (e.g. `84063.md` and `84063_clean.html`) in `apps/data/cleaned/2026SP/`.
5. **Deliverable 5 (Documentation)**: Technical Explainer (`research/ISSUE_90_EXPLAINER.md`) and Implementation Plan (`docs/ISSUE_90_PLAN.md`).
