"""
===============================================================================
Preprocessing Diff & Quality Gate Verification Test Suite
===============================================================================
Author: Antigravity AI / Neftali
Project: Success Coach Chatbot (Issue #90 - Preprocessing Engine Tests)

Description:
    TDD Quality Gate test suite verifying structural diff, header retention,
    metadata extraction accuracy, DOM purity (zero synthetic markers/headers),
    and catalog course HTML cleaning & markdown conversion.
===============================================================================
"""

import glob
import re
from pathlib import Path
import pytest
from bs4 import BeautifulSoup

try:
    from dallasai.markdown_converter import MarkdownConverter
except ModuleNotFoundError:
    from apps.data.dallasai.markdown_converter import MarkdownConverter


def verify_file_accuracy(raw_path: Path) -> dict:
    """Helper to convert a single raw HTML file and calculate structural metrics."""
    raw_html = raw_path.read_text(encoding="utf-8", errors="ignore")
    converter = MarkdownConverter()

    clean_md, clean_html = converter.clean_html_and_markdown(
        raw_html, source_url=str(raw_path)
    )

    raw_soup = BeautifulSoup(raw_html, "html.parser")

    raw_headers = len(raw_soup.find_all(re.compile(r"^h[1-6]$", re.IGNORECASE)))
    md_headers = len(re.findall(r"^#{1,6}\s+", clean_md, re.MULTILINE))

    raw_tables = len(raw_soup.find_all("table"))
    raw_table_rows = len(raw_soup.find_all("tr"))

    md_table_rows = len(
        [
            line
            for line in clean_md.splitlines()
            if line.startswith("|") and not line.startswith("| ---")
        ]
    )

    metadata = converter.extract_metadata_from_html(raw_soup, clean_md, str(raw_path))

    return {
        "raw_path": raw_path,
        "clean_md": clean_md,
        "clean_html": clean_html,
        "raw_headers": raw_headers,
        "md_headers": md_headers,
        "raw_tables": raw_tables,
        "raw_table_rows": raw_table_rows,
        "md_table_rows": md_table_rows,
        "instructor": metadata.get("instructor"),
        "course_id": metadata.get("course_id"),
        "concourse_id": metadata.get("concourse_id"),
    }


def test_no_synthetic_markers_or_injected_headers():
    """Verifies zero synthetic policy markers and zero injected HTML header divs."""
    sample_html = """
    <html>
    <head><title>GOVT 2306 - Federal Government</title></head>
    <body>
    <div id="syllabus">
        <h1>GOVT 2306 Syllabus</h1>
        <p>Welcome to class!</p>
    </div>
    </body>
    </html>
    """
    converter = MarkdownConverter()
    clean_md, clean_html = converter.clean_html_and_markdown(sample_html, source_url="test.html")

    assert "Not stated in syllabus" not in clean_md
    assert "concourse-metadata-header" not in clean_html
    assert "GOVT-2306" in clean_md


def test_catalog_course_cleaning_and_markdown_conversion():
    """Verifies catalog course HTML cleaning and Markdown conversion."""
    raw_catalog_html = """
    <!DOCTYPE html>
    <html>
    <head><title>ABDR 1307 - Collision Repair Welding (3 Credit Hours) - Dallas College</title></head>
    <body>
    <td class="block_content">
        <div id="gateway-toolbar-1" class="gateway-toolbar">Toolbar links to strip</div>
        <h1 id="course_preview_title">ABDR 1307&nbsp;-&nbsp;Collision Repair Welding (3 Credit Hours)</h1>
        <hr>
        <em>Campus Location:</em> <em>EFC</em><br><br>
        A study of collision repair welding and cutting procedures.<br><br>
        <strong>Course Hour Configuration</strong><br> (2 Lec., 3 Lab.)<br><br>
        CTE<br><br>
        <em><strong>This is a WECM Course Number.</strong></em>
    </td>
    </body>
    </html>
    """
    converter = MarkdownConverter()
    clean_md, clean_html = converter.clean_html_and_markdown(raw_catalog_html, source_url="15113.html")

    # Verify DOM purity and metadata extraction
    assert "gateway-toolbar" not in clean_html
    assert "ABDR 1307" in clean_md
    assert "Collision Repair Welding" in clean_md
    assert "credit_hours: 3" in clean_md
    assert "document_type: course" in clean_md
    assert "campus_locations: EFC" in clean_md


def test_sample_syllabi_accuracy(input_dir: Path = None, limit: int = None) -> None:
    """Tests structural diff, metadata accuracy, and strict proportional header preservation."""
    if input_dir is None:
        input_dir = Path(__file__).resolve().parent.parent / "sample_data" / "syllabi"

    if not input_dir.exists():
        if pytest:
            pytest.skip(f"Input directory {input_dir} not found")
        print(f"Error: Input directory {input_dir} not found")
        return

    all_files = glob.glob(str(input_dir / "*.html"))
    test_files = all_files[:limit] if limit and limit > 0 else all_files

    print(f"Evaluating Quality Gate on {len(test_files)} Syllabi in '{input_dir.name}'...\n")

    passed_count = 0
    failed_count = 0

    for filepath in test_files:
        raw_path = Path(filepath)
        try:
            metrics = verify_file_accuracy(raw_path)

            header_pass = metrics["md_headers"] >= int(0.75 * metrics["raw_headers"]) if metrics["raw_headers"] > 0 else True
            table_pass = metrics["md_table_rows"] >= metrics["raw_table_rows"]
            instructor_pass = metrics["instructor"] and metrics["instructor"] != "UNKNOWN"
            course_pass = metrics["course_id"] and metrics["course_id"] != "UNKNOWN"
            no_synthetic_pass = "Not stated in syllabus" not in metrics["clean_md"] and "concourse-metadata-header" not in metrics["clean_html"]

            if header_pass and table_pass and instructor_pass and course_pass and no_synthetic_pass:
                passed_count += 1
            else:
                failed_count += 1
        except Exception:
            failed_count += 1

    assert failed_count == 0, f"FAILED: {failed_count} syllabi failed quality gate accuracy checks."


if __name__ == "__main__":
    import sys
    args = sys.argv[1:]
    input_path = Path(args[0]) if args else None
    test_sample_syllabi_accuracy(input_dir=input_path)
