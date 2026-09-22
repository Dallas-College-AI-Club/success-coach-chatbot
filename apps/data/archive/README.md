# Archive

Code the supported pipeline ([REPRODUCE.md](../REPRODUCE.md)) no longer uses, moved
here on 2026-09-22 instead of deleted so the history stays browsable. Every file is a
frozen snapshot: imports still name the old `dallasai.*` locations, and the
ChromaDB / OpenAI / sentence-transformers / Alembic packages they need were dropped
from `pyproject.toml`, so nothing here runs without restoring both. `pytest` collects
`tests/` only (`testpaths` in `pyproject.toml`), so `archive/tests/` never runs.

Nothing under `archive/` is imported by live code or CI. Checked on 2026-09-22 with

```sh
grep -rn "rag_poc\|rag_interactive\|pipeline_runner\|dallasai.main\|init_db\|markdown_converter\|html_cleaner\|preprocess_html\|preprocess_syllabi\|semantic_chunker\|test_chunker\|dallasai.embedding\|update_embeddings\|repositories\|alembic\|chromadb\|sample_data" dallasai tests run_*.ps1 ../../.github
```

which returns only the `database.py` function named `init_db` (the live initializer).

| Archived file | Original path | What it was | Why archived |
|---|---|---|---|
| `prototypes/rag_poc.py` | `dallasai/rag_poc.py` | Issue #20 RAG evaluation: ChromaDB + OpenAI over sample syllabi | zero importers; superseded by Neon pgvector and the frontend retrieval tools |
| `prototypes/rag_interactive.py` | `dallasai/rag_interactive.py` | terminal chat over the Chroma prototype | zero importers; same |
| `prototypes/rag_interactive_html.py` | `dallasai/rag_interactive_html.py` | same prototype, HTML-report variant | zero importers; same |
| `prototypes/pipeline_runner.py` | `dallasai/pipeline_runner.py` | Issue #35 HTML → Markdown → chunks → ChromaDB ingestion | second write path; only importer was its own test; superseded by `assemble_*` → `embed_rows` → `load_catalog_to_neon` |
| `legacy_write_path/main.py` | `dallasai/main.py` | Issue #91 ingest CLI; database writes retired per #136 / #151 | superseded by `load_catalog_to_neon`; only importer was `tests/test_main.py` |
| `legacy_write_path/init_db.py` | `dallasai/init_db.py` | compatibility alias for `database.init_db` | zero importers; `python -m dallasai.database --init` is the entry point |
| `preprocessing/html_cleaner.py` | `dallasai/pipeline/html_cleaner.py` | Issue #90 DOM cleaner for Concourse and catalog HTML | imported only by `markdown_converter`; extraction uses `pipeline/extract.html_to_text` |
| `preprocessing/markdown_converter.py` | `dallasai/markdown_converter.py` | Issue #90 HTML / PDF → Markdown with frontmatter | imported only by `main.py`, `pipeline_runner.py`, `preprocess_html.py` (all archived) |
| `preprocessing/preprocess_html.py` | `dallasai/pipeline/preprocess_html.py` | batch CLI driver for the converter | zero live importers |
| `preprocessing/preprocess_syllabi.py` | `dallasai/pipeline/preprocess_syllabi.py` | alias of `preprocess_html` | zero importers |
| `preprocessing/semantic_chunker.py` | `dallasai/semantic_chunker.py` | Issue #35 header + sliding-window chunker | imported only by `main.py`, `pipeline_runner.py`, `test_chunker.py` (all archived); rows are composed whole by `build_knowledge` |
| `preprocessing/test_chunker.py` | `dallasai/test_chunker.py` | ANSI terminal viewer for the chunker | zero importers |
| `legacy_embedding/embedding.py` | `dallasai/embedding.py` | in-process sentence-transformers MiniLM encoder | imported only by `main.py` and `update_embeddings.py`; the one embedding contract runs the frontend encoder through `pipeline/embed_rows` |
| `legacy_embedding/update_embeddings.py` | `dallasai/pipeline/update_embeddings.py` | re-embed `rows.json` in place, no provenance stamps | zero importers; `embed_rows` / `carry_embeddings` replace it |
| `repositories/__init__.py` | `dallasai/repositories/__init__.py` | package re-exports | zero importers |
| `repositories/knowledge_repository.py` | `dallasai/repositories/knowledge_repository.py` | Issue #51 SQLAlchemy upsert / search helpers | zero importers; the loader writes through `dallasai.models` directly |
| `repositories/user_repository.py` | `dallasai/repositories/user_repository.py` | Issue #51 chat-session export by student | zero importers |
| `alembic/alembic.ini`, `alembic/README`, `alembic/env.py`, `alembic/script.py.mako` | `alembic.ini`, `alembic/` | Alembic scaffold, no revisions ever committed | never used; schema comes from `dallasai.database --schema` / `--init` |
| `tests/test_main.py` | `tests/test_main.py` | tests for `main.py` | follows `main.py` |
| `tests/test_pipeline.py` | `tests/test_pipeline.py` | tests for `markdown_converter`, `semantic_chunker`, `pipeline_runner` | follows them |
| `tests/test_preprocessing_diff.py` | `tests/test_preprocessing_diff.py` | converter output checks against `sample_data` | follows `markdown_converter` |
| `sample_data/` (19 files) | `sample_data/` | syllabus and course HTML / Markdown samples plus one schedule CSV | read only by the files above; the archived tests still resolve `../sample_data` |
