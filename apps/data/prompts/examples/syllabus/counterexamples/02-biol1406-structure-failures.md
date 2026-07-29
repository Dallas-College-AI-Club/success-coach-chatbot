# COUNTEREXAMPLE — BIOL 1406, structural extraction failures
## ⚠ The output below is WRONG on purpose — do NOT imitate it
<!-- doc_type: syllabus | source: raw/syllabi/2026SP/84963.html | identity: BIOL 1406 sec 77, Spring 2026, Tiwari | NEGATIVE EXAMPLE — never splice into a prompt's positive {{EXAMPLES}}; see counterexamples/README.md. Sibling worked exemplar (same document, CORRECT output): ../05-biol1406-drops-contradictions-hidden-policies.md -->

The sibling exemplar shows this document's correct 9-row extraction reconciling to the
printed Total Points 1100. Below is what a naive extractor plausibly produces instead —
each mistake annotated. (Fields not shown behave as in the sibling.)

### WRONG output (grading + key fields only)
```json
{
  "grading": [
    { "raw_label": "Orientation", "canonical_type": "quiz", "count": 3, "weight_pct": null, "points": 30, "notes": null },
    { "raw_label": "Lecture Exams", "canonical_type": "exam", "count": 5, "weight_pct": null, "points": 500, "notes": "Six exams, lowest dropped, so five count." },
    { "raw_label": "Lecture", "canonical_type": "quiz", "count": 10, "weight_pct": null, "points": 100, "notes": "Each quiz worth 10 points." },
    { "raw_label": "Project", "canonical_type": "project", "count": 1, "weight_pct": null, "points": 100, "notes": null },
    { "raw_label": "Lab", "canonical_type": "lab", "count": 29, "weight_pct": null, "points": 330, "notes": "Lab participation, projects, quizzes, and report evaluation combined. Lab quizzes are worth 10 points each." },
    { "raw_label": "Attendance", "canonical_type": "participation", "count": null, "weight_pct": null, "points": 40, "notes": null },
    { "raw_label": "Practice Exams", "canonical_type": "exam", "count": 5, "weight_pct": null, "points": 0, "notes": "Ungraded practice exams." },
    { "raw_label": "Total Points", "canonical_type": "other", "count": null, "weight_pct": null, "points": 1100, "notes": null }
  ],
  "policies": {
    "extra_credit": null,
    "makeup": null
  },
  "instructor_outcomes": null,
  "distinctive_features": null,
  "inclusive_access": null,
  "required_materials": [
    { "raw_text": "Biology Course Material, 6th Edition, ISBN 9781266769764", "title": "Biology Course Material", "author": "McGraw Hill", "isbn": "9781266769764", "edition": "6th", "cost": null, "required": true }
  ],
  "confidence": "high"
}
```

### Why each part is wrong

1. **"Total Points / 1100" kept as a grading row.** It is the checksum; it is excluded,
   and its job is the sum check (the real rows total exactly 1100). *(checksum_row)*
2. **The four duplicate "Lab" rows MERGED into one** (count 29, points 330). Duplicate
   raw_labels stay separate rows — participation (30), 4 lab projects (150), 24 lab
   quizzes (100), lab report evaluation (50) — disambiguated by notes only.
   *(duplicate_raw_labels)*
3. **Post-drop recomputation.** "count": 5 for lecture exams applies the "one dropped"
   note to the printed count. The table prints "6 lecture exams" -> count 6; drops are
   recorded in notes, never applied to counts or points. Same error on lecture quizzes
   (10 instead of the printed 12). *(drop policy vs printed values)*
4. **Silent contradiction resolution.** The table prints lab quizzes at "05" points
   each; the prose says "worth 10 points each". The wrong output just asserts 10. The
   correct move: keep the table's printed row values, record BOTH figures and the
   irreconciliation, cap confidence at medium. *(sum_mismatch / contradiction)*
5. **"Orientation / 3 / various / 30" read as count 3, type quiz.** "3" is a coursework
   cell on a mixed bucket whose per-item points are "various" — mixed bucket -> type
   "other", count null. A printed digit is not automatically a count.
   *(mixed_bucket_other)*
6. **Ungraded Practice Exams added as a grading row.** The document says they "do not
   count toward your grade" — they never enter grading[]. *(grading = graded work only)*
7. **"Lecture Exams" is not the printed label** — the Criteria table prints the
   component label "Lecture". raw_label is verbatim from the table. *(verbatim)*
8. **policies.extra_credit: null although stated.** Extra credit lives in the
   Participation Policy prose (on-time arrival eligibility, Kahoot bonus points) —
   prose placement does not make it optional to extract. *(null discipline)*
9. **policies.makeup: null although stated** under "Missed Exams"/"Retakes" and the
   lab sections ("Only one lab quiz may be made up during the Lab Practical...").
   *(null discipline; makeup_in_grading_notes)*
10. **instructor_outcomes: null** — the heading holds the department proctored-testing
    requirement; it is content, not boilerplate. **inclusive_access: null** despite the
    IncludED passage -> true. **Author field invented**: the page prints the (odd but
    real) author "Bookers Biology"; "McGraw Hill" is the publisher promoted into the
    author slot. The Sharpen Study App and the two computer-requirement entries are
    dropped from required_materials entirely. *(hallucination + omission)*
11. **confidence: "high"** with two unresolved contradictions (quiz points, Chromebook)
    and an unassigned 650-659 grade band -> medium, with the contradictions recorded
    in distinctive_features. *(confidence tiers)*

### Corrected grading skeleton (full correct output in exemplar 05)
```text
Orientation      other          count null  30 pts   (mixed bucket, "various" each)
Lecture          exam           count 6    500 pts   ("6 taken, one dropped" in notes)
Lecture          quiz           count 12   100 pts   ("12 taken, two dropped." in notes)
Project          project        count 1    100 pts
Lab              participation  count null  30 pts
Lab              lab            count 4    150 pts   ("4 taken, I dropped" verbatim)
Lab              quiz           count 24   100 pts   (05 vs 10 contradiction recorded)
Lab              lab            count 1     50 pts   (report evaluation)
Attendance       participation  count null  40 pts
                                    SUM = 1100 = printed Total Points  ✓
```
