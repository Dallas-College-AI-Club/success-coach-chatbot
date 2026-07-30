# COUNTEREXAMPLE — CV, seven identity-invention failures
## ⚠ The output below is WRONG on purpose — do NOT imitate it
<!-- doc_type: cv | source: raw/cv/david-bracewell.html | identity: Bracewell, David (Concourse CV) | NEGATIVE EXAMPLE — never splice into a prompt's positive {{EXAMPLES}}; see the syllabus counterexamples/README.md for the folder contract. The verified CORRECT output for this document lives in the cv-david-bracewell test kit. -->

The document: a credentials-rich CV (PhD, four degrees, six employers, ~70
publications) that prints ZERO course codes, no department line, no email, and no
vita link. The correct output is name + four nulls + `[]` + confidence high.
Below is what a naive model plausibly produces instead.

### Context given to the extractor
```json
{
  "professor": "Bracewell, David"
}
```

### WRONG output
```json
{
  "name": "Dr. David B. Bracewell",
  "department": "Language Computer Corporation",
  "email": "dbracewell@dallascollege.edu",
  "cv_url": "https://dallascollege.campusconcourse.com/view_cv_information_for_course?course_id=84096",
  "courses_taught": ["COSC 1436"],
  "confidence": "low"
}
```

### Why each field is wrong

1. **`courses_taught: ["COSC 1436"]`** — the page's breadcrumb says "Programming
   Fundamentals I"; the model recognized the course TITLE and supplied the code from
   outside knowledge. Titles are never converted to codes; this CV prints zero codes
   -> `[]`. *(titles-as-codes + outside-knowledge injection — the single most
   dangerous CV failure)*
2. **`name` keeps the honorific** — "Dr." is stripped ("Dr. David  Bracewell" is the
   printed instructor block).
3. **`name` promotes the middle initial from bibliography prose** — publications
   print "Bracewell, David B.", but the instructor block does not; bibliography
   spellings never override the instructor-block name.
4. **`department: "Language Computer Corporation"`** — an EMPLOYER from the
   industry-experience prose promoted into department. Job-history prose is never
   the instructor's Dallas College department -> null. *(dept-prose trap)*
5. **`email` fabricated from a plausible pattern** — no email is printed anywhere.
   Pattern-guessed contact details are the worst kind of hallucination: they look
   checkable and are wrong. -> null.
6. **`cv_url` filled with the page's own URL** — the pipeline stamps `source_url`
   separately; `cv_url` is only for a vita link PRINTED on the page -> null.
7. **`confidence: "low"` because the CV "lacks course data"** — backwards.
   Emptiness is not uncertainty: identity matches, every null is certain -> high.
   (`low` would quarantine this row and bury real review cases in noise.)

### Corrected output
```json
{
  "name": "David Bracewell",
  "department": null,
  "email": null,
  "cv_url": null,
  "courses_taught": [],
  "confidence": "high"
}
```
