## Linked issue

Closes #

## Summary of changes

-
-

## How this was checked

From `apps/frontend`: `npm run verify` (lint, types, regression checks, production build).
From `apps/data`, if changed: `uv run pytest tests/ -q`. Describe any manual/browser checks.

## Definition of Done

- [ ] `npm run verify` passes (or `uv run pytest tests/ -q` for `apps/data` changes)
- [ ] Documentation updated: `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, or the relevant README
- [ ] No secrets, credentials or raw data in this diff

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full workflow.
