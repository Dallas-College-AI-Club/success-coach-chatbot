# Worked example — real Concourse CV with unspaced course codes and an honorific
<!-- doc_type: cv | source: raw/cv/david-maxwell.html | identity: Maxwell, David (Concourse CV, 2026SP manifest) | traits: cv_codes_as_printed,cv_honorific_stripped,cv_no_email,noise_token -->
<!-- REAL Dallas College document (trimmed excerpt), extracted claude_code_session.
     NOT yet registered in _sentinels.json (that file lives on feat/61-extraction-harness);
     register these identity/values there when folding this example in. Exclude from
     gold-gate aggregates (smoke-only). Never edit in place: replace with a numbered
     successor and re-run the gold gate. -->

### Context given to the extractor
```json
{
  "professor": "Maxwell, David"
}
```

### Document excerpt
```text
Prin of Financial Accounting > Curricula Vitae
Instructors
Mr David Maxwell
Education
Education
University of Washington: 1988
Bachelor of Arts in Business Administration with Concentration in Accounting
Keller Graduate School of Business: August 2014
Master of Arts in Accounting (with Distinction)
Washington Society of Certified Public Accountants, Certified Public Accountant
American Institute of Certified Management Accountants, Certified Management Accountant
Experience
Teaching Experience
Dallas College – Mountain View, Dallas, 2021 to Present
Instructor – Financial Accounting (ACCT2301)
Brookhaven College, Farmers Branch, 2016 to 2019
Instructor – Financial & Managerial Accounting (ACCT2301 & ACCT2302)
Seattle Community College, Seattle, WA: 2001 – 2014
Instructor – Accounting, Taxation and Financial Analysis
American Institute of Banking, Seattle, WA
Instructor – Accounting & Financial Analysis
DUMMY
Times are America/Chicago | 7:02 PM
```

### Correct output
```json
{
  "name": "David Maxwell",
  "department": null,
  "email": null,
  "cv_url": null,
  "courses_taught": ["ACCT2301", "ACCT2302"],
  "confidence": "high"
}
```

### Method notes (what this example teaches)
- The CV prints codes WITHOUT the space ("ACCT2301") -> keep them exactly as printed.
  Normalizing to "ACCT 2301" is the COMPOSE stage's job (metadata-registry: course_code
  stamps normalize to "SUBJ NNNN"); the extractor never rewrites source values.
- "(ACCT2301 & ACCT2302)" is two codes joined by an ampersand -> two entries. The
  Brookhaven repeat of ACCT2301 collapses (set of codes, not a ledger).
- "Mr David Maxwell" -> honorific stripped; `name` holds the person's name, and the
  context ("Maxwell, David") confirms identity.
- Seattle-era lines name subjects ("Accounting, Taxation") but print no codes -> they
  contribute nothing to `courses_taught`. Titles are not codes.
- No department/email/vita link printed -> null each; footer noise ("DUMMY", timestamps)
  is ignored.
