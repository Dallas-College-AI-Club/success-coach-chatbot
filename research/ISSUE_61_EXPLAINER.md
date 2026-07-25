# Issue #61 Explainer: LLM Facts Extraction, $0 Early-Exit Gate & Accuracy Reconciliation

> **Scope Boundary**: Issue #61 is **BLOCKED BY Issue #90**. Issue #61 takes the Clean Markdown produced by Issue #90, runs `rule_based_facts.json` harvesting first ($0 cost), checks `Draft7Validator` against `facts-syllabus-v1.schema.json` for an early exit, runs LLM fallback if needed using `extract_v2.md` few-shot exemplars, and reconciles facts for 100% data accuracy before writing to PostgreSQL (`knowledge_entry.facts`).
> **Hardened by Reference Contracts**: Derived from the schemas, gold fixtures, and `EXTRACTION_PLAYBOOK.md` in `apps/data/workingfiles/working files - 20260724/`.

---

## 1. The $0 Early-Exit Workflow: `rule_based_facts.json` First

To maximize speed and minimize API costs, Issue #61 uses an **Early-Exit Strategy**:

```
                                  ┌────────────────────────────────────────────────────────┐
                                  │          Clean Markdown (.md) from Issue #90           │
                                  └──────────────────────────┬─────────────────────────────┘
                                                             │
                                                             ▼
                                  ┌────────────────────────────────────────────────────────┐
                                  │         Step 1: Rule-Based Harvester ($0 Cost)         │
                                  │     Generates `rule_based_facts.json` via BeautifulSoup│
                                  │     and Regex (Course Code, Section, Instructor, Tables│
                                  └──────────────────────────┬─────────────────────────────┘
                                                             │
                                                             ▼
                                  ┌────────────────────────────────────────────────────────┐
                                  │       Step 2: Draft7Validator Early-Exit Check         │
                                  │   Validates against `facts-syllabus-v1.schema.json`   │
                                  └──────────────┬───────────────────────────┬─────────────┘
                                                 │                           │
                                         YES (100% valid)            NO (Missing complex fields)
                                                 │                           │
                                                 ▼                           ▼
                                  ┌──────────────────────────┐┌─────────────────────────────┐
                                  │   SKIP LLM ENTIRELY!     ││   Step 3: LLM Fallback      │
                                  │   ($0 API Cost Exit)     ││   `extract.py` + exemplars  │
                                  └──────────────┬───────────┘│   fills ONLY missing fields │
                                                 │            └──────────────┬──────────────┘
                                                 │                           │
                                                 │                           ▼
                                                 │            ┌─────────────────────────────┐
                                                 │            │  Step 4: Merge & Validate   │
                                                 │            │  `Draft7Validator` checks   │
                                                 │            │  merged payload             │
                                                 │            └──────────────┬──────────────┘
                                                 │                           │
                                                 └─────────────┬─────────────┘
                                                               │
                                                               ▼
                                  ┌────────────────────────────────────────────────────────┐
                                  │      Step 5: Data Accuracy & Reconciliation Check     │
                                  │      (L1 Substring Match + L2 Numeric + Math Verification)│
                                  └────────────────────────────┬───────────────────────────┘
                                                               │
                                                               ▼
                                  ┌────────────────────────────────────────────────────────┐
                                  │    PostgreSQL Insert (`knowledge_entry.facts`) JSONB    │
                                  └────────────────────────────────────────────────────────┘
```

---

## 2. Extraction Playbook Architecture & Ground-Truth Verification

### 2.1 The Teacher-Student Loop
As defined in `EXTRACTION_PLAYBOOK.md`, frontier models (Claude) act as **Teachers** (authoring gold answers and exemplars), while $0/free models act as **Students** (executing bulk extraction under constrained decoding). 

### 2.2 Deterministic Verifier Lints
To turn silent wrong values into retryable error strings, Issue #61 enforces strict semantic lints:
1. **L1 Verbatim Grounding**: Every verbatim text string (`policies.*`, `raw_text`, `office_hours`) must be an exact substring of the source document after punctuation normalization.
2. **L2 Numeric Grounding**: Every `weight_pct` or `points` value must physically exist as a numeric token in the source text.
3. **L9 Parroting Sentinel Check**: Validates that small models do not parrot values from few-shot prompt exemplars into new document extractions.

### 2.3 Gold-Set Benchmarking & Stress Test Matrix
- **Gold Set**: Validated against 12+ human-verified syllabus fixtures (`apps/data/workingfiles/working files - 20260724/verified-fixtures/`).
- **Student-Question Stress Test**: Verified against the 144 student-question evaluation matrix (`STRESS_TEST_SYLLABI_CVS.md`), ensuring extracted facts reliably answer student inquiries regarding grade calculations, late work, makeup exams, withdraw dates, and AI plagiarism policies.

---

## 3. Feynman-Style Analogy

> **Imagine a bank teller inspecting a check.**
> 
> * **`Draft7Validator`** is like checking if the check has a signature line and a dollar amount written down. (Syntax check).
> * **Facts Reconciliation Test** is like calling the account owner to verify that the account has enough money and the signature matches their ID card. (Accuracy & Truth check).
> 
> By running **both**, we ensure the JSON isn't just well-formatted—it's **100% mathematically and factually true**.
r old data from entering PostgreSQL, Issue #61 runs 4 automated accuracy checks:

1. **Exact Substring Ground-Truth Verification**:
   * Every extracted text field (e.g., `instructor.email`, `course.course_number`, `textbook.isbn`) **MUST physically exist as an exact substring** inside the raw/cleaned document text.
   * *Example Assertion*: `assert extracted_email in clean_markdown_text`
   * If an LLM invents an email or misreads a course code, the substring check fails immediately!

2. **Grading Weight Math Reconciliation**:
   * Asserts that the sum of all grading weight percentages equals 100% ($\sum \text{weights} = 100\%$).
   * For points-based syllabi, automatically calculates $\text{weight\_pct} = (\text{component\_points} / \text{total\_points}) \times 100$.

3. **Deterministic Identity Cross-Check**:
   * Verifies that `course_number` and `section_number` in the JSON match the scraped manifest identity (`BIOL-1406-21001`).

4. **Quarantine Safety Net**:
   * If substring verification fails or math doesn't balance, set `confidence = "low"` and write to `.tmp/quarantine/` (`needs_review`). Corrupted or unverified data **never** touches production PostgreSQL.

---

## 3. Feynman-Style Analogy

> **Imagine a bank teller inspecting a check.**
> 
> * **`Draft7Validator`** is like checking if the check has a signature line and a dollar amount written down. (Syntax check).
> * **Facts Reconciliation Test** is like calling the account owner to verify that the account has enough money and the signature matches their ID card. (Accuracy & Truth check).
> 
> By running **both**, we ensure the JSON isn't just well-formatted—it's **100% mathematically and factually true**.
