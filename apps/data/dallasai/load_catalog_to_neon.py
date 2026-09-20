"""Validate knowledge deliveries, then optionally load reviewed rows into Neon.

Every delivery declares expected record counts. Full-row upserts commit in
batches; facts-only repairs use one transaction and reject missing or changed targets.
Without --load this command performs validation only.
"""

from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from sqlalchemy import bindparam, case, func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from dallasai.database import SessionLocal
from dallasai.models import KnowledgeEntry
from dallasai.pipeline.embed_rows import validate_embedding
from dallasai.pipeline.extract import DOC_SCHEMAS, SCHEMAS_DIR, validate

# Every import declares its expected composition; no frozen snapshot counts.
SUPPLEMENTAL_DOC_TYPES = frozenset(
    {"course", "program_map", "section", "cv", "resource", "catalog"}
)

# Required fields that every JSON row must contain.
REQUIRED_FIELDS = {
    "source_url",
    "chunk_index",
    "chunk_text",
    "facts",
    "metadata",
    "content_hash",
    "scraped_at",
    "embedding",
}


def validate_identity(row: dict, index: int) -> None:
    url = row.get("source_url")
    parsed = urlsplit(url) if isinstance(url, str) else None
    if (
        not parsed
        or parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username
        or parsed.password
    ):
        raise ValueError(f"Row {index}: source_url must be a public HTTPS URL")
    if type(row.get("chunk_index")) is not int or row["chunk_index"] < 0:
        raise ValueError(f"Row {index}: chunk_index must be a non-negative integer")
    if not isinstance(row.get("content_hash"), str) or not re.fullmatch(
        r"[a-f0-9]{64}", row["content_hash"]
    ):
        raise ValueError(f"Row {index}: content_hash must be a SHA-256 hex digest")
    if not isinstance(row.get("facts"), dict):
        raise ValueError(f"Row {index}: facts must be an object")
    validate_numbers(row["facts"])


def validate_numbers(value: Any, key: str = "") -> None:
    if isinstance(value, dict):
        for k, v in value.items():
            validate_numbers(v, k)
    elif isinstance(value, list):
        for v in value:
            validate_numbers(v, key)
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        if not math.isfinite(value) or ("credit" in key and value < 0):
            raise ValueError(f"Invalid numeric fact: {key}")


@lru_cache(maxsize=1)
def _section_validator():
    import jsonschema

    schema = json.loads(
        (SCHEMAS_DIR / "facts-section-v2.schema.json").read_text(encoding="utf-8")
    )
    return jsonschema.Draft7Validator(schema)


def validate_section(facts: dict) -> None:
    errors = list(_section_validator().iter_errors(facts))
    if errors:
        raise ValueError("Invalid section facts: " + errors[0].message)


# Converts ISO date strings into Python datetime objects.
def parse_datetime(value: str | datetime) -> datetime:
    """Convert an ISO-8601 string to a datetime object."""

    # Already converted.
    if isinstance(value, datetime):
        return value

    if not isinstance(value, str):
        raise ValueError("Timestamp must be an ISO-8601 string")
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


# Reads the complete JSON dataset and validates every record
# before anything is written into Neon.
def load_rows(
    path: Path,
    *,
    supplemental_doc_type: str | None = None,
    expected_supplemental_rows: int | None = None,
    expected_counts: dict[str, int] | None = None,
) -> list[dict[str, Any]]:
    """Read and validate the complete JSON dataset."""

    if not path.exists():
        raise FileNotFoundError(f"JSON file was not found: {path}")

    if not path.is_file():
        raise ValueError(f"The supplied path is not a file: {path}")

    print(f"Opening file: {path}", flush=True)

    print(
        "Reading the complete JSON file. Please wait...",
        flush=True,
    )

    with path.open("r", encoding="utf-8") as file:
        rows: list[dict[str, Any]] = json.load(file)

    if not isinstance(rows, list):
        raise ValueError("The root JSON value must be a list.")

    if not rows:
        raise ValueError("The JSON file contains no rows.")

    # Track document counts and duplicate keys.
    counts: Counter[str] = Counter()
    seen_keys: set[tuple[str, int]] = set()

    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            raise ValueError(f"Row {index} is not a JSON object.")

        missing_fields = REQUIRED_FIELDS - row.keys()

        if missing_fields:
            raise ValueError(
                f"Row {index} is missing required fields: {sorted(missing_fields)}"
            )

        validate_identity(row, index)

        source_url = row["source_url"]
        chunk_index = row["chunk_index"]
        chunk_text = row["chunk_text"]
        facts = row["facts"]
        metadata = row["metadata"]
        scraped_at = row["scraped_at"]

        if not isinstance(chunk_text, str) or not chunk_text.strip():
            raise ValueError(f"Row {index} has an invalid chunk_text.")
        if not isinstance(metadata, dict):
            raise ValueError(f"Row {index} has invalid metadata.")

        try:
            if parse_datetime(scraped_at).tzinfo is None:
                raise ValueError("Missing timezone")
        except (TypeError, ValueError) as error:
            raise ValueError(
                f"Row {index} has an invalid scraped_at value: {scraped_at}"
            ) from error

        # Every record must declare its document type.
        doc_type = metadata.get("doc_type")

        if not isinstance(doc_type, str) or not doc_type:
            raise ValueError(f"Row {index} has no metadata.doc_type.")
        if doc_type not in SUPPLEMENTAL_DOC_TYPES:
            raise ValueError(f"Row {index}: unsupported doc_type {doc_type}")
        if doc_type in DOC_SCHEMAS:
            errors = validate(doc_type, facts)
            if errors:
                raise ValueError(f"Row {index}: invalid {doc_type} facts: {errors[:3]}")
        if doc_type == "section":
            validate_section(facts)
        if doc_type == "course":
            if not re.fullmatch(r"[A-Z]{3,4} \d{4}", facts.get("course_code", "")):
                raise ValueError(
                    f"Row {index}: option placeholders belong in catalog, not course"
                )
            if metadata.get("course_code") != facts["course_code"]:
                raise ValueError(
                    f"Row {index}: metadata and facts course codes disagree"
                )
        year = metadata.get("year")
        if year is not None and (type(year) is not int or not 2020 <= year <= 2035):
            raise ValueError(f"Row {index}: invalid year")
        if metadata.get("semester") not in (
            None,
            "fall",
            "spring",
            "summer",
            "winter",
            "may",
        ):
            raise ValueError(f"Row {index}: invalid semester")
        validate_embedding(row)

        # Detect duplicate upsert keys.
        unique_key = (
            source_url,
            chunk_index,
        )

        if unique_key in seen_keys:
            raise ValueError(f"Duplicate (source_url, chunk_index) found: {unique_key}")

        seen_keys.add(unique_key)
        counts[doc_type] += 1

    # Validate the dataset composition.
    validate_dataset_counts(
        total_rows=len(rows),
        counts=counts,
        supplemental_doc_type=supplemental_doc_type,
        expected_supplemental_rows=expected_supplemental_rows,
        expected_counts=expected_counts,
    )

    print("\nValidation passed", flush=True)

    print(
        f"Total rows: {len(rows):,}",
        flush=True,
    )

    for doc_type, count in sorted(counts.items()):
        print(
            f"{doc_type}: {count:,}",
            flush=True,
        )

    return rows


# Determines whether the JSON file is:
#
#   • Catalog dataset
#   • CV dataset
#
# Any other document composition is rejected.
def validate_dataset_counts(
    total_rows: int,
    counts: Counter[str],
    *,
    supplemental_doc_type: str | None = None,
    expected_supplemental_rows: int | None = None,
    expected_counts: dict[str, int] | None = None,
) -> None:
    """Require reviewed counts for a mixed or single-type delivery."""

    actual_counts = dict(counts)
    doc_types = set(actual_counts)
    if (
        total_rows <= 0
        or sum(counts.values()) != total_rows
        or any(n <= 0 for n in counts.values())
    ):
        raise ValueError("Expected a non-empty, consistent delivery count")

    if supplemental_doc_type is not None:
        if supplemental_doc_type not in SUPPLEMENTAL_DOC_TYPES:
            raise ValueError(
                f"Unknown supplemental doc_type: {supplemental_doc_type!r}. "
                f"Expected one of: {sorted(SUPPLEMENTAL_DOC_TYPES)}"
            )

        if expected_supplemental_rows is None or expected_supplemental_rows <= 0:
            raise ValueError(
                "A supplemental delivery needs an expected row count (pass --expect N)."
            )

        expected = {supplemental_doc_type: expected_supplemental_rows}

        if (
            doc_types != {supplemental_doc_type}
            or total_rows != expected_supplemental_rows
            or actual_counts != expected
        ):
            raise ValueError(
                "The supplemental counts do not match "
                "the expected delivery.\n"
                f"Expected: {expected}\n"
                f"Found: {actual_counts}"
            )

        return

    if expected_counts is not None:
        if not isinstance(expected_counts, dict):
            raise ValueError(
                "Expected counts must map document types to positive counts"
            )
        if not expected_counts or set(expected_counts) - SUPPLEMENTAL_DOC_TYPES:
            raise ValueError("Expected counts contain unsupported document types")
        if any(type(n) is not int or n <= 0 for n in expected_counts.values()):
            raise ValueError("Expected counts must be positive integers")
        if actual_counts != expected_counts:
            raise ValueError(
                f"Delivery counts differ: expected {expected_counts}, "
                f"found {actual_counts}"
            )
        return
    raise ValueError(
        "Unexpected dataset composition: supply --counts reviewed-counts.json "
        "or --supplemental <type> --expect N"
    )


# Converts one JSON object into the format expected by the
# knowledge_entry database table.
def prepare_row(
    row: dict[str, Any],
) -> dict[str, Any]:
    """Convert one JSON row into database-ready values."""

    return {
        "source_url": row["source_url"],
        "chunk_index": row["chunk_index"],
        "chunk_text": row["chunk_text"],
        "facts": row["facts"],
        "metadata": row["metadata"],
        "content_hash": row["content_hash"],
        "scraped_at": parse_datetime(row["scraped_at"]),
        "embedding": row["embedding"],
    }


# Inserts new rows into Neon.
#
# If a row already exists, PostgreSQL updates only the
# content-related fields whose content hash changed.
#
# This prevents duplicates while keeping the database current.
def upsert_batch(
    session: Session,
    batch: list[dict[str, Any]],
) -> None:
    """Insert or update one batch in knowledge_entry."""

    # This avoids conflicts with the reserved "metadata" name.
    table = KnowledgeEntry.__table__

    statement = insert(table).values(batch)

    excluded = statement.excluded

    # Compare hashes to determine whether content changed.
    content_changed = table.c.content_hash.is_distinct_from(excluded.content_hash)

    # Perform an UPSERT using the repository key:
    # (source_url, chunk_index)
    statement = statement.on_conflict_do_update(
        index_elements=[
            table.c.source_url,
            table.c.chunk_index,
        ],
        set_={
            "scraped_at": excluded.scraped_at,
            "chunk_text": case(
                (
                    content_changed,
                    excluded.chunk_text,
                ),
                else_=table.c.chunk_text,
            ),
            "facts": case(
                (
                    content_changed,
                    excluded.facts,
                ),
                else_=table.c.facts,
            ),
            # NOT gated on content_changed. content_hash covers chunk_text,
            # facts and compose-time metadata only -- it is computed before the
            # embedding exists and before enrich/embed add their stamps. Gating
            # these two on it discarded every re-embed while reporting success.
            "metadata": excluded.metadata,
            "embedding": excluded.embedding,
            "content_hash": case(
                (
                    content_changed,
                    excluded.content_hash,
                ),
                else_=table.c.content_hash,
            ),
            "updated_at": case(
                (
                    content_changed,
                    func.now(),
                ),
                else_=table.c.updated_at,
            ),
        },
    )

    session.execute(statement)


# Loads validated rows into Neon in configurable batches.
#
# Why batches are used:
#   • Prevents one enormous database transaction
#   • Reduces memory and connection pressure
#   • Makes progress visible in the terminal
#   • Allows a failed batch to roll back safely
FACTS_ONLY_REQUIRED_FIELDS = {
    "source_url",
    "chunk_index",
    "facts",
    "content_hash",
    "expected_content_hash",
}


def describe_target() -> str:
    """Host and database of the configured connection, never the password.

    Loading into the wrong Neon branch is a silent, one-keystroke mistake, and
    the operator has no other confirmation of where the write is going.
    """
    try:
        with SessionLocal() as session:
            url = session.get_bind().url
    except Exception:
        return "unknown target (could not read the connection URL)"
    host = url.host or "unknown-host"
    database = url.database or "unknown-db"
    return f"{host} / {database}"


def load_facts_only_rows(path: Path) -> list[dict[str, Any]]:
    """Read and validate a facts-only update delivery.

    The file carries no embedding and no chunk_text: the row already exists,
    its chunk_text is unchanged, and the stored vector was computed from that
    text, so re-sending 384 floats per row would add ~160 MB for data the
    database already holds.
    """
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    with path.open(encoding="utf-8") as handle:
        rows = json.load(handle)

    if not isinstance(rows, list) or not rows:
        raise ValueError("Expected a non-empty JSON array.")

    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            raise ValueError(f"Row {index} is not an object.")
        missing = FACTS_ONLY_REQUIRED_FIELDS - set(row)
        if missing:
            raise ValueError(
                f"Row {index} is missing required fields: {sorted(missing)}"
            )
        validate_identity(row, index)
        if not isinstance(row["expected_content_hash"], str) or not re.fullmatch(
            r"[a-f0-9]{64}", row["expected_content_hash"]
        ):
            raise ValueError(
                f"Row {index}: expected_content_hash must be a SHA-256 hex digest"
            )
        if "section_number" in row["facts"]:
            validate_section(row["facts"])

    keys = {(r["source_url"], r["chunk_index"]) for r in rows}
    if len(keys) != len(rows):
        raise ValueError("Duplicate (source_url, chunk_index) keys in the delivery.")

    print(f"Validated {len(rows):,} facts-only rows.", flush=True)
    return rows


def update_facts_only(
    rows: list[dict[str, Any]],
    batch_size: int,
) -> None:
    """Update `facts` on rows that already exist. Never inserts.

    Deliberately an UPDATE rather than the upsert: an INSERT ... ON CONFLICT
    still has to supply every NOT NULL column, including `embedding`, so it
    could not express "change only these facts". A missing or changed target
    rolls back the entire delivery, including earlier batches. Nothing is inserted.
    """
    if batch_size <= 0:
        raise ValueError("batch_size must be greater than zero")
    table = KnowledgeEntry.__table__

    statement = (
        table.update()
        .where(
            table.c.source_url == bindparam("b_source_url"),
            table.c.chunk_index == bindparam("b_chunk_index"),
            table.c.content_hash == bindparam("b_expected_content_hash"),
        )
        .values(
            facts=bindparam("b_facts"),
            content_hash=bindparam("b_content_hash"),
            updated_at=func.now(),
        )
    )

    total = len(rows)
    changed = 0

    print(
        f"\nUpdating facts on {total:,} rows in {describe_target()} ...",
        flush=True,
    )

    with SessionLocal() as session:
        try:
            for start in range(0, total, batch_size):
                window = rows[start : start + batch_size]
                result = session.execute(
                    statement,
                    [
                        {
                            "b_source_url": row["source_url"],
                            "b_chunk_index": row["chunk_index"],
                            "b_facts": row["facts"],
                            "b_content_hash": row["content_hash"],
                            "b_expected_content_hash": row["expected_content_hash"],
                        }
                        for row in window
                    ],
                )
                changed += result.rowcount or 0
                if result.rowcount != len(window):
                    raise ValueError(
                        "Facts-only update has missing or changed targets; "
                        "entire delivery rolled back"
                    )
                print(
                    f"  {min(start + batch_size, total):,} / {total:,}",
                    flush=True,
                )
            session.commit()
        except Exception:
            session.rollback()
            raise

    print(f"\nRows updated: {changed:,}", flush=True)


def load_into_neon(
    rows: list[dict[str, Any]],
    batch_size: int,
    limit: int | None = None,
) -> None:
    """Load validated rows into Neon in batches."""

    if batch_size <= 0:
        raise ValueError("batch_size must be greater than zero.")

    if limit is not None and limit <= 0:
        raise ValueError("limit must be greater than zero.")

    # If a limit was provided, load only that many rows.
    # This is useful for safe testing before a full import.
    selected_rows = rows[:limit] if limit is not None else rows

    total = len(selected_rows)

    print(
        f"\nPreparing to load {total:,} rows into {describe_target()} ...",
        flush=True,
    )

    with SessionLocal() as session:
        try:
            for start in range(
                0,
                total,
                batch_size,
            ):
                raw_batch = selected_rows[start : start + batch_size]

                batch = [prepare_row(row) for row in raw_batch]

                upsert_batch(
                    session=session,
                    batch=batch,
                )

                # Commit only after the current batch succeeds.
                session.commit()

                completed = min(
                    start + batch_size,
                    total,
                )

                print(
                    f"Loaded {completed:,}/{total:,} rows",
                    flush=True,
                )

        except Exception:
            # Roll back the active batch if anything fails.
            session.rollback()

            print(
                "\nLoad failed. The current batch was rolled back.",
                flush=True,
            )

            raise

    print(
        "\nDataset load completed successfully.",
        flush=True,
    )


# Handles terminal arguments and decides whether the script
# should only validate the dataset or also load it into Neon.
def main() -> None:
    """Run validation or load rows into Neon."""

    parser = argparse.ArgumentParser(
        description=(
            "Validate and load catalog, supplemental program, "
            "or CV rows into the Neon knowledge_entry table."
        )
    )

    parser.add_argument(
        "json_path",
        type=Path,
        help="Path to the JSON file.",
    )

    parser.add_argument(
        "--load",
        action="store_true",
        help=(
            "Write rows to Neon after validation. "
            "Without this option, the script only validates."
        ),
    )

    parser.add_argument(
        "--supplemental",
        dest="supplemental_doc_type",
        choices=sorted(SUPPLEMENTAL_DOC_TYPES),
        default=None,
        help=(
            "Accept a single-doc_type delivery (e.g. a term's worth of "
            "section rows, or a batch of program_map rows). Requires "
            "--expect."
        ),
    )

    parser.add_argument(
        "--supplemental-programs",
        action="store_true",
        help="Shorthand for --supplemental program_map.",
    )

    parser.add_argument(
        "--expect",
        type=int,
        default=None,
        help=(
            "Number of rows a supplemental delivery should contain, "
            "e.g. --expect 19. Stating it catches a truncated or "
            "double-written file."
        ),
    )

    parser.add_argument(
        "--counts",
        type=Path,
        help="Reviewed JSON object mapping each doc_type to its expected count",
    )

    parser.add_argument(
        "--facts-only",
        action="store_true",
        help=(
            "Update `facts` on rows that already exist. The file needs only "
            "source_url, chunk_index, facts and content_hash — no embeddings, "
            "so the delivery stays small and nothing is re-embedded."
        ),
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help=("Number of rows written in each database batch. Default: 100."),
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help=("Optional number of rows to load for a small database test."),
    )

    args = parser.parse_args()
    if args.supplemental_programs:
        if args.supplemental_doc_type not in (None, "program_map"):
            parser.error("--supplemental-programs conflicts with --supplemental")
        args.supplemental_doc_type = "program_map"
    if args.counts and (args.supplemental_doc_type or args.facts_only):
        parser.error("--counts cannot be combined with --supplemental or --facts-only")

    if args.supplemental_doc_type is not None and args.limit is not None:
        parser.error("--limit cannot be used with --supplemental.")

    if args.supplemental_doc_type is not None and args.expect is None:
        parser.error(
            "--supplemental requires --expect N "
            "(the number of rows the file should contain)."
        )

    if args.expect is not None and args.supplemental_doc_type is None:
        parser.error("--expect only applies to --supplemental.")

    if args.facts_only:
        if args.limit is not None or args.supplemental_doc_type is not None:
            parser.error(
                "--facts-only cannot be combined with --limit or --supplemental."
            )
        facts_rows = load_facts_only_rows(args.json_path)
        if not args.load:
            print(
                f"\nTarget: {describe_target()}"
                f"\nValidation only. Re-run with --load to update "
                f"{len(facts_rows):,} rows.",
                flush=True,
            )
            return
        update_facts_only(rows=facts_rows, batch_size=args.batch_size)
        return

    rows = load_rows(
        args.json_path,
        supplemental_doc_type=args.supplemental_doc_type,
        expected_supplemental_rows=args.expect,
        expected_counts=json.loads(args.counts.read_text(encoding="utf-8"))
        if args.counts
        else None,
    )

    if not args.load:
        print(
            f"\nTarget: {describe_target()}\nValidation only. Neon was not modified.",
            flush=True,
        )
        return

    load_into_neon(
        rows=rows,
        batch_size=args.batch_size,
        limit=args.limit,
    )


# Runs main() only when this file is executed directly.
if __name__ == "__main__":
    main()
