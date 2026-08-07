"""Compose stage for cv envelopes: fill computed + teaching_record, build the
row's chunk_text, and verify — the bridge from extract_batch envelopes to
knowledge_entry rows.

chunk_text is built mechanically, never by the model:
  summary (duration tokens substituted)            <- derived tier, verified
  + " Per published Dallas College class schedules ...: currently teaches
     COSC 1436 (Programming Fundamentals I); ..."   <- composed tier, mechanical;
     course codes always carry their printed class titles
Empty-shell CVs are marked delivery.status = quarantine_rescrape and are NOT
loaded: at least one shell page proved to be a scrape gap (the instructor's
live profile has content) — shells wait for a re-scrape review.

    python -m dallasai.pipeline.compose_cv --facts out/facts-cv/cv --out
    out/facts-cv-composed \
        --raw-root <raw> [--as-of 2026]
"""

from __future__ import annotations

import argparse
import copy
import json
import re
from pathlib import Path

from .compute_cv import (
    ORD_TERM,
    _norm_prof,
    compute,
    refresh_currency,
    teaching_records,
)
from .verify_cv import verify


def _course_label(c: dict) -> str:
    """'COSC 1436 (Programming Fundamentals I)' — codes alone are unreadable"""
    return f"{c['course_code']} ({c['title']})" if c.get("title") else c["course_code"]


def teaching_sentence(tr: dict | None) -> str:
    if not tr or not tr.get("courses"):
        return ""
    newest = max(
        (c["last_term"] for c in tr["courses"] if c.get("last_term")),
        key=ORD_TERM,
        default=None,
    )
    by_code = sorted(tr["courses"], key=lambda c: c["course_code"])
    current = [_course_label(c) for c in by_code if c.get("last_term") == newest]
    past = [_course_label(c) for c in by_code if c.get("last_term") != newest]
    m = re.search(r"\d{4}(?:SP|SU|FA)-\d{4}(?:SP|SU|FA)", tr.get("source", ""))
    span = m.group(0) if m else "schedule data"
    parts = []
    if tr.get("currently_teaching") and current:
        parts.append(f"currently teaches {', '.join(current)}")
        if past:
            parts.append(f"previously taught {', '.join(past)}")
    else:
        parts.append(f"taught {', '.join(_course_label(c) for c in by_code)}")
    return (
        f" Per published Dallas College class schedules ({span}): {'; '.join(parts)}."
    )


def is_empty_shell(facts: dict) -> bool:
    return (
        not (facts.get("education") or [])
        and not (facts.get("experience") or [])
        and not facts.get("publications")
        and not (facts.get("certifications") or [])
    )


def chunk_text_for(facts: dict) -> str:
    dp = facts.get("derived_profile")
    if dp and dp.get("summary"):
        base = dp["summary"]
    else:
        # never narrate absence — state only what is known
        base = f"{facts.get('name')} is listed as an instructor at Dallas College."
    return base + teaching_sentence(facts.get("teaching_record"))


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--facts", type=Path, required=True, help="extract_batch cv envelope dir"
    )
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--raw-root", type=Path, required=True)
    ap.add_argument(
        "--as-of",
        type=int,
        default=None,
        help="fallback scrape year when the envelope context has none",
    )
    args = ap.parse_args(argv)

    from .extract import html_to_text, pdf_to_text

    records = teaching_records(args.raw_root)
    args.out.mkdir(parents=True, exist_ok=True)
    n = flagged = shells = 0
    for p in sorted(args.facts.glob("*.json")):
        env = json.loads(p.read_text(encoding="utf-8"))
        ctx = env.get("context") or {}
        as_of = ctx.get("scrape_year") or args.as_of
        if not as_of:
            raise SystemExit(f"{p.name}: no scrape_year in context and no --as-of")
        facts = compute(copy.deepcopy(env["facts"]), as_of)
        prof = ctx.get("professor")
        facts["teaching_record"] = records.get(_norm_prof(prof)) if prof else None
        facts = refresh_currency(facts)

        src_path = args.raw_root / env["raw_path"].replace("\\", "/")
        if src_path.suffix.lower() == ".pdf":
            source_text = pdf_to_text(src_path)
        else:
            source_text = html_to_text(
                src_path.read_text(encoding="utf-8", errors="replace")
            )
        flags = verify(facts, source_text, as_of, records, prof)
        env["facts"] = facts
        env["chunk_text"] = chunk_text_for(facts)
        env["verify_flags"] = flags
        # empty-shell pages are QUARANTINED, not delivered: at least one shell
        # (Bassam Attili, 2026-07-26 pilot review) has real content on the live
        # profile page while our scraped course-CV page is empty — shells may be
        # scrape artifacts, so they wait for a re-scrape review instead of
        # shipping as content-less rows.
        if is_empty_shell(facts):
            env["delivery"] = {
                "status": "quarantine_rescrape",
                "reason": "empty-shell CV page — possible scrape "
                "gap; re-check the instructor's live "
                "profile page before loading",
            }
            shells += 1
        else:
            env["delivery"] = {"status": "load"}
        (args.out / p.name).write_text(
            json.dumps(env, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        n += 1
        if flags:
            flagged += 1
            print(f"{p.name}: {len(flags)} flag(s)")
            for f in flags:
                print(f"  - {f}")
    print(
        f"composed {n} envelopes -> {args.out} "
        f"({flagged} flagged, {shells} empty shells held for re-scrape review)"
    )


if __name__ == "__main__":
    main()
