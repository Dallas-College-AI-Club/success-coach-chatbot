# Issue #90 Implementation Plan: Data Preprocessing Engine

> **Scope Boundary**: Issue #90 focuses **solely** on Data Preprocessing (converting raw Spring 2026 Concourse syllabus HTMLs into Clean HTML `.html` and Clean Markdown `.md`). It does **NOT** generate JSON payloads (all JSON generation, rule harvesting, and `Draft7Validator` testing are owned by Issue #61).

---

## 1. Core Structure & Four Agile Sections

### **Section 1: Standalone HTML DOM Cleaning Engine (`html_cleaner.py`)**
- **Purpose**: A dedicated, reusable HTML cleaning script/module (`apps/data/pipeline/html_cleaner.py`).
- **How It Works**:
  - Decomposes non-content elements (`<script>`, `<style>`, `<iframe`, `<form>`, `<button>`, `<nav>`, `<header>`, `<footer`).
  - Isolates core syllabus container (`id="syllabus"` / `.syl`).
  - Truncates generic district policy footers at `Dallas College Policies` or `Support Contacts`.
- **Output**: Clean HTML (`clean_syllabus.html`).

---

### **Section 2: Clean HTML to Clean Markdown Converter (`markdown_converter.py`)**
- **Purpose**: Converts Clean HTML into standardized Clean Markdown.
- **Rule 1 (Table Break Unrolling)**: Pre-scan `<td>` and `<th>` elements and replace `<br>` / `<br/>` with spaces/commas to prevent markdown table lines from splitting across rows.
- **Rule 2 (Strict Table Preservation)**: Convert all HTML `<table>` elements into valid GFM pipe-delimited Markdown tables (`| Header 1 | Header 2 |`), never collapsing tables into prose.
- **Rule 3 (UTF-8 Encoding Enforcement)**: Explicitly enforce `encoding="utf-8"` across all read and write operations.
- **Output**: Clean Markdown (`clean_syllabus.md`).

---

### **Section 3: Automated Validation & Quality Gate against Raw HTML**
- **`apps/data/tests/test_preprocessing_diff.py`**:
  - Assert count of raw HTML `<h1>`/`<h2>`/`<h3>` tags match `#`/`##`/`###` in Markdown.
  - Assert count of raw `<tr>` elements match pipe table rows (`| ... |`) in Markdown.
  - Assert key section keywords ("Prerequisites", "Grading Scale", "Course Schedule", "ISBN") remain present in Markdown output.

---

### **Section 4: Human Baseline Spot-Check Audit & Batch Corpus Delivery**
- **Manual Spot-Check**: Perform side-by-side audit on 5 representative syllabi (`84063.html`, `98305.html`, `98301.html`, `98296.html`, `98326.html`).
- **Batch Corpus Delivery**: Output `{id}_clean.html` and `{id}.md` in `apps/data/cleaned/2026SP/`.

---

## 🎯 Definition of Done & Required Deliverables

- [ ] **Deliverable 1 (HTML Cleaner)**: Standalone DOM Cleaner (`apps/data/pipeline/html_cleaner.py`).
- [ ] **Deliverable 2 (Markdown Converter)**: Preprocessor Engine (`apps/data/dallasai/markdown_converter.py`) with 3 structural rules.
- [ ] **Deliverable 3 (Test Suite)**: Automated Diff Check Test Script (`apps/data/tests/test_preprocessing_diff.py`).
- [ ] **Deliverable 4 (Processed Corpus)**: Clean Markdown & Clean HTML files (e.g. `84063.md` and `84063_clean.html`) in `apps/data/cleaned/2026SP/`.
- [ ] **Deliverable 5 (Documentation)**: Technical Explainer (`research/ISSUE_90_EXPLAINER.md`) and Implementation Plan (`docs/ISSUE_90_PLAN.md`).
