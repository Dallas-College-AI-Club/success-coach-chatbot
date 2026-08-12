"""Compose extracted facts + schedule CSV + catalog into knowledge_entry rows,
then load them.

This is the LOAD stage. It performs the section<->syllabus MERGE: a section row
(deterministic, from the CSV) carries its offering's syllabus facts inline
(`facts.syllabus`) on the representative section, while sibling sections point to
it (`facts.syllabus_ref`). Catalog courses/programs and CVs become their own
rows. Long documents also emit prose chunks (facts=NULL) for semantic search.

Sinks:
  * SQLite (default, no server) — for the demo and local dev. Filter columns are
    materialized in Python, mirroring the Postgres generated columns.
  * Postgres/pgvector via §5D upsert — the production target (DATABASE_URL); the
    row shape is identical, so switching sinks changes nothing upstream.

CLI (demo):
    python -m pipeline.build_knowledge --facts demo/facts --schedule <csv> \
        --catalog raw/catalog/2026-2027 --sqlite demo/knowledge.db
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

# ---- shared helpers (kept in sync with the archiver's _slug) ----------------

def slug(name: str) -> str:
    if "," in name:
        last, _, first = name.partition(",")
        name = f"{first.strip()} {last.strip()}"
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-zA-Z0-9]+", "-", name).strip("-").lower() or "unknown"


def norm_course_code(code: str) -> str:
    code = re.sub(r"([A-Za-z])([0-9])", r"\1 \2", code or "")
    return re.sub(r"[^A-Za-z0-9]+", " ", code).upper().strip()


def _canonical(chunk_text: str, facts: Any, metadata: dict) -> str:
    return json.dumps({"t": chunk_text, "f": facts, "m": metadata},
                      sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def content_hash(chunk_text: str, facts: Any, metadata: dict) -> str:
    return hashlib.sha256(_canonical(chunk_text, facts, metadata).encode()).hexdigest()


# ---- knowledge_entry row factory --------------------------------------------

def _row(source_url: str, chunk_index: int, chunk_text: str,
         facts: Optional[dict], metadata: dict) -> dict:
    metadata = {k: v for k, v in metadata.items() if v is not None}
    return {"source_url": source_url, "chunk_index": chunk_index,
            "chunk_text": chunk_text, "facts": facts, "metadata": metadata,
            "content_hash": content_hash(chunk_text, facts, metadata)}


def _section_metadata(sec: dict) -> dict:
    cc = norm_course_code(sec.get("course_code", ""))
    subj = cc.split(" ")[0] if cc else None
    return {"doc_type": "section", "module": "degree_planning",
            "course_code": cc, "subject": subj,
            "year": sec.get("year"), "semester": sec.get("semester"),
            "campus": sec.get("campus"), "modality": sec.get("modality"),
            "professor": sec.get("professor"),
            "instructor_slug": slug(sec["professor"]) if sec.get("professor") else None,
            "section": sec.get("section"), "session": sec.get("session"),
            "credit_hours": sec.get("credit_hours")}


def compose_sections(sections: list[dict],
                     syllabus_by_key: dict[tuple, dict]) -> list[dict]:
    """One knowledge_entry row per section, with the offering's syllabus merged
    onto the representative and siblings pointing to it via syllabus_ref.

    `syllabus_by_key` maps (professor_slug, course_code, modality) -> {facts, source_url}."""
    rows: list[dict] = []
    # choose one representative section per (prof, course, modality) that has a syllabus
    rep_source: dict[tuple, str] = {}
    for s in sections:
        key = (slug(s.get("professor", "")), norm_course_code(s.get("course_code", "")),
               s.get("modality"))
        if key in syllabus_by_key and key not in rep_source:
            rep_source[key] = s["source_url"]
    for s in sections:
        key = (slug(s.get("professor", "")), norm_course_code(s.get("course_code", "")),
               s.get("modality"))
        facts = dict(s.get("facts", {}))
        syl = syllabus_by_key.get(key)
        if syl and rep_source.get(key) == s["source_url"]:
            facts["syllabus"] = syl["facts"]
            facts["syllabus_source_url"] = syl["source_url"]
        elif syl:
            facts["syllabus_ref"] = rep_source[key]
        rows.append(_row(s["source_url"], 0, s["chunk_text"], facts, _section_metadata(s)))
    return rows


def compose_course(cf: dict, source_url: str, catalog_year: str) -> dict:
    cc = norm_course_code(cf.get("course_code", ""))
    meta = {"doc_type": "course", "module": "degree_planning", "course_code": cc,
            "subject": cc.split(" ")[0] if cc else None, "catalog_year": catalog_year}
    text = (f"{cc} — {cf.get('title') or ''} ({cf.get('credit_hours') or '?'} cr). "
            f"{cf.get('description','') or ''} "
            f"Prerequisites: {cf.get('requisites_raw') or 'none stated'}. "
            + ("Texas Common Course Number (generally transfers to Texas public universities - verify with the receiving school). "
               if cf.get("tccn") else ""))
    return _row(f"{source_url}#{catalog_year}#facts", 0, text.strip(), cf, meta)


def compose_program(pf: dict, source_url: str, catalog_year: str) -> dict:
    meta = {"doc_type": "program_map", "module": "degree_planning",
            "program_code": (pf.get("program_code") or "").upper(),
            "catalog_year": catalog_year}
    groups = pf.get("groups", [])
    text = (f"{pf.get('name') or ''} ({pf.get('award_type') or 'award type not stated'}), "
            f"{pf.get('total_credits') or '?'} credit hours. Requirement groups: "
            + "; ".join(g.get("name", "") for g in groups))
    return _row(f"{source_url}#{catalog_year}#facts", 0, text.strip(), pf, meta)


def compose_cv(cf: dict, source_url: str) -> dict:
    meta = {"doc_type": "cv", "module": "degree_planning",
            "instructor_slug": slug(cf.get("name", "")), "professor": cf.get("name")}
    text = (f"{cf.get('name','')}"
            + (f", {cf['department']}" if cf.get("department") else "")
            + (f". Teaches: {', '.join(cf.get('courses_taught', []))}"
               if cf.get("courses_taught") else ""))
    return _row(source_url, 0, text.strip(), cf, meta)


# ---- SQLite sink (demo) ------------------------------------------------------

FILTER_COLS = ["doc_type", "module", "course_code", "subject", "year", "semester",
               "catalog_year", "program_code", "professor", "instructor_slug",
               "section", "session"]


def load_sqlite(rows: list[dict], db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(db_path)
    cols = ", ".join(f"{c} TEXT" for c in FILTER_COLS)
    con.execute(f"""CREATE TABLE IF NOT EXISTS knowledge_entry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_url TEXT NOT NULL, chunk_index INTEGER NOT NULL,
        content_hash TEXT NOT NULL, chunk_text TEXT NOT NULL,
        facts TEXT, metadata TEXT NOT NULL, {cols},
        scraped_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        UNIQUE(source_url, chunk_index))""")
    # FTS over chunk_text for the semantic-search stand-in
    con.execute("CREATE VIRTUAL TABLE IF NOT EXISTS ke_fts USING fts5("
                "chunk_text, content='knowledge_entry', content_rowid='id')")
    now = datetime.now(timezone.utc).isoformat()
    for r in rows:
        md = r["metadata"]
        vals = [md.get(c) for c in FILTER_COLS]
        cur = con.execute(
            f"""INSERT INTO knowledge_entry
                (source_url, chunk_index, content_hash, chunk_text, facts, metadata,
                 {', '.join(FILTER_COLS)}, scraped_at, updated_at)
                VALUES ({', '.join(['?'] * (6 + len(FILTER_COLS) + 2))})
                ON CONFLICT(source_url, chunk_index) DO UPDATE SET
                  chunk_text=excluded.chunk_text, facts=excluded.facts,
                  metadata=excluded.metadata, scraped_at=excluded.scraped_at""",
            [r["source_url"], r["chunk_index"], r["content_hash"], r["chunk_text"],
             json.dumps(r["facts"]) if r["facts"] is not None else None,
             json.dumps(r["metadata"]), *[str(v) if v is not None else None for v in vals],
             now, now])
        con.execute("INSERT INTO ke_fts(rowid, chunk_text) VALUES (?, ?)",
                    (cur.lastrowid, r["chunk_text"]))
    con.commit()
    n = con.execute("SELECT count(*) FROM knowledge_entry").fetchone()[0]
    by_type = con.execute("SELECT doc_type, count(*) FROM knowledge_entry "
                          "GROUP BY doc_type ORDER BY 2 DESC").fetchall()
    con.close()
    print(f"loaded {len(rows)} rows -> {db_path}  (total {n})")
    for dt, c in by_type:
        print(f"  {dt}: {c}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--rows", type=Path, required=True,
                    help="a JSON file: {sections, syllabus_by_key, courses, programs, cvs}")
    ap.add_argument("--sqlite", type=Path, required=True)
    args = ap.parse_args()
    data = json.loads(args.rows.read_text(encoding="utf-8"))
    syl_by_key = {tuple(k.split("|")): v for k, v in data.get("syllabus_by_key", {}).items()}
    rows: list[dict] = []
    rows += compose_sections(data.get("sections", []), syl_by_key)
    for c in data.get("courses", []):
        rows.append(compose_course(c["facts"], c["source_url"], c["catalog_year"]))
    for p in data.get("programs", []):
        rows.append(compose_program(p["facts"], p["source_url"], p["catalog_year"]))
    for c in data.get("cvs", []):
        rows.append(compose_cv(c["facts"], c["source_url"]))
    load_sqlite(rows, args.sqlite)
