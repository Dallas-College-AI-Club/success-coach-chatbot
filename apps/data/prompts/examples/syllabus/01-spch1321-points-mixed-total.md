# Worked example — real points-based syllabus with duplicate labels, a mixed bucket, and a total that doesn't reconcile
<!-- doc_type: syllabus | source: raw/syllabi/2026SP/122458.html | identity: SPCH 1321 sec 47, Spring 2026, Minnifee | traits: points_grading,duplicate_raw_labels,mixed_bucket_other,sum_mismatch_medium_confidence,empty_heading_null,link_only_materials,plagiarism_policy -->
<!-- REAL Dallas College document (trimmed excerpt). Its identity/values are registered in
     _sentinels.json: an extraction of a DIFFERENT document containing these values is
     parroting. This source document is excluded from gold-gate aggregates (smoke-only).
     Never edit in place: replace with a numbered successor and re-run the gold gate. -->

### Context given to the extractor
```json
{
  "course_code": "SPCH 1321",
  "section": "47",
  "professor": "Minnifee, Tamisha",
  "year": 2026,
  "semester": "spring"
}
```

### Document excerpt
```text
Business Profess Communication
SPCH-1321
Spring 2026 / Section 47 / 3 Credits / 03/23/2026 to 05/14/2026 / Modified 04/27/2026

Course Information
Class Meetings:  Online Lecture / Online Campus
Withdraw Date : 04/29/2026
Certification Date : 03/30/2026

Instructor-Defined Learning Outcomes

Texas Core Objectives
The College defines essential knowledge and skills that students need to develop during
their college experience. [standard boilerplate continues]

Required Course Materials
Lecture Materials Link

Graded Work
Criteria
Type / Weight / Topic / Notes
   Syllabus Quiz    /    25   /    Syllabus Overview   / Verifies understanding of important elements of the syllabus.
   Welcome Discussion    /    25   /    Student Introductions   / Discussion to introduce yourself to the class.
   Discussions    /    150   /    Chapter Discussions 6 at 25 points each   / Interpret and explain highlights from the assigned textbook chapter.
   Quizzes/Assignments    /    200   /    Chapter Quizzes (4) /Assignments (4) at 25 points each   / Summary of chapter lessons
   Speeches    /    100   /    Who Am I Speech: Outline (25) Presentation (75)
   Speeches    /    150   /    Informative Speech (100 points) and Outline (50 points)
   Speeches    /    150   /    Persuasive Speech (100 points) and Outline (50 points)

Breakdown
Grade / Range
   A    /    900-1000
   B    /    800-899
   C    /    700-799
   D    /    600-699
   F    /    0-599

Course Policies
All Speeches and Group Assignment must be submitted to pass the class.
Attendance and Participation
Attendance is based on your log ins to eCampus. You are expected to log in every 2-3 days, if not every day. There is no attendance grade, but if you fall behind on work and have not been logging in regularly, I may contact you to discuss your participation in the course.
Late Work
Please discuss challenges with your professor. [...] LATE means your work was submitted, completed, or posted after the 11:59 PM deadline on the due date. Assignments submitted up to 3 days after the date may receive partial credit.
Plagiarism
Students will not receive credit for plagiarized assignments: There is a zero-tolerance policy for this practice. Plagiarism can be intentional (copying, stealing, buying a paper) or unintentional (forgetting to cite, or citing incorrectly). The consequences are the same.
```

### Correct output
```json
{
  "grading": [
    {
      "raw_label": "Syllabus Quiz",
      "canonical_type": "quiz",
      "count": 1,
      "weight_pct": null,
      "points": 25,
      "notes": "Verifies understanding of important elements of the syllabus."
    },
    {
      "raw_label": "Welcome Discussion",
      "canonical_type": "participation",
      "count": 1,
      "weight_pct": null,
      "points": 25,
      "notes": "Discussion to introduce yourself to the class."
    },
    {
      "raw_label": "Discussions",
      "canonical_type": "participation",
      "count": 6,
      "weight_pct": null,
      "points": 150,
      "notes": "Chapter Discussions 6 at 25 points each."
    },
    {
      "raw_label": "Quizzes/Assignments",
      "canonical_type": "other",
      "count": null,
      "weight_pct": null,
      "points": 200,
      "notes": "Mixed bucket: Chapter Quizzes (4) / Assignments (4) at 25 points each."
    },
    {
      "raw_label": "Speeches",
      "canonical_type": "presentation",
      "count": 1,
      "weight_pct": null,
      "points": 100,
      "notes": "Who Am I Speech: Outline (25) Presentation (75)."
    },
    {
      "raw_label": "Speeches",
      "canonical_type": "presentation",
      "count": 1,
      "weight_pct": null,
      "points": 150,
      "notes": "Informative Speech (100 points) and Outline (50 points)."
    },
    {
      "raw_label": "Speeches",
      "canonical_type": "presentation",
      "count": 1,
      "weight_pct": null,
      "points": 150,
      "notes": "Persuasive Speech (100 points) and Outline (50 points)."
    }
  ],
  "policies": {
    "late_work": "LATE means your work was submitted, completed, or posted after the 11:59 PM deadline on the due date. Assignments submitted up to 3 days after the date may receive partial credit.",
    "attendance": "Attendance is based on your log ins to eCampus. You are expected to log in every 2-3 days, if not every day. There is no attendance grade, but if you fall behind on work and have not been logging in regularly, I may contact you to discuss your participation in the course.",
    "makeup": null,
    "ai_plagiarism": "Students will not receive credit for plagiarized assignments: There is a zero-tolerance policy for this practice. Plagiarism can be intentional (copying, stealing, buying a paper) or unintentional (forgetting to cite, or citing incorrectly). The consequences are the same.",
    "extra_credit": null
  },
  "instructor_outcomes": null,
  "course_schedule": null,
  "distinctive_features": "All speeches and the group assignment must be submitted to pass the class. The graded-work table totals 800 points while the letter-grade scale spans 0-1000; the syllabus does not reconcile the difference.",
  "full_summary": "Business and Professional Communication (SPCH 1321), Spring 2026, Section 47, taught online by Professor Minnifee: communication in business and professional contexts with graded discussions, chapter quizzes and assignments, and three speech sequences (Who Am I, informative, persuasive) with outlines. All speeches and the group assignment must be submitted to pass. Late work may receive partial credit up to 3 days after the deadline; plagiarism carries a zero-tolerance policy. The withdraw deadline is April 29, 2026.",
  "modified_date": "2026-04-27",
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
- Points-based grading: every weight_pct is null. count records how many items make up a row (6 chapter discussions; each speech sequence is one row with count 1); count is null for the mixed "Quizzes/Assignments" bucket — never derive a count by dividing points.
- Three rows share the verbatim label "Speeches" — keep all three as separate rows; never merge or rename them.
- "Quizzes/Assignments" is a mixed bucket -> canonical_type "other", with the mix recorded in notes.
- The grading rows total 800 but the letter scale runs to 1000. The document does not reconcile this: record the observation in distinctive_features and set confidence "medium" — numbers that don't add up are never silently "fixed".
- "Instructor-Defined Learning Outcomes" heading is empty -> null. The "Texas Core Objectives" boilerplate that follows it appears on every syllabus and is NOT instructor outcomes.
- "Lecture Materials Link" names nothing -> required_materials [] (never invent titles).
- A plagiarism policy belongs in policies.ai_plagiarism even when it never mentions AI.
- No office hours or instructor contact printed -> null; identity comes from the context block, not the document.
