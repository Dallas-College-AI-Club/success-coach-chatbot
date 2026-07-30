# Worked example — a clean percent-weighted syllabus that EARNS confidence high (and keeps the source's typos)
<!-- doc_type: syllabus | source: raw/syllabi/2026SP/85860.html | identity: COSC 1437 sec 5, Spring 2026, Sharma | traits: percent_grading,checksum_row,named_textbook,empty_heading_null -->
<!-- REAL Dallas College document (trimmed excerpt), extracted claude_code_session,
     adversarially verified (2 independent review passes) 2026-07-24. NOT yet registered in
     _sentinels.json (that file lives on feat/61-extraction-harness); register these
     identity/values there when folding this example in. Excluded from gold-gate
     aggregates (smoke-only). Never edit in place: replace with a numbered successor
     and re-run the gold gate. -->

### Context given to the extractor
```json
{
  "course_code": "COSC 1437",
  "section": "15",
  "professor": "Sharma, Prabhat",
  "year": 2026,
  "semester": "spring"
}
```

### Document excerpt
```text
Programming Fundamentals II
COSC-1437
Spring 2026
Section 15
4 Credits
01/20/2026 to 05/14/2026
Modified 01/21/2026
Course Information
Class Meetings:
[...]
Online Lecture
Online Campus
Online Laboratory
Online Campus
Withdraw Date :
04/16/2026
Certification Date :
02/02/2026
Course Description
This course focuses on the object-oriented programming paradigm, emphasizing the definition and use of classes along with fundamentals of object-oriented design. The course includes basic analysis of algorithms, searching and sorting techniques, and an introduction to software engineering processes. Students will apply techniques for testing and debugging software. This course may use instructional examples and assignments form various programming languages including but not limited to C, Objective-C, C++, and/or Java. (This course is included in the Field of Study Curriculum for Computer Science.) COSC 1437 will satisfy the Associate in Sciences degree general elective requirement. This course will fulfill degree requirements established by the colleges of DCCCD only if this course has been successfully completed and the date of completion does not exceed 10 years.
[...]
Instructor-Defined Learning Outcomes
Required Course Materials
Lecture Materials Link
Laboratory Materials Link
Starting Out with Java: From Control Structures through Objects
Author:
Tony Gaddis
Publisher:
Pearson
Edition:
8
ISBN:
0137357958
This book will be made available to the students in the Learning Materials section of Brightspace.
Software
NetBeans
is the recommended
Integrated Development Environment (IDE)
Graded Work
[...]
Criteria
Assignments and Assessments
Topic and Numbers
Percentage Weight for the Course
Notes
Quizzes
5 Quizzes each of 100 marks.
20%
Multiple choice questions from Textbook Chapters
Lab Assignments
5 Labs each of 100 marks.
25%
Short programming assignments.
Programming Projects
2 Programming Projects each of 100 marks
25%
Complex programming assignments.
Exams
2 Exams each of 100 marks.
30%
Multiple choice questions covering the half of the chapters for mid-term, and remaining half of the chapters for final.
TOTAL: 100%
[...]
Course Schedule
This schedule is for reading your textbook and doing practice of the programs given in the book. These are not going to be graded. However, you will certainly need to complete these to do the gradable assignments.
Week (s)
Topic
Readings
1,2
Introduction to Computers and Java
Java Fundamentals
Chapter 1
Chapter 2
[...]
13,14
Map and HashMap Collections
Recursion
Documents
Chapter 15
Here is scheduled and locations of the graded assignments and examinations.
Activity
Folder
Available
on
Due Date
Lab Assignment 1
Assignments
02/08
02/21
[...]
Mid-Term Exam (Chaters 1-6)
Quizzes
03/27
03/28
[...]
Final Exam (Chapters 7–11, 15, plus)
Quizzes
05/08
05/09
[...]
Course Policies
Unexpected Class Changes
Late Work
Lab Assignments and Programming Projects submitted one (1) day after their due date will be graded on the basis of a maximum of 90 points instead of 100 points.
Lab Assignments and Programming Projects submitted two (2) days after their due date will be graded on the basis of a maximum of 80 points instead of 100 points.
Lab Assignments and Programming Projects submitted three (3) days after their due date will be graded on the basis of a maximum of 70 points instead of 100 points.
Lab Assignments and Programming Projects submitted four (4) or more days after their due date will receive a grade of zero (0) points.
The Quizzes and the Examinations will not be made available after the due dates.
[...]
[...]
This schedule is for reading your textbook and doing practice of the programs given in the book. These are not going to be graded. However, you will certainly need to complete these to do the gradable assignments.
Week (s)
Readings
[...]
Decision Structures
Loops and Files
[...]
Inheritance and Polymorphism
Recursion
[...]
```

### Correct output
```json
{
  "grading": [
    {
      "raw_label": "Quizzes",
      "canonical_type": "quiz",
      "count": 5,
      "weight_pct": 20,
      "points": null,
      "notes": "5 Quizzes each of 100 marks. Multiple choice questions from Textbook Chapters. Row unit is percent; the 100 marks are per-item scores, not the row weight."
    },
    {
      "raw_label": "Lab Assignments",
      "canonical_type": "lab",
      "count": 5,
      "weight_pct": 25,
      "points": null,
      "notes": "5 Labs each of 100 marks. Short programming assignments."
    },
    {
      "raw_label": "Programming Projects",
      "canonical_type": "project",
      "count": 2,
      "weight_pct": 25,
      "points": null,
      "notes": "2 Programming Projects each of 100 marks. Complex programming assignments."
    },
    {
      "raw_label": "Exams",
      "canonical_type": "exam",
      "count": 2,
      "weight_pct": 30,
      "points": null,
      "notes": "2 Exams each of 100 marks. Multiple choice questions covering the half of the chapters for mid-term, and remaining half of the chapters for final. Single row combines the mid-term and the final exam."
    }
  ],
  "policies": {
    "late_work": "Lab Assignments and Programming Projects submitted one (1) day after their due date will be graded on the basis of a maximum of 90 points instead of 100 points. Lab Assignments and Programming Projects submitted two (2) days after their due date will be graded on the basis of a maximum of 80 points instead of 100 points. Lab Assignments and Programming Projects submitted three (3) days after their due date will be graded on the basis of a maximum of 70 points instead of 100 points. Lab Assignments and Programming Projects submitted four (4) or more days after their due date will receive a grade of zero (0) points. The Quizzes and the Examinations will not be made available after the due dates.",
    "attendance": null,
    "makeup": null,
    "ai_plagiarism": null,
    "extra_credit": null
  },
  "instructor_outcomes": null,
  "course_schedule": "Weekly reading schedule (weeks 1-14) covering textbook chapters 1-11 and 15: Java fundamentals, decision structures, loops and files, methods, classes, arrays and the ArrayList class, file I/O, text processing, inheritance and polymorphism, exceptions, Map and HashMap collections, and recursion; the syllabus states these readings are not graded but are needed to do the gradable assignments. A separate table schedules the graded assignments and examinations from 02/08 through 05/09 (dates printed without year), with the Mid-Term Exam (chapters 1-6) due 03/28 and the Final Exam (chapters 7-11, 15) due 05/09.",
  "distinctive_features": "The Gaddis textbook is provided to students in the Learning Materials section of Brightspace; NetBeans is the recommended IDE. A weekly reading/practice schedule is explicitly ungraded but required to complete the gradable assignments. Late lab assignments and programming projects are graded out of a shrinking maximum (90, 80, then 70 points at one, two, and three days late; zero at four or more days), while quizzes and exams are simply not made available after their due dates.",
  "full_summary": "Programming Fundamentals II (COSC 1437), Spring 2026, Section 15, taught online by Professor Sharma: object-oriented programming with classes, inheritance, and polymorphism, basic algorithm analysis, searching and sorting, and an introduction to software engineering, primarily in Java. Grading is percentage-weighted: five quizzes (20%), five lab assignments (25%), two programming projects (25%), and two exams (30%, mid-term and final). The Gaddis textbook Starting Out with Java (8th edition) is provided through Brightspace, and NetBeans is the recommended IDE. Late labs and projects are capped at 90/80/70 points for 1-3 days late and earn zero after four days; quizzes and exams are unavailable after due dates. The withdraw deadline is April 16, 2026.",
  "modified_date": "2026-01-21",
  "withdraw_date": "2026-04-16",
  "certification_date": "2026-02-02",
  "inclusive_access": null,
  "required_materials": [
    {
      "raw_text": "Starting Out with Java: From Control Structures through Objects Author: Tony Gaddis Publisher: Pearson Edition: 8 ISBN: 0137357958 This book will be made available to the students in the Learning Materials section of Brightspace.",
      "title": "Starting Out with Java: From Control Structures through Objects",
      "author": "Tony Gaddis",
      "isbn": "0137357958",
      "edition": "8",
      "cost": null,
      "required": true
    },
    {
      "raw_text": "NetBeans is the recommended Integrated Development Environment (IDE)",
      "title": "NetBeans",
      "author": null,
      "isbn": null,
      "edition": null,
      "cost": null,
      "required": false
    }
  ],
  "office_hours": null,
  "instructor_contact": null,
  "confidence": "high"
}
```

### Method notes (what this example teaches)
- This is what a clean extraction looks like: four percentage rows summing to exactly
  100, the "TOTAL / 100%" checksum row excluded, identity matching the context,
  no internal contradictions -> confidence high. High is EARNED by consistency, not
  the default.
- Source typos are preserved character-for-character: "Mid-Term Exam (Chaters 1-6)"
  and "assignments form various programming languages" stay as printed. Cleaning up a
  typo is a verbatim violation — the gold gate diffs bytes.
- The reading schedule is explicitly "not going to be graded" — it feeds
  course_schedule (a generative field), never grading[].
- Percent rows: every points field null; no counts are printed anywhere -> every count
  null (a count is never guessed from the schedule's per-chapter quiz list).
