import argparse
import json
from pathlib import Path

from dallasai.embedding import embed


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--i", "--input", type=Path, required=True, help="rows.json")
    p.add_argument(
        "--o", "--output", type=Path, required=True, help="updated rows.json"
    )
    args = p.parse_args()

    docs = json.load(args.i.open())
    for doc in docs:
        doc["embedding"] = embed(doc["chunk_text"]).tolist()

    args.o.write_text(json.dumps(docs, indent=2))


if __name__ == "__main__":
    main()
