"""
===============================================================================
Dallas College Concourse & Catalog HTML Cleaner Module
===============================================================================
Author: Antigravity AI / Neftali
Project: Success Coach Chatbot (Issue #90 - HTML Cleaning Engine)

Description:
    Strips non-academic UI wrapper noise from both Concourse Syllabi and Dallas
    College Course Catalog pages, reducing payload size by 90%+ while preserving
    core academic content and DOM structure.
===============================================================================
"""

import argparse
import re
from pathlib import Path
from bs4 import BeautifulSoup, Tag


class HTMLCleaner:
    """
    Unified DOM cleaning engine supporting both Dallas College Concourse Syllabi
    and Catalog Course preview pages. Both document types share common HTML noise reduction
    patterns (stripping scripts, footers, navigation wrappers, and text normalization) while
    preserving structural academic headers and course metadata DOM nodes.
    """

    def clean_html(self, raw_html: str) -> str:
        """
        Cleans raw Concourse syllabus or Catalog course HTML by removing wrapper boilerplate.

        Args:
            raw_html (str): Full uncleaned HTML string.

        Returns:
            str: Cleaned HTML containing only the core content DOM structure.
        """
        soup = BeautifulSoup(raw_html, "html.parser")

        # Step 1: Remove script, style, iframe, and noscript elements
        for element in soup(["script", "style", "iframe", "noscript", "svg"]):
            element.decompose()

        # Step 2: Detect if this is a Catalog Course page
        is_catalog_course = (
            soup.find(id="course_preview_title") is not None
            or "preview_course" in raw_html
        )

        if is_catalog_course:
            return self._clean_catalog_course_html(soup)

        # Step 3: Concourse Syllabus Cleaning Path
        noise_selectors = [
            "div.skip-links",
            "div#header",
            "div#footer",
            "div#navigation",
            "div#menu",
            "div.nav",
            "div.action-buttons",
            "div.print-icon",
            "form",
            "nav",
            "header",
            "footer",
            "aside",
        ]
        for selector in noise_selectors:
            for element in soup.select(selector):
                element.decompose()

        target_container: Tag | None = (
            soup.find(id="syllabus")
            or soup.find(class_="syl")
            or soup.find(class_="block_content")
            or soup.find("body")
            or soup
        )

        for el in target_container.find_all(["header", "footer", "nav", "aside"]):
            el.decompose()

        self._strip_noise_categories(target_container)
        self._truncate_institutional_policies(target_container)

        return str(target_container)

    def _clean_catalog_course_html(self, soup: BeautifulSoup) -> str:
        """Isolates the core course preview block from a catalog course HTML page."""
        title_el = soup.find(id="course_preview_title")
        target_container = None
        if title_el:
            target_container = title_el.find_parent("td", class_="block_content") or title_el.parent

        if not target_container:
            target_container = soup.find("td", class_="block_content") or soup.find("body") or soup

        # Collect elements to decompose first
        to_decompose = []
        for el in target_container.find_all(True):
            if not isinstance(el, Tag):
                continue
            el_id = str(el.get("id") or "")
            el_class = " ".join(el.get("class", [])) if el.get("class") else ""
            href = str(el.get("href") or "")
            onclick = str(el.get("onclick") or "")

            if any(k in el_id or k in el_class or k in href or k in onclick for k in ["gateway-toolbar", "portfolio", "print", "help"]):
                to_decompose.append(el)

        for el in to_decompose:
            if el.parent:
                el.decompose()

        return str(target_container)

    def _strip_noise_categories(self, container: Tag) -> None:
        """Decomposes state objective headings while preserving academic course descriptions."""
        noise_pattern = re.compile(
            r"state-defined\s+learning\s+outcomes|texas\s+core\s+objectives",
            re.IGNORECASE,
        )
        for element in container.find_all(["h1", "h2", "h3", "h4", "div"]):
            text = element.get_text(strip=True)
            if noise_pattern.search(text):
                parent_item = element.find_parent(class_=re.compile(r"syl-item"))
                if parent_item:
                    parent_item.decompose()
                else:
                    element.decompose()

    def _truncate_institutional_policies(self, container: Tag) -> None:
        """Truncates document at generic district disclaimers and footers."""
        cutoff_pattern = re.compile(
            r"dallas\s+college\s+policies|institutional\s+policies|district\s+policies|support\s+contacts",
            re.IGNORECASE,
        )
        for element in container.find_all(["h1", "h2", "h3", "h4", "div"]):
            text = element.get_text(strip=True)
            if cutoff_pattern.search(text):
                parent_item = element.find_parent(class_=re.compile(r"syl-item"))
                target_elem = parent_item if parent_item else element
                siblings = list(target_elem.find_next_siblings())
                for sib in siblings:
                    sib.decompose()
                target_elem.decompose()
                break


def main() -> None:
    import sys
    parser = argparse.ArgumentParser(
        description="HTML Cleaner CLI tool for Syllabi and Catalog Course pages."
    )
    parser.add_argument("-i", "--input", required=True, help="Input HTML file/dir")
    parser.add_argument("-o", "--output", required=False, help="Output HTML file/dir")

    args = parser.parse_args()
    input_path = Path(args.input)
    cleaner = SyllabusHTMLCleaner()

    if not input_path.exists():
        print(f"Error: Input path '{input_path}' does not exist.", file=sys.stderr)
        sys.exit(1)

    if input_path.is_file():
        raw = input_path.read_text(encoding="utf-8", errors="ignore")
        cleaned = cleaner.clean_html(raw)
        out_path = Path(args.output) if args.output else input_path.parent / f"{input_path.stem}_clean.html"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(cleaned, encoding="utf-8")
        print(f"Cleaned HTML written to: {out_path}")
    elif input_path.is_dir():
        out_dir = Path(args.output) if args.output else input_path / "cleaned"
        out_dir.mkdir(parents=True, exist_ok=True)
        html_files = list(input_path.glob("**/*.html")) + list(input_path.glob("**/*.htm"))
        count = 0
        for html_file in html_files:
            rel_path = html_file.relative_to(input_path)
            target_file = out_dir / rel_path.parent / f"{html_file.stem}_clean.html"
            target_file.parent.mkdir(parents=True, exist_ok=True)
            raw = html_file.read_text(encoding="utf-8", errors="ignore")
            cleaned = cleaner.clean_html(raw)
            target_file.write_text(cleaned, encoding="utf-8")
            count += 1
        print(f"Processed {count} HTML files in directory '{input_path}' -> '{out_dir}'")


# Backward compatibility alias
SyllabusHTMLCleaner = HTMLCleaner

if __name__ == "__main__":
    main()
