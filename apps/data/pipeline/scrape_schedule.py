"""Schedule-CSV scraper: one CSV row -> one raw_documents row (raw_payload).

The CSV is already structured, so rows land as raw_payload JSON — no lossy
text round-trip (DATA_DICTIONARY, raw_payload). source_url is the CSV location
plus a per-row fragment so (source_url, content_hash) change detection works
row-by-row: an unchanged row on re-scrape writes nothing.

CLI:
    python -m pipeline.scrape_schedule "raw data/dallas_classes_2022_Summer.csv"
    python -m pipeline.scrape_schedule <path.csv> --source-url https://.../export.csv
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path
from typing import Optional

from pipeline.load_extractions import term_code_from_label
from pipeline.rawdocs import store_raw_document


def scrape_csv(conn, csv_path: str, source_url: Optional[str] = None) -> tuple[int, int]:
    """Load every row of the schedule CSV into raw_documents.

    Returns (inserted, skipped_unchanged)."""
    path = Path(csv_path)
    base_url = source_url or path.resolve().as_uri()
    inserted = skipped = 0

    with path.open(newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            row = {k.strip(): (v.strip() if isinstance(v, str) else v)
                   for k, v in row.items()}
            term_code = None
            try:
                if row.get("term_year"):
                    term_code = term_code_from_label(row["term_year"])
            except ValueError:
                pass  # keep the row; term stays null rather than invented
            fragment = (f"#{row.get('class_prefix','')}-{row.get('class_number','')}"
                        f"-{row.get('section_number','')}")
            _, was_inserted = store_raw_document(
                conn,
                source_type="schedule_csv",
                source_url=base_url + fragment,
                term_code=term_code,
                raw_payload=row,
            )
            inserted += was_inserted
            skipped += not was_inserted
    conn.commit()
    return inserted, skipped


def main(argv: Optional[list[str]] = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("csv_path", help="path to the schedule CSV export")
    ap.add_argument("--source-url", default=None,
                    help="canonical URL of the export (defaults to the file URI)")
    args = ap.parse_args(argv)

    from db.client import get_connection  # the one-file adapter (ADR-008)

    with get_connection() as conn:
        inserted, skipped = scrape_csv(conn, args.csv_path, args.source_url)
    print(f"schedule CSV: {inserted} new raw rows, {skipped} unchanged")


if __name__ == "__main__":
    main()
