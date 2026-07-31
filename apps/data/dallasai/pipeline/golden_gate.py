"""Byte-exact golden gate for the catalog extractor (issue #61 / #72).

Fresh-extracts each fixture document under the configured EXTRACTOR and diffs
the result against the verified expected.json. ANY difference is a failure:
investigate (and re-verify by hand) before trusting a bulk run. Run this after
EVERY prompt, model, or schema change.

    python -m dallasai.pipeline.golden_gate --raw-root <raw> [--gate-dir gate]

Gate fixtures: gate/<case>/context.json + expected.json; <case> starts with
"course-" or "program-" (mapped to doc_type), and rel.txt names the raw file
(falls back to the built-in map for the 2026-07-24 five).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from .extract import extract, html_to_text

REL = {
    "course-math2414": "catalog/2026-2027/courses/16370.html",
    "course-biol1406": "catalog/2026-2027/courses/15293.html",
    "program-as3448": "catalog/2026-2027/programs/3448.html",
    "program-aafos2856": "catalog/2026-2027/programs/2856.html",
    "program-core3388": "catalog/2026-2027/programs/3388.html",
}


def diff_paths(a, b, path="$", ws_only=None):
    """Token-exact comparison. Whitespace-only string differences (newline vs
    space joining in long verbatim fields) are model-unstable under the
    claude-sonnet-5 ALIAS (no dated snapshot exists to pin — adjudicated
    2026-07-26; record in the delivery audit trail on SharePoint, summary in
    EXTRACTION_MANUAL.md §5): they are
    collected into ws_only and reported, but do not fail the gate. ANY token
    change — a dropped word, a case change, a reordered list — still fails."""
    if isinstance(a, dict) and isinstance(b, dict):
        out = []
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b:
                out.append(f"{path}.{k} (missing on one side)")
            else:
                out += diff_paths(a[k], b[k], f"{path}.{k}", ws_only)
        return out
    if isinstance(a, list) and isinstance(b, list):
        out = [] if len(a) == len(b) else [f"{path}[len {len(a)} vs {len(b)}]"]
        for i, (x, y) in enumerate(zip(a, b)):
            out += diff_paths(x, y, f"{path}[{i}]", ws_only)
        return out
    if isinstance(a, str) and isinstance(b, str) and a != b:
        if re.sub(r"\s+", " ", a).strip() == re.sub(r"\s+", " ", b).strip():
            if ws_only is not None:
                ws_only.append(path)
            return []
        return [path]
    return [] if a == b else [path]


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--raw-root", type=Path, required=True)
    ap.add_argument(
        "--gate-dir",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "pipeline_runs" / "gate",
    )
    args = ap.parse_args(argv)

    n_fail = 0
    for case_dir in sorted(p for p in args.gate_dir.iterdir() if p.is_dir()):
        case = case_dir.name
        if case.startswith("_") or not (case_dir / "expected.json").exists():
            continue  # retired fixtures, adjudication records, scratch dirs
        doc_type = "course" if case.startswith("course-") else "program_map"
        rel_file = case_dir / "rel.txt"
        rel = (
            rel_file.read_text(encoding="utf-8").strip()
            if rel_file.exists()
            else REL[case]
        )
        context = json.loads((case_dir / "context.json").read_text(encoding="utf-8"))
        expected = json.loads((case_dir / "expected.json").read_text(encoding="utf-8"))
        document = html_to_text(
            (args.raw_root / rel).read_text(encoding="utf-8", errors="replace")
        )
        res = extract(doc_type, document, context)
        (case_dir / "fresh.json").write_text(
            json.dumps(res.data, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        if res.status != "ok":
            print(
                f"[GATE FAIL] {case}: extraction status {res.status} "
                f"(errors: {res.validation_errors})"
            )
            n_fail += 1
        elif res.data != expected:
            ws_only: list = []
            paths = diff_paths(res.data, expected, ws_only=ws_only)
            if paths:
                print(f"[GATE FAIL] {case}: {len(paths)} differing path(s); first 8:")
                for p in paths[:8]:
                    print(f"            {p}")
                print(f"            (full fresh output: {case_dir / 'fresh.json'})")
                n_fail += 1
            else:
                print(
                    f"[gate ok]   {case} (attempts={res.attempts}; "
                    f"{len(ws_only)} whitespace-only field(s) tolerated per "
                    f"the 2026-07-26 adjudication)"
                )
        else:
            print(f"[gate ok]   {case} (attempts={res.attempts})")
    if n_fail:
        print(
            f"\n{n_fail} case(s) FAILED — do NOT bulk-run until reconciled and re-verified."
        )
        sys.exit(1)
    print("\nGOLDEN GATE GREEN — pilot/bulk unlocked.")


if __name__ == "__main__":
    main()
