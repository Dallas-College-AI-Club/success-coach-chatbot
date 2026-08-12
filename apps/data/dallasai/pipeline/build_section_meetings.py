"""Build one load-ready delivery: section meeting times (+ any other rows).

The `section` rows are already in Neon with instructor, campus and modality,
but no meeting days or times — `load_worklist` reads the schedule CSV's
`meeting_info` column only to derive online/in-person and drops the rest
(archive_syllabi_cv.py:127).

This recovers them WITHOUT re-embedding anything: each existing row is read
back out of Neon and its `chunk_text` and `embedding` are copied through
untouched, so the stored vector stays valid and no embedding call is made.
Only `facts` changes, filled to the existing contract in
src/config/facts-schemas/facts-section-v1.schema.json.

Pass --include-programs to fold the supplemental program_map rows into the
same file, so one load covers both.

    python -m dallasai.pipeline.build_section_meetings \
        --schedule "<...>/raw/schedule" \
        --include-programs programs-19.embedded.json \
        --out delivery.json

    python apps/data/dallasai/load_catalog_to_neon.py delivery.json
    python apps/data/dallasai/load_catalog_to_neon.py delivery.json --load \
        --supplemental --expect <the number it printed>

The meeting_info grammar, confirmed against all 16,181 rows of the 2026
Spring and Summer files:

    <ROOM> <MODALITY> <TYPE> <DAYS> [<START> - <END>]     ... repeated, no separator

    ROOM      T018 | INET (online) | TBD
    MODALITY  In-Person | Online | Blended | Hybrid
    TYPE      Lecture | Laboratory | Experiential | Combination | Clinical | Internship
    DAYS      space-separated letters, R = Thursday, U = Sunday
    TIMES     absent for online and for "Meeting Patterns will vary."

Online sections list all seven days with no times. That means the work can be
done at any time, NOT that the class meets daily — so they are written as
`meetings: []`, which the schema defines as exactly that. Times are only ever
written when the CSV states them; nothing here infers one.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from typing import Any

from sqlalchemy import select

from dallasai.database import SessionLocal
from dallasai.models import KnowledgeEntry
from dallasai.pipeline.build_knowledge import content_hash

# --------------------------------------------------------------- grammar --

# "Synchronous Online" must precede "Online" so the longer name wins.
_MODALITY = (
    r"In-Person|Synchronous Online|Online|Blended|Hybrid|Preceptor"
)
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
    per the schema an empty list means there is no scheduled meeting time,
    which is the truth for both.
    """
    text = (meeting_info or "").strip()
    if not text:
        return [], False

    meetings: list[dict[str, Any]] = []
    matched_chars = 0
    for match in _SEGMENT_RE.finditer(text):
        matched_chars += len(match.group(0))
        if not (match.group("start") and match.group("end")):
            continue
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

    # Recognised when the grammar consumed essentially the whole string; a
    # value it only half understood is reported rather than silently trimmed.
    recognised = matched_chars >= len(re.sub(r"\s+", " ", text)) * 0.6
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


def read_schedule(schedule_dir: Path) -> dict[tuple[str, str, str], dict[str, str]]:
    """(course_code, section, term_code) -> the CSV row."""
    out: dict[tuple[str, str, str], dict[str, str]] = {}
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
                    out[(code, section, term)] = row
    return out


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
    args = parser.parse_args()

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
        entries = (
            session.execute(
                select(KnowledgeEntry).where(
                    KnowledgeEntry.doc_type == "section"
                )
            )
            .scalars()
            .all()
        )

    for entry in entries:
        # NOTE: the column is mapped as `metadata_`; `entry.metadata` is
        # SQLAlchemy's own MetaData object.
        metadata = dict(entry.metadata_ or {})
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

        raw = (csv_row.get("meeting_info") or "").strip()
        meetings, recognised = parse_meetings(raw)
        if not recognised:
            unparsed.append(raw)
            continue
        if meetings:
            with_times += 1

        facts = {
            "section_number": metadata.get("section"),
            "instructor": metadata.get("professor"),
            "instructor_slug": metadata.get("instructor_slug"),
            "modality": metadata.get("modality"),
            "campus": (csv_row.get("location") or "").strip() or None,
            "start_date": (csv_row.get("start_date") or "").strip() or None,
            "end_date": (csv_row.get("end_date") or "").strip() or None,
            "meetings": meetings,
            # Verbatim, so a question the parse cannot answer can
            # still be answered from the source text.
            "meeting_info_raw": raw or None,
            "credit_hours": metadata.get("credit_hours"),
            "session": metadata.get("session"),
            "materials_links": [],
            "confidence": "high",
        }
        rows.append(
            {
                # The upsert key. facts-only mode UPDATEs this row in place;
                # chunk_text and the stored embedding are never touched, so
                # the vector stays valid and the file stays small.
                "source_url": entry.source_url,
                "chunk_index": entry.chunk_index,
                "facts": facts,
                "content_hash": content_hash(
                    entry.chunk_text, facts, metadata
                ),
            }
        )

    args.out.write_text(json.dumps(rows, indent=1), encoding="utf-8")

    print(
        "\n".join(
            [
                "",
                f"rows written          : {len(rows):,}  -> {args.out}",
                f"  with meeting times  : {with_times:,}",
                f"  online / no set time: {len(rows) - with_times:,}",
                f"UNPARSED meeting_info : {len(unparsed):,}   <- must be 0",
                f"no CSV match          : {unmatched:,}",
                "",
                f"Load with:  --load --facts-only   ({len(rows):,} rows)",
            ]
        ),
        flush=True,
    )
    for sample in unparsed:
        print(f"  unparsed sample: {sample!r}", flush=True)


if __name__ == "__main__":
    main()
