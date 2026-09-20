"""Reconcile an exported knowledge corpus with saved catalog sources.

Produces a review report and proposed rows locally. Never connects to or writes
a database. --snapshot is {docs: [...], schedules: [...]} with all course,
program_map and CV rows, plus per-course/term schedule counts. Source dates are
copied from archive manifests, never replaced by the time of this audit.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from bs4 import BeautifulSoup

from .build_knowledge import compose_course, content_hash
from .extract import validate
from .verify_catalog import check_course, fold


def catalog_course(html: str) -> tuple[dict, str]:
    """Extract only printed fields; keep conditional requisites verbatim."""
    soup = BeautifulSoup(html, "html.parser")
    heading = soup.find(id="course_preview_title")
    if heading is None:
        raise ValueError("No course heading: source may be a login or error page")
    title_line = fold(heading.get_text(" ", strip=True))
    title = re.fullmatch(
        r"([A-Z]{3,4} \d{4})\s*-\s*(.*?)\s*\((\d+) Credit Hours?\)", title_line
    )
    if not title:
        raise ValueError(
            "Heading needs review: non-course, variable credits or non-credit record"
        )
    container = heading.find_parent("td", class_="block_content")
    if container is None:
        raise ValueError("Course content container is missing")
    for node in container.select(
        ".gateway-toolbar, .table-responsive, .portfolio_link, script, style"
    ):
        node.decompose()
    text = fold(container.get_text(" ", strip=True))
    body = text.split(title_line, 1)[1].strip()
    campus = re.match(r"Campus Location:\s*((?:[A-Z]{3}(?:,\s*)?)+)\s*", body)
    if not campus:
        raise ValueError("Campus/description boundary needs review")
    body = body[campus.end() :]
    boundaries = (
        r"Prerequisites:|Corequisites(?:/Concurrent)?:|"
        r"Background Search Required:|Course Hour Configuration"
    )
    description = re.split(boundaries, body, maxsplit=1)[0].strip()
    if not description:
        raise ValueError("Description is empty")
    raw_match = re.search(
        r"(?:Prerequisites:|Corequisites(?:/Concurrent)?:).*?"
        r"(?=Background Search Required:|Course Hour Configuration|$)",
        body,
    )
    raw = raw_match.group(0).strip() if raw_match else None
    facts = {
        "course_code": title[1],
        "title": title[2],
        "credit_hours": int(title[3]),
        "description": description,
        "campus_locations": campus[1].strip().rstrip(","),
        "prerequisites": [],
        "corequisites": [],
        "requisites_raw": raw,
        "confidence": "high",
        "is_core": True if "Core Curriculum course" in text else None,
        "tccn": title[1] if "Texas Common Course Number" in text else None,
    }
    # Do not turn an AND, grade, placement or permission clause into an OR list.
    if raw:
        parts = re.split(r"(?=Prerequisites:|Corequisites(?:/Concurrent)?:)", raw)
        for part in filter(None, parts):
            kind = (
                "prerequisites" if part.startswith("Prerequisites:") else "corequisites"
            )
            facts[kind].append({"one_of": [], "raw_text": part.strip()})
    errors = validate("course", facts) or []
    errors += check_course(facts, text, text)
    if errors:
        raise ValueError("; ".join(str(e) for e in errors))
    return facts, text


def catalog_option(html: str) -> dict | None:
    soup = BeautifulSoup(html, "html.parser")
    heading = soup.find(id="course_preview_title")
    if heading is None or not re.match(
        r"[A-Z]{3,4} XXXX\b", fold(heading.get_text(" ", strip=True))
    ):
        return None
    title = fold(heading.get_text(" ", strip=True))
    container = heading.find_parent("td", class_="block_content")
    if container is None:
        raise ValueError("Option page has no content container")
    for node in container.select(
        ".gateway-toolbar, .table-responsive, .portfolio_link, script, style"
    ):
        node.decompose()
    text = fold(container.get_text(" ", strip=True))
    return {
        "title": title,
        "record_kind": "course_options",
        "raw_text": text,
        "course_options": sorted(set(re.findall(r"\b[A-Z]{3,4} \d{4}\b", text))),
    }


def reconcile(
    raw_root: Path, snapshot: dict, catalog_year: str
) -> tuple[dict, list, list]:
    docs = snapshot["docs"]
    courses = [
        r
        for r in docs
        if r["doc_type"] == "course"
        and r["metadata"].get("catalog_year") == catalog_year
    ]
    if not courses:
        raise ValueError("Snapshot contains no courses for the selected catalog")
    manifests = {}
    for path in sorted((raw_root / "manifests").glob("archive_catalog_*.jsonl")):
        for line in path.read_text(encoding="utf-8").splitlines():
            entry = json.loads(line)
            rel = (entry.get("raw_path") or "").replace("\\", "/")
            if rel and (entry.get("fetched_at") or "") >= (
                manifests.get(rel, {}).get("fetched_at") or ""
            ):
                manifests[rel] = entry
    indexed = {
        parse_qs(urlsplit(r["source_url"]).query).get("coid", [""])[0]: r
        for r in docs
        if r.get("metadata", {}).get("catalog_year") == catalog_year
        and r.get("doc_type") in ("course", "catalog")
    }
    files = sorted((raw_root / "catalog" / catalog_year / "courses").glob("*.html"))
    if not files:
        raise ValueError("No archived course pages")
    missing, proposed, quarantine, reclassify, missing_options = [], [], [], [], []
    for path in files:
        if path.stem in indexed:
            continue
        rel = path.relative_to(raw_root).as_posix()
        manifest = manifests.get(rel, {})
        item = {
            "raw_path": rel,
            "source_url": manifest.get("source_url"),
            "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "source_fetched_at": manifest.get("fetched_at"),
        }
        try:
            html = path.read_text(encoding="utf-8")
            options = catalog_option(html)
            if not item["source_url"] or not item["source_fetched_at"]:
                raise ValueError("Missing source provenance in archive manifest")
            if options:
                meta = {
                    "doc_type": "catalog",
                    "record_kind": "course_options",
                    "catalog_year": catalog_year,
                    "module": "degree_planning",
                    "extraction_method": "deterministic",
                    "source_sha256": item["source_sha256"],
                }
                row = {
                    "source_url": item["source_url"] + f"#{catalog_year}#facts",
                    "chunk_index": 0,
                    "chunk_text": options["raw_text"],
                    "facts": options,
                    "metadata": meta,
                    "scraped_at": item["source_fetched_at"],
                    "content_hash": content_hash(options["raw_text"], options, meta),
                }
                missing_options.append(row)
                item.update(
                    {
                        "title": options["title"],
                        "status": "option_page_prepared_for_review",
                    }
                )
                missing.append(item)
                continue
            facts, _ = catalog_course(html)
            row = compose_course(facts, item["source_url"], catalog_year)
            row["metadata"].update(
                {
                    "extraction_method": "deterministic",
                    "source_sha256": item["source_sha256"],
                }
            )
            row["content_hash"] = content_hash(
                row["chunk_text"], row["facts"], row["metadata"]
            )
            row["scraped_at"] = item["source_fetched_at"]
            proposed.append(row)
            item.update(
                {
                    "course_code": facts["course_code"],
                    "title": facts["title"],
                    "status": "prepared_for_review",
                }
            )
        except ValueError as error:
            item.update({"status": "needs_source_review", "reason": str(error)})
            quarantine.append(item)
        missing.append(item)
    for row in courses:
        if re.fullmatch(r"[A-Z]{3,4} XXXX", row.get("course_code") or ""):
            metadata = {
                **row["metadata"],
                "doc_type": "catalog",
                "record_kind": "course_options",
            }
            # Retain public evidence and identity; regenerate embeddings locally
            # instead of carrying the known inaccurate legacy model stamp.
            for key in list(metadata):
                if key.startswith("embedding_"):
                    del metadata[key]
            correction = {
                k: row[k]
                for k in (
                    "source_url",
                    "chunk_index",
                    "chunk_text",
                    "facts",
                    "scraped_at",
                )
            }
            correction["metadata"] = metadata
            correction["content_hash"] = content_hash(
                row["chunk_text"], row["facts"], metadata
            )
            reclassify.append(correction)
    available = {r["course_code"] for r in courses} | {
        r["facts"]["course_code"] for r in proposed
    }
    missing_schedule_courses = [
        r for r in snapshot.get("schedules", []) if r["course_code"] not in available
    ]
    report = {
        "catalog_year": catalog_year,
        "archived_course_pages": len(files),
        "indexed_course_rows": len(courses),
        "missing_count": len(missing),
        "prepared_course_count": len(proposed),
        "missing_option_count": len(missing_options),
        "quarantined_count": len(quarantine),
        "option_pages_to_reclassify": len(reclassify),
        "missing": missing,
        "quarantine": quarantine,
        "option_codes": [r["facts"].get("course_code") for r in reclassify],
        "schedule_courses_without_catalog": missing_schedule_courses,
        "source_dates": dict(
            Counter(r.get("source_fetched_at", "unknown") for r in missing)
        ),
        "database_changes_applied": False,
    }
    return report, proposed, reclassify + missing_options


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-root", type=Path, required=True)
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--catalog-year", default="2026-2027")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    report, courses, options = reconcile(
        args.raw_root,
        json.loads(args.snapshot.read_text(encoding="utf-8")),
        args.catalog_year,
    )
    args.out.mkdir(parents=True, exist_ok=True)
    for name, value in (
        ("report", report),
        ("missing-courses", courses),
        ("option-pages", options),
    ):
        with (args.out / f"{name}.json").open("x", encoding="utf-8") as output:
            json.dump(value, output, ensure_ascii=False, indent=2)
    print(
        json.dumps(
            {
                k: v
                for k, v in report.items()
                if k.endswith("count")
                or k in ("option_pages_to_reclassify", "database_changes_applied")
            }
        )
    )


if __name__ == "__main__":
    main()
