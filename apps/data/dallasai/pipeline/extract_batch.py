"""Manifest-driven batch runner for the facts-extraction stage (issue #61).

Turns the per-document engine in `pipeline.extract` into a resumable corpus
stage: read the scrape manifests, convert each raw file, extract facts under
the configured EXTRACTOR, and persist one facts JSON per document — quarantine
for anything that isn't `ok`. Identity always comes from the manifest line,
never from the document body.

    python -m dallasai.pipeline.extract_batch --raw-root <path-to-raw> \
        --manifest-glob "archive_syllabus_*.jsonl" --doc-type syllabus \
        --out out/facts [--limit 25] [--term 2026SP]

Resumability: a document whose output file already exists is skipped, so a
killed run continues where it stopped; delete outputs (or pass --refresh) to
redo. The engine is stateless, so several machines can split the manifests.

Replay mode (`--replay-map replay.jsonl`) routes documents through
`extract_manual()` instead of a model call: each line maps a manifest
`raw_path` to a hand-produced-and-validated payload file. This is the
no-API-key `claude_code_session` path run in bulk — used to smoke the
batch -> compose -> load path with verified payloads, and to backfill
documents extracted interactively.

Manifest kinds map to doc_types: syllabus -> syllabus, cv -> cv,
course -> course, program -> program_map (index lines are skipped).
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Iterator, Optional

from .extract import (
    extract,
    extract_manual,
    html_to_text,
    pdf_to_text,
    persist_quarantine,
)

KIND_TO_DOC_TYPE = {
    "syllabus": "syllabus",
    "cv": "cv",
    "course": "course",
    "program": "program_map",
}


def _context(entry: dict) -> dict:
    """The identity context the manifest supplies for this document."""
    kind = entry.get("kind")
    if kind == "syllabus":
        term = entry.get("term_code") or ""
        sem = {"SP": "spring", "SU": "summer", "FA": "fall"}.get(term[4:6], None)
        return {
            k: v
            for k, v in {
                "course_code": entry.get("course_code"),
                "section": entry.get("section"),
                "professor": entry.get("professor"),
                "year": int(term[:4]) if term[:4].isdigit() else None,
                "semester": sem,
            }.items()
            if v not in (None, "")
        }
    if kind == "cv":
        ctx = {"professor": entry.get("professor")}
        # scrape year bounds open-ended evidence ("2018 - Present") so the
        # extractor never invents the current year from nowhere
        fetched = entry.get("fetched_at") or ""
        if fetched[:4].isdigit():
            ctx["scrape_year"] = int(fetched[:4])
        return ctx
    # catalog course/program: the catalog year scopes it; page supplies the rest
    ctx = {"catalog_year": entry.get("catalog_year")}
    for k in ("coid", "poid"):
        if entry.get(k):
            ctx[k] = entry[k]
    return ctx


def _doc_id(entry: dict) -> str:
    """Stable, filesystem-safe id: term-qualified stem of the raw file."""
    p = Path(entry["raw_path"].replace("\\", "/"))
    return f"{p.parent.name}-{p.stem}" if p.parent.name not in ("", ".") else p.stem


def iter_manifest(raw_root: Path, pattern: str) -> Iterator[dict]:
    for mf in sorted((raw_root / "manifests").glob(pattern)):
        for line in mf.read_text(encoding="utf-8").splitlines():
            if line.strip():
                yield json.loads(line)


def main(argv: Optional[list[str]] = None) -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument(
        "--raw-root",
        type=Path,
        required=True,
        help="corpus root holding manifests/, syllabi/, cv/, catalog/",
    )
    ap.add_argument("--manifest-glob", default="archive_*.jsonl")
    ap.add_argument(
        "--doc-type",
        choices=sorted(set(KIND_TO_DOC_TYPE.values())),
        help="only extract this doc_type (default: all wired kinds)",
    )
    ap.add_argument("--term", help="only syllabi of this term_code (e.g. 2026SP)")
    ap.add_argument("--limit", type=int, help="stop after N extractions this run")
    ap.add_argument(
        "--out",
        type=Path,
        required=True,
        help="facts output dir; one <doc_type>/<doc_id>.json per ok doc",
    )
    ap.add_argument(
        "--quarantine-dir", type=Path, default=None, help="default <out>/../quarantine"
    )
    ap.add_argument(
        "--refresh",
        action="store_true",
        help="re-extract even when the output file exists",
    )
    ap.add_argument(
        "--replay-map",
        type=Path,
        help="JSONL: {raw_path, facts_file} per line; routes documents "
        "through extract_manual() (claude_code_session) instead of a model",
    )
    ap.add_argument(
        "--paths-file",
        type=Path,
        help="only extract manifests whose raw_path is listed in this "
        "file (one per line, / or \\ separators) — pilot/backfill runs",
    )
    args = ap.parse_args(argv)

    only_paths: Optional[set[str]] = None
    if args.paths_file:
        only_paths = {
            ln.strip().replace("\\", "/")
            for ln in args.paths_file.read_text(encoding="utf-8").splitlines()
            if ln.strip()
        }

    qdir = args.quarantine_dir or args.out.parent / "quarantine"
    replay: dict[str, Path] = {}
    if args.replay_map:
        for line in args.replay_map.read_text(encoding="utf-8").splitlines():
            if line.strip():
                e = json.loads(line)
                replay[e["raw_path"].replace("\\", "/")] = Path(e["facts_file"])

    stats: Counter = Counter()
    seen: set[str] = set()
    for entry in iter_manifest(args.raw_root, args.manifest_glob):
        doc_type = KIND_TO_DOC_TYPE.get(entry.get("kind", ""))
        # Not gated on status: the fetcher records 202 for pages that only
        # completed after a JS challenge, and their HTML is complete on disk.
        # Every genuine failure (404, error, resolve_*) has raw_path=None.
        if doc_type is None or not entry.get("raw_path"):
            continue
        if args.doc_type and doc_type != args.doc_type:
            continue
        if args.term and entry.get("term_code") != args.term:
            continue
        rel = entry["raw_path"].replace("\\", "/")
        if rel in seen:  # re-fetches: first manifest line wins
            continue
        seen.add(rel)
        if only_paths is not None and rel not in only_paths:
            continue
        if replay and rel not in replay:  # replay runs touch only mapped docs
            continue

        doc_id = _doc_id(entry)
        dest = args.out / doc_type / f"{doc_id}.json"
        if dest.exists() and not args.refresh:
            stats["skipped_existing"] += 1
            continue
        src = args.raw_root / rel
        if not src.exists():
            print(f"[missing] {rel}", file=sys.stderr)
            stats["missing_raw"] += 1
            continue

        context = _context(entry)
        if rel in replay:
            payload = json.loads(replay[rel].read_text(encoding="utf-8"))
            res = extract_manual(doc_type, payload)
        else:
            if src.suffix.lower() == ".pdf":
                document = pdf_to_text(src)
            else:
                document = html_to_text(
                    src.read_text(encoding="utf-8", errors="replace")
                )
            res = extract(doc_type, document, context)

        if res.status == "ok" and res.data is not None:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(
                json.dumps(
                    {
                        "facts": res.data,
                        "context": context,
                        "source_url": entry.get("source_url"),
                        "raw_path": entry["raw_path"],
                        "sha256": entry.get("sha256"),
                        "fetched_at": entry.get("fetched_at"),
                        "doc_type": doc_type,
                        "extractor": res.extractor,
                        "extraction_method": res.extraction_method,
                        "prompt_version": res.prompt_version,
                        "attempts": res.attempts,
                    },
                    indent=2,
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            stats["ok"] += 1
        else:
            persist_quarantine(res, qdir, doc_id, source=src, context=context)
            stats["quarantined"] += 1
        print(f"[{res.status}] {doc_type} {doc_id} via {res.extraction_method}")

        if args.limit and stats["ok"] + stats["quarantined"] >= args.limit:
            break

    print(
        "\n" + "  ".join(f"{k}={v}" for k, v in sorted(stats.items()))
        or "nothing matched"
    )
    if stats["quarantined"]:
        print(
            f"quarantine -> {qdir} (review 100% of these before any load; see issue #72)"
        )


if __name__ == "__main__":
    main()
