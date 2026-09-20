"""Manifest-driven batch runner for the facts-extraction stage (issue #61).

Turns the per-document engine in `pipeline.extract` into a resumable corpus
stage: read the scrape manifests, convert each raw file, extract facts under
the configured EXTRACTOR, and persist one facts JSON per document — quarantine
for anything that isn't `ok`. Identity always comes from the manifest line,
never from the document body.

    python -m dallasai.pipeline.extract_batch --raw-root <path-to-raw> \
        --manifest-glob "archive_syllabus_*.jsonl" --doc-type syllabus \
        --out out/facts [--limit 25] [--term 2026SP]

Resumability: skip only an output whose extraction fingerprint still matches
source bytes, identity, model, prompt, schema and extractor code. Changed inputs
retire the old envelope to quarantine before retrying (or pass --refresh).
The engine is stateless, so several machines can split the manifests.

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
import hashlib
import json
import os
import sys
from collections import Counter
from pathlib import Path
from typing import Iterator, Optional

from dotenv import load_dotenv

from .extract import (
    DOC_SCHEMAS,
    SCHEMAS_DIR,
    extract,
    extract_manual,
    html_to_text,
    pdf_to_text,
    persist_quarantine,
    prompt_path,
)

load_dotenv()

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
    latest: dict[tuple[str, str], dict] = {}
    for mf in sorted((raw_root / "manifests").glob(pattern)):
        for line in mf.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            entry = json.loads(line)
            rel = (entry.get("raw_path") or "").replace("\\", "/")
            if not rel:
                continue
            key = (entry.get("kind", ""), rel)
            previous = latest.get(key, {})
            if (entry.get("fetched_at") or "") >= (previous.get("fetched_at") or ""):
                latest[key] = entry
    yield from latest.values()


def extraction_fingerprint(
    source: Path,
    doc_type: str,
    context: dict,
    replay: Path | None = None,
    provenance: dict | None = None,
) -> str:
    """Resume only the same bytes, identity, model, prompt, schema and extractor."""
    digest = hashlib.sha256()
    for value in (
        source.read_bytes(),
        prompt_path(doc_type).read_bytes(),
        (SCHEMAS_DIR / DOC_SCHEMAS[doc_type][0]).read_bytes(),
        Path(__file__).with_name("extract.py").read_bytes(),
        json.dumps(context, sort_keys=True).encode(),
        json.dumps(provenance, sort_keys=True).encode(),
        (replay.read_bytes() if replay else os.environ.get("EXTRACTOR", "").encode()),
    ):
        digest.update(len(value).to_bytes(8, "big"))
        digest.update(value)
    return digest.hexdigest()


def retire_output(dest: Path, quarantine: Path, doc_type: str) -> None:
    """Remove stale active facts while preserving the envelope for review."""
    if dest.exists():
        retired = quarantine / "superseded" / doc_type
        retired.mkdir(parents=True, exist_ok=True)
        old_hash = hashlib.sha256(dest.read_bytes()).hexdigest()[:16]
        dest.replace(retired / f"{dest.stem}-{old_hash}.json")


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
    if args.limit is not None and args.limit <= 0:
        ap.error("--limit must be positive")

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
        if not replay:
            ap.error("Replay map contains no documents; no extraction was attempted")

    stats: Counter = Counter()
    selected: dict[Path, tuple[dict, str, str]] = {}
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
        if only_paths is not None and rel not in only_paths:
            continue
        if args.replay_map and rel not in replay:
            continue

        dest = args.out / doc_type / f"{_doc_id(entry)}.json"
        previous = selected.get(dest)
        owner = (
            json.loads(dest.read_text(encoding="utf-8")).get("raw_path")
            if dest.exists()
            else None
        )
        if (previous and previous[2] != rel) or (
            owner and owner.replace("\\", "/") != rel
        ):
            raise ValueError(
                f"Output identities collide at {dest.name}; "
                "use separate --out directories for each catalog year"
            )
        selected[dest] = (entry, doc_type, rel)

    # Preflight every output identity before any extraction or file mutation.
    for dest, (entry, doc_type, rel) in selected.items():
        doc_id = dest.stem
        src = args.raw_root / rel
        if not src.exists():
            retire_output(dest, qdir, doc_type)
            print(f"[missing] {rel}", file=sys.stderr)
            stats["missing_raw"] += 1
            continue

        context = _context(entry)
        fingerprint = extraction_fingerprint(
            src,
            doc_type,
            context,
            replay.get(rel),
            {key: entry.get(key) for key in ("source_url", "fetched_at")},
        )
        if dest.exists():
            previous = json.loads(dest.read_text(encoding="utf-8"))
            if (
                not args.refresh
                and previous.get("extraction_fingerprint") == fingerprint
            ):
                stats["skipped_verified"] += 1
                continue
            # Keep a reviewable copy, but never leave stale facts in the active
            # delivery when re-extraction fails or gets quarantined.
            retire_output(dest, qdir, doc_type)
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
                        "source_sha256": hashlib.sha256(src.read_bytes()).hexdigest(),
                        "extraction_fingerprint": fingerprint,
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
            f"quarantine -> {qdir} "
            "(review 100% of these before any load; see issue #72)"
        )
    if (
        stats["quarantined"]
        or stats["missing_raw"]
        or not (stats["ok"] + stats["skipped_verified"])
    ):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
