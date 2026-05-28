# Success Coach Chatbot — MVP Spec (Degree Planning)

## Goal
Provide an AI assistant that helps Dallas College students understand:
1) remaining degree requirements, and
2) a suggested next-term schedule (2–4 courses),
based on program + catalog year + completed courses, with prerequisite checks and clear reasoning.

**Non-goal:** This is not an official degree audit. Users must verify in Workday/advising.

## MVP Scope (v1)
### In scope
- Collect required inputs: Program + Catalog Year + Completed Courses (course codes)
- Compute remaining requirements from structured program data
- Recommend a next-term schedule (2–4 courses) with explanations
- Prerequisite warnings + alternative suggestions when possible
- Course info lookup (description/credits/prereqs)
- Copyable plan output

### Out of scope (v1)
- Workday login/integration
- Real-time class availability / section scheduling
- Financial aid optimization
- Transfer equivalencies (planned v2)
- PDF export (v2)

## Primary User Personas
- New student (doesn’t know degree requirements)
- Working student (needs constraints like credit load / schedule)
- Returning student (has partial credits and needs “what’s left?”)

## Required Data (Minimum)
- `courses`: code, title, credits, description
- `program_requirements`: program, catalog_year, requirement groups, required courses, elective rules
- `prerequisites`: course_code, prerequisite expression (best-effort)

## User Stories (MVP)
1) Intake: program + catalog year + completed courses
2) Remaining requirements summary
3) Next-term recommended schedule (2–4 courses)
4) Prerequisite check & warnings
5) Course info lookup
6) Explain “why” (requirement mapping)
7) Export/share plan (copyable output)

## Definition of Done (MVP)
MVP is considered done when:
- End-to-end demo works in staging: UI -> chat -> response (no crashes)
- Dataset v1 exists for at least 1–2 programs and the relevant courses
- Bot does not recommend courses with unmet prerequisites (or clearly warns)
- A test set exists (>= 15 queries) with documented expected outputs and pass rate target >= 80%
- README includes local run instructions + environment variables (`.env.example`)
- No secrets committed; CI checks pass on PRs (lint/build/test as available)

## Testing Notes
- Build a small set of student profiles with completed course lists
- Validate:
  - remaining requirements correctness
  - prereq enforcement
  - output formatting and copyability
  - failure behavior when data is missing or user input is invalid
