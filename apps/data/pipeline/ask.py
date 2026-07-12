"""Retrieval over knowledge_entry (SQLite demo sink). Given a student question,
pull the rows a tool layer would fetch: structured point-reads on the promoted
filter columns (doc_type, course_code, …) plus an FTS fallback on chunk_text.

This is the read side the chatbot's tools sit on. The LLM only ever sees the
rows returned here — list queries drop the heavy embedded `syllabus` block;
detail queries keep it.

    python -m pipeline.ask --db demo/knowledge.db --q "prerequisites for ENGL 1302?"
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
from pathlib import Path

COURSE_RE = re.compile(r"\b([A-Z]{2,4})\s?-?\s?(\d{4})\b")


def _rows(cur) -> list[dict]:
    cols = [d[0] for d in cur.description]
    out = []
    for r in cur.fetchall():
        d = dict(zip(cols, r))
        for k in ("facts", "metadata"):
            if d.get(k):
                d[k] = json.loads(d[k])
        out.append(d)
    return out


def retrieve(con: sqlite3.Connection, question: str, list_mode: bool = False) -> list[dict]:
    q = question.strip()
    codes = [f"{p} {n}" for p, n in COURSE_RE.findall(q.upper())]
    ql = q.lower()
    hits: list[dict] = []

    def sql(where, params, limit=8):
        return _rows(con.execute(
            f"SELECT doc_type, course_code, program_code, professor, section, "
            f"source_url, chunk_text, facts FROM knowledge_entry WHERE {where} LIMIT {limit}",
            params))

    # program / requirements / first-semester / degree / electives / exclusions
    if any(w in ql for w in ("associate", "degree", "a.s", "program", "first semester",
                             "what do i need", "requirement", "plan", "elective",
                             "use both", "count toward")):
        hits += sql("doc_type='program_map'", [], 3)

    # course-level: prereqs, transfer, description, credits
    if codes and any(w in ql for w in ("prereq", "transfer", "credit", "about", "cover",
                                       "description", "unt", "count")):
        for c in codes:
            hits += sql("doc_type='course' AND course_code=?", [c], 2)

    # sections: modality / schedule / campus / when / online / evening
    if codes and any(w in ql for w in ("online", "section", "evening", "weekend", "campus",
                                       "when", "where", "meet", "hybrid", "time", "start")):
        for c in codes:
            cols = ("doc_type, course_code, section, professor, source_url, "
                    "json_remove(facts,'$.syllabus') AS facts" if list_mode
                    else "doc_type, course_code, section, professor, source_url, facts")
            hits += _rows(con.execute(
                f"SELECT {cols}, chunk_text FROM knowledge_entry "
                f"WHERE doc_type='section' AND course_code=? LIMIT 12", [c]))

    # syllabus content: grading / workload / policy / exam / textbook / office hours
    if codes and any(w in ql for w in ("grad", "workload", "policy", "exam", "test", "attendance",
                                       "late", "makeup", "textbook", "office", "final", "project")):
        for c in codes:
            hits += _rows(con.execute(
                "SELECT doc_type, course_code, section, professor, source_url, facts, chunk_text "
                "FROM knowledge_entry WHERE doc_type='section' AND course_code=? "
                "AND json_extract(facts,'$.syllabus') IS NOT NULL LIMIT 4", [c]))

    # instructor background
    if any(w in ql for w in ("professor", "instructor", "teaches", "background", "who ")):
        m = re.search(r"(?:professor|instructor|dr\.?|prof\.?)\s+([a-z]+)", ql)
        if m:
            hits += sql("doc_type='cv' AND lower(professor) LIKE ?", [f"%{m.group(1)}%"], 3)

    if not hits:  # semantic fallback
        terms = re.sub(r"[^a-z0-9 ]", " ", ql)
        try:
            hits += _rows(con.execute(
                "SELECT ke.doc_type, ke.course_code, ke.professor, ke.source_url, ke.chunk_text, ke.facts "
                "FROM ke_fts f JOIN knowledge_entry ke ON ke.id=f.rowid "
                "WHERE ke_fts MATCH ? ORDER BY rank LIMIT 6", [terms]))
        except sqlite3.OperationalError:
            pass
    # de-dup by source_url
    seen, uniq = set(), []
    for h in hits:
        if h["source_url"] not in seen:
            seen.add(h["source_url"])
            uniq.append(h)
    return uniq


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--db", type=Path, required=True)
    ap.add_argument("--q", required=True)
    ap.add_argument("--list-mode", action="store_true")
    args = ap.parse_args()
    con = sqlite3.connect(args.db)
    rows = retrieve(con, args.q, args.list_mode)
    print(f"Q: {args.q}\nretrieved {len(rows)} rows:")
    for r in rows:
        f = r.get("facts")
        note = ""
        if isinstance(f, dict):
            if "syllabus" in f and f.get("syllabus"):
                note = " [+embedded syllabus]"
            elif f.get("syllabus_ref"):
                note = " [syllabus_ref → sibling]"
        print(f"  [{r['doc_type']}] {r.get('course_code') or r.get('program_code') or r.get('professor','')}"
              f" {('§'+str(r['section'])) if r.get('section') else ''}{note}")
