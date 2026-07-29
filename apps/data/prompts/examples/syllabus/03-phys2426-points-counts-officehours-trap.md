# Worked example — real points-based syllabus with printed counts, a fully-named textbook, a make-up policy hidden in grading notes, and an office-hours keyword trap
<!-- doc_type: syllabus | source: raw/syllabi/2026SP/95865.html | identity: PHYS 2426 sec 22, Spring 2026, Taylor | traits: points_grading,named_textbook,makeup_in_grading_notes,plagiarism_policy -->
<!-- REAL Dallas College document (trimmed excerpt), extracted claude_code_session,
     adversarially verified (2 independent review passes) 2026-07-24. NOT yet registered in
     _sentinels.json (that file lives on feat/61-extraction-harness); register these
     identity/values there when folding this example in. Excluded from gold-gate
     aggregates (smoke-only). Never edit in place: replace with a numbered successor
     and re-run the gold gate. -->

### Context given to the extractor
```json
{
  "course_code": "PHYS 2426",
  "section": "22",
  "professor": "Taylor, Zachary",
  "year": 2026,
  "semester": "spring"
}
```

### Document excerpt
```text
University Physics II
PHYS-2426
Spring 2026
Section 22
4 Credits
01/20/2026 to 05/14/2026
Modified 01/14/2026
Course Information
Class Meetings:
[...]
In-Person Lecture
Cedar Valley Campus; M Building; ROOM M160
Mon/Wed ; 1:30 PM - 2:50 PM
[...]
Withdraw Date :
04/16/2026
Certification Date :
02/02/2026
Course Description
The second semester of calculus - based physics sequence for science, computer science, and engineering majors. Principles of electricity and magnetism, including circuits, electromagnetism, waves, sound, light, and optics are studied. Performance of basic laboratory experiments supporting theoretical physics principles and applications of electricity and magnetism, including circuits, electromagnetism, waves, sound, light, and optics. Also includes experimental design, data collection and analysis, and preparation of laboratory reports.
[...]
Required Course Materials
Lecture Materials Link
Laboratory Materials Link
Modified Mastering w/eText for University Physics
Author:
Young
Publisher:
Pearson Learning Solutions
Edition:
15th
ISBN:
9780136840213
Access to a computer with internet access
Calculator
Can be any calculator. Ideally a scientific one. On test days I have a few that I can spare for use.
[...]
Type
Weight
Topic
Notes
   Group Work
   150 Points
   15 group worksheets at 10 points each
You will work with your group members to complete a few questions over that week's topic. This will include discussions and solving problems together completed at the end of the lecture.
   Homework
   225 Points
   15 Assignments at 15 points each
Homework problems will be completed through Mastering Physics. These assignments will be due at the end of the week. Mastering Physics will be accessed through eCampus.
   Labs
   225 points
   9 Labs at 25 points each
These labs will include taking quantitative and qualitative measurements during experiments in small groups. These experiments will be completed during lab time.
This course satisfies the core curriculum requirement for scientific discovery and
sustainability. A minimum lab average of 60% is required in order to pass the course. If your lab average is below 60%, regardless of your course average, your course grade will be changed to be equal to your lab average.
   Lab Report
   100 Points
   1 assignment at 100 points
The lab report will be over a selected lab in which you will formally represent your findings and understanding of the physics behind the phenomenon. You will be given an outline to guide your writing. This will be an individual assignment.
   Exams
   150 points
   3 unit exams each at 50 points.
Each exam will be over selected chapters. The exams will consist of 10 multiple-choice questions, 5 problems, and 1 written response question. The 10 multiple-choice questions will involve conceptual questions and some quick problems to solve. The 5 problems will involve multiple steps in which you will need to show your work to earn credit. The 1 written response question will present you with a situation in which you will need to explain using your understanding of physics.
Exams are used to see how well you retained the information in the course at that point. You will be allowed to do test corrections after the exam has been graded to improve your score.
   Final Exam
   150 Points
   Comprehensive Final Exam
The final exam will be given on the last class day of the semester (May 12th). The exam will be comprehensive. The exam will be given in a similar format to the unit exams. 15 Mulitple-Choice questions, 8 Problems in which you will need to solve and show your work (only need to complete 6 of the problems), and 3 written response questions (only need to complete 2 of the written response).
Breakdown
[...]
   A
   900 - 1000 Points
[...]
Course Schedule
[...]
Week 1
   Jan 20 - 25
   Electric Charge and Electric Field
[...]
Due on MasteringPhysics by Sunday 1/25 @ 11:59PM:
[...]
Take Exam 1 (CH 21 - 24)
[...]
Take Exam 2 (CH 25 - 28)
[...]
Lab used as extra lecture time/office hours
[...]
Take Exam 3 (29 - 32)
[...]
Week 17
   May 11 - 14
   Final Exam
Make-Up/Review day on 5/11 (essentially office hours)
Final Exam on 5/13
Lab Report due by 11:59 PM on 5/14
Semester Ends 5/14 and no assignments will be accepted after 11:59 PM
Course Policies
[...]
Attendance and Participation
You are expected to attend and participate in the course, complete assignments, and working with your group members to complete the group work and lab. Failure to participate in group work and lab will result in a score of 0 for that assignment, even if the group completed the assignment.
15 minutes after the start of the class for that day, the classroom door will be shut to allow for a more distraction free environment.
If you have to miss a lecture or lab it will be your responsibility to review the topic of that lecture, complete the group work assignment, and to come to office hours to complete the lab.
Late Work
Late work will not be accepted, but extensions are granted. If you need an extension for an assignment talk to the instructor to set up a reasonable extension.
No work will be accepted after the end of the course May 14th.
[...]
The use of AI
AI (like Copilot, ChatGPT, or Gemini, etc.) can be a useful tool, but does not replace critical thinking skills. It depends on how you prompt AI will determine what answer you get. So, simply copying and pasting the answer and calming it as your own is plagiarism and is a serious academic violation, which will have serious consequences both in academics and work careers.
So what should you do? Use AI responsibly. Make sure that vet the answers given from AI Prompts. Don't simply copy and paste, check the results. State that you used AI and what you used as your prompt. Explain the results that you got from AI. Use it to study but always check its work.
[...]
```

### Correct output
```json
{
  "grading": [
    {
      "raw_label": "Group Work",
      "canonical_type": "participation",
      "count": 15,
      "weight_pct": null,
      "points": 150,
      "notes": "15 group worksheets at 10 points each. You will work with your group members to complete a few questions over that week's topic, including discussions and solving problems together completed at the end of the lecture. Mapped to participation as an in-class group activity; homework is a defensible alternative."
    },
    {
      "raw_label": "Homework",
      "canonical_type": "homework",
      "count": 15,
      "weight_pct": null,
      "points": 225,
      "notes": "15 Assignments at 15 points each. Homework problems will be completed through Mastering Physics (accessed through eCampus); due at the end of the week."
    },
    {
      "raw_label": "Labs",
      "canonical_type": "lab",
      "count": 9,
      "weight_pct": null,
      "points": 225,
      "notes": "9 Labs at 25 points each. Quantitative and qualitative measurements during experiments in small groups, completed during lab time. A minimum lab average of 60% is required in order to pass the course; if your lab average is below 60%, regardless of your course average, your course grade will be changed to be equal to your lab average."
    },
    {
      "raw_label": "Lab Report",
      "canonical_type": "paper",
      "count": 1,
      "weight_pct": null,
      "points": 100,
      "notes": "1 assignment at 100 points. A formal individual written report over a selected lab presenting findings and the physics behind the phenomenon; an outline is provided. Mapped to paper as a formal written report; lab is a defensible alternative."
    },
    {
      "raw_label": "Exams",
      "canonical_type": "exam",
      "count": 3,
      "weight_pct": null,
      "points": 150,
      "notes": "3 unit exams each at 50 points. Each exam consists of 10 multiple-choice questions, 5 problems, and 1 written response question. You will be allowed to do test corrections after the exam has been graded to improve your score."
    },
    {
      "raw_label": "Final Exam",
      "canonical_type": "final_exam",
      "count": 1,
      "weight_pct": null,
      "points": 150,
      "notes": "Comprehensive Final Exam, given in a similar format to the unit exams. The grading table says the last class day of the semester (May 12th) while the course schedule lists the Final Exam on 5/13."
    }
  ],
  "policies": {
    "late_work": "Late work will not be accepted, but extensions are granted. If you need an extension for an assignment talk to the instructor to set up a reasonable extension. No work will be accepted after the end of the course May 14th.",
    "attendance": "You are expected to attend and participate in the course, complete assignments, and working with your group members to complete the group work and lab. Failure to participate in group work and lab will result in a score of 0 for that assignment, even if the group completed the assignment. 15 minutes after the start of the class for that day, the classroom door will be shut to allow for a more distraction free environment. If you have to miss a lecture or lab it will be your responsibility to review the topic of that lecture, complete the group work assignment, and to come to office hours to complete the lab.",
    "makeup": "You will be allowed to do test corrections after the exam has been graded to improve your score. If you have to miss a lecture or lab it will be your responsibility to review the topic of that lecture, complete the group work assignment, and to come to office hours to complete the lab.",
    "ai_plagiarism": "AI (like Copilot, ChatGPT, or Gemini, etc.) can be a useful tool, but does not replace critical thinking skills. It depends on how you prompt AI will determine what answer you get. So, simply copying and pasting the answer and calming it as your own is plagiarism and is a serious academic violation, which will have serious consequences both in academics and work careers. So what should you do? Use AI responsibly. Make sure that vet the answers given from AI Prompts. Don't simply copy and paste, check the results. State that you used AI and what you used as your prompt. Explain the results that you got from AI. Use it to study but always check its work.",
    "extra_credit": null
  },
  "instructor_outcomes": null,
  "course_schedule": "Weekly schedule, Jan 20 to May 14, beginning with Electric Charge and Electric Field; homework due Sundays at 11:59 PM on MasteringPhysics; Exam 1 (CH 21 - 24), Exam 2 (CH 25 - 28), Exam 3 (29 - 32); Make-Up/Review day on 5/11 (essentially office hours); Final Exam on 5/13; Lab Report due by 11:59 PM on 5/14; no assignments accepted after 5/14.",
  "distinctive_features": "A minimum lab average of 60% is required to pass the course; if the lab average is below 60%, the course grade is changed to equal the lab average regardless of the course average. Test corrections are allowed after each unit exam. The classroom door is shut 15 minutes after class starts. The grading table says the final exam is given on the last class day (May 12th) while the schedule lists the Final Exam on 5/13 — the syllabus does not reconcile the dates.",
  "full_summary": "University Physics II (PHYS 2426), Spring 2026, Section 22, taught in person at Cedar Valley Campus by Professor Taylor: calculus-based electricity and magnetism, circuits, electromagnetic waves, sound, light, and optics, with laboratory experiments. Grading is points-based out of 1000: group work (150), Mastering Physics homework (225), labs (225), a lab report (100), three unit exams (150 total), and a comprehensive final exam (150). A minimum 60% lab average is required to pass. Late work is not accepted, though extensions can be arranged, and test corrections may improve exam scores. The required text is Young's Modified Mastering w/eText for University Physics, 15th edition. The withdraw deadline is April 16, 2026.",
  "modified_date": "2026-01-14",
  "withdraw_date": "2026-04-16",
  "certification_date": "2026-02-02",
  "inclusive_access": null,
  "required_materials": [
    {
      "raw_text": "Modified Mastering w/eText for University Physics Author: Young Publisher: Pearson Learning Solutions Edition: 15th ISBN: 9780136840213",
      "title": "Modified Mastering w/eText for University Physics",
      "author": "Young",
      "isbn": "9780136840213",
      "edition": "15th",
      "cost": null,
      "required": true
    },
    {
      "raw_text": "Access to a computer with internet access",
      "title": null,
      "author": null,
      "isbn": null,
      "edition": null,
      "cost": null,
      "required": true
    },
    {
      "raw_text": "Calculator Can be any calculator. Ideally a scientific one. On test days I have a few that I can spare for use.",
      "title": null,
      "author": null,
      "isbn": null,
      "edition": null,
      "cost": null,
      "required": true
    }
  ],
  "office_hours": null,
  "instructor_contact": null,
  "confidence": "medium"
}
```

### Method notes (what this example teaches)
- Points-based: every weight_pct is null. Every count is copied from printed "N @ M
  points each" notation; the Final Exam's count 1 comes from the row naming a single
  "Comprehensive Final Exam", never from dividing points.
- The grading rows sum to 1000 and the letter scale tops at 1000 — the NUMBERS
  reconcile, yet confidence is still medium: the grading table says the final exam is
  on the last class day (May 12) while the schedule prints Final Exam on 5/13. A date
  contradiction is a contradiction; record it in distinctive_features, never resolve it.
- canonical_type judgment calls carry their defensible alternative in the row's notes
  (Group Work -> participation, homework defensible; Lab Report -> paper, lab
  defensible) so a human reviewer can accept or flip them.
- policies.makeup is STITCHED from two verbatim sentences living nowhere near a makeup
  heading: the test-corrections sentence inside the Exams grading note, and the
  missed-lecture/lab sentence inside the Attendance policy. The same sentence stays in
  policies.attendance too — a sentence can be verbatim evidence for two fields.
- **The office-hours trap:** the document says "office hours" three times ("come to
  office hours to complete the lab", a review day "essentially office hours") but never
  states days/times/location -> office_hours is null. Keyword presence is not a stated
  value.
- required_materials keeps non-book rows ("Access to a computer with internet access",
  "Calculator ...") as raw_text-only entries with title null — named requirements, not
  invented titles.
- "The use of AI" section -> policies.ai_plagiarism even though it never says
  "plagiarism policy"; it defines AI misuse as plagiarism.
