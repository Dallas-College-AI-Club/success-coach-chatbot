# Worked example — real Concourse CV printing course codes at TWO institutions
<!-- doc_type: cv | source: raw/cv/kelly-gebhart.html | identity: GEBHART, KELLY (Concourse CV, 2026SP manifest) | traits: cv_multi_institution_codes,cv_allcaps_name,cv_no_email,noise_token -->
<!-- REAL Dallas College document (trimmed excerpt), extracted claude_code_session.
     NOT yet registered in _sentinels.json (that file lives on feat/61-extraction-harness);
     register these identity/values there when folding this example in, so an extraction
     of a DIFFERENT document containing them is caught as parroting. Exclude from
     gold-gate aggregates (smoke-only). Never edit in place: replace with a numbered
     successor and re-run the gold gate. -->

### Context given to the extractor
```json
{
  "professor": "GEBHART, KELLY"
}
```

### Document excerpt
```text
Prin of Financial Accounting > Curricula Vitae
Instructors
KELLY GEBHART
Education
Degrees
Master of Taxation, University of Texas at Arlington
Bachelor of Science in Business – Accountancy, Eastern Illinois University
Certification
Certified Member of the Institute (CMI), Institute of Professionals in Taxation
Experience
I use my extensive work experience in industry and public accounting to introduce real life examples into my lectures, believing that tangible examples make the material easier to understand.
Teaching
Faculty, Dallas College, 2024, 2025
ACCT 2301 Principles of Financial Accounting
ACCT 2302 Principles of Managerial Accounting
ACNT 1331 Federal Income Tax, Individual
ACNT 1311 Intro to Computerized Accounting
Adjunct assistant professor, University of Texas at Arlington 2024, 2025
ACCT 2302 Principals of Accounting II
ACCT 3311 Financial Accounting I
ACCT 3315 Principles of Federal Income Tax
Professional
Experienced tax manager, Grant Thornton, 2016-2020
Publications
“The new working world of the Covid-19 pandemic: A tumultuous time for auditors, industries, and the PCAOB” with Hila Fogel-Yaari. 2022. CPA Journal March/April 2022, 30-35
DUMMY
```

### Correct output
```json
{
  "name": "Kelly Gebhart",
  "department": null,
  "email": null,
  "cv_url": null,
  "courses_taught": ["ACCT 2301", "ACCT 2302", "ACNT 1331", "ACNT 1311", "ACCT 3311", "ACCT 3315"],
  "confidence": "high"
}
```

### Method notes (what this example teaches)
- `courses_taught` lists every course CODE printed on the CV, verbatim, in document
  order — including the University of Texas at Arlington block (ACCT 3311, ACCT 3315).
  The field is informational (schema `$comment`); the authoritative Dallas College tie
  is `instructor_slug` on section rows, so downstream must never read `courses_taught`
  as Dallas College catalog membership. Upper-division 3xxx codes cannot even exist at
  a two-year college — they are on the list because they are printed, nothing more.
- ACCT 2302 is printed under BOTH institutions -> one entry (it is a set of codes, not
  a teaching-history ledger).
- The instructor block prints the name in shout-case ("KELLY GEBHART"); fold to title
  case. Identity ordering comes from the context ("GEBHART, KELLY" -> "Kelly Gebhart").
- Degrees, certification (CMI), employer history, and the publication are NOT facts
  fields — they stay retrievable as prose chunks. No department/email/vita link is
  printed -> null each.
