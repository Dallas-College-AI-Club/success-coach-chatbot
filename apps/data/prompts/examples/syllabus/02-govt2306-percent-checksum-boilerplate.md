# Worked example — real percent-weighted syllabus with a TOTAL checksum row and contradictory boilerplate policy
<!-- doc_type: syllabus | source: raw/syllabi/2026SP/84063.html | identity: GOVT 2306 sec 148, Spring 2026, Galloway | traits: percent_grading,checksum_row,opaque_label,contradictory_policy_medium_confidence,empty_heading_null,link_only_materials -->
<!-- REAL Dallas College document (trimmed excerpt). Its identity/values are registered in
     _sentinels.json: an extraction of a DIFFERENT document containing these values is
     parroting. This source document is excluded from gold-gate aggregates (smoke-only).
     Never edit in place: replace with a numbered successor and re-run the gold gate. -->

### Context given to the extractor
```json
{
  "course_code": "GOVT 2306",
  "section": "148",
  "professor": "Galloway, Mitchell",
  "year": 2026,
  "semester": "spring"
}
```

### Document excerpt
```text
Texas Government
GOVT-2306
Spring 2026 / Section 148 / 3 Credits / 03/23/2026 to 05/14/2026 / Modified 04/02/2026

Course Information
Class Meetings:  Online Lecture / Online Campus
Withdraw Date : 04/29/2026
Certification Date : 03/30/2026

Requisites
Student must satisfy TSI Reading and TSI Writing requirements, either through specific coursework with a grade of C or better, passing test scores, or approved exemptions/waivers.

Instructor-Defined Learning Outcomes

Required Course Materials
Lecture Materials Link

Graded Work
Activity / Percentages
Chapter Quizzes / 20%
Discussion Board / 20%
Updated and Materials / 20%
Smart Book Assignments / 15%
Exams / 25%
TOTAL / 100%

Criteria
Final Grade
Letter Grade / Percentage Range
A / 90-100%
B / 80-89%
C / 70-79%
D / 60-69%
F / 0-59%

Course Policies
Unexpected Class Changes

Attendance and Participation
For in person classes, students are required to attend.  Participation and attendance represents 20% of the overall grade. Each unexcused absence is a deduction in numerical grade and increase in the deduction depending on if assignments are given on that day which the assignment cannot be made up.
In a 16 week course after 3 unexcused absences then total letter grade is lowered by one.
```

### Correct output
```json
{
  "grading": [
    {
      "raw_label": "Chapter Quizzes",
      "canonical_type": "quiz",
      "count": null,
      "weight_pct": 20,
      "points": null,
      "notes": null
    },
    {
      "raw_label": "Discussion Board",
      "canonical_type": "participation",
      "count": null,
      "weight_pct": 20,
      "points": null,
      "notes": null
    },
    {
      "raw_label": "Updated and Materials",
      "canonical_type": "other",
      "count": null,
      "weight_pct": 20,
      "points": null,
      "notes": "Label as printed; the syllabus does not explain this category."
    },
    {
      "raw_label": "Smart Book Assignments",
      "canonical_type": "homework",
      "count": null,
      "weight_pct": 15,
      "points": null,
      "notes": null
    },
    {
      "raw_label": "Exams",
      "canonical_type": "exam",
      "count": null,
      "weight_pct": 25,
      "points": null,
      "notes": null
    }
  ],
  "policies": {
    "late_work": null,
    "attendance": "For in person classes, students are required to attend. Participation and attendance represents 20% of the overall grade. Each unexcused absence is a deduction in numerical grade and increase in the deduction depending on if assignments are given on that day which the assignment cannot be made up. In a 16 week course after 3 unexcused absences then total letter grade is lowered by one.",
    "makeup": null,
    "ai_plagiarism": null,
    "extra_credit": null
  },
  "instructor_outcomes": null,
  "course_schedule": null,
  "distinctive_features": "The attendance policy is written for in-person, 16-week classes and says attendance is 20% of the grade, but this is an online section and no attendance row appears in the grading table — the syllabus does not reconcile this.",
  "full_summary": "Texas Government (GOVT 2306), Spring 2026, Section 148, taught online by Professor Galloway: the Texas constitution, state and local government, elections, and public policy. Grading is percentage-weighted: chapter quizzes (20%), discussion board (20%), a materials category (20%), SmartBook assignments (15%), and exams (25%). The attendance policy text is written for in-person classes and is not reflected in the grading table. TSI Reading and Writing standards are required. The withdraw deadline is April 29, 2026.",
  "modified_date": "2026-04-02",
  "withdraw_date": "2026-04-29",
  "certification_date": "2026-03-30",
  "inclusive_access": null,
  "required_materials": [],
  "office_hours": null,
  "instructor_contact": null,
  "confidence": "medium"
}
```

### Method notes (what this example teaches)
- Percent-weighted grading: every points field is null; the five real rows sum to 100. No per-row item counts are printed -> every count is null (never guessed from the schedule).
- "TOTAL / 100%" is a checksum row — EXCLUDED from grading[].
- "Updated and Materials" is an opaque label: keep it verbatim, map to "other", note that the document doesn't explain it. Never rename a label to something more sensible.
- The attendance text contradicts the document (in-person/16-week wording on an online 8-week section; a 20% attendance weight absent from the grading table). Copy it verbatim, surface the contradiction in distinctive_features, set confidence "medium" — do not resolve contradictions the source doesn't resolve.
- Empty headings ("Unexpected Class Changes", "Instructor-Defined Learning Outcomes") yield nothing/null.
- Optional fields differ from the other example: here late_work, makeup, ai_plagiarism are genuinely absent -> null. Nulls follow THIS document, never the example pattern.
