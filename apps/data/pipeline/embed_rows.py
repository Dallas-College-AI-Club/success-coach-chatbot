"""Fill knowledge_entry rows with production-grade embeddings via OpenRouter.

Model pinned to the team's gateway decision: openai/text-embedding-3-small at
dimensions=768, provider-routing locked to OpenAI so every vector — including
every future live query — comes from numerically identical weights.

Quality is enforced, not advised: the run aborts unless every vector has exactly
768 dims and unit norm (±1%). Each row's metadata is stamped with
embedding_model + embedding_dimensions so provenance survives into Postgres and
a future model swap can target rows precisely.

    OPENROUTER_API_KEY=... python -m pipeline.embed_rows --rows rows.json
        [--out rows.embedded.json] [--batch 64]

Resumable: rows that already carry an embedding are skipped.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from pathlib import Path

import requests

EMBED_MODEL = "openai/text-embedding-3-small"
DIMS = 768
URL = "https://openrouter.ai/api/v1/embeddings"


def embed_batch(texts: list[str], key: str) -> list[list[float]]:
    r = requests.post(URL, timeout=120, headers={
        "Authorization": f"Bearer {key}",
        "HTTP-Referer": "https://dc-success-coach.vercel.app",
        "X-Title": "Dallas College Success Coach Chatbot",
    }, json={
        "model": EMBED_MODEL, "input": texts, "dimensions": DIMS,
        # rider 3: one upstream, no fallbacks — vector consistency over uptime
        "provider": {"order": ["openai"], "allow_fallbacks": False},
    })
    if r.status_code in (429, 500, 502, 503):
        time.sleep(10)
        r = requests.post(URL, timeout=120, headers={"Authorization": f"Bearer {key}"},
                          json={"model": EMBED_MODEL, "input": texts, "dimensions": DIMS,
                                "provider": {"order": ["openai"], "allow_fallbacks": False}})
    r.raise_for_status()
    data = sorted(r.json()["data"], key=lambda d: d["index"])
    out = []
    for d in data:
        v = d["embedding"]
        if len(v) != DIMS:
            sys.exit(f"ABORT: got {len(v)} dims, expected {DIMS} — the dimensions "
                     "parameter did not pass through; do not load these vectors")
        n = math.sqrt(sum(x * x for x in v))
        if not 0.99 <= n <= 1.01:
            sys.exit(f"ABORT: vector norm {n:.4f} outside unit tolerance — "
                     "normalization contract violated; investigate before loading")
        out.append(v)
    return out


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--rows", type=Path, required=True)
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--batch", type=int, default=64)
    args = ap.parse_args(argv)
    key = os.environ.get("OPENROUTER_API_KEY") or sys.exit("OPENROUTER_API_KEY not set")

    rows = json.loads(args.rows.read_text(encoding="utf-8"))
    flat = rows if isinstance(rows, list) else None
    if flat is None:
        sys.exit("--rows must be the composed row LIST (run the compose step first)")

    todo = [r for r in flat if not r.get("embedding")]
    print(f"{len(flat)} rows, {len(todo)} need embeddings "
          f"({EMBED_MODEL} @ {DIMS} dims, provider-pinned)")
    for i in range(0, len(todo), args.batch):
        chunk = todo[i:i + args.batch]
        vecs = embed_batch([r["chunk_text"] for r in chunk], key)
        for r, v in zip(chunk, vecs):
            r["embedding"] = v
            r.setdefault("metadata", {})["embedding_model"] = EMBED_MODEL
            r["metadata"]["embedding_dimensions"] = DIMS
        print(f"  {min(i + args.batch, len(todo))}/{len(todo)}")

    dest = args.out or args.rows.with_suffix(".embedded.json")
    dest.write_text(json.dumps(flat, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {dest} — every row embedding verified: {DIMS} dims, unit norm")


if __name__ == "__main__":
    main()
