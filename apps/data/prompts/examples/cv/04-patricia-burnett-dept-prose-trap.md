# Worked example — real Concourse CV where "Department/Division" appears only in job-history prose
<!-- doc_type: cv | source: raw/cv/patricia-burnett.html | identity: Burnett, Patricia (Concourse CV, 2026SP manifest) | traits: cv_dept_prose_trap,cv_titles_not_codes,cv_fuller_printed_name,cv_no_email -->
<!-- REAL Dallas College document (trimmed excerpt), extracted claude_code_session.
     NOT yet registered in _sentinels.json (that file lives on feat/61-extraction-harness);
     register these identity/values there when folding this example in. Exclude from
     gold-gate aggregates (smoke-only). Never edit in place: replace with a numbered
     successor and re-run the gold gate. -->

### Context given to the extractor
```json
{
  "professor": "Burnett, Patricia"
}
```

### Document excerpt
```text
Prin of Financial Accounting > Curricula Vitae
Instructors
Patricia Scott Burnett
Education
Education
University of Texas at Dallas, Richardson, TX
MBA and MS in Accounting: GPA: 3.72 Total Graduate Hours = 63 hours
University of Chicago, Chicago, IL
BA: GPA: 3.5
Honors in Economics and the College, Phi Beta Kappa
Higher Education Experience: Teaching and Program Coordinator
Dallas College, Dallas, TX (August 2009 – Present)
El Centro Professor of Accounting, Full-Time, (2016 – Present)
El Centro College Coordinator of Accounting and Economics Programs, Full-Time (2016 - 2021)
Teaching Specialties: Principles of Financial Accounting, Principles of Managerial Accounting, Introduction to Accounting, Advanced Managerial Accounting, Cost Accounting, Intermediate Accounting
Collin College, Plano, TX (January 2013 – Present)
Associate Accounting Faculty – Financial Accounting and Managerial Accounting
Experience
Professional Experience
EY, Dallas/Fort Worth Area, TX (April 2007 – May 2009)
Tax Staff – National Tax – Tax Credits and Incentives
Recruited to join the Tax Division of a large accounting firm to create and develop the California Enterprise Zone Tax Credit Department.
Other Related Experience
Before attending graduate school, I worked for five years in the business world, including the financial services industry, the consulting division of a major public accounting firm, and the state tax credit division of a Dallas-area consulting firm.
```

### Correct output
```json
{
  "name": "Patricia Scott Burnett",
  "department": null,
  "email": null,
  "cv_url": null,
  "courses_taught": [],
  "confidence": "high"
}
```

### Method notes (what this example teaches)
- "Tax Division", "Tax Credit Department", "consulting division" are all in PROFESSIONAL
  job-history prose about past employers — none is the instructor's Dallas College
  department. No department line is printed for the instructor -> `department` null.
  (This CV is why the trap trait exists: a keyword-matching extractor "finds" a
  department here.)
- Six course TITLES are printed ("Teaching Specialties: Principles of Financial
  Accounting, ...") but not one course CODE -> `courses_taught` [] — codes only,
  never titles mapped to codes by inference.
- The instructor block prints a fuller name ("Patricia Scott Burnett") than the context
  ("Burnett, Patricia"). The context settles WHO this is; the printed instructor-block
  name is kept verbatim as `name` because it is consistent with (a superset of) the
  context identity. A printed name that CONTRADICTED the context would be
  identity_mismatch -> confidence low.
- Degrees, honors, employers, coordinator roles stay prose-chunk material; `confidence`
  stays high — every field is either clearly supported or clearly absent.
