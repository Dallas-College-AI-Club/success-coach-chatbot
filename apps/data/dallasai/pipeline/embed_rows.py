"""Embed deliveries with the same local encoder as frontend retrieval.

Requires npm ci in apps/frontend and Node on PATH. Model weights download on
first use; document text stays local. No API key is required.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import subprocess
import tempfile
from pathlib import Path

FRONTEND = Path(__file__).resolve().parents[3] / "frontend"
CONTRACT = json.loads((FRONTEND / "lib/embedding-contract.json").read_text())
EMBED_MODEL = CONTRACT["model"]
DIMS = CONTRACT["dimensions"]
EMBEDDING_KEYS = (
    "embedding_model",
    "embedding_dimensions",
    "embedding_dtype",
    "embedding_text_sha256",
)


def validate_embedding(row: dict) -> None:
    if not isinstance(row, dict) or not isinstance(row.get("metadata"), dict):
        raise ValueError("Embedding row requires a metadata object")
    if not isinstance(row.get("chunk_text"), str) or not row["chunk_text"].strip():
        raise ValueError("Embedding row requires non-empty chunk_text")
    vector = row.get("embedding")
    if not isinstance(vector, list) or len(vector) != DIMS:
        raise ValueError(f"Embedding must have {DIMS} dimensions")
    if any(type(x) not in (int, float) or not math.isfinite(x) for x in vector):
        raise ValueError("Embedding contains a non-finite or non-numeric value")
    if not 0.99 <= math.hypot(*vector) <= 1.01:
        raise ValueError("Embedding must have unit norm")
    metadata = row["metadata"]
    expected = (
        EMBED_MODEL,
        DIMS,
        CONTRACT["dtype"],
        hashlib.sha256(row["chunk_text"].encode()).hexdigest(),
    )
    if tuple(metadata.get(k) for k in EMBEDDING_KEYS) != expected:
        raise ValueError(
            "Embedding provenance does not match the model contract and text; re-embed"
        )


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rows", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--doc-types", nargs="+")
    args = parser.parse_args(argv)
    if args.out.resolve() == args.rows.resolve() or args.out.exists():
        parser.error(
            "Choose a new output path; existing deliveries are never overwritten"
        )
    rows = json.loads(args.rows.read_text(encoding="utf-8"))
    if (
        not isinstance(rows, list)
        or not rows
        or any(not isinstance(r, dict) for r in rows)
    ):
        parser.error("Expected a non-empty row array")
    if args.doc_types:
        rows = [
            r for r in rows if r.get("metadata", {}).get("doc_type") in args.doc_types
        ]
    if not rows:
        parser.error("No rows match --doc-types")
    node = shutil.which("node")
    if not node or not (FRONTEND / "node_modules/tsx").exists():
        parser.error("Install Node and run npm ci in apps/frontend first")
    with tempfile.TemporaryDirectory(prefix="course-embedding-") as temp:
        staged = Path(temp) / "rows.json"
        staged.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
        result = subprocess.run(
            [
                node,
                "--import",
                "tsx",
                "scripts/embed-rows.ts",
                str(staged),
                str(args.out.resolve()),
            ],
            cwd=FRONTEND,
        )
        if result.returncode:
            raise SystemExit(result.returncode)
    for row in json.loads(args.out.read_text(encoding="utf-8")):
        validate_embedding(row)


if __name__ == "__main__":
    main()
