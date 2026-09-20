# DallasAI Club Success Coach Chatbot - Data

## Requirements

- uv

## Installing uv

**Windows:**

```bash
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**Mac/Linux:**

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

or

```bash
wget -qO- https://astral.sh/uv/install.sh | sh
```

## Setting up the environment

```bash
cd apps/data
uv sync
```

## Running the pipeline

**Start here: [`REPRODUCE.md`](REPRODUCE.md)** — the step-by-step runbook, organised by
doc_type, with a paid path and a $0 local-model path. [`EXTRACTION_MANUAL.md`](EXTRACTION_MANUAL.md)
carries the rationale behind each stage.

Every stage runs as a module from `apps/data/`:

```bash
uv run python -m dallasai.pipeline.<module>
```

> Legacy `dallasai.main` database writes are disabled. Its `--no-db` option
> supports local inspection only. Use the reviewed composition → local embedding
> → strict loader path in the runbook. Setup never drops existing tables, and
> status checks never initialize the database.

## Adding a library

```bash
uv add <library-name>
```

## Running tests

```bash
uv run pytest
```
