"""Assemble the Neon delivery: schedules + extracted catalog facts -> final rows.

Produces rows.json in the exact live-table shape (scraped_at, metadata stamps
schema_version / extractor / acalog_* included), loads the SQLite reference DB,
and runs the acceptance checks from the handoff doc. Embedding runs separately
(pipeline.embed_rows) so this stage stays deterministic and re-runnable.

    python -m pipeline.assemble_delivery --raw-root <raw> --facts out/facts \
        --terms 2026SP 2026SU --out out/delivery [--fail-on-acceptance]

Sections carry course TITLES in chunk_text (retrieval finding 2026-07-24: a
title-less section row is semantically invisible). syllabus_by_key is empty on
purpose — syllabi merge in next week's delivery via the same compose path.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from .archive_syllabi_cv import load_worklist
from .build_knowledge import (compose_course, compose_program, compose_sections,
                              load_sqlite, norm_course_code)

ACALOG_ID = re.compile(r"[?&](coid|poid)=(\d+)")


def sections_from_csvs(raw_root: Path, terms: list[str]) -> list[dict]:
    """One section dict per schedule row of the requested terms, title included."""
    import csv
    out = []
    for csv_path in sorted((raw_root / "schedule").glob("dallas_classes_*.csv")):
        normalized = load_worklist(csv_path)
        # join titles/credits/location back on by (course_code, section)
        detail = {}
        with csv_path.open(newline="", encoding="utf-8-sig") as fh:
            for r in csv.DictReader(fh):
                cc = f"{r.get('class_prefix','').strip()} {r.get('class_number','').strip()}".strip()
                detail[(cc, r.get("section_number", "").strip())] = r
        for s in normalized:
            if s["term_code"] not in terms:
                continue
            d = detail.get((s["course_code"], s["section"]), {})
            title = (d.get("class_name") or "").strip()
            # honest scraped_at for sections: the CSV's date_accessed, when it
            # parses; otherwise omit and let the DB's server_default fill it
            # (issue #51 model: scraped_at NOT NULL DEFAULT now()).
            scraped = (d.get("date_accessed") or "").strip()
            if not re.match(r"\d{4}-\d{2}-\d{2}", scraped):
                scraped = None
            term = s["term_code"]
            sem = {"SP": "spring", "SU": "summer", "FA": "fall"}.get(term[4:6])
            credit = (d.get("credit_hours") or "").strip()
            out.append({
                "scraped_at": scraped,
                "course_code": s["course_code"], "professor": s["professor"],
                "modality": s["modality"], "section": s["section"],
                "year": int(term[:4]), "semester": sem,
                "session": s["session"] or None,
                "campus": (d.get("location") or "").strip() or None,
                "credit_hours": int(credit) if credit.isdigit() else None,
                "source_url": (d.get("syllabus_url") or
                               f"section:{term}:{norm_course_code(s['course_code'])}:{s['section']}"),
                "chunk_text": (f"{s['course_code']} — {title or 'course'} "
                               f"({credit or '?'} cr), section {s['section']}, {term}, "
                               f"{(s['modality'] or 'unknown').replace('_', ' ')}, "
                               f"Prof. {s['professor']}."
                               + (f" Location: {d.get('location').strip()}." if (d.get('location') or '').strip() else "")),
            })
    return out


def enrich(row: dict, env: dict, schema_version: str) -> dict:
    row["scraped_at"] = env.get("fetched_at")
    m = row["metadata"]
    m["schema_version"] = schema_version
    m["extractor"] = env.get("extractor")
    m["acalog_catoid"] = "5"
    for kind, num in ACALOG_ID.findall(env.get("source_url") or ""):
        m[f"acalog_{kind}"] = num
    return row


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--raw-root", type=Path, required=True)
    ap.add_argument("--facts", type=Path, required=True)
    ap.add_argument("--terms", nargs="+", default=["2026SP", "2026SU"])
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--fail-on-acceptance", action="store_true")
    args = ap.parse_args(argv)
    args.out.mkdir(parents=True, exist_ok=True)

    secs = sections_from_csvs(args.raw_root, args.terms)
    rows = compose_sections(secs, {})
    for sec, row in zip(secs, rows):        # 1:1, order-preserving
        if sec.get("scraped_at"):
            row["scraped_at"] = sec["scraped_at"]
    n_sec = len(rows)
    for p in sorted((args.facts / "course").glob("*.json")):
        env = json.loads(p.read_text(encoding="utf-8"))
        rows.append(enrich(compose_course(env["facts"], env["source_url"],
                                          env["context"].get("catalog_year", "2026-2027")),
                           env, "facts-course-v1"))
    n_course = len(rows) - n_sec
    for p in sorted((args.facts / "program_map").glob("*.json")):
        env = json.loads(p.read_text(encoding="utf-8"))
        rows.append(enrich(compose_program(env["facts"], env["source_url"],
                                           env["context"].get("catalog_year", "2026-2027")),
                           env, "facts-program-map-v1"))
    n_prog = len(rows) - n_sec - n_course
    print(f"composed: {n_sec} sections + {n_course} courses + {n_prog} programs = {len(rows)} rows")

    rows_path = args.out / "rows.json"
    rows_path.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    load_sqlite(rows, args.out / "knowledge.db")

    # acceptance (mirrors the handoff doc)
    import sqlite3
    con = sqlite3.connect(args.out / "knowledge.db")
    ok = True
    counts = dict(con.execute("SELECT doc_type, COUNT(*) FROM knowledge_entry GROUP BY doc_type"))
    exp = {"section": n_sec, "course": n_course, "program_map": n_prog}
    for k, v in exp.items():
        if counts.get(k) != v:
            ok = False; print(f"[ACCEPT FAIL] {k}: db={counts.get(k)} composed={v}")
    pre = con.execute("SELECT facts FROM knowledge_entry WHERE course_code='MATH 2414' AND doc_type='course'").fetchone()
    if not (pre and json.loads(pre[0])["prerequisites"][0]["one_of"] == ["MATH 2413"]):
        ok = False; print("[ACCEPT FAIL] MATH 2414 prerequisite check")
    core = con.execute("SELECT facts FROM knowledge_entry WHERE program_code='CORE-42'").fetchone()
    if not (core and len(json.loads(core[0])["groups"]) == 9):
        ok = False; print("[ACCEPT FAIL] CORE-42 nine-groups check")
    pcodes = {r[0] for r in con.execute("SELECT program_code FROM knowledge_entry WHERE doc_type='program_map'")}
    if not {"CORE-42", "AS_SCIENCE"} <= pcodes:
        ok = False; print("[ACCEPT FAIL] program codes missing CORE-42/AS_SCIENCE")
    print("ACCEPTANCE:", "ALL CHECKS PASS" if ok else "FAILURES ABOVE")
    if args.fail_on_acceptance and not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
