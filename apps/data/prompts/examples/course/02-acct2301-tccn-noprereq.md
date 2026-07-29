# Worked example — real course with a TCCN marking, a CB approval number, and no prerequisites
<!-- doc_type: course | source: raw/catalog/2026-2027/courses/15128.html | identity: ACCT 2301, 2026-2027 catalog | traits: tccn_present,cb_approval,no_prereqs,multi_campus -->
<!-- REAL Dallas College document (trimmed excerpt). Its identity/values are registered in
     _sentinels.json: an extraction of a DIFFERENT document containing these values is
     parroting. This source document is excluded from gold-gate aggregates (smoke-only).
     Never edit in place: replace with a numbered successor and re-run the gold gate. -->

### Context given to the extractor
```json
{
  "course_code": "ACCT 2301",
  "catalog_year": "2026-2027"
}
```

### Document excerpt
```text
ACCT 2301 - Principles of Financial Accounting (3 Credit Hours)
Campus Location:

BHC, CVC, EFC, ECC, MVC, NLC, RLC
This course is an introduction to the fundamental concepts of financial accounting as prescribed by U.S. generally accepted accounting principles (GAAP) as applied to transactions and events that affect business organizations. Students will examine the procedures and systems to accumulate, analyze, measure, and record financial transactions.
Course Hour Configuration
 (3 Lec.)
Acad
Coordinating Board Academic Approval Number 5203015104
This is a Texas Common Course Number.
```

### Correct output
```json
{
  "course_code": "ACCT 2301",
  "title": "Principles of Financial Accounting",
  "credit_hours": 3,
  "description": "This course is an introduction to the fundamental concepts of financial accounting as prescribed by U.S. generally accepted accounting principles (GAAP) as applied to transactions and events that affect business organizations. Students will examine the procedures and systems to accumulate, analyze, measure, and record financial transactions.",
  "state_outcomes": null,
  "prerequisites": [],
  "corequisites": [],
  "requisites_raw": null,
  "is_core": null,
  "core_component_area": null,
  "tccn": "ACCT 2301",
  "cb_approval_number": "5203015104",
  "campus_locations": "BHC, CVC, EFC, ECC, MVC, NLC, RLC",
  "confidence": "high"
}
```

### Method notes (what this example teaches)
- "This is a Texas Common Course Number." -> tccn is this course's own code string.
- "Coordinating Board Academic Approval Number 5203015104" -> cb_approval_number verbatim digits.
- No Prerequisites section at all -> prerequisites [] and requisites_raw null (nothing printed to copy).
- The catalog page carries no Core Curriculum marking -> is_core null even though the course may appear in core lists elsewhere; each row reports only its own source.
