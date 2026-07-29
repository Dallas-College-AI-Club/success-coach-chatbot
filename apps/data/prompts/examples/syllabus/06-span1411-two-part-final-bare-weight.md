# Worked example — two-part final exam as two rows, a weight printed without its % sign, and an extra-credit block excluded from grading
<!-- doc_type: syllabus | source: raw/syllabi/2026SP/91845.html | identity: SPAN 1411 sec 36, Spring 2026, Vega | traits: two_part_final,percent_grading,extra_credit_row,inclusive_access,named_textbook -->
<!-- REAL Dallas College document (trimmed excerpt), extracted claude_code_session,
     adversarially verified (2 independent review passes) 2026-07-24. NOT yet registered in
     _sentinels.json (that file lives on feat/61-extraction-harness); register these
     identity/values there when folding this example in. Excluded from gold-gate
     aggregates (smoke-only). Never edit in place: replace with a numbered successor
     and re-run the gold gate. -->

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

### Document excerpt
```text
Beginning Spanish I
SPAN-1411
Spring 2026
Section 36
4 Credits
01/20/2026 to 05/14/2026
Modified 01/07/2026
WELCOME TO SPANISH 1411 - Beginning Spanish I
This is a 16-Week online course from January 20 to May 14.
[...]
Withdraw Date : 
04/16/2026
Certification Date : 
02/02/2026
Course Description
This is the first semester of academic transfer Spanish. This course is an introductory course intended for students with little or no knowledge of the language. Its aim is to present essential vocabulary and grammar, and to develop the pronunciation, listening, reading, and writing skills necessary for basic communication and comprehension. Customs and cultural insights are also presented.
[...]
Instructor-Defined Learning Outcomes
DALLAS COLLEGE MARKETABLE SKILLS & DIGITAL BADGING SYLLABUS STATEMENT
“In this course, you will have the opportunity to practice the following marketable skills:
Integrating time management in your routine to complete tasks/activities (Leadership and Personal Responsibility Skills)
Learning and growing from mistakes made throughout the course (Leadership and Personal Responsibility Skills)
Becoming detail-oriented with your approaches towards your work (Critical Thinking)
Developing cultural and community awareness (Global Awareness and Social Responsibility)
Learning to express ideas clearer orally and/or in writing (Communication Skills)
Applying knowledge to anticipate solutions and make decisions (Critical Thinking Skills)
Upon successful demonstration of a skill, you may be eligible to apply for a Digital Badge.
[...]
Required Course Materials
[...]
For this course, your required electronic textbook and workbook is 
Conectados MindTap
 (2nd Edition) by Marinelli and Fajardo (ISBN: 9780357424209). As part of the Dallas College IncludED program, the required electronic 
Conectados MindTap
textbook and workbook will be provided free of charge to students.
If a student opts out of the IncludED program, the student is responsible for obtaining all required learning materials by the first day of the class.
In addition, 
Students are required to have access to high-speed internet and eCampus throughout the course.
Set of headphones or speakers to complete audio and video activities.
Microphone to audio record activities. 
IMPORTANT:
 Please ensure you have access to a desktop or laptop device with a Windows or OS X operating system. A Chromebook, tablet, smartphone, or Linux computer may not be suitable for some activities in this course.
Graded Work
[...]
Type
Weight
Topic
Notes
   Marketable Skills Lesson   
   3%  
As part of the Dallas College initiative, you need to complete the Marketable Skills Lesson module during Week 1 of the semester.
   Weekly Conectados MindTap Activities   
   75%  
Each week, you will have a batch of activities from our digital textbook, 
Conectados MindTap
, to complete by a certain due date. All activities will be available from the first day of the semester to provide flexibility along with a weekly due date schedule for all activities on eCampus.
   Final Exam Part 1: Monólogo Final   
   12  
At the end of the semester, as part of the 2-part Final Exam, you will video-record a brief monologue and upload it to eCampus.
   Final Exam Part 2: Course Reflection Assignment   
   10%  
At the end of the semester, as part of the Final Exam, you will write a brief course reflection in English based on a set of provided prompts/questions.
   Extra Credit   
EXTRA CREDIT OPPORTUNITIES: Virtual Class Get-Togethers!
Students can earn extra credit by attending the optional live interactive sessions online via MS Teams. There will be TWO virtual class get-togethers throughout the term. 
These VCGTs are not mandatory, but students can earn up to 3 points added to their final grade for each VCGT if they attend the entire time and participate in the activities.
Tentative dates for the Virtual Class Get-Togethers:
Wednesday, January 21: 4pm – 520pm
Wednesday, April 23: 4pm – 520pm
No more extra credit will be given. So, please do not ask!
[...]
Course Schedule
Click 
HERE
 to access the Course Calendar on eCampus for assignment due dates and other important course dates.  
Course Policies
[...]
THIS IS NOT A SELF-PACED COURSE! 
There are weekly set of activities due every Tuesday starting with Week 2. See 
[...]
Late Work
Late work is NOT tolerated. No assignments will be accepted after their due date without proper documentation for consideration and/or prior arrangement. 
FYI: Please note that a doctor’s appointment, jury duty, and court dates are not excuses for late work because students know about these events in time and can arrange to submit work on time.
Make Up Work Policy
No make up work will be allowed unless a previous arrangement has been made and/or proper written documentation is submitted for consideration 
within 48 hours
.
If you miss an assignment due to an emergency, you need to contact Vega within 48 hours to consider any extension. Be ready to provide the necessary paperwork. 
Once you access an online assignment (an eCampus activity, an exam, or any other assignment), make sure to complete it to the best of your ability and submit. Submissions will not be reset, and retakes are not allowed. Internet related issues and technical breakdowns are not acceptable excuses for failure to complete assignments.
Make sure you have a reliable computer and internet. The Dallas College libraries and labs have computers you may use to complete your assignments. If you are using such resources, make sure to check their hours of operation/availability ahead of time.
If you are unable to complete an assignment due to a technical/technology issue, it needs to be properly documented for extension request. Attempting to submit assignments minutes before it is due may be qualify as a valid reason for requesting an extension.  
[...]
Academic Dishonesty Policy
[...]
Consequences for cheating, plagiarism or collusion could include the following:
A zero on parts or the entire assignment or test
An “F” in the course
Official reporting of incident/s to the Office of Student Rights and Responsibilities at Dallas College
If at any point, you are unsure about plagiarism or collusion, please ask Vega for clarification.
Work completed by AI is not acceptable for this course and will be considered plagiarism given the types of activities and assignments.  AI-generated work will be scored as zero.
[...]
Disclaimer
As instructor of record for this course, I reserve the right to amend this syllabus as necessary. Students will be informed on any amendments/changes made to the course syllabus.
Grand Master Jedi Vega
```

### Correct output
```json
{
  "grading": [
    {
      "raw_label": "Marketable Skills Lesson",
      "canonical_type": "other",
      "count": 1,
      "weight_pct": 3,
      "points": null,
      "notes": "As part of the Dallas College initiative, you need to complete the Marketable Skills Lesson module during Week 1 of the semester."
    },
    {
      "raw_label": "Weekly Conectados MindTap Activities",
      "canonical_type": "homework",
      "count": null,
      "weight_pct": 75,
      "points": null,
      "notes": "Each week, you will have a batch of activities from our digital textbook, Conectados MindTap, to complete by a certain due date. All activities will be available from the first day of the semester to provide flexibility along with a weekly due date schedule for all activities on eCampus."
    },
    {
      "raw_label": "Final Exam Part 1: Monólogo Final",
      "canonical_type": "final_exam",
      "count": 1,
      "weight_pct": 12,
      "points": null,
      "notes": "Weight printed as '12' with no percent sign while every other row prints a percentage under the same Weight column; read as 12% (the four rows then sum to 100). At the end of the semester, as part of the 2-part Final Exam, you will video-record a brief monologue and upload it to eCampus."
    },
    {
      "raw_label": "Final Exam Part 2: Course Reflection Assignment",
      "canonical_type": "final_exam",
      "count": 1,
      "weight_pct": 10,
      "points": null,
      "notes": "At the end of the semester, as part of the Final Exam, you will write a brief course reflection in English based on a set of provided prompts/questions."
    }
  ],
  "policies": {
    "late_work": "Late work is NOT tolerated. No assignments will be accepted after their due date without proper documentation for consideration and/or prior arrangement. FYI: Please note that a doctor’s appointment, jury duty, and court dates are not excuses for late work because students know about these events in time and can arrange to submit work on time.",
    "attendance": null,
    "makeup": "No make up work will be allowed unless a previous arrangement has been made and/or proper written documentation is submitted for consideration within 48 hours. If you miss an assignment due to an emergency, you need to contact Vega within 48 hours to consider any extension. Be ready to provide the necessary paperwork. Once you access an online assignment (an eCampus activity, an exam, or any other assignment), make sure to complete it to the best of your ability and submit. Submissions will not be reset, and retakes are not allowed. Internet related issues and technical breakdowns are not acceptable excuses for failure to complete assignments. Make sure you have a reliable computer and internet. The Dallas College libraries and labs have computers you may use to complete your assignments. If you are using such resources, make sure to check their hours of operation/availability ahead of time. If you are unable to complete an assignment due to a technical/technology issue, it needs to be properly documented for extension request. Attempting to submit assignments minutes before it is due may be qualify as a valid reason for requesting an extension.",
    "ai_plagiarism": "Consequences for cheating, plagiarism or collusion could include the following: A zero on parts or the entire assignment or test An “F” in the course Official reporting of incident/s to the Office of Student Rights and Responsibilities at Dallas College If at any point, you are unsure about plagiarism or collusion, please ask Vega for clarification. Work completed by AI is not acceptable for this course and will be considered plagiarism given the types of activities and assignments. AI-generated work will be scored as zero.",
    "extra_credit": "EXTRA CREDIT OPPORTUNITIES: Virtual Class Get-Togethers! Students can earn extra credit by attending the optional live interactive sessions online via MS Teams. There will be TWO virtual class get-togethers throughout the term. These VCGTs are not mandatory, but students can earn up to 3 points added to their final grade for each VCGT if they attend the entire time and participate in the activities. Tentative dates for the Virtual Class Get-Togethers: Wednesday, January 21: 4pm – 520pm Wednesday, April 23: 4pm – 520pm No more extra credit will be given. So, please do not ask!"
  },
  "instructor_outcomes": "DALLAS COLLEGE MARKETABLE SKILLS & DIGITAL BADGING SYLLABUS STATEMENT “In this course, you will have the opportunity to practice the following marketable skills: Integrating time management in your routine to complete tasks/activities (Leadership and Personal Responsibility Skills) Learning and growing from mistakes made throughout the course (Leadership and Personal Responsibility Skills) Becoming detail-oriented with your approaches towards your work (Critical Thinking) Developing cultural and community awareness (Global Awareness and Social Responsibility) Learning to express ideas clearer orally and/or in writing (Communication Skills) Applying knowledge to anticipate solutions and make decisions (Critical Thinking Skills) Upon successful demonstration of a skill, you may be eligible to apply for a Digital Badge.",
  "course_schedule": "Click HERE to access the Course Calendar on eCampus for assignment due dates and other important course dates.",
  "distinctive_features": "The final exam has two parts: a video-recorded Spanish monologue (Monólogo Final) and a course reflection written in English. In the grading table the monologue row's weight is printed as '12' with no percent sign; all other rows are percentages and the four rows sum to 100. The required Conectados MindTap e-textbook/workbook is provided free through the Dallas College IncludED program, with an opt-out option. Extra credit is limited to two optional MS Teams 'Virtual Class Get-Togethers' worth up to 3 points each; 'No more extra credit will be given.' The course is explicitly not self-paced, with weekly activities due every Tuesday starting Week 2. The syllabus disclaimer is signed 'Grand Master Jedi Vega'.",
  "full_summary": "Beginning Spanish I (SPAN 1411), Spring 2026, Section 36, a 16-week online course taught by Professor Vega: introductory Spanish vocabulary, grammar, pronunciation, listening, reading, and writing, with Hispanic customs and culture. Grading is percentage-weighted: a Marketable Skills Lesson (3%), weekly Conectados MindTap activities (75%), and a two-part final exam — a recorded monologue (12%) and a written course reflection (10%). The Conectados MindTap e-textbook (2nd Edition) is provided free through the IncludED program. The course is not self-paced; weekly activities are due Tuesdays. Late work is not accepted without documentation, make-up work requires arrangement within 48 hours, and AI-generated work is scored as zero. The withdraw deadline is April 16, 2026.",
  "modified_date": "2026-01-07",
  "withdraw_date": "2026-04-16",
  "certification_date": "2026-02-02",
  "inclusive_access": true,
  "required_materials": [
    {
      "raw_text": "For this course, your required electronic textbook and workbook is Conectados MindTap (2nd Edition) by Marinelli and Fajardo (ISBN: 9780357424209). As part of the Dallas College IncludED program, the required electronic Conectados MindTap textbook and workbook will be provided free of charge to students.",
      "title": "Conectados MindTap",
      "author": "Marinelli and Fajardo",
      "isbn": "9780357424209",
      "edition": "2nd Edition",
      "cost": "provided free of charge to students (Dallas College IncludED program)",
      "required": true
    },
    {
      "raw_text": "Students are required to have access to high-speed internet and eCampus throughout the course.",
      "title": null,
      "author": null,
      "isbn": null,
      "edition": null,
      "cost": null,
      "required": true
    },
    {
      "raw_text": "Set of headphones or speakers to complete audio and video activities.",
      "title": null,
      "author": null,
      "isbn": null,
      "edition": null,
      "cost": null,
      "required": true
    },
    {
      "raw_text": "Microphone to audio record activities.",
      "title": null,
      "author": null,
      "isbn": null,
      "edition": null,
      "cost": null,
      "required": true
    },
    {
      "raw_text": "IMPORTANT: Please ensure you have access to a desktop or laptop device with a Windows or OS X operating system. A Chromebook, tablet, smartphone, or Linux computer may not be suitable for some activities in this course.",
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
- The final exam is printed as TWO table rows ("Final Exam Part 1: Monólogo Final",
  "Final Exam Part 2: Course Reflection Assignment") -> two final_exam rows, count 1
  each. Row structure follows the PRINT: a two-part final printed as one row would be
  one row with count 2 (see the ACCT gold case); printed as two rows, it stays two.
- Part 1's weight cell prints a bare "12" — no % sign — while every sibling prints a
  percentage; read as 12% because the column is Weight and the four rows then sum to
  100. That is a RESOLVED AMBIGUITY: it is recorded in the row's notes and drives
  confidence medium. Resolving silently and claiming high is the failure mode.
- The "Extra Credit" block sits INSIDE the graded-work table but is not a graded
  component -> excluded from grading[], captured verbatim in policies.extra_credit
  (including "No more extra credit will be given. So, please do not ask!").
- IncludED: the e-textbook is "provided free of charge to students" -> inclusive_access
  true, and the provided-free fact also lands in the textbook row's cost field.
- required_materials has five rows: one named textbook (title/author/ISBN/edition) and
  four raw_text-only requirements (internet+eCampus, headphones/speakers, microphone,
  the IMPORTANT desktop/laptop requirement). Named requirements are kept even when
  they have no title.
- The "Instructor-Defined Learning Outcomes" heading is NOT empty here — it holds the
  Marketable Skills statement -> instructor_outcomes is populated. Nulls follow the
  document, not the pattern of other syllabi.
- course_schedule is only an eCampus link -> keep the link sentence; do not invent a
  schedule.
