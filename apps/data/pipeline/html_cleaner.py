"""
===============================================================================
HTML Cleaner & Boilerplate Truncation Module
===============================================================================
Author: Antigravity AI / Neftali
Project: Success Coach Chatbot (Issue #90 - Data Preprocessing Engine)

Description:
    This module provides a standalone HTML cleaning engine (`HTMLCleaner`) that
    strips web layout noise (<script>, <style>, navbars, header logos) and
    truncates district-wide institutional policy boilerplate from raw Concourse
    syllabus HTML documents.

    It isolates the core course syllabus DOM container (`id="syllabus"`) and
    emits a clean, high-density HTML string (`clean_syllabus.html`) ready for:
      1. Section 2 Markdown Conversion (Issue #90).
      2. Issue #61 Rule-Based $0 JSON Harvesting.

Usage (API):
    from apps.data.pipeline.html_cleaner import HTMLCleaner
    cleaner = HTMLCleaner()
    clean_html = cleaner.clean_html(raw_html_string)

Usage (CLI):
    python apps/data/pipeline/html_cleaner.py --input path/to/file.html --output path/to/clean.html
    python apps/data/pipeline/html_cleaner.py --input path/to/html_dir/ --output path/to/clean_dir/
===============================================================================
"""

import argparse
import re
import sys
import glob
from pathlib import Path
from typing import Optional
from bs4 import BeautifulSoup, Comment, Tag


class HTMLCleaner:
    """
    DOM Cleaning Engine for Concourse Syllabus HTML documents.
    """

    def __init__(self) -> None:
        """Initialize cleaner with default unwanted HTML tags."""
        self.unwanted_tags: list[str] = [
            "script", "style", "iframe", "noscript", "form",
            "button", "input", "select", "svg"
        ]

    def clean_html(self, raw_html: str) -> str:
        """
        Cleans a raw Concourse HTML string and returns the sanitized HTML string.

        Args:
            raw_html (str): The raw HTML string scraped from Concourse.

        Returns:
            str: Sanitized, high-density HTML containing only course facts.
        """
        soup = BeautifulSoup(raw_html, "html.parser")

        # Step 1: Remove completely non-content HTML tags
        for tag in soup.find_all(self.unwanted_tags):
            tag.decompose()

        # Step 2: Remove HTML comments
        for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
            comment.extract()

        # Step 3: Target the core syllabus content container
        target_container: Optional[Tag] = (
            soup.find(id="syllabus")
            or soup.find(class_="syl")
            or soup.find(class_="block_content")
            or soup.find("body")
            or soup
        )

        # Step 4: Decompose layout header, footer, navigation, and sidebar elements
        for el in target_container.find_all(["header", "footer", "nav", "aside"]):
            el.decompose()

        # Step 5: Decompose non-course noise sections
        self._strip_noise_categories(target_container)

        # Step 6: Truncate at district-wide institutional policy footers
        self._truncate_institutional_policies(target_container)

        return str(target_container)

    def _strip_noise_categories(self, container: Tag) -> None:
        """Decomposes state objective headings and redundant course descriptions."""
        noise_pattern = re.compile(
            r'state-defined\s+learning\s+outcomes|texas\s+core\s+objectives|course\s+description',
            re.IGNORECASE
        )
        for element in container.find_all(['h1', 'h2', 'h3', 'h4', 'div']):
            text = element.get_text(strip=True)
            if noise_pattern.search(text):
                parent_item = element.find_parent(class_=re.compile(r'syl-item'))
                if parent_item:
                    parent_item.decompose()
                else:
                    element.decompose()

    def _truncate_institutional_policies(self, container: Tag) -> None:
        """Truncates document at generic district disclaimers and footers."""
        cutoff_pattern = re.compile(
            r'dallas\s+college\s+policies|institutional\s+policies|district\s+policies|support\s+contacts',
            re.IGNORECASE
        )
        for element in container.find_all(['h1', 'h2', 'h3', 'h4', 'div']):
            text = element.get_text(strip=True)
            if cutoff_pattern.search(text):
                parent_item = element.find_parent(class_=re.compile(r'syl-item'))
                target_elem = parent_item if parent_item else element
                siblings = list(target_elem.find_next_siblings())
                for sib in siblings:
                    sib.decompose()
                target_elem.decompose()
                break


def main() -> None:
    """CLI Entry Point with Argparse for Reusability and Scalability."""
    parser = argparse.ArgumentParser(
        description="HTML Cleaner & Boilerplate Truncation CLI tool."
    )
    parser.add_argument(
        "-i", "--input", required=True,
        help="Path to an input HTML file OR directory of HTML files."
    )
    parser.add_argument(
        "-o", "--output", required=False,
        help="Path to an output HTML file OR directory. Defaults to <input_stem>_clean.html"
    )

    args = parser.parse_args()
    input_path = Path(args.input)

    if not input_path.exists():
        print(f"Error: Input path '{input_path}' does not exist.")
        sys.exit(1)

    cleaner = HTMLCleaner()

    if input_path.is_file():
        with open(input_path, "r", encoding="utf-8", errors="ignore") as f:
            raw_html = f.read()

        clean_html = cleaner.clean_html(raw_html)
        out_file = Path(args.output) if args.output else input_path.with_name(f"{input_path.stem}_clean.html")
        out_file.parent.mkdir(parents=True, exist_ok=True)

        with open(out_file, "w", encoding="utf-8") as f:
            f.write(clean_html)
        print(f"SUCCESS: Clean HTML written to {out_file.resolve()}")

    elif input_path.is_dir():
        out_dir = Path(args.output) if args.output else input_path.parent / f"{input_path.name}_cleaned"
        out_dir.mkdir(parents=True, exist_ok=True)

        files = glob.glob(str(input_path / "*.html"))
        print(f"Cleaning {len(files)} HTML files from '{input_path}' -> '{out_dir}'...")

        count = 0
        for filepath in files:
            p = Path(filepath)
            with open(p, "r", encoding="utf-8", errors="ignore") as f:
                raw_html = f.read()

            clean_html = cleaner.clean_html(raw_html)
            out_file = out_dir / f"{p.stem}_clean.html"
            with open(out_file, "w", encoding="utf-8") as f:
                f.write(clean_html)
            count += 1

        print(f"SUCCESS: Cleaned {count} HTML files in {out_dir.resolve()}")


if __name__ == "__main__":
    main()
