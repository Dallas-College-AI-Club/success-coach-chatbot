# Reproducing the data pipeline

This is the current supported path. Extraction produces reviewable facts; composition produces rows; one local encoder produces vectors; the loader validates before any database write. Raw archives, credentials, delivery files and test traces stay outside Git.

## Setup and schema

Run Python commands from `apps/data` after `uv sync`. Install frontend dependencies with `npm ci` in `apps/frontend`; Node must also be on PATH for embedding. Keep database credentials in a local ignored environment file. The Python tools read `.env`/process environment; the frontend reads `.env.local`. Neither setup command copies credentials between them.

```sh
uv run python -m dallasai.database --schema   # print SQL; no connection
uv run python -m dallasai.database --status   # read-only counts; never initializes
```

For a **new disposable database**, review [the generated baseline](reference/db/schema.sql), configure that target, then explicitly run `uv run python -m dallasai.database --init`. Setup enables `vector` and `pg_trgm`, creates missing tables, and never drops tables. It fails clearly on errors. It does not upgrade an existing table layout. The Alembic directory is an unused historical scaffold with no revisions; `alembic upgrade head` is not a setup command.

SQLAlchemy models are authoritative; TypeScript mirrors them. The supported baseline uses `halfvec(384)` and exact filtered vector search, without an HNSW index. Existing databases require a separately reviewed migration. Regenerate the reference SQL with `database --schema` after an approved model change; a regression test detects drift.

## Source evidence and extraction

Keep the archived `catalog`, `schedule`, `cv`, `cv_profiles`, `syllabi` and `manifests` folders together under a configurable raw root. Archive manifests retain public source URLs and original fetch timestamps. HTTP success alone does not prove a page contains the intended document: login/error pages, absent headings, wrong identities and missing files must be quarantined.

Use `python -m dallasai.pipeline.extract_batch --help` for the manifest filters and replay mode. The [extraction manual](EXTRACTION_MANUAL.md) explains the per-document schemas and prompt versions. Paid extraction requires an explicitly selected `EXTRACTOR`; replay accepts already reviewed payloads. Tests clear provider configuration and do not call paid extraction services.

```sh
uv run python -m dallasai.pipeline.golden_gate --raw-root <raw> --gate-dir <verified-fixtures>
uv run python -m dallasai.pipeline.extract_batch --raw-root <raw> --doc-type course --out <facts>
uv run python -m dallasai.pipeline.verify_catalog --raw-root <raw> --facts <facts>
uv run python -m dallasai.pipeline.verify_cv --raw-root <raw> --facts <facts/cv> --as-of 2026
```

Golden fixtures must be supplied and reviewed; an empty fixture directory cannot unlock a bulk run. The repository's unit tests cover failure cases but do not replace the extractor's source-specific golden fixtures. Catalog verification checks titles as well as codes and credits. Adjudications waive only explicitly named diagnostics, never every error in a document. Missing CV sources and empty verification runs fail.

Resume skips an extraction only when its fingerprint matches the actual source bytes, identity context, extractor configuration, prompt, schema and extractor code. Superseded envelopes move to quarantine before re-extraction so a failed retry cannot leave stale facts in the active delivery.

Missing raw files also retire their old active envelopes. Empty replay maps fail without calling a model. Output identities are checked before extraction: use a separate facts output directory per catalog year when archived filenames overlap; conflicting existing envelopes cannot be silently replaced.

## Composition and missing-data review

`assemble_delivery` composes course/program envelopes and the selected schedule terms; `assemble_cv_delivery` composes reviewed CV envelopes. Run each module with `--help` for its required paths. Composition never embeds. Schedule composition now includes meeting facts directly from the CSV, so a fresh database does not need an existing section row to acquire times. Source dates are preserved; date-only CSV stamps are represented as UTC midnight, not a claim of an exact fetch time.

Catalog envelopes must identify their edition; composition rejects a missing edition instead of defaulting to 2026–2027. Acalog identifiers come from the source URL. Schedule receipts are compared as timestamps, including timezone offsets, and the CSV is read once for composition.

`build_section_meetings` prepares a **local facts-only update** for already indexed sections. It reads the database in a read-only transaction, requires explicit terms, checks source URLs, and rejects unmatched targets. Partial or unknown meeting formats retain their full source text with no invented times. Empty `meetings` means no parsed clock times, never proof of asynchronous delivery.

```sh
uv run python -m dallasai.pipeline.build_section_meetings --schedule <raw/schedule> --terms 2026FA --out <review.json>
```

Export a review snapshot with `uv run python -m dallasai.database --export-snapshot <new-snapshot.json>` (read-only; refuses overwrites). The corpus review tool takes this snapshot containing `docs` (all course/program/CV records with facts, metadata, text, source URL, chunk index, hash and source timestamp) and `schedules` (course/term section counts). It never connects to a database:

```sh
uv run python -m dallasai.pipeline.audit_corpus --raw-root <raw> --snapshot <snapshot.json> --out <new-review-directory>
```

Its report distinguishes real missing courses, elective-option pages, quarantine and schedule codes without a catalog record. `XXXX` pages belong to `catalog` with `record_kind=course_options`; they are not enrollable courses. Generated supplements still require source review, embedding, validation and approval before loading. A catalog record does not establish that a section is offered this term.

## One embedding contract

[embedding-contract.json](../frontend/lib/embedding-contract.json) declares `Xenova/all-MiniLM-L6-v2`, 384 dimensions, int8 weights, mean pooling and unit normalization. Python invokes the frontend encoder through a small local Node runner, so ingestion and queries use the same implementation. First use downloads model weights; document text is processed locally, with no embedding API charge.

```sh
uv run python -m dallasai.pipeline.embed_rows --rows <rows.json> --out <new.embedded.json>
uv run python -m dallasai.pipeline.carry_embeddings <new-rows.json> <previous.embedded.json> <new-output.json>
```

Both paths refuse to overwrite their inputs or an existing output. The carry path checks finite values, width, norm, model, weight dtype and the embedded text's SHA-256. The encoder regenerates unproven vectors; it never fixes provenance by merely relabelling them. Existing Neon rows have historically inaccurate model stamps. A read-only three-course sample showed MiniLM cosine similarity 0.9885–0.9894, which is supporting evidence, **not proof of every row's origin**. Legacy vectors therefore cannot be carried into a new validated delivery without regeneration. Updating the live corpus is a separate reviewed data operation.

Validated vectors can be reused when `chunk_text` is identical even if other facts or source receipts changed. Only the vector and embedding provenance are carried; the new delivery's facts and other metadata remain authoritative. A text change always requires a new embedding.

## Validation and loading

Declare reviewed expected counts for every delivery. Single-type supplements use `--supplemental <type> --expect N`; mixed deliveries use `--counts <counts.json>`, an object such as `{"course":86,"catalog":34}`. Counts are not frozen in source code.

```sh
uv run python -m dallasai.load_catalog_to_neon <new.embedded.json> --supplemental course --expect 86
uv run python -m dallasai.load_catalog_to_neon <mixed.embedded.json> --counts <counts.json>
uv run python -m dallasai.load_catalog_to_neon <review.json> --facts-only
```

These commands validate only. The loader rejects empty deliveries/text, duplicate identities, unsafe source URLs, malformed hashes, invalid dates/numbers/facts and incompatible vectors. Section facts use the backward-compatible v2 contract, including original meeting text. Review the target and delivery before a separately authorized `--load`.

Full imports commit in batches and report failure if any batch fails; already committed batches remain and an idempotent retry is required. Facts-only updates require an `expected_content_hash` captured from each reviewed target, use one transaction, and roll back the entire delivery if any target is absent or its hash changed. `build_section_meetings` supplies this precondition automatically. Regenerate older proposals that lack it; never copy the proposed replacement hash into this field. Facts-only updates must only be used when source text and its embedding are unchanged. A stale proposal or a repeat of an already applied repair must be regenerated and reviewed before loading.

Legacy `dallasai.main` database writes are retired. Its `--no-db` path is only for local historical inspection. `course_extractor` is import-safe and has an explicit local-output CLI. Neither path bypasses the supported loader.

## Acceptance

```sh
uv run pytest tests/ -q
```

Run frontend lint, typecheck, regression tests and build as described in its README. Compare changed tool outputs with the full database query and saved source pages, then test realistic multi-turn conversations and browser disclosures. Record the number of sources checked, any quarantine and the source snapshot dates. A successful build or model reply alone does not prove factual completeness.
