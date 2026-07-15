# Gold case — ACCT 2301 §24, Spring 2026 (Prin of Financial Accounting)

- **doc_type**: syllabus
- **source**: `apps/data/sample_syllabi/Prin of Financial Accounting _ Syllabus _ Concourse.pdf` (Concourse print-to-PDF, course_id 84070)
- **format**: pdf (2024/2026 archive format — text via PDF extraction, not HTML)
- **traits**: `points_grading`, `checksum_row`, `extra_credit_row`, `makeup_in_grading_notes`, `empty_heading_null`, `link_only_materials`, `two_part_final`
- **status**: `teacher_authored` — **awaiting human verification** (do NOT gate on this case until `verified`)
- **authored_by**: claude_code_session (teacher), 2026-07-15
- **verified_by**: _(pending — a club member must check every field against the PDF, including the nulls)_

## Why this document

It is a real syllabus that exhibits most of the syllabus failure taxonomy in one page, so a model that gets this case right has demonstrated the hard behaviors:

## Field-by-field verification checklist (for the human verifier)

- [ ] **Grading rows = exactly 6.** The `Total Points / 1000` row is a **checksum** and must NOT appear in `grading[]`. The `Extra Credit` row must NOT appear in `grading[]` (it is in `policies.extra_credit`).
- [ ] **Sum check**: 60 + 240 + 60 + 15 + 375 + 250 = **1000**, matching the printed `Total Points`. Because the numbers reconcile and identity matches context, `confidence` = **high**.
- [ ] **Every `weight_pct` is null** (this syllabus is points-based). Never convert points to a percentage.
- [ ] **`count`**: 12 (Ready for Class), null (Assignments — a mixed SmartBook+Assignment bucket, so no single count), 12 (Quizzes), 1 (Comprehensive Problem), 3 (Unit Exams), 2 (Final Exams = Part 1 + Part 2). Counts are copied from the "N @ …" notation, never derived by dividing points.
- [ ] **`canonical_type` judgment calls** (documented so the verifier can accept or correct):
  - `Comprehensive Problem` → `other`. It is a distinctive one-off, neither clearly a project nor homework; `other` is the safe, defensible choice. *Acceptable alternatives a verifier may allow: `homework`, `project`.*
  - `Final Exams` → `final_exam` (not `exam`), because the label says "Final".
  - `Ready for Class` and `Assignments` → `homework`.
- [ ] **`policies.late_work` = null.** The "Late Work" heading is present but has **no content under it** (the document goes straight to "Support Contacts"). This is the empty-heading trap: null, never the next section's text.
- [ ] **`policies.makeup`** is lifted from the **Final Exams grading-table notes**, not from a policies heading — make-up policy hides in grading notes here.
- [ ] **`policies.ai_plagiarism` = null.** No AI/academic-integrity statement in the body; the Institutional Policies section only links out.
- [ ] **`instructor_outcomes` = null.** The "Instructor-Defined Learning Outcomes" heading is empty. (The State-Defined outcomes that appear belong to the **course** row, not the syllabus — there is no `state_outcomes` field in facts-syllabus.)
- [ ] **`required_materials` = [].** Materials is a bookstore link only; no textbook is named. Never invent a title/ISBN.
- [ ] **`inclusive_access` = null.** No "provided free / no purchase required" statement.
- [ ] **Meetings are NOT extracted.** The class-meeting table (Brookhaven M123, Mon/Wed 11:00-12:20) belongs to the **section** row (from the schedule CSV), not to syllabus facts — facts-syllabus has no meetings field.
- [ ] **Dates**: `modified_date` 2026-04-22, `withdraw_date` 2026-04-16, `certification_date` 2026-02-02 (ISO-normalized from MM/DD/YYYY).
- [ ] **`full_summary`** and **`course_schedule`** are generative fields (scored by similarity, not exact match) — verify they are accurate and neutral, not that they match word-for-word.

## Reproduction note

`input.txt` is a faithful text rendering of the PDF for offline, parser-free scoring. When the PDF→text converter is finalized, regenerate `input.txt` from the source PDF via that converter and re-verify; a converter change that alters this text marks the case `stale` (excluded from gating) until re-verified.
