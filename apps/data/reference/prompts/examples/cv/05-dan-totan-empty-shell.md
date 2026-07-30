# Worked example — real Concourse CV that is an empty shell (name only)
<!-- doc_type: cv | source: raw/cv/dan-totan.html | identity: Totan, Dan (Concourse CV, 2026SP manifest) | traits: cv_empty_shell,cv_no_course_codes,cv_no_email,noise_token -->
<!-- REAL Dallas College document (near-complete excerpt), extracted claude_code_session.
     NOT yet registered in _sentinels.json (that file lives on feat/61-extraction-harness);
     register these identity/values there when folding this example in. Exclude from
     gold-gate aggregates (smoke-only). Never edit in place: replace with a numbered
     successor and re-run the gold gate. -->

### Context given to the extractor
```json
{
  "professor": "Totan, Dan"
}
```

### Document excerpt
```text
Cello > Curricula Vitae
Instructors
Dan Totan
DUMMY
Times are America/Chicago | 8:07 PM
&copy; 2026
Intellidemia, Inc.
Support
Privacy
Terms
```

### Correct output
```json
{
  "name": "Dan Totan",
  "department": null,
  "email": null,
  "cv_url": null,
  "courses_taught": [],
  "confidence": "high"
}
```

### Method notes (what this example teaches)
- The CV page is a bare shell: an instructor line and boilerplate, nothing else.
  About 9 of the 2,415 CVs referenced by the 2026SP term are like this.
- **Emptiness is not low confidence.** `confidence: high` — identity matches the
  context and every null is certain ("the source didn't say"). `low` is for
  unparseable or contradictory documents, not sparse ones; quarantining empty
  shells would just bury real review cases in noise.
- The facts row still earns its keep even with all-null fields: it supplies the
  name <-> instructor_slug join for section rows ("Who teaches Cello?").
- "DUMMY", timestamps, and the Intellidemia footer are Concourse boilerplate ->
  ignored, and never promoted into any field.
