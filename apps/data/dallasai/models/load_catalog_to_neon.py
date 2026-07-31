import argparse
import json
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import case, func
from sqlalchemy.dialects.postgresql import insert

from dallasai.database import SessionLocal
from dallasai.models import KnowledgeEntry


EXPECTED_COUNTS = {
    "section": 16_181,
    "course": 1_588,
    "program_map": 318,
}


def load_rows(path: Path) -> list[dict[str, Any]]:
    """Read and validate the delivered catalog rows."""

    print("Start readingx")
    with path.open("r", encoding="utf-8") as file:
        rows: list[dict[str, Any]] = json.load(file)
        print ("Reading Json file")

    required_fields = {
        "source_url",
        "chunk_index",
        "chunk_text",
        "facts",
        "metadata",
        "content_hash",
        "scraped_at",
        "embedding",
    }

    counts: Counter[str] = Counter()

    for index, row in enumerate(rows):
        missing = required_fields - row.keys()

        if missing:
            raise ValueError(
                f"Row {index} is missing fields: {sorted(missing)}"
            )

        metadata = row.get("metadata") or {}
        doc_type = metadata.get("doc_type")

        if not doc_type:
            raise ValueError(f"Row {index} has no metadata.doc_type")

        counts[doc_type] += 1

        embedding = row.get("Embedding")

        if not isinstance(embedding, list) or len(embedding) != 768:
            raise ValueError(
                f"Row {index} has invalid embedding dimensions"
            )

    if len(rows) != 18_087:
        raise ValueError(
            f"Expected 18,087 rows, received {len(rows)}"
        )

    if dict(counts) != EXPECTED_COUNTS:
        raise ValueError(
            f"Unexpected doc_type counts: {dict(counts)}"
        )

    print("Validation passed")
    print(f"Total rows: {len(rows):,}")

    for doc_type, count in sorted(counts.items()):
        print(f"{doc_type}: {count:,}")

    return rows


def prepare_row(row: dict[str, Any]) -> dict[str, Any]:
    """Convert one JSON row to SQLAlchemy insert values."""

    scraped_at = row["scraped_at"]

    if isinstance(scraped_at, str):
        scraped_at = datetime.fromisoformat(
            scraped_at.replace("Z", "+00:00")
        )

    return {
        "source_url": row["source_url"],
        "chunk_index": row["chunk_index"],
        "chunk_text": row["chunk_text"],
        "facts": row["facts"],
        "metadata": row["metadata"],
        "content_hash": row["content_hash"],
        "scraped_at": scraped_at,
        "embedding": row["embedding"],
    }


def load_into_neon(
    rows: list[dict[str, Any]],
    batch_size: int,
) -> None:
    """Upsert the delivered rows into Neon PostgreSQL."""

    total = len(rows)

    with SessionLocal() as session:
        try:
            for start in range(0, total, batch_size):
                batch = [
                    prepare_row(row)
                    for row in rows[start : start + batch_size]
                ]

                statement = insert(KnowledgeEntry).values(batch)
                excluded = statement.excluded

                content_changed = (
                    KnowledgeEntry.content_hash.is_distinct_from(
                        excluded.content_hash
                    )
                )

                statement = statement.on_conflict_do_update(
                    index_elements=[
                        KnowledgeEntry.source_url,
                        KnowledgeEntry.chunk_index,
                    ],
                    set_={
                        "scraped_at": excluded.scraped_at,
                        "chunk_text": case(
                            (content_changed, excluded.chunk_text),
                            else_=KnowledgeEntry.chunk_text,
                        ),
                        "facts": case(
                            (content_changed, excluded.facts),
                            else_=KnowledgeEntry.facts,
                        ),
                        "metadata": case(
                            (content_changed, excluded["metadata"]),
                            else_=KnowledgeEntry.metadata_,
                        ),
                        "embedding": case(
                            (content_changed, excluded.embedding),
                            else_=KnowledgeEntry.embedding,
                        ),
                        "content_hash": case(
                            (content_changed, excluded.content_hash),
                            else_=KnowledgeEntry.content_hash,
                        ),
                        "updated_at": case(
                            (content_changed, func.now()),
                            else_=KnowledgeEntry.updated_at,
                        ),
                    },
                )

                session.execute(statement)
                session.commit()

                completed = min(start + batch_size, total)

                print(
                    f"Loaded {completed:,}/{total:,} rows"
                )

        except Exception:
            session.rollback()
            raise


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Validate and load catalog rows into Neon."
    )

    parser.add_argument(
        "json_path",
        type=Path,
        help="Path to rows.json",
    )

    parser.add_argument(
        "--load",
        action="store_true",
        help="Write rows to Neon after validation.",
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Rows per database batch.",
    )

    args = parser.parse_args()

    rows = load_rows(args.json_path)

    if not args.load:
        print("Validation only. Neon was not modified.")
        return

    load_into_neon(
        rows=rows,
        batch_size=args.batch_size,
    )

    print("Catalog load completed successfully.")


if __name__ == "__main__":
    main()