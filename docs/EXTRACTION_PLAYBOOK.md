# Extraction Playbook — Frontier Quality from Free Models

> **Scope**: the LLM extraction stage of the data pipeline — raw syllabi / CV pages / catalog pages → validated `facts` JSON (see [`docs/DATA_PIPELINE.md`](DATA_PIPELINE.md) for the surrounding stages, [`apps/data/pipeline/extract.py`](../apps/data/pipeline/extract.py) for the engine this playbook hardens).
> **Goal**: bulk extraction runs on **$0 models** (local via LM Studio/Ollama, hosted free tiers) while a frontier model — Claude, free to the club inside dev sessions — plays **teacher**: it authors the gold answers, the prompt exemplars, and the audits that keep the students honest.
> **Why it matters**: a wrong prerequisite or grading fact ships to students with an authoritative-looking citation. Extraction quality is the trust budget of the whole app.

---

## 1. The one principle everything follows

**Small models' dominant failure is schema-valid JSON with wrong values.** Benchmarks are consistent on this: once you force syntactically valid output (which constrained decoding does for free), 76–100% of remaining defects are *wrong values* — a misread grading weight, an invented ISBN, a policy paraphrased into its opposite, a `null` where the document actually said something. Two consequences drive this whole design:

1. **Nothing is trusted because it parsed.** Quality is measured only as *field-value accuracy against human-verified gold answers*.
2. **Every correction signal must be external and deterministic.** Feeding a model its own validator errors measurably fixes outputs; asking a model to critique itself does not. So we invest in lints, groundings, and cross-checks that produce exact, retryable error strings — never "please double-check your answer."

The architecture is a **teacher–student loop**:

```
                      ┌──────────────────────────────────────────────┐
                      │  TEACHER (Claude in a dev session — $0)      │
                      │  authors gold answers · authors exemplars    │
                      │  audits samples · triages quarantine         │
                      └───────────────┬──────────────────────────────┘
                          gold cases  │  few-shot exemplars + prompt rules
                                      ▼
 raw documents ──► deterministic pre-extraction ──► STUDENT (free model,
                   (segment, prefill, trim)          constrained decoding)
                                      │
                                      ▼
                   deterministic verifiers (schema + semantic lints)
                     │ pass                    │ fail → exact errors re-prompted
                     ▼                         ▼ (retries exhausted)
                   knowledge_entry           escalation rung (next model)
                                               │ still failing
                                               ▼
                                             quarantine (needs_review)
                                               → teacher triage → fix becomes
                                                 a new gold case or prompt rule
```

Everything below exists to make that loop cheap, measurable, and runnable by a rotating student club.

---

## 2. Pillar 1 — The gold set (build this first; it gates everything)

A **gold case** is a frozen triple: the exact document text the extractor receives, the exact identity `context`, and the human-verified correct `facts` JSON. Location: `apps/data/tests/gold/<doc_type>/<case_id>/` — see [`apps/data/tests/gold/README.md`](../apps/data/tests/gold/README.md) for the full SOP and the first case.

**Authoring SOP (teacher → human → frozen):**
1. Pick documents by **trait coverage**, not convenience: [`traits.json`](../apps/data/tests/gold/traits.json) registers the failure taxonomy (points-based grading, checksum rows, extra-credit rows, empty headings, policies hidden in grading notes, mixed `weight_pct`/points, one-of prereqs, choose/placeholder program slots, 2024-PDF mangling, …). Every trait needs ≥1 case; the eval reports coverage.
2. The teacher (Claude, in a dev session) reads the real document and writes `expected.json`, validating it through the existing `extract_manual()` path (`extraction_method="claude_code_session"`). Zero API cost.
3. A club member verifies **field-by-field against the source**. Honesty rule: verifying the *null* fields means reading the whole document — a missed policy frozen as `null` will later punish a *better* model for finding it. Budget **30–45 minutes per syllabus case**; a second verifier spot-checks 1 in 5. When a model later produces a *grounded* non-null value where gold says null, the scorer flags the **gold** as suspect rather than counting a model error — gold is corrigible.
4. `notes.md` records provenance (source URL/term, converter used, traits, verifier, date). Only `status: verified` cases gate. Cases whose `input.txt` predates a converter change are auto-marked `stale` (each case keeps its raw source so the harness can re-run the converter and detect drift).

**Size and honesty about what a green gate means:** start with **15 verified syllabus cases + ~10 course + ~6 program_map + ~4 cv** (≈35–50 volunteer-hours total — plan it as a club work session, not a side task), growing toward 25/20/12/10 by replaying every production failure as a new case. At 15–25 cases, zero observed critical errors only bounds the true critical-error rate near ~1.5–2% (rule of three) — so a green gate **must** be paired with the post-promotion audit (§7). The eval report prints the exact binomial confidence bound next to every gate metric so nobody over-reads a pass.

**Contamination rule:** prompt exemplars (§3) are fictionalized from specific cases; those source cases are excluded from gate aggregates (scored separately as smoke cases). Exemplar→case lineage is recorded machine-readably in `_sentinels.json`.

---

## 3. Pillar 2 — Few-shot exemplars (the biggest prompt-side lever)

One to two **complete worked examples** per doc_type — a trimmed input excerpt plus its perfect JSON — raise small-model extraction accuracy more than any other prompt change (typical measured gains ~10%; it is the foundation of Google's LangExtract design). They live in [`apps/data/prompts/examples/`](../apps/data/prompts/examples/) and are spliced into [`extract_v2.md`](../apps/data/prompts/extract_v2.md) via an `{{EXAMPLES}}` placeholder.

**Exemplars are REAL documents from the raw archive** — a trimmed excerpt of an actual Concourse syllabus, catalog page, or CV plus its verified extraction. Real exemplars teach the real format: the shredded link text, the empty headings, the dropdown artifacts, the boilerplate blocks a model must learn to step around. Each exemplar's source is recorded in its header and in `_sentinels.json`.

**The failure to engineer against is parroting** — a small model copying the example's *values* (or its *null pattern*) into other documents' outputs. Three defenses, all mandatory:

1. **Identity registry**: `_sentinels.json` records each exemplar's identity (course, section, term) and distinctive output values. Lint L9: an extraction whose `context` identity differs from an exemplar's but whose output contains that exemplar's distinctive values is parroting → retry/quarantine. (Extractions *of the exemplar document itself* are exempt and excluded from gold-gate aggregates — smoke cases only.)
2. **Null/populated pairing**: exemplars must jointly show every optional field **both null and populated** across the shot set — a single all-nulls exemplar teaches "output null." That is why `syllabus/` ships two exemplars (SPCH 1321: points-based, null-heavy, an unreconciled 800-vs-1000 total; GOVT 2306: percent-based with a checksum row and contradictory boilerplate policy), and shipping ≥2 syllabus shots is a **blocker for activating v2**. The gold gate separately reports a per-field *null-agreement* metric to catch residual null-parroting.
3. **Verbatim grounding lint** (§5): any verbatim-contract field whose value isn't a substring of the *current source document* is rejected — an exemplar-copied value can never ground against a different document.

Budget: the whole `{{EXAMPLES}}` block stays under ~1,500 tokens per doc_type (trimmed excerpts, not full documents). Exemplars are versioned prompt assets: never edited in place — replaced, with the gold gate re-run in the same commit.

---

## 4. Pillar 3 — Constrained decoding (free reliability, per provider)

Grammar-enforced output eliminates the parse/shape failure class outright (and the "constraints hurt quality" claim did not survive replication — measured cost ≈ 0). The engine already validates with the repo JSON Schemas; the upgrade is sending those schemas *into the decoder*:

| Provider | Request configuration | Notes |
|---|---|---|
| Ollama (local) | `"format": <full Draft-07 schema dict>` + **always** `options.num_ctx` (default 16384; 8192 on 8 GB machines) | Ollama ≥ 0.5. Without explicit `num_ctx` Ollama silently truncates at ~2–4k tokens — which presents as *plausible wrong values*, the worst failure mode |
| LM Studio (local) | `response_format: {type:"json_schema", json_schema:{name, strict:true, schema}}` | LM Studio ≥ 0.3.x; llama.cpp grammar enforcement |
| OpenRouter (hosted free) | same `json_schema` shape **plus** `provider: {require_parameters: true}` | routes only to backends that honor it; keep the existing degrade-to-`json_object` on 400 |
| Gemini (hosted free) | `generationConfig: {responseMimeType:"application/json", responseJsonSchema: <schema>}` | worth adding as a real provider (own `GEMINI_API_KEY` env — never share `LLM_BASE_URL` between ladder rungs) |
| Anthropic / non-structured models | unchanged: `json_object`/fence-strip + validator retry | the universal backstop |

Grammar guarantees **syntax, never semantics** — the validator-retry loop and lints stay on regardless. Before enabling per model, A/B constrained vs `json_object` on the gold set (rare regressions on generative fields like `full_summary` are cheap to catch there). Pre-flight once per schema: confirm the grammar compiler accepts our `type:[X,null]` unions and `additionalProperties:false` (they are standard-supported in all four engines above).

---

## 5. Pillar 4 — Deterministic verifiers (turn silent wrong values into retryable errors)

The engine's retry loop re-prompts with exact validator errors. Extend it with a **semantic lint pass** (`verify_facts.py`, hooked via an optional `semantic_validator` callback in `extract()` — ~8 lines, default-off, byte-identical behavior when unused). Lints emit the same `path: message` format and cost zero tokens:

| Lint | Rule | On failure |
|---|---|---|
| L1 verbatim grounding | every verbatim-contract value (`raw_label`, `raw_text`, `policies.*`, `office_hours`, `instructor_contact`) must appear as a substring of the source, after deterministic punctuation folding (curly→ASCII quotes, en/em-dash→hyphen, NBSP→space; PDF tier also dehyphenates line breaks; case preserved) | retryable on HTML tier; **advisory (confidence floor) on the 2024-PDF tier** — the model cannot out-copy mangled source text, so retries would burn budget deterministically |
| L2 numeric grounding | every `weight_pct`/`points` number must appear as a numeric token in the document | retryable |
| L3 unit XOR | each grading row has `weight_pct` **xor** `points`; a mix of pct-rows and points-rows in one syllabus → "confirm the printed unit per row; note mixed units" | retryable once, then confidence floor |
| L4 sum sanity | all-pct rows sum ≈100 (co-req note tolerated); all-points rows sum ≈ any printed total (checksum row must be excluded, not emitted) | retryable |
| L5 identity echo | any course code/section/term the model emits must match `context` | retryable |
| L6 date window | withdraw/certification/modified dates parse and fall within the term ± a semester | retryable |
| L7 keyword→enum | unambiguous `raw_label` keywords must match `canonical_type` (`/final/i`→`final_exam`, `/quiz/i`→`quiz`, `/\blab\b/i`→`lab`, `/paper|essay/i`→`paper`) | retryable |
| L8 structural expectation | document has a grading-section marker (heading + ≥2 lines matching `\d+\s*(%|points)`) but `grading == []` → the model dropped the table (truncation tripwire) | retryable, then quarantine — never a silent empty |
| L9 sentinel | output contains any `_sentinels.json` value → exemplar parroting | immediate retry with explicit warning |

Two engine refinements that pay for themselves immediately (and are safe on v1): include the **previous attempt's JSON** in the retry block (so "change only the named fields" is actually followable — today the model never sees what it wrote), and harden the JSON parser (`raw_decode` from first brace to tolerate trailing prose; one lenient retry stripping trailing commas). Also return a `request_count` (transport retries included) so free-tier budgets are decremented by real requests, not loop iterations — the 429-backoff can otherwise burn up to 5× the assumed daily quota.

**Not on the menu:** a same-model "review your own answer" pass. The evidence says it doesn't help extraction; it only spends tokens.

---

## 6. Pillar 5 — Deterministic pre-extraction (don't prompt for what you can parse)

The 2025/26 Concourse pages are structured HTML with a stable heading set; several fields are parseable without any model. Two patterns, chosen per field:

- **Prefill** (value injected into `context`; the prompt says these fields are pipeline-handled): dates printed with stable labels (`Withdraw Date:`, `Certification Date:`, `Modified`), credit hours from the header line. **Merge rule: prefill wins only when non-null** — a regex miss must fall back to the model's value plus a cross-check lint, never clobber it with null (Concourse label wording drifts: "Withdraw Date" vs "Withdraw Deadline"). Do not instruct the model to skip a field until that field's prefill recall measures ≥99% on a labeled sample; until then run both and lint on disagreement.
- **Cross-check** (model extracts; parser verifies): grading tables (the DOM row count bounds `grading[]` length), section headings (an empty heading in the DOM ⇒ that field must be null).
- **Segmentation/trim**: strip only *proven* boilerplate (the Support Contacts / Institutional Policies blocks are identical across thousands of pages — verify on a sample before denylisting anything, and version the denylist; gold inputs regenerate through the same trim so eval and production always see the same text). For small-context local models, section-wise extraction (split by H2, extract per section, merge) is the fallback when a document exceeds the context budget in *tokens* (measure tokens, not chars — table-heavy pages run ~3 chars/token).

The prompt keeps the "policies hide in odd places — scan the whole document" rule, so trimming must never remove a section that has ever carried a policy.

---

## 7. Pillar 6 — Escalation ladder, budgets, and the quarantine loop

**Ladder** (each rung only sees what the previous rung failed): local student model → hosted free structured-output model → hosted mid rung → **quarantine** (`needs_review` — the existing status; never displaces good data). Candidate rungs from current research (all must pass the gold gate before promotion; the free lineup churns, so re-running the gate on a swap must stay a one-command affair):

- **Local**: Qwen3 8B Q4_K_M (16 GB machines) or Qwen3 4B (8 GB); Gemma 3 12B where RAM allows. Skip Phi-family (benchmarked poorly under schema guidance) and ≥14B local (RAM overflow tanks throughput).
- **Hosted free**: Gemini 2.5 Flash-Lite (best free RPD, native `responseJsonSchema`) with Gemini 2.5 Flash as the mid rung; on OpenRouter, prefer models advertising `structured_outputs` (query `/api/v1/models` at startup rather than hardcoding — the roster changes monthly).

**Budget reality** (measured against the actual raw archive: ~32k files across 8 terms, of which 2024 alone is ~7k): plan **per-cohort phases** — 2026/2025 Concourse HTML first (structured tier, highest quality per document), the 2024 PDF cohort as its own later phase with PDF-tier lint settings. At free-tier rates with ~1.4 requests/doc, a full-history syllabus pass is *weeks, not days*; the batch runner must be **resumable** (ledger keyed by source + converter/prompt/schema versions), **paced** per provider bucket, and guarded by a **circuit breaker**: abort and report when the quarantine rate over the first N docs of a batch exceeds ~40% — a systematic cohort failure (e.g., every 2024 PDF) must cost one triage session, not the whole budget.

**Quarantine is triaged by cohort, not by document.** The weekly session (~30 min) reads the *failure-pattern report* (top validator errors by count, per term/source tier), picks the dominant pattern, and fixes it once — a prompt rule, a lint adjustment, a converter fix — then re-runs that cohort. Individual adjudications flow through `extract_manual()` and the interesting ones are promoted to gold cases. A per-term **facts-coverage report** (extracted-ok ÷ expected representatives) is printed by every batch and build, so a silently quarantined cohort is visible even in a week nobody triages.

**Post-promotion audit** (mandatory, closes the small-gold-set gap): after any model/prompt promotion, the first ~100 accepted production docs get a blind teacher audit (Claude re-extracts a sample in a dev session; field-diff against the student). Disagreements feed the failure taxonomy → new lints, prompt rules, or gold cases.

---

## 8. Measuring: the scorer and the gate

One pure scoring library (zero network) shared by eval runs, offline self-checks, and audits. Field classes, keyed off the facts schemas:

| Class | Fields (examples) | Match rule |
|---|---|---|
| EXACT | enums (`canonical_type`, `confidence`), numbers, booleans | equality (numbers: ±0.01) |
| NORM_STR | codes, titles, dates | casefold + whitespace/punctuation fold |
| VERBATIM | `raw_label`, `raw_text`, `policies.*`, `office_hours`, `instructor_contact` | normalized equality **and** source-grounding — fuzzy matching is banned here because token-overlap scores can rate a policy and its *negation* ~0.9 similar |
| SET | order-irrelevant arrays (`one_of` members, `courses[]`) | set equality after NORM_STR |
| GENERATIVE | `full_summary`, `distinctive_features`, `instructor_outcomes`, `course_schedule` | reported (similarity), never gated |

Scoring rules that keep the numbers honest: absent keys normalize to null/`[]` on **both** sides before matching (`{"confidence":"high"}` must score terribly, not vacuously); **non-null recall** (accuracy over gold-non-null fields) is reported separately from **null agreement** — never blended, because gold syllabi are null-dominated and blending lets an abstainer look accurate; identity fields echoed from `context` are excluded from the gated denominator; `expected.json` may declare `acceptable_alternatives` for genuinely ambiguous enum rows; teacher (`claude_code_session`) rows appear on the leaderboard as reference only, never in promotion logic.

**The gate** (per doc_type, verified cases only): critical fields (grading numbers, prereq structures, dates, enum types) = 100% of non-abstained cases, with **per-trait coverage** — every registered trait must pass at least once, so a model can't dodge the traps by abstaining on exactly the hard cases (abstentions are capped and their trait coverage still required); overall non-null recall ≥ 95%; null agreement ≥ 90%. The report prints confidence bounds beside each number, and a pass at n≤25 is *provisional* — it authorizes a bulk run only together with the §7 audit.

---

## 9. Who does what (club rhythm)

| Role | Time | Does |
|---|---|---|
| Teacher sessions (any member driving Claude in dev) | as needed | author gold `expected.json` + exemplars via `extract_manual()`; blind audits; quarantine adjudications |
| Verifier (any member) | 30–45 min/case | field-by-field gold verification incl. reading for nulls; 1-in-5 double-check |
| Pipeline runner | ~1 evening/cohort | batch runs (local overnight or hosted paced), watch the coverage report + circuit breaker |
| Weekly triage (rotating) | 30 min | cohort-pattern report → one systemic fix → re-run |

**Implementation home:** the code artifacts this playbook specifies — `verify_facts.py`, `segment.py`, `score_facts.py`, `eval_extract.py`, the batch runner, and the small `extract.py` seams (semantic-validator hook, previous-JSON retry block, parser hardening, `request_count`, `num_ctx`, per-provider env vars) — belong in one focused issue ("extraction quality harness") so they land together with the gold gate that proves them. The prompt/exemplar/gold artifacts already live in this repo:

| Artifact | Status |
|---|---|
| [`apps/data/prompts/extract_v2.md`](../apps/data/prompts/extract_v2.md) | draft — **inactive** until `PROMPT_VERSION` flips after a passing gold gate |
| [`apps/data/prompts/examples/`](../apps/data/prompts/examples/) | syllabus ×2, course ×2, program_map ×1, cv ×1 + `_sentinels.json` |
| [`apps/data/tests/gold/`](../apps/data/tests/gold/) | SOP README, `traits.json`, first real case (ACCT-2301 Spring 2026 — teacher-authored, awaiting human verification) |
