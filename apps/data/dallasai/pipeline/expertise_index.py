"""FACULTY_EXPERTISE_INDEX — the leadership-query view over cv-v2 facts.

Answers "who at Dallas College knows X?" without touching the chatbot: an
index composed from finished cv facts, grouped by topic, currency-graded
(current / recent / historical), every row carrying the professor's
source_url so any claim is one click from its origin. Pure composition —
nothing here is model output.

  python -m dallasai.pipeline.expertise_index --facts out/facts-cv --raw-root <raw> \
      --out out/FACULTY_EXPERTISE_INDEX

Emits <out>.json (machine) and <out>.md (leadership-readable).
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

from .compute_cv import _norm_prof

CURRENCY_ORDER = {"current": 0, "recent": 1, "historical": 2}


def cv_source_urls(raw_root: Path) -> dict[str, str]:
    """normalized professor name -> CV source_url, from the manifests."""
    urls: dict[str, str] = {}
    for mf in sorted((raw_root / "manifests").glob("archive_*.jsonl")):
        for line in mf.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            e = json.loads(line)
            if e.get("kind") == "cv" and e.get("professor") and e.get("source_url"):
                urls.setdefault(_norm_prof(e["professor"]), e["source_url"])
    return urls


def collect(entries: list[tuple[str, dict]], urls: dict[str, str]) -> dict:
    """entries: (manifest professor name, final facts) pairs."""
    topics = defaultdict(list)
    faculty = []
    for prof, facts in entries:
        dp = facts.get("derived_profile")
        comp = facts.get("computed") or {}
        tr = facts.get("teaching_record") or {}
        url = urls.get(_norm_prof(prof))
        faculty.append(
            {
                "professor": prof,
                "name": facts.get("name"),
                "orientation": (dp or {}).get("orientation"),
                "currently_teaching": tr.get("currently_teaching"),
                "years_teaching": comp.get("years_teaching"),
                "years_industry": comp.get("years_industry"),
                "source_url": url,
            }
        )
        for tp in (dp or {}).get("expertise_topics") or []:
            topics[tp["topic"]].append(
                {
                    "professor": prof,
                    "name": facts.get("name"),
                    "currency": tp.get("currency"),
                    "evidence_years": tp.get("evidence_years"),
                    "evidence": tp.get("evidence"),
                    "orientation": (dp or {}).get("orientation"),
                    "source_url": url,
                }
            )
    for rows in topics.values():
        rows.sort(key=lambda r: (CURRENCY_ORDER.get(r["currency"], 9), r["name"] or ""))
    return {
        "topics": dict(sorted(topics.items())),
        "faculty": sorted(faculty, key=lambda f: f["name"] or ""),
    }


def render_md(index: dict) -> str:
    lines = [
        "# Faculty expertise index",
        "",
        "Composed from extracted CV facts + published class-schedule data.",
        "`currency`:",
        "current = active evidence within 3 years (or actively teaching the",
        "subject this term) · recent = within 8 · historical = older. Every",
        "claim links to the professor's published CV — verify at the source.",
        "",
        "## By topic",
        "",
    ]
    for topic, rows in index["topics"].items():
        lines.append(f"### {topic}")
        for r in rows:
            years = r.get("evidence_years") or [None, None]
            span = (
                f"{years[0]}–{years[1]}"
                if years[0] and years[1] and years[0] != years[1]
                else str(years[0])
                if years[0]
                else "undated"
            )
            link = f" · [CV]({r['source_url']})" if r.get("source_url") else ""
            lines.append(
                f"- **{r['name']}** ({r['currency']}, {span}, {r['orientation']}){link}"
            )
        lines.append("")
    lines += [
        "## Faculty overview",
        "",
        "| Name | Orientation | Teaching now | Yrs teaching | Yrs industry | CV |",
        "|---|---|---|---|---|---|",
    ]
    for f in index["faculty"]:
        cv = f"[link]({f['source_url']})" if f.get("source_url") else "—"
        teach = {True: "yes", False: "no"}.get(f.get("currently_teaching"), "—")
        lines.append(
            f"| {f['name']} "
            f"| {f.get('orientation') or '— (CV publishes no content)'} "
            f"| {teach} | {f.get('years_teaching') or '—'} "
            f"| {f.get('years_industry') or '—'} | {cv} |"
        )
    return "\n".join(lines) + "\n"


def _final_facts_from_draft(md_path: Path) -> tuple[str, dict] | None:
    text = md_path.read_text(encoding="utf-8")
    prof, blocks = None, []
    for raw in re.findall(r"```json\n(.*?)\n```", text, re.S):
        try:
            b = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(b, dict) and set(b) == {"professor"}:
            prof = b["professor"]
        elif isinstance(b, dict) and "confidence" in b:
            blocks.append(b)
    finals = [b for b in blocks if b.get("computed") is not None]
    if not prof or not finals:
        return None
    return prof, finals[-1]


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--facts", type=Path, help="dir of final (composed) cv envelopes")
    ap.add_argument(
        "--rows",
        type=Path,
        help="delivered rows json — the source of truth for what "
        "shipped, so the index can never disagree with it",
    )
    ap.add_argument(
        "--composed",
        type=Path,
        help="dir of compose_cv output envelopes; only delivery.status == 'load' rows",
    )
    ap.add_argument(
        "--drafts", type=Path, help="dir of cv2 DRAFT-*.md exemplars (demo mode)"
    )
    ap.add_argument("--raw-root", type=Path, required=True)
    ap.add_argument(
        "--out", type=Path, required=True, help="output basename (writes .json and .md)"
    )
    args = ap.parse_args(argv)

    entries: list[tuple[str, dict]] = []
    if args.rows:
        for r in json.loads(args.rows.read_text(encoding="utf-8")):
            prof = (r.get("metadata") or {}).get("professor")
            if prof and r.get("facts"):
                entries.append((prof, r["facts"]))
    elif args.composed:
        for p in sorted(args.composed.glob("*.json")):
            env = json.loads(p.read_text(encoding="utf-8"))
            if (
                (env.get("delivery") or {}).get("status") == "load"
                and (env.get("context") or {}).get("professor")
                and not any(
                    "identity-mismatch" in f for f in env.get("verify_flags") or []
                )
            ):
                entries.append((env["context"]["professor"], env["facts"]))
    elif args.drafts:
        for p in sorted(args.drafts.glob("DRAFT-*.md")):
            got = _final_facts_from_draft(p)
            if got:
                entries.append(got)
    else:
        for p in sorted(args.facts.glob("*.json")):
            env = json.loads(p.read_text(encoding="utf-8"))
            if env.get("status") == "ok" and (env.get("context") or {}).get(
                "professor"
            ):
                entries.append((env["context"]["professor"], env["data"]))

    index = collect(entries, cv_source_urls(args.raw_root))
    args.out.with_suffix(".json").write_text(
        json.dumps(index, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    args.out.with_suffix(".md").write_text(render_md(index), encoding="utf-8")
    n_topics = len(index["topics"])
    print(f"{len(entries)} faculty, {n_topics} topics -> {args.out}.json/.md")


if __name__ == "__main__":
    main()
