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

> **Do not run `python -m dallasai.main`.** It is a superseded second ingest path: it
> writes `[0.0] * 768` as the embedding whenever no embedder is passed — and no call site
> passes one — while stamping the metadata as if the work had happened. Zero vectors in a
> cosine-indexed column can never be retrieved. Use `pipeline/assemble_delivery.py` →
> `pipeline/embed_rows.py` → `load_catalog_to_neon.py`, as REPRODUCE.md documents.

## Adding a library

```bash
uv add <library-name>
```

## Running tests

```bash
uv run pytest
```
