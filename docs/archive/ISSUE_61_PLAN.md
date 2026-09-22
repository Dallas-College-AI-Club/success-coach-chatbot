# Issue #61 Implementation Plan: LLM Facts Extraction, Early-Exit Gate & Accuracy Reconciliation

> **Scope & Blocking Boundary**: Issue #61 is **BLOCKED BY Issue #90**. It reads the preprocessed Clean Markdown output from Issue #90, runs `rule_based_facts.json` harvesting first ($0 cost), checks `Draft7Validator` for an early exit, runs LLM fallback using the `extraction-contract` schemas, and reconciles facts for 100% data accuracy before writing to PostgreSQL (`knowledge_entry.facts`).
> **Reference Contracts**: Hardened using the extraction architecture, gold fixtures, and schemas in `apps/data/workingfiles/working files - 20260724/`.

---

## 1. Five Execution Tasks in Issue #61

### **Task 1: Rule-Based $0 Harvester (`rule_based_facts.json`)**
- Build Python/Regex/BeautifulSoup parser in Issue #61 that extracts deterministic fields (`course_id`, `section`, `instructor`, `grading_tables`, `withdraw_date`, `inclusive_access`) into `rule_based_facts.json` for **$0 API cost**.

### **Task 2: Draft7Validator $0 Early-Exit Check (`facts-syllabus-v1.schema.json`)**
- Test `rule_based_facts.json` against `apps/data/workingfiles/working files - 20260724/extraction-contract/facts-syllabus-v1.schema.json`.
- If 100% of required fields pass schema validation, **exit immediately and skip LLM calls ($0 cost)**.

### **Task 3: LLM Fallback Extraction (`extract.py` + `extract_v2.md`)**
- If `rule_based_facts.json` fails schema validation due to missing complex fields, pass Clean Markdown to `extract.py` (LLM) utilizing `extract_v2.md` few-shot exemplars (`apps/data/workingfiles/working files - 20260724/extraction-contract/`).
- Merge LLM output with `rule_based_facts.json` following the `EXTRACTION_PLAYBOOK.md` teacher-student loop.

### **Task 4: Facts Accuracy & Ground-Truth Reconciliation Test (`EXTRACTION_PLAYBOOK.md` Lints)**
- **Verbatim Substring Grounding (Lint L1)**: Assert every extracted string (`policies.*`, `raw_text`, `office_hours`) physically exists as an exact substring inside document text after punctuation normalization.
- **Numeric Grounding (Lint L2)**: Assert every `weight_pct`/`points` number appears as a numeric token in the document.
- **Math Reconciliation**: Assert grading weights sum to 100% or match printed point totals.
- **Parroting Sentinel Check (Lint L9)**: Ensure small LLMs do not parrot few-shot exemplar values across different course contexts.
- **Gold-Fixture Gate**: Benchmark extraction accuracy against the 12+ human-verified gold fixtures in `apps/data/workingfiles/working files - 20260724/verified-fixtures/` and the 144 student-question stress test matrix (`STRESS_TEST_SYLLABI_CVS.md`).

### **Task 5: PostgreSQL Insertion & Quarantine Flow**
- If validation & reconciliation pass $\rightarrow$ Insert `JSONB` into `knowledge_entry.facts`.
- If reconciliation fails $\rightarrow$ Write to `.tmp/quarantine/` (`needs_review`) for teacher triage.

