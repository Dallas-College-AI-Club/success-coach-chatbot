# Worked example — real Concourse CV with credentials but no course codes printed
<!-- doc_type: cv | source: raw/cv/aaron-reyes.html | identity: Aaron Reyes (Concourse CV) | traits: cv_no_course_codes,noise_token,no_email -->
<!-- REAL Dallas College document (trimmed excerpt). Its identity/values are registered in
     _sentinels.json: an extraction of a DIFFERENT document containing these values is
     parroting. This source document is excluded from gold-gate aggregates (smoke-only).
     Never edit in place: replace with a numbered successor and re-run the gold gate. -->

### Context given to the extractor
```json
{
  "professor": "Reyes, Aaron"
}
```

### Document excerpt
```text
Intro Layout & Fabrication > Curricula Vitae

Instructors

 Aaron  Reyes

Education

Associates of Applied Science in Welding Technology

Portland Community College, Portland, Oregon

Experience

17 years in the Welding Industry

Welding Fabrication- Trailers

Ironworker- Structural Construction

Teaching: Portland Community College, Portland, Oregon
2018- 2025

Welding Certifications

SMAW Plate Certification (E7018)- all positions

GTAW (Mild Steel, Aluminum, Stainless Steel)

DUMMY
```

### Correct output
```json
{
  "name": "Aaron Reyes",
  "department": null,
  "email": null,
  "cv_url": null,
  "courses_taught": [],
  "confidence": "high"
}
```

### Method notes (what this example teaches)
- The page header "Intro Layout & Fabrication" is the linked COURSE TITLE, not a course code -> courses_taught stays [] (codes only, exactly as printed).
- No department line, no email, no vita link printed -> null each (the pipeline stamps source_url separately; cv_url is only for a printed link).
- Stray tokens ("DUMMY") and layout noise are ignored.
- Education, experience, and certifications have no facts fields — they remain retrievable as prose chunks; the facts row exists for the deterministic joins (name <-> courses via instructor_slug on section rows).
