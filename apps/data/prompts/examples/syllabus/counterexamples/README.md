# Syllabus extraction COUNTEREXAMPLES — wrong outputs, annotated

**Never splice these into an extraction prompt.** The planned `build_prompt()` EXAMPLES
splice globs `apps/data/prompts/examples/<doc_type>/*.md` (see the header of
`extract_v2.md`); this subfolder exists precisely so these files stay OUT of that glob.
If the splice implementation ever changes to a recursive glob, it must exclude
`counterexamples/` — a wrong output injected as a worked example would teach the model
the exact failures the gold gate exists to catch.

## What these files are

Each counterexample pairs a real document excerpt (the same excerpt as a sibling
worked exemplar) with the output a naive extractor plausibly produces, annotated
failure-by-failure against the failure taxonomy in `apps/data/tests/gold/traits.json`.
Every wrong field cites the rule it violates and gives the correct value, so a file
is a **self-contained contrastive block**: WRONG output → why each field is wrong →
corrected output.

Uses:

- **Contrastive few-shot for local models (primary).** Small local extractors
  (`lmstudio:qwen2.5-14b-instruct`, Gemma, `ollama:qwen2.5:14b`) benefit from seeing
  labeled negatives — what NOT to do — next to the worked positives. To wire this in:
  draft an `extract_v3.md` with a `{{COUNTEREXAMPLES}}` placeholder spliced from this
  folder, each block framed by an explicit `### WRONG output (do NOT imitate)` /
  `### Corrected output` pair, and promote it only after it beats v2 on the gold gate
  (playbook §8). Never mix these into the positive `{{EXAMPLES}}` splice unlabeled.
- **Human onboarding** — a club member reviewing extractions learns the failure
  modes fastest by seeing them concretely, next to the correction.
- **Verifier grounding** — the #72 human spot-check and quarantine review can use
  the annotated failures as a checklist of what wrong looks like.
- **Post-MVP benchmark material (#73)** — when the contrastive variant is formally
  scored, keep the strict train/test separation from the gold set (no counterexample
  may share a source document with a gating gold case).

## Conventions

- Same header/format as worked exemplars, plus a WRONG-OUTPUT banner in the title
  and header comment.
- The wrong output must be *plausible* — the kind a competent-but-unguided model
  actually produces (each mistake maps to a registered trait), not a strawman.
- Like worked exemplars: real documents, values registered in `_sentinels.json`
  when folded into the feat/61 branch, excluded from gold-gate aggregates, never
  edited in place.
