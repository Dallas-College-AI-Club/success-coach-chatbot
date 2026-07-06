"""Pure-function regression tests for the pipeline (no database needed).

parse_date once silently returned NULL for every date in the real schedule CSV
because the file had been resaved in Excel's D-Mon-YY form — sections loaded
with no dates and nothing complained. These tests pin every format that has
appeared in the wild.
"""

from datetime import date

from pipeline.load_extractions import (
    parse_date,
    parse_materials_links,
    term_code_from_label,
    term_from_code,
)


def test_parse_date_all_known_formats():
    assert parse_date("2022-06-06") == date(2022, 6, 6)          # ISO (extractions)
    assert parse_date("May 13, 2022") == date(2022, 5, 13)       # original CSV export
    assert parse_date("13-May-22") == date(2022, 5, 13)          # Excel resave (the bug)
    assert parse_date("2-Jun-22") == date(2022, 6, 2)            # single-digit day
    assert parse_date("05/13/2022") == date(2022, 5, 13)         # US slash form


def test_parse_date_empty_and_unknown(capsys):
    assert parse_date(None) is None
    assert parse_date("") is None
    assert parse_date("   ") is None
    # unknown formats return None but WARN — silent loss is the failure mode
    assert parse_date("someday soon") is None
    assert "unparseable date" in capsys.readouterr().err


def test_term_helpers():
    assert term_from_code("2022SU")["name"] == "Summer 2022"
    assert term_code_from_label("Fall 2026") == "2026FA"


def test_materials_links_parsing():
    links = parse_materials_links(
        "Textbook Info (https://bkstr.example.com/a?x=1) | IncludEd Info (https://college.example.com/b)")
    assert links == ["https://bkstr.example.com/a?x=1", "https://college.example.com/b"]
    assert parse_materials_links(None) == []
