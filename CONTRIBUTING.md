# Contributing Guidelines

Welcome to the team! To maintain high code quality, prevent breaking changes from hitting the main branch, and ensure architectural consistency, we follow a strict Definition of Done (DoD) and Pull Request (PR) workflow. 

---

## 1. Branch Naming Conventions
Always branch off of `main` (or the designated integration branch) and use the following prefix system to clarify the intent of your work:

* **Feature:** `feature/[ID]-[short-description]` (e.g., `feature/001-event-api`)
* **Bugfix:** `bugfix/[ID]-[short-description]` (e.g., `bugfix/login-error`)
* **Spike/Research:** `spike/[ID]-[short-description]` (e.g., `spike/004-infra`)

**Note:** All `[ID]` are GitHub issue ids.

---

## 2. Local Development & Testing Commands
Before pushing your code, you must ensure that all code complies with our formatting, typing, and testing standards. 

From `apps/frontend`, run `npm run verify` for lint, types, regression checks and a production build. From `apps/data`, run `uv run pytest tests/ -q`. These are the same two commands CI runs. The frontend regression scripts use Node's built-in test runner through `tsx`.

For changes to answers or retrieval, also compare tool output with independently read database records and original saved sources. Record the model, source dates, scenario counts, failures and limitations. Browser checks must exercise real student flows, including mobile layout, expandable details, saved notes and the first-message starter behavior.

---

## 3. Definition of Done (DoD)
A feature or bug ticket cannot be moved to the "Done" column until the following baseline criteria are met. This checklist is included in our PR template.

* **Code Quality:** `eslint` passes with no warnings/errors, and `tsc` reports no type discrepancies.
* **Regression Testing:** Meaningful cases cover changed business rules and reproduced failures through `node:test`/`tsx` or `pytest`.
* **User-flow Testing:** Relevant browser journeys and real-data comparisons pass, with evidence and limitations recorded.
* **Environment:** Feature works as expected in a simulated local or staging environment.
* **Documentation:** architecture changes go in `docs/ARCHITECTURE.md`, dated decisions in `docs/DECISIONS.md`, and new environment variables in `.env.example` and the relevant README.

---

## Cleanup required for every touched file

Review the whole file when changing it. Remove confirmed unused code and imports, duplicate validation, obsolete comments and outdated instructions. Keep one authoritative implementation for each rule. Prefer existing modules and dependencies; add a file only when it gives a clear responsibility or reusable boundary. Keep source files readable rather than combining unrelated concerns just to reduce file count.

Preserve existing behavior outside the approved scope. Test failure paths as well as successful answers. Keep credentials, raw data, generated drafts and local test traces out of Git. Report unfinished work accurately; passing tests do not prove every possible model response is correct.


## 4. Pull Request (PR) Workflow
Follow this step-by-step lifecycle to integrate your code:

1. **Commit your changes:** Write clear, concise commit messages.
2. **Open a PR:** Push your branch and open a Pull Request against `main`.
3. **Fill out the template:** `.github/pull_request_template.md` populates automatically. Link the issue, say what changed and why, and record how it was checked.
4. **Peer Review:** At least **1 peer approval** is required before the PR can be merged. Reviewers will check for logic errors, architectural consistency, and adherence to the DoD.
5. **Conflict Resolution:** If merge conflicts arise with the target branch, **the PR author** is solely responsible for pulling the latest changes, resolving the conflicts locally, and updating the PR branch without overwriting others’ work. Use a normal merge update where possible; coordinate any history rewrite before using force-with-lease.
6. **Merge:** Once approved and passing all automated checks, the code can be merged.
