import sys
from pathlib import Path

SYS_DATA_DIR = Path(__file__).resolve().parent.parent
if str(SYS_DATA_DIR) not in sys.path:
    sys.path.insert(0, str(SYS_DATA_DIR))

from dallasai.main import parse_args


def test_main_cli_parser():
    """Verify CLI parser default arguments."""
    sys.argv = ["main.py"]
    args = parse_args()
    assert args.input is not None
    assert args.output is not None
    assert args.no_db is False

