"""Carry embeddings from a previous delivery into a freshly assembled rows file.

Re-assembling after a fix regenerates every row, but most rows are byte-identical
to what already shipped. `content_hash` is computed at compose time over
chunk_text + facts + the compose-time metadata; the later enrich/embed stamps
fall outside it, which is why a re-assembled row still matches a shipped one.
An unchanged row keeps its hash — and can keep its already-paid-for vector.
Only genuinely new or changed rows are left for `embed_rows` to fill.

    python -m dallasai.pipeline.carry_embeddings <new> <old.embedded> <out>
    python -m dallasai.pipeline.embed_rows --rows <out> --out <final.embedded>

Refuses outright if the previous delivery was embedded by a different model:
vectors from two models share no basis and fail silently downstream — nothing
in the loader checks the model or the norm, so a mixed corpus reaches Postgres
and simply returns the wrong rows.

Typical effect: re-assembling the 2026-07-27 CV delivery (2,709 rows) and
carrying from its own embedded file — 2,709 carried, 0 new API calls.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from .embed_rows import EMBED_MODEL


def main(argv: list[str] | None = None) -> None:
    args = argv if argv is not None else sys.argv[1:]
    if len(args) != 3:
        raise SystemExit(__doc__)
    new_p, old_p, out_p = (Path(a) for a in args)
    new = json.loads(new_p.read_text(encoding="utf-8"))
    old = json.loads(old_p.read_text(encoding="utf-8"))

    models = {(r.get("metadata") or {}).get("embedding_model")
              for r in old if r.get("embedding")}
    if models - {EMBED_MODEL}:
        raise SystemExit(
            f"refusing to carry: {old_p} holds vectors from "
            f"{sorted(map(str, models))}, but embed_rows now produces "
            f"{EMBED_MODEL}. Vectors from two models share no basis and "
            "fail silently — re-embed instead of carrying.")

    if out_p.resolve() == old_p.resolve():
        raise SystemExit(
            f"refusing to overwrite {old_p} — pick a different <out>")

    by_hash = {r["content_hash"]: r for r in old if r.get("embedding")}
    carried = 0
    for r in new:
        prev = by_hash.get(r["content_hash"])
        if prev and not r.get("embedding"):
            r["embedding"] = prev["embedding"]
            for k in ("embedding_model", "embedding_dimensions"):
                if k in (prev.get("metadata") or {}):
                    r.setdefault("metadata", {})[k] = prev["metadata"][k]
            carried += 1

    out_p.write_text(json.dumps(new, indent=1, ensure_ascii=False),
                     encoding="utf-8")
    need = sum(1 for r in new if not r.get("embedding"))
    print(f"{len(new)} rows: {carried} embeddings carried over, "
          f"{need} need embedding")


if __name__ == "__main__":
    main()
