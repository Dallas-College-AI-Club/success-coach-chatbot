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

## Running code locally

```bash
uv run python -m dallasai.main
```

## Adding a library

```bash
uv add <library-name>
```

## Running tests

```bash
uv run pytest
```
