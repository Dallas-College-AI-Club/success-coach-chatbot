# Gold set — the extraction quality gate

> Human-verified correct extractions for real Dallas College documents. This is the
> measuring stick: **no model or prompt is promoted to a bulk run until it reproduces
> these answers.** Full rationale in [`docs/EXTRACTION_PLAYBOOK.md`](../../../../docs/EXTRACTION_PLAYBOOK.md).

Small models produce schema-valid JSON with *wrong values* far more often than they produce
malformed JSON. Schema validation can't catch that; only comparison against known-correct
answers can. So the gate scores **field-value accuracy against these gold cases**, never mere
validity.

## Layout

```
apps/data/tests/gold/
  README.md                  ← this file (the SOP)
  traits.json                the failure-taxonomy registry (what each case must exercise)
  <doc_type>/<case_id>/
    input.txt                the exact text the extractor receives (parser-free, byte-reproducible)
    context.json             the identity context passed to extract() (course_code, section, term…)
    expected.json            the human-verified correct facts payload (schema-valid)
    notes.md                 provenance, traits, and a field-by-field verification checklist
```

`case_id` = `<coursecode><-term|catalogyear>-<format>-<salient trait>`, e.g.
`syllabus/acct2301-2026sp-pdf-points`.

## How a gold case is made (teacher → human → frozen)

1. **Pick by trait, not convenience.** Every trait in `traits.json` needs ≥1 case. Choose real
   documents that exercise the hard behaviors (points grading, checksum rows, hidden make-up
   policies, one-of prereqs, choose/placeholder program slots, garbled PDFs…).
2. **Teacher drafts `expected.json`.** Claude, in a dev session (free to the club), reads the real
   document and writes the correct facts, validated through the pipeline's `extract_manual()`
   path (`extraction_method="claude_code_session"`).
3. **A human verifies field-by-field against the source.** Use the checklist in the case's
   `notes.md`. **Verifying the nulls means reading the whole document** — a make-up policy the
   teacher missed and froze as `null` will later punish a *better* model for finding it. Budget
   **30–45 min per syllabus case**; a second member spot-checks 1 in 5. Set `verified_by` + date
   in `notes.md` and flip `status` to `verified`. **Only `verified` cases gate.**
4. **Corrigible gold.** When a model later produces a *grounded* value where gold says null, the
   scorer flags the **gold** as suspect (blocks the run for re-adjudication) rather than counting a
   model error — gold is not infallible.

## Scoring (per field class, keyed off the facts schemas)

| Class | Fields | Rule |
|---|---|---|
| EXACT | enums (`canonical_type`, `confidence`), numbers (`points`, `weight_pct`, `count`), booleans | equality (numbers ±0.01) |
| NORM_STR | codes, titles, dates | casefold + whitespace/punctuation fold |
| VERBATIM | `raw_label`, `policies.*`, `office_hours`, `instructor_contact`, `required_materials[].raw_text` | normalized equality **and** grounding in `input.txt` (no fuzzy — token overlap rates a policy ≈ its negation) |
| SET | order-irrelevant arrays (`prerequisites[].one_of`, `courses[]`) | set equality after NORM_STR |
| GENERATIVE | `full_summary`, `distinctive_features`, `instructor_outcomes`, `course_schedule`, `notes` | reported (similarity), never gated |

Honesty rules the scorer enforces: absent keys normalize to `null`/`[]` on **both** sides before
matching (a bare `{"confidence":"high"}` must score terribly, not vacuously); **non-null recall**
(accuracy over gold-non-null fields) is reported and gated separately from **null agreement**, never
blended; identity fields echoed from `context` are excluded from the gated denominator; teacher
(`claude_code_session`) runs appear as reference only, never in promotion logic.

## The gate (per doc_type, `verified` cases only)

- **Critical fields = 100%** of non-abstained cases: grading numbers, `canonical_type`, prereq
  structures, dates.
- **Per-trait coverage**: every trait with a verified case must pass at least once (a model can't
  dodge the traps by abstaining on the hard cases).
- **Non-null recall ≥ 95%**, **null agreement ≥ 90%**.
- The report prints the exact binomial confidence bound beside each number. At small n a green gate
  is **provisional** — it authorizes a bulk run only together with the post-promotion audit
  (playbook §7): the first ~100 accepted docs get a blind teacher re-check.

## Contamination

Prompt exemplars (`apps/data/prompts/examples/`) are real documents; those *source* cases are
excluded from gate aggregates and scored separately as smoke cases (lineage recorded in
`examples/_sentinels.json`). A gold case is never also an exemplar source in the gated set.

## Current cases

| Case | doc_type | status | traits |
|---|---|---|---|
| `syllabus/acct2301-2026sp-pdf-points` | syllabus | teacher_authored — **awaiting verification** | points_grading, checksum_row, extra_credit_row, makeup_in_grading_notes, empty_heading_null, link_only_materials, two_part_final |

**Next:** verify the ACCT-2301 case; add the remaining Phase-1 stratum (target ~15 syllabus + 10
course + 6 program_map + 4 cv), covering every `traits.json` entry, before the first bulk run.
The scoring library and eval runner (`score_facts.py`, `eval_extract.py`) land with the extraction-
harness implementation issue (playbook §9); the case format here is their input contract.
