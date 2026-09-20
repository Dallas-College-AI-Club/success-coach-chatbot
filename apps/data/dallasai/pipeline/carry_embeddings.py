"""Reuse validated local vectors for unchanged embedded text.

Run ``python -m dallasai.pipeline.carry_embeddings NEW OLD OUTPUT`` before
embed_rows. Model, width, norm, dtype and text hash must satisfy the shared
contract. Inputs and existing outputs are never overwritten.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from .embed_rows import EMBEDDING_KEYS, validate_embedding


def main(argv: list[str] | None = None) -> None:
    args = argv if argv is not None else sys.argv[1:]
    if len(args) != 3:
        raise SystemExit(__doc__)
    new_p, old_p, out_p = (Path(a) for a in args)
    new = json.loads(new_p.read_text(encoding="utf-8"))
    old = json.loads(old_p.read_text(encoding="utf-8"))
    if (
        not isinstance(new, list)
        or not new
        or not isinstance(old, list)
        or not old
        or any(not isinstance(r, dict) for r in old + new)
    ):
        raise ValueError("Both deliveries must be non-empty row arrays")
    for row in old + new:
        if row.get("embedding") is not None:
            validate_embedding(row)

    if out_p.resolve() in (old_p.resolve(), new_p.resolve()) or out_p.exists():
        raise SystemExit(f"refusing to overwrite {old_p} — pick a different <out>")

    # The encoder sees only chunk_text. New source receipts or non-text facts
    # do not require recomputing an identical vector; never carry other metadata.
    by_hash = {
        r["metadata"]["embedding_text_sha256"]: r for r in old if r.get("embedding")
    }
    carried = 0
    for r in new:
        text = r.get("chunk_text")
        if not isinstance(text, str) or not text.strip():
            raise ValueError("Every delivery row requires non-empty chunk_text")
        prev = by_hash.get(hashlib.sha256(text.encode()).hexdigest())
        if prev and not r.get("embedding"):
            r["embedding"] = prev["embedding"]
            for k in EMBEDDING_KEYS:
                if k in (prev.get("metadata") or {}):
                    r.setdefault("metadata", {})[k] = prev["metadata"][k]
            carried += 1
            validate_embedding(r)

    with out_p.open("x", encoding="utf-8") as output:
        json.dump(new, output, indent=1, ensure_ascii=False)
    need = sum(1 for r in new if not r.get("embedding"))
    print(f"{len(new)} rows: {carried} embeddings carried over, {need} need embedding")


if __name__ == "__main__":
    main()
