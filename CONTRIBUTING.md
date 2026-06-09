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

**Linting & Typechecking**
We enforce strict typing and formatting across the codebase.
* Run ESLint: `npm run lint` (or `npx eslint .`)
* Run Typecheck: `npm run typecheck` (or `npx tsc --noEmit`)

**Testing**
Our testing strategy splits into fast unit tests for logic and comprehensive e2e tests for user flows.
* Run Unit Tests (Vitest): `npm run test:unit` (or `npx vitest`)
* Run E2E Tests (Playwright): `npm run test:e2e` (or `npx playwright test`)

---

## 3. Definition of Done (DoD)
A feature or bug ticket cannot be moved to the "Done" column until the following baseline criteria are met. This checklist is included in our PR template.

* **Code Quality:** `eslint` passes with no warnings/errors, and `tsc` reports no type discrepancies.
* **Unit Testing:** Critical business logic has coverage via `vitest`.
* **E2E Testing:** Critical user flows are covered and passing via `playwright`.
* **Environment:** Feature works as expected in a simulated local or staging environment.
* **Documentation:** System architecture changes, new third-party packages, and environment variables (`.env.example`) are updated in the repository `README` or wiki.

---

## 4. Pull Request (PR) Workflow
Follow this step-by-step lifecycle to integrate your code:

1. **Commit your changes:** Write clear, concise commit messages.
2. **Open a PR:** Push your branch and open a Pull Request against `main`.
3. **Fill out the Template:** The `.github/pull_request_template.md` will automatically populate. You must link the Issue ID, summarize changes, provide manual testing steps, and verify the DoD checklist.
4. **Peer Review:** At least **1 peer approval** is required before the PR can be merged. Reviewers will check for logic errors, architectural consistency, and adherence to the DoD.
5. **Conflict Resolution:** If merge conflicts arise with the target branch, **the PR author** is solely responsible for pulling the latest changes, resolving the conflicts locally, and force-pushing the resolution back to the PR branch.
6. **Merge:** Once approved and passing all automated checks, the code can be merged.