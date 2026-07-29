# Worked example — real course whose cross-listing 'or' must NOT be parsed as a one-of prerequisite
<!-- doc_type: course | source: raw/catalog/2026-2027/courses/15149.html | identity: ACNT 2303, 2026-2027 catalog | traits: required_prereq,crosslist_or_trap,wecm_not_tccn,line_shredded_links -->
<!-- REAL Dallas College document (trimmed excerpt). Its identity/values are registered in
     _sentinels.json: an extraction of a DIFFERENT document containing these values is
     parroting. This source document is excluded from gold-gate aggregates (smoke-only).
     Never edit in place: replace with a numbered successor and re-run the gold gate. -->

### Context given to the extractor
```json
{
  "course_code": "ACNT 2303",
  "catalog_year": "2026-2027"
}
```

### Document excerpt
```text
ACNT 2303 - Intermediate Accounting I (3 Credit Hours)
Campus Location:

BHC, CVC, EFC, ECC, MVC, NLC, RLC
Analysis of generally accepted accounting principles, concepts, and theory underlying the preparation of financial statements.
Prerequisites:

Required

:
ACCT 2301

.
This course is cross-listed as ACNT 2403. The student may register for either ACNT 2303 or ACNT 2403 but may receive credit for only one of the two.
Course Hour Configuration
 (3 Lec.)
CTE
This is a WECM Course Number.
```

### Correct output
```json
{
  "course_code": "ACNT 2303",
  "title": "Intermediate Accounting I",
  "credit_hours": 3,
  "description": "Analysis of generally accepted accounting principles, concepts, and theory underlying the preparation of financial statements.",
  "state_outcomes": null,
  "prerequisites": [
    {
      "one_of": [
        "ACCT 2301"
      ],
      "raw_text": "Required: ACCT 2301."
    }
  ],
  "corequisites": [],
  "requisites_raw": "Prerequisites: Required: ACCT 2301. This course is cross-listed as ACNT 2403. The student may register for either ACNT 2303 or ACNT 2403 but may receive credit for only one of the two.",
  "is_core": null,
  "core_component_area": null,
  "tccn": null,
  "cb_approval_number": null,
  "campus_locations": "BHC, CVC, EFC, ECC, MVC, NLC, RLC",
  "confidence": "high"
}
```

### Method notes (what this example teaches)
- The page text shreds links across lines ("Required\n\n:\nACCT 2301\n\n.") — reassemble the sentence; a single required course is a one-entry prerequisites list whose one_of has one member.
- THE TRAP: "may register for either ACNT 2303 or ACNT 2403" is a CROSS-LISTING note, not an alternative prerequisite. It stays verbatim inside requisites_raw and never becomes a one_of.
- "This is a WECM Course Number." is NOT a Texas Common Course Number marking -> tccn null.
- No Core Curriculum marking -> is_core null (the source didn't say; never false by assumption).
