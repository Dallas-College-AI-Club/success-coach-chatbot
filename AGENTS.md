# Rules for coding agents

These rules apply to every AI coding agent working in this repository: Claude reads them through
`CLAUDE.md`, Codex reads this file directly. The repository is shared by the Dallas College AI Club,
so everything committed here is read by teammates.

## How changes land

- Branch from an up-to-date `origin/main`, one topic per branch. `main` changes only through a pull
  request with one peer approval ([CONTRIBUTING.md](CONTRIBUTING.md)).
- Ask the person you work for before any GitHub write (opening, commenting on or merging a PR or
  issue) and before any deployment. Merging does not deploy; see
  [apps/frontend/README.md](apps/frontend/README.md).
- Make maintainer review comments as asked, then reply briefly.
- Before opening a PR, run the two checks CI runs and report the results honestly, including what
  you did not check:
  - `apps/frontend`: `npm run verify`
  - `apps/data`: `uv run pytest tests/ -q`

## How to write code here

- Read the installed version's docs before writing against a library. Next.js has its own rule in
  [apps/frontend/AGENTS.md](apps/frontend/AGENTS.md); check versions in `package-lock.json` and
  `uv.lock`, not the ranges.
- Make the smallest change that works. Use what the library or the existing code already provides
  before adding a helper, file or layer.
- Delete superseded code and documents instead of archiving them. Git history is the archive: no
  `archive/` folders, `-v2` copies or dated duplicates.
- Record a decision as a dated entry in [docs/DECISIONS.md](docs/DECISIONS.md) and architecture
  changes in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## What stays out of Git

- **Secrets.** Credentials live only in ignored `.env` / `.env.local` files or the hosting
  platform's secret store, never in code, docs, screenshots, issues or PRs.
- **Raw data.** The scraped corpus lives outside the repository. Pipeline code reaches it only
  through the `DATA_DIR` setting in `apps/data/.env`; never hard-code a machine path or copy raw
  files into the tree.
- **Personal notes and local output.** Chat logs, handoffs, evidence traces and scratch files go in
  the ignored `.tmp/` folder or outside the repository. Docs in the tree are written for teammates.
