"""Prepare reviewed section-facts updates from saved schedule CSVs.

Reads Neon without changing it, matches explicit terms and section source URLs,
retains unparsed meeting text, and writes a local delivery. Missing targets or
conflicting source rows fail instead of silently shrinking the update.

    python -m dallasai.pipeline.build_section_meetings --schedule <raw/schedule> \
        --terms 2026FA --out review.json
    python -m dallasai.load_catalog_to_neon review.json --facts-only

A separate, approved --load applies the review. Empty meetings means no parsed
clock times; it never proves online or asynchronous attendance.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import and_, or_, select, text
from sqlalchemy.orm import load_only

from dallasai.database import SessionLocal
from dallasai.models import KnowledgeEntry
from dallasai.pipeline.build_knowledge import content_hash

# --------------------------------------------------------------- grammar --

# "Synchronous Online" must precede "Online" so the longer name wins.
_MODALITY = r"In-Person|Synchronous Online|Online|Blended|Hybrid|Preceptor"
_TYPE = r"Lecture|Laboratory|Experiential|Combination|Clinical|Internship"
_TIME = r"\d{1,2}:\d{2}\s*[AP]M"

# A day letter must not begin a word: without the trailing lookahead, "M"
# matches the M of "Meeting Patterns will vary" and the rest of the sentence
# is left unconsumed. The "vary" branch is tried first for the same reason.
# A lookahead rather than a word-boundary escape on purpose - that escape is
# easy to corrupt when this file is edited by a script, and a literal
# backspace byte here is invisible and matches nothing.
_DAY = r"[MTWRFSU](?![A-Za-z])"

_SEGMENT_RE = re.compile(
    rf"(?P<room>\S+)\s+(?P<modality>{_MODALITY})\s+(?P<type>{_TYPE})\s+"
    rf"(?:(?P<vary>Meeting Patterns will vary\.?)"
    rf"|(?P<days>{_DAY}(?:\s+{_DAY})*)"
    rf"(?:\s+(?P<start>{_TIME})\s*-\s*(?P<end>{_TIME}))?)"
)

# The schema's enum is lecture | lab | other.
_TYPE_MAP = {
    "Lecture": "lecture",
    "Laboratory": "lab",
    "Experiential": "other",
    "Combination": "other",
    "Clinical": "other",
    "Internship": "other",
}


# INET is the online "room"; TBD is a real room not yet assigned.
_NON_ROOMS = {"INET", "TBD", "TBA"}


def parse_meetings(meeting_info: str) -> tuple[list[dict[str, Any]], bool]:
    """Return (meetings, recognised).

    Only segments that state a start AND end time become meetings. Online and
    "patterns will vary" segments are recognised but contribute no meeting:
    an empty list means no clock times were parsed. It never establishes
    asynchronous delivery or that a student has no attendance obligations.
    """
    text = (meeting_info or "").strip()
    if not text:
        return [], False

    meetings: list[dict[str, Any]] = []
    for match in _SEGMENT_RE.finditer(text):
        if not (match.group("start") and match.group("end")):
            continue
        if any(
            not re.fullmatch(r"(?:0?[1-9]|1[0-2]):[0-5]\d\s*[AP]M", match.group(which))
            for which in ("start", "end")
        ):
            return [], False
        room = match.group("room")
        meetings.append(
            {
                "type": _TYPE_MAP[match.group("type")],
                "days": re.sub(r"\s+", " ", match.group("days")).strip(),
                "start_time": re.sub(r"\s+", " ", match.group("start")).strip(),
                "end_time": re.sub(r"\s+", " ", match.group("end")).strip(),
                "building": None if room in _NON_ROOMS else room,
                "room": None if room in _NON_ROOMS else room,
            }
        )

    # All meaningful text must be consumed: 60% coverage used to label a
    # partial lecture/lab parse complete and silently discard the remainder.
    recognised = not _SEGMENT_RE.sub("", text).strip(" \t\r\n,;|")
    return meetings, recognised


# ------------------------------------------------------------------- CSV --

_TERM_SUFFIX = {"spring": "SP", "summer": "SU", "fall": "FA"}


def _term_code(term_year: str) -> str | None:
    """'Spring 2026' -> '2026SP'."""
    raw = (term_year or "").strip()
    year = re.search(r"(20\d{2})", raw)
    if not year:
        return None
    for name, suffix in _TERM_SUFFIX.items():
        if name in raw.lower():
            return f"{year.group(1)}{suffix}"
    return None


def source_datetime(value: str) -> datetime:
    """Compare receipt instants, not ISO strings with potentially different offsets."""
    if not re.match(r"^\d{4}-\d{2}-\d{2}(?:T|\s|$)", value):
        raise ValueError("Missing or invalid schedule source date")
    date = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return date if date.tzinfo else date.replace(tzinfo=timezone.utc)


def read_schedule(schedule_dir: Path) -> dict[tuple[str, str, str], dict[str, str]]:
    """(course_code, section, term_code) -> the CSV row."""
    out: dict[tuple[str, str, str], dict[str, str]] = {}
    receipts: dict[str, datetime] = {}
    for path in sorted(schedule_dir.glob("dallas_classes_*.csv")):
        with path.open(newline="", encoding="utf-8-sig") as handle:
            for row in csv.DictReader(handle):
                code = (
                    f"{(row.get('class_prefix') or '').strip()} "
                    f"{(row.get('class_number') or '').strip()}"
                ).strip()
                section = (row.get("section_number") or "").strip()
                term = _term_code(row.get("term_year", ""))
                if code and section and term:
                    receipt = (row.get("date_accessed") or "").strip()
                    if receipt not in receipts:
                        receipts[receipt] = source_datetime(receipt)
                    key = (code, section, term)
                    previous = out.get(key)
                    if previous and previous != row:
                        previous_date = receipts[
                            (previous.get("date_accessed") or "").strip()
                        ]
                        if previous_date == receipts[receipt]:
                            raise ValueError(
                                f"Conflicting CSV rows for {key}; "
                                "source review required"
                            )
                        if previous_date > receipts[receipt]:
                            continue
                    out[key] = row
    return out


def facts_from_csv(row: dict, metadata: dict) -> tuple[dict, bool]:
    raw = (row.get("meeting_info") or "").strip()
    meetings, recognized = parse_meetings(raw)
    facts = {
        "section_number": metadata.get("section"),
        "instructor": metadata.get("professor"),
        "instructor_slug": metadata.get("instructor_slug"),
        "modality": None
        if metadata.get("modality") == "unknown"
        else metadata.get("modality"),
        "campus": (row.get("location") or "").strip() or None,
        "start_date": (row.get("start_date") or "").strip() or None,
        "end_date": (row.get("end_date") or "").strip() or None,
        "meetings": meetings if recognized else [],
        "meeting_info_raw": raw or None,
        "credit_hours": metadata.get("credit_hours"),
        "session": metadata.get("session"),
        "materials_links": [],
        "confidence": "high" if recognized else "medium",
    }
    return facts, recognized


# ------------------------------------------------------------------ main --


def term_code_of(metadata: dict[str, Any]) -> str:
    year = metadata.get("year")
    suffix = _TERM_SUFFIX.get(str(metadata.get("semester") or "").lower())
    return f"{year}{suffix}" if year and suffix else ""


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Add meeting days/times to existing section rows, reusing their "
            "stored embeddings (no embedding API calls)."
        )
    )
    parser.add_argument("--schedule", type=Path, required=True)
    parser.add_argument("--out", type=Path, default=Path("delivery.json"))
    parser.add_argument(
        "--terms", nargs="+", required=True, help="Explicit source terms, e.g. 2026FA"
    )
    args = parser.parse_args()
    if args.out.exists():
        parser.error("Choose a new output path; review artifacts are never overwritten")
    if any(not re.fullmatch(r"20\d{2}(SP|SU|FA)", term) for term in args.terms):
        parser.error("Terms must use YYYYSP, YYYYSU or YYYYFA")

    schedule = read_schedule(args.schedule)
    print(f"schedule rows read : {len(schedule):,}", flush=True)
    if not schedule:
        raise SystemExit(
            f"No dallas_classes_*.csv under {args.schedule}. If they live in "
            "OneDrive, mark them 'Always keep on this device' first — an "
            "online-only placeholder cannot be read."
        )

    rows: list[dict[str, Any]] = []
    unmatched = 0
    unparsed: list[str] = []
    with_times = 0

    with SessionLocal() as session:
        session.execute(text("SET TRANSACTION READ ONLY"))
        entries = (
            session.execute(
                select(KnowledgeEntry)
                .options(
                    load_only(
                        KnowledgeEntry.metadata_,
                        KnowledgeEntry.facts,
                        KnowledgeEntry.source_url,
                        KnowledgeEntry.chunk_index,
                        KnowledgeEntry.chunk_text,
                        KnowledgeEntry.content_hash,
                    )
                )
                .where(
                    KnowledgeEntry.doc_type == "section",
                    or_(
                        *(
                            and_(
                                KnowledgeEntry.year == int(term[:4]),
                                KnowledgeEntry.semester
                                == {"SP": "spring", "SU": "summer", "FA": "fall"}[
                                    term[4:]
                                ],
                            )
                            for term in args.terms
                        )
                    ),
                )
            )
            .scalars()
            .all()
        )

    for entry in entries:
        # NOTE: the column is mapped as `metadata_`; `entry.metadata` is
        # SQLAlchemy's own MetaData object.
        metadata = dict(entry.metadata_ or {})
        if term_code_of(metadata) not in args.terms:
            continue
        csv_row = schedule.get(
            (
                str(metadata.get("course_code") or ""),
                str(metadata.get("section") or ""),
                term_code_of(metadata),
            )
        )
        if csv_row is None:
            unmatched += 1
            continue
        if (csv_row.get("syllabus_url") or "").split("#")[0] != entry.source_url.split(
            "#"
        )[0]:
            raise ValueError("Section source URL mismatch; no delivery was written")

        facts, recognised = facts_from_csv(csv_row, metadata)
        if not recognised:
            unparsed.append(facts["meeting_info_raw"] or "")
        if facts["meetings"]:
            with_times += 1

        # CSVs do not describe textbooks/materials: retain existing source facts.
        facts.pop("materials_links", None)
        facts = {**(entry.facts or {}), **facts}
        rows.append(
            {
                # The upsert key. facts-only mode UPDATEs this row in place;
                # chunk_text and the stored embedding are never touched, so
                # the vector stays valid and the file stays small.
                "source_url": entry.source_url,
                "chunk_index": entry.chunk_index,
                "facts": facts,
                "content_hash": content_hash(entry.chunk_text, facts, metadata),
                "expected_content_hash": entry.content_hash,
            }
        )

    if unmatched or not rows:
        raise SystemExit(
            f"Incomplete source coverage: {unmatched} unmatched sections, "
            f"{len(rows)} prepared. No delivery written."
        )
    with args.out.open("x", encoding="utf-8") as output:
        json.dump(rows, output, indent=1)

    print(
        "\n".join(
            [
                "",
                f"rows written          : {len(rows):,}  -> {args.out}",
                f"  with meeting times  : {with_times:,}",
                f"  no parsed clock time: {len(rows) - with_times:,}",
                f"raw-only formats retained for review: {len(unparsed):,}",
                f"no CSV match          : {unmatched:,}",
                "",
                f"Load with:  --load --facts-only   ({len(rows):,} rows)",
            ]
        ),
        flush=True,
    )
    for sample, count in Counter(unparsed).most_common(20):
        print(f"  {count} sections with unparsed source: {sample!r}", flush=True)


if __name__ == "__main__":
    main()
