import sys
from pathlib import Path

SYS_DATA_DIR = Path(__file__).resolve().parent.parent
if str(SYS_DATA_DIR) not in sys.path:
    sys.path.insert(0, str(SYS_DATA_DIR))

from dallasai.main import parse_args, resolve_canonical_url


def test_main_cli_parser():
    """Verify CLI parser default arguments."""
    sys.argv = ["main.py"]
    args = parse_args()
    assert args.input is not None
    assert args.output is not None
    assert args.no_db is False


def test_resolve_canonical_url():
    """Verify resolve_canonical_url resolves web HTTPS URLs instead of file:// fallbacks."""
    # 1. Explicit HTTPS URL preserved
    url_explicit = resolve_canonical_url("https://example.com/page", "syllabus")
    assert url_explicit == "https://example.com/page"

    # 2. Course catalog URL by numeric coid
    url_course = resolve_canonical_url("file://15113.html", "course", metadata={"coid": "15113"})
    assert url_course == "https://catalog.dallascollege.edu/preview_course_nopop.php?catoid=5&coid=15113"

    # 3. Concourse syllabus URL by numeric concourse_id
    url_syl = resolve_canonical_url("sample_data/syllabi/84063.html", "syllabus")
    assert url_syl == "https://concourse.dallascollege.edu/syllabus/view/84063"

    # 4. Program map URL by numeric poid
    url_program = resolve_canonical_url("program_poid123.html", "program_map", metadata={"poid": "123"})
    assert url_program == "https://catalog.dallascollege.edu/preview_program.php?catoid=5&poid=123"


