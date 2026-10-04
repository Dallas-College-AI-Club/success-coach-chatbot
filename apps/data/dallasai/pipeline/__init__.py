import argparse
import os
from pathlib import Path


def add_data_dir_arg(
    ap: argparse.ArgumentParser, flag: str = "--raw-root", required: bool = True
) -> None:
    """Add `flag`: the raw-corpus folder outside the repo. It defaults to the
    DATA_DIR setting (apps/data/.env), so it is only required while that is unset."""
    default = os.environ.get("DATA_DIR") or None
    ap.add_argument(
        flag,
        type=Path,
        default=default,
        required=required and default is None,
        help="raw corpus root holding manifests/, schedule/, catalog/, syllabi/, cv/ "
        "(default: $DATA_DIR)",
    )
