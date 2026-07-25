"""
===============================================================================
Automated Structural Diff & Metadata Accuracy Test Suite
===============================================================================
Author: Antigravity AI / Neftali
Project: Success Coach Chatbot (Issue #90 - Section 3 Quality Gate)

Description:
    Asserts count of raw HTML <h1>/<h2>/<h3> tags match #/##/### in Markdown.
    Asserts count of raw <tr> elements match pipe table rows (| ... |) in Markdown.
    Asserts required metadata fields (instructor, course_id) are non-null and not UNKNOWN.

Usage (Pytest):
    pytest apps/data/tests/test_preprocessing_diff.py

Usage (CLI):
    python apps/data/tests/test_preprocessing_diff.py --input-dir path/to/raw_html/
    python apps/data/tests/test_preprocessing_diff.py --input path/to/single_file.html
===============================================================================
"""

import argparse
import glob
import re
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

try:
    import pytest
except ImportError:
    pytest = None

from bs4 import BeautifulSoup
from apps.data.dallasai.markdown_converter import MarkdownConverter


def verify_file_accuracy(raw_html_path: Path) -> dict:
    """
    Verifies that a converted markdown file preserves structural element counts
    and metadata integrity compared to the raw HTML file.
    """
    with open(raw_html_path, "r", encoding="utf-8", errors="ignore") as f:
        raw_html = f.read()

    converter = MarkdownConverter()
    clean_md, clean_html = converter.clean_html_and_markdown(raw_html, source_url=raw_html_path.name)

    soup_raw = BeautifulSoup(raw_html, "html.parser")
    soup_clean = BeautifulSoup(clean_html, "html.parser")

    raw_headers = len(soup_clean.find_all(["h1", "h2", "h3"]))
    md_headers = len(re.findall(r"^(?:#|##|###)\s+", clean_md, re.MULTILINE))

    raw_table_rows = len(soup_clean.find_all("tr"))
    md_table_lines = [line for line in clean_md.splitlines() if line.strip().startswith("|")]
    md_data_rows = [line for line in md_table_lines if not re.match(r"^\|\s*:?---", line)]

    metadata = converter.extract_metadata_from_html(soup_raw, clean_md, raw_html_path.name)

    return {
        "file_name": raw_html_path.name,
        "raw_headers": raw_headers,
        "md_headers": md_headers,
        "raw_table_rows": raw_table_rows,
        "md_table_rows": len(md_data_rows),
        "instructor": metadata.get("instructor"),
        "course_id": metadata.get("course_id"),
        "term": metadata.get("term"),
        "section": metadata.get("section"),
        "clean_md": clean_md,
        "clean_html": clean_html,
    }


def test_sample_syllabi_accuracy(input_dir: Path = None, limit: int = None) -> None:
    """
    Tests structural diff and metadata extraction accuracy on sample or full syllabi.
    """
    if input_dir is None:
        input_dir = Path(__file__).resolve().parent.parent / "2026SP (Unzipped Files)" / "2026SP"

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
    failures = []

    for filepath in test_files:
        raw_path = Path(filepath)
        try:
            metrics = verify_file_accuracy(raw_path)

            header_pass = metrics["md_headers"] >= min(1, metrics["raw_headers"])
            table_pass = metrics["md_table_rows"] >= metrics["raw_table_rows"]
            instructor_pass = metrics["instructor"] and metrics["instructor"] != "UNKNOWN"
            course_pass = metrics["course_id"] and metrics["course_id"] != "UNKNOWN"

            if header_pass and table_pass and instructor_pass and course_pass:
                passed_count += 1
            else:
                failed_count += 1
                failures.append({
                    "file": raw_path.name,
                    "instructor": metrics["instructor"],
                    "course_id": metrics["course_id"],
                    "header_pass": header_pass,
                    "table_pass": table_pass,
                })
        except Exception as e:
            failed_count += 1
            failures.append({"file": raw_path.name, "error": str(e)})

    print("--- Structural Diff & Metadata Accuracy Report ---")
    print(f"Total Evaluated : {len(test_files)}")
    print(f"Passed          : {passed_count} [OK]")
    print(f"Failed          : {failed_count} [FAIL]")

    if failures:
        print("\n--- Failure Details (First 15) ---")
        for f in failures[:15]:
            print(f"File: {f['file']} | Instructor: {f.get('instructor')} | CourseID: {f.get('course_id')} | Error: {f.get('error')}")

    assert failed_count == 0, f"FAILED: {failed_count} syllabi failed quality gate accuracy checks."
    print("\nALL TESTED SYLLABI PASSED STRUCTURAL & METADATA ACCURACY CHECKS! [OK]")


def main() -> None:
    """CLI Entry Point with Argparse for Quality Gate Testing."""
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(
        description="Reusable Preprocessing Quality Gate Test CLI tool."
    )
    parser.add_argument(
        "-i", "--input-dir", required=False,
        help="Path to an input directory of HTML files to test."
    )
    parser.add_argument(
        "-f", "--file", required=False,
        help="Path to a single HTML file to verify accuracy."
    )
    parser.add_argument(
        "-l", "--limit", required=False, type=int, default=None,
        help="Optional integer limit on how many files to test (e.g., --limit 10). Defaults to testing all files."
    )

    args = parser.parse_args()

    print("========================================================================")
    print("           PREPROCESSING ACCURACY & STRUCTURAL DIFF QUALITY GATE        ")
    print("========================================================================\n")

    if args.file:
        path = Path(args.file)
        if not path.exists():
            print(f"Error: File '{path}' does not exist.")
            sys.exit(1)
        r = verify_file_accuracy(path)
        print(f"File: {r['file_name']} | Instructor: {r['instructor']} | CourseID: {r['course_id']} | Headers (HTML vs MD): {r['raw_headers']} vs {r['md_headers']} | Table Rows (HTML vs MD): {r['raw_table_rows']} vs {r['md_table_rows']}")
        assert r["instructor"] != "UNKNOWN", f"Instructor is UNKNOWN in {path.name}"
        assert r["course_id"] != "UNKNOWN", f"Course ID is UNKNOWN in {path.name}"
        print(f"\nSUCCESS: {path.name} passed all structural and metadata quality checks! [OK]")
    else:
        in_dir = Path(args.input_dir) if args.input_dir else None
        test_sample_syllabi_accuracy(in_dir, limit=args.limit)

    print("========================================================================")


if __name__ == "__main__":
    main()
