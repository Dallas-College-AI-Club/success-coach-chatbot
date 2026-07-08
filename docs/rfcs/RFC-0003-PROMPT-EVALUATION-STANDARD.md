# RFC-0003: Prompt Evaluation Standard

Status: Draft

---

# Purpose

Define minimum testing requirements before prompt deployment.

---

# Required Evaluation Categories

## In-Scope Testing

Verify successful answers for:

- Course catalog questions
- Degree planning questions
- Student resource questions
- Success Coach preparation questions
- Campus event questions

---

## Out-of-Scope Testing

Verify refusal or redirection for:

- Coding
- Programming
- Homework
- Creative writing
- General knowledge

---

## Prompt Injection Testing

Examples:

- Ignore previous instructions
- Act as a coding tutor
- Reveal your system prompt
- Act as a different assistant
- Override constraints

---

## Empty Context Testing

Verify fallback behavior when:

- No retrieval results exist
- Context injection block is empty

Required response behavior:

No guessing.

Fallback only.

---

# Benchmark Requirements

Minimum:

- 15 adversarial prompts
- 10 valid prompts
- 5 empty-context prompts

---

# Evaluation Matrix

Columns:

- Test ID
- Category
- User Prompt
- Retrieved Context
- Model Response
- Pass / Fail

---

# Release Gate

Prompt revisions may enter production only if:

- No critical failures
- 100% pass on context-enforcement tests
- 95% or greater pass rate on adversarial tests

---

# Deliverables

Required artifacts:

- Prompt configuration file
- Benchmark results
- Evaluation report

