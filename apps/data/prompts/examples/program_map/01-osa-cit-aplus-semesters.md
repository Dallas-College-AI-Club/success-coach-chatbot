# Worked example — real occupational skills award with semester-sequenced fixed groups and a capstone footnote
<!-- doc_type: program_map | source: raw/catalog/2026-2027/programs/2760.html | identity: OSA_CIT_A+, 2026-2027 catalog | traits: fixed_groups,semester_sequence,footnote_rule,tsi_waiver_note,ui_noise -->
<!-- REAL Dallas College document (trimmed excerpt). Its identity/values are registered in
     _sentinels.json: an extraction of a DIFFERENT document containing these values is
     parroting. This source document is excluded from gold-gate aggregates (smoke-only).
     Never edit in place: replace with a numbered successor and re-run the gold gate. -->

### Context given to the extractor
```json
{
  "program_code": "OSA_CIT_A+",
  "catalog_year": "2026-2027"
}
```

### Document excerpt
```text
A+ Occupational Skills Award

Location(s):

Brookhaven
,
Close
Cedar Valley
,
Close
Eastfield
,
Close
El Centro
,
Close
Mountain View
,
Close
North Lake
,
Close
Richland
Close

(Occupational Skills Award)

Offered on all campuses

Students pursuing this certificate are waived from the Texas Success Initiative (TSI) standards, but must meet course prerequisites.

Complete at least 25% of the credit hours required for graduation through instruction by Dallas College.

Degree Plan Code: OSA_CIT_A+

This sequence is for students interested in A+ Certification. Completers will learn how a PC works and will also be able to write specifications for PCs, perform routine maintenance and be able to troubleshoot and repair simple problems.

Semester 1
ITNW 1308 - Implementing and Supporting Client Operating Systems (3 Credit Hours)
ITSC 1325 - Personal Computer Hardware (3 Credit Hours)
Semester Total: 6 Credit Hours
Semester 2
ITSC 1305 - Introduction to PC Operating Systems (3 Credit Hours)
 *
Semester Total: 3 Credit Hours
Minimum Hours Required: 9 Credit Hours
Note(s)
*
ITSC 1305

 Introduction to PC Operating Systems is the capstone course for this award.
```

### Correct output
```json
{
  "program_code": "OSA_CIT_A+",
  "name": "A+ Occupational Skills Award",
  "award_type": "Occupational Skills Award",
  "school": null,
  "total_credits": 9,
  "catalog_year": "2026-2027",
  "groups": [
    {
      "name": "Semester 1",
      "component_area_code": null,
      "credits_required": 6,
      "rule": null,
      "slot_kind": "fixed",
      "options_exhaustive": null,
      "exclusions": [],
      "courses": [
        "ITNW 1308",
        "ITSC 1325"
      ]
    },
    {
      "name": "Semester 2",
      "component_area_code": null,
      "credits_required": 3,
      "rule": "ITSC 1305 Introduction to PC Operating Systems is the capstone course for this award.",
      "slot_kind": "fixed",
      "options_exhaustive": null,
      "exclusions": [],
      "courses": [
        "ITSC 1305"
      ]
    }
  ],
  "confidence": "high"
}
```

### Method notes (what this example teaches)
- The Location(s) list is polluted with dropdown artifacts ("Close" tokens) — ignore UI noise; "Offered on all campuses" is the meaningful statement.
- Semester blocks with explicit course lists are slot_kind "fixed"; "Semester Total" lines give credits_required; "Minimum Hours Required" gives total_credits.
- The asterisk footnote resolves to a rule on the group containing the footnoted course.
- options_exhaustive is null (the catalog neither confirms nor denies other options) — false only when it SAYS other options exist.
- "Degree Plan Code:" is the program_code. No school/division is printed -> school null.
- The TSI-waiver sentence has no facts field; it remains retrievable as a prose chunk of the same page — facts capture structure, chunks keep everything else.
