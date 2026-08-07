"""Assemble the CV delivery: composed cv envelopes -> knowledge_entry rows.

Same live-table row contract as the catalog delivery (source_url, chunk_index,
chunk_text, facts, metadata with schema_version/extractor stamps, scraped_at,
content_hash); embedding runs separately (pipeline.embed_rows). What loads and
what doesn't is decided HERE, from the compose stage's verdicts:

  loads     delivery.status == "load" and no identity-mismatch flag
  held      empty shells (delivery.status == "quarantine_rescrape") -> audit list
  excluded  identity-mismatch (source anomaly: page serves another person's CV)

`professor` in metadata is the MANIFEST spelling (the join key section rows
use); the CV's own display name lives in metadata.display_name and facts.name.

    python -m dallasai.pipeline.assemble_cv_delivery --composed out/facts-cv-composed \
        --out out/delivery-cv [--fail-on-acceptance]
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

from .build_knowledge import _row, slug


def shell_dispositions(report_path: Path | None) -> dict[str, dict]:
    """shell raw_path -> what the live-profile backfill found for it, so the
    held list says WHY each shell is held instead of one flat bucket."""
    if not report_path or not report_path.exists():
        return {}
    rep = json.loads(report_path.read_text(encoding="utf-8"))
    out: dict[str, dict] = {}
    for pr in rep.get("profiles", []):
        key = (pr.get("shell_raw_path") or "").replace("\\", "/")
        has_content = (pr.get("body_chars") or 0) > 0
        out[key] = {
            "disposition": (
                "recovered_from_live_profile"
                if has_content
                else "confirmed_empty_live_profile_is_name_only"
            ),
            "profile_url": pr.get("source_url"),
            "name_match": pr.get("name_match"),
        }
    for un in rep.get("unresolved", []):
        prof = un.get("professor")
        out.setdefault(
            f"unresolved::{prof}",
            {
                "disposition": "unresolved_no_matching_user",
                "professor": prof,
                "name_match": None,
            },
        )
    return out


def assemble(composed_dir: Path, dispositions: dict[str, dict] | None = None):
    dispositions = dispositions or {}
    rows, held, excluded, flagged = [], [], [], []
    for p in sorted(composed_dir.glob("*.json")):
        env = json.loads(p.read_text(encoding="utf-8"))
        facts = env["facts"]
        prof = (env.get("context") or {}).get("professor") or ""
        vflags = env.get("verify_flags") or []
        entry = {
            "doc_id": p.stem,
            "professor": prof,
            "name": facts.get("name"),
            "source_url": env.get("source_url"),
            "raw_path": env.get("raw_path"),
            "verify_flags": vflags,
            "adjudication": env.get("adjudication"),
        }
        if any("identity-mismatch" in f for f in vflags):
            excluded.append(entry)
            continue
        if (env.get("delivery") or {}).get("status") == "quarantine_rescrape":
            rel = (env.get("raw_path") or "").replace("\\", "/")
            d = dispositions.get(rel) or dispositions.get(f"unresolved::{prof}")
            entry.update(d or {"disposition": "not_yet_rechecked"})
            held.append(entry)
            continue
        if vflags:
            flagged.append(entry)  # loads, but the audit lists it
        meta = {
            "doc_type": "cv",
            "module": "degree_planning",
            "professor": prof,
            "instructor_slug": slug(prof),
            "display_name": facts.get("name"),
            "schema_version": "2",
            "extractor": env.get("extractor"),
            "extraction_method": env.get("extraction_method"),
            "prompt_version": env.get("prompt_version"),
        }
        row = _row(env["source_url"], 0, env["chunk_text"], facts, meta)
        row["scraped_at"] = env.get("fetched_at")
        rows.append(row)

    rows, superseded = _one_row_per_professor(rows)
    return rows, held, excluded, flagged, superseded


def _one_row_per_professor(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    """A thin course-CV page can carry just enough content to load while the
    same professor's live profile page carries more. Both are honest, but the
    chatbot must see ONE row per person: keep the richer chunk_text (ties go to
    the live profile, the canonical instructor page) and record the other."""
    by_slug: dict[str, list[dict]] = {}
    for r in rows:
        by_slug.setdefault(r["metadata"]["instructor_slug"], []).append(r)

    keep, superseded = [], []
    for prof_slug, group in by_slug.items():
        if len(group) == 1:
            keep.append(group[0])
            continue
        group.sort(
            key=lambda r: (
                len(r["chunk_text"]),
                "view_profile" in (r["source_url"] or ""),
            ),
            reverse=True,
        )
        winner, losers = group[0], group[1:]
        keep.append(winner)
        for loser in losers:
            superseded.append(
                {
                    "instructor_slug": prof_slug,
                    "professor": loser["metadata"].get("professor"),
                    "dropped_source_url": loser["source_url"],
                    "dropped_chunk_chars": len(loser["chunk_text"]),
                    "kept_source_url": winner["source_url"],
                    "kept_chunk_chars": len(winner["chunk_text"]),
                    "reason": "one row per professor — kept the richer page",
                }
            )
    keep.sort(key=lambda r: r["metadata"]["instructor_slug"])
    return keep, superseded


def acceptance(rows: list[dict]) -> list[str]:
    problems = []
    slugs = Counter(r["metadata"]["instructor_slug"] for r in rows)
    dupes = [s for s, n in slugs.items() if n > 1]
    if dupes:
        problems.append(
            f"{len(dupes)} professor(s) with more than one row: {dupes[:3]}"
        )
    keys = Counter((r["source_url"], r["chunk_index"]) for r in rows)
    dups = [k for k, n in keys.items() if n > 1]
    if dups:
        problems.append(
            f"duplicate (source_url, chunk_index): {dups[:3]} "
            f"(+{len(dups) - 3 if len(dups) > 3 else 0})"
        )
    for r in rows:
        if not (r["chunk_text"] or "").strip():
            problems.append(f"empty chunk_text: {r['metadata'].get('professor')}")
        if not r.get("scraped_at"):
            problems.append(f"missing scraped_at: {r['metadata'].get('professor')}")
    david = [
        r for r in rows if r["metadata"].get("instructor_slug") == "david-bracewell"
    ]
    if not david:
        problems.append("acceptance probe: David Bracewell row missing")
    else:
        t = david[0]["chunk_text"]
        for probe in ("18 years", "COSC 1437 (Programming Fundamentals II)"):
            if probe not in t:
                problems.append(
                    f"acceptance probe: {probe!r} not in Bracewell chunk_text"
                )
    return problems


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--composed", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument(
        "--backfill-report",
        type=Path,
        help="live-profile backfill report; annotates each held shell "
        "with what the re-scrape found",
    )
    ap.add_argument("--fail-on-acceptance", action="store_true")
    args = ap.parse_args(argv)

    rows, held, excluded, flagged, superseded = assemble(
        args.composed, shell_dispositions(args.backfill_report)
    )
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "rows-cv.json").write_text(
        json.dumps(rows, indent=1, ensure_ascii=False), encoding="utf-8"
    )
    audit = args.out / "audit-trail"
    audit.mkdir(exist_ok=True)
    (audit / "held-for-rescrape.json").write_text(
        json.dumps(held, indent=1, ensure_ascii=False), encoding="utf-8"
    )
    (audit / "excluded-source-anomalies.json").write_text(
        json.dumps(excluded, indent=1, ensure_ascii=False), encoding="utf-8"
    )
    (audit / "loaded-with-adjudicated-flags.json").write_text(
        json.dumps(flagged, indent=1, ensure_ascii=False), encoding="utf-8"
    )
    (audit / "superseded-duplicate-pages.json").write_text(
        json.dumps(superseded, indent=1, ensure_ascii=False), encoding="utf-8"
    )

    problems = acceptance(rows)
    print(
        f"rows: {len(rows)} load | {len(held)} held | "
        f"{len(excluded)} excluded (source anomalies) | "
        f"{len(superseded)} superseded duplicate pages | "
        f"{len(flagged)} loaded with adjudicated flags"
    )
    disp = Counter(h.get("disposition", "not_yet_rechecked") for h in held)
    for k, v in disp.most_common():
        print(f"   held: {v:>4}  {k}")
    if problems:
        print("ACCEPTANCE PROBLEMS:")
        for x in problems:
            print("  -", x)
        if args.fail_on_acceptance:
            sys.exit(1)
    else:
        print("acceptance checks: all green")


if __name__ == "__main__":
    main()
