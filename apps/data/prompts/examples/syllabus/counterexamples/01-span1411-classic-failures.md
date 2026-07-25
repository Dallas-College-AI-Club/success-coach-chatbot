# COUNTEREXAMPLE — SPAN 1411, ten classic extraction failures
## ⚠ The output below is WRONG on purpose — do NOT imitate it
<!-- doc_type: syllabus | source: raw/syllabi/2026SP/91845.html | identity: SPAN 1411 sec 36, Spring 2026, Vega | NEGATIVE EXAMPLE — never splice into a prompt's positive {{EXAMPLES}}; see counterexamples/README.md. Sibling worked exemplar (same document, CORRECT output): ../06-span1411-two-part-final-bare-weight.md -->

Every mistake below is the kind a competent-but-unguided model actually makes on this
real document. Each is annotated with the rule it breaks and the correct value.

### Context given to the extractor
```json
{
  "course_code": "SPAN 1411",
  "section": "36",
  "professor": "Vega, Gerardo",
  "year": 2026,
  "semester": "spring"
}
```

### WRONG output (a plausible naive extraction)
```json
{
  "grading": [
    {
      "raw_label": "Marketable Skills Lesson",
      "canonical_type": "homework",
      "count": 1,
      "weight_pct": 3,
      "points": null,
      "notes": null
    },
    {
      "raw_label": "Weekly Conectados MindTap Activities",
      "canonical_type": "homework",
      "count": 16,
      "weight_pct": 75,
      "points": null,
      "notes": "Weekly activities due every Tuesday."
    },
    {
      "raw_label": "Final Exam",
      "canonical_type": "final_exam",
      "count": 2,
      "weight_pct": 22,
      "points": null,
      "notes": "Two-part final: a monologue and a reflection."
    },
    {
      "raw_label": "Extra Credit",
      "canonical_type": "other",
      "count": 2,
      "weight_pct": null,
      "points": 6,
      "notes": "Two Virtual Class Get-Togethers at 3 points each."
    }
  ],
  "policies": {
    "late_work": "Late work is not accepted without documentation.",
    "attendance": null,
    "makeup": null,
    "ai_plagiarism": "AI-generated work counts as plagiarism and is scored zero.",
    "extra_credit": null
  },
  "instructor_outcomes": null,
  "course_schedule": "Weekly activities due Tuesdays; final exam at the end of the semester.",
  "distinctive_features": null,
  "full_summary": "Beginning Spanish I (SPAN 1411), Spring 2026, an online course taught by Professor Vega with weekly MindTap activities and a final exam.",
  "modified_date": "01/07/2026",
  "withdraw_date": "2026-04-16",
  "certification_date": "2026-02-02",
  "inclusive_access": null,
  "required_materials": [
    {
      "raw_text": "Conectados MindTap (2nd Edition) by Marinelli and Fajardo",
      "title": "Conectados: Spanish Communication Guide",
      "author": "Marinelli and Fajardo",
      "isbn": "9780357424209",
      "edition": "2nd Edition",
      "cost": "$120",
      "required": true
    }
  ],
  "office_hours": "By appointment",
  "instructor_contact": null,
  "confidence": "high"
}
```

### Why each part is wrong

1. **Two-part final MERGED into one row** (`"Final Exam"`, count 2, weight 22). The
   document prints TWO table rows — "Final Exam Part 1: Monólogo Final / 12" and
   "Final Exam Part 2: Course Reflection Assignment / 10%". Row structure follows the
   print: two rows -> two `final_exam` rows. Merging also laundered the bare-"12"
   ambiguity out of existence. *(trait: two_part_final)*

2. **`count: 16` invented from "16-Week online course."** No multiplier is printed on
   the MindTap row. Counts come only from printed "N @ ..." notation — never from the
   course length, the schedule, or division. Correct: `null`. *(count inference)*

3. **"Extra Credit" kept as a grading row, with `points: 6` computed as 2 x 3.** Extra
   credit is NEVER a grading row — the whole block goes verbatim to
   `policies.extra_credit` (including "No more extra credit will be given. So, please
   do not ask!"). Bonus wrongness: it put POINTS on a percent-weighted syllabus row.
   *(traits: extra_credit_row, mixed units)*

4. **`policies.late_work` paraphrased.** The source says: "Late work is NOT tolerated.
   No assignments will be accepted after their due date without proper documentation
   for consideration and/or prior arrangement. FYI: ..." — verbatim fields are copied
   character-for-character, never summarized. *(verbatim rule)*

5. **`policies.makeup: null` although the document has a "Make Up Work Policy"
   heading** with five paragraphs (48-hour rule, no resets/retakes, tech-issue
   documentation). A null for stated content is as wrong as inventing a value.
   *(null discipline)*

6. **`instructor_outcomes: null`** — the Instructor-Defined Learning Outcomes heading
   is NOT empty here; it contains the Marketable Skills & Digital Badging statement.
   Dismissing it as "boilerplate" dropped stated content. *(null discipline; contrast
   with documents where the heading truly is empty)*

7. **Textbook title mutated and cost invented.** The printed title is "Conectados
   MindTap"; "Conectados: Spanish Communication Guide" does not exist in the source.
   "$120" is fabricated — the source says the e-textbook is "provided free of charge
   to students" via IncludED, which also means `inclusive_access` should be `true`,
   not `null`. Four more named required materials (internet/eCampus, headphones or
   speakers, microphone, the IMPORTANT desktop/laptop requirement) were dropped.
   *(hallucination + omission)*

8. **`office_hours: "By appointment"` invented.** The source never states office
   hours. Plausible-sounding defaults are hallucinations. *(hallucination)*

9. **`modified_date` not ISO-normalized** ("01/07/2026" instead of "2026-01-07").
   *(normalization)*

10. **`confidence: "high"` forced.** The bare "12" weight had to be resolved by
    inference (12% because the column is percentages and the rows then sum to 100) —
    a resolved ambiguity is `medium`, recorded in the row's notes. High is earned by
    an unambiguous, internally consistent parse, which this document does not offer.
    *(confidence tiers)*

Minor: "Marketable Skills Lesson" is a college-initiative module, not homework —
`other` is the honest bucket.

### Corrected grading + extra credit (the core contrast; full correct output in exemplar 06)
```json
{
  "grading": [
    { "raw_label": "Marketable Skills Lesson", "canonical_type": "other", "count": 1, "weight_pct": 3, "points": null, "notes": "As part of the Dallas College initiative, you need to complete the Marketable Skills Lesson module during Week 1 of the semester." },
    { "raw_label": "Weekly Conectados MindTap Activities", "canonical_type": "homework", "count": null, "weight_pct": 75, "points": null, "notes": "Each week, you will have a batch of activities from our digital textbook, Conectados MindTap, to complete by a certain due date. All activities will be available from the first day of the semester to provide flexibility along with a weekly due date schedule for all activities on eCampus." },
    { "raw_label": "Final Exam Part 1: Monólogo Final", "canonical_type": "final_exam", "count": 1, "weight_pct": 12, "points": null, "notes": "Weight printed as '12' with no percent sign while every other row prints a percentage under the same Weight column; read as 12% (the four rows then sum to 100). At the end of the semester, as part of the 2-part Final Exam, you will video-record a brief monologue and upload it to eCampus." },
    { "raw_label": "Final Exam Part 2: Course Reflection Assignment", "canonical_type": "final_exam", "count": 1, "weight_pct": 10, "points": null, "notes": "At the end of the semester, as part of the Final Exam, you will write a brief course reflection in English based on a set of provided prompts/questions." }
  ],
  "policies_extra_credit_goes_here": "EXTRA CREDIT OPPORTUNITIES: Virtual Class Get-Togethers! ... up to 3 points added to their final grade for each VCGT ... No more extra credit will be given. So, please do not ask!"
}
```
