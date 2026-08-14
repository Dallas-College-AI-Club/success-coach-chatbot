"""
===============================================================================
Dallas College Concourse HTML & Document to Markdown Converter Engine
===============================================================================
Author: Antigravity AI / Neftali
Project: Success Coach Chatbot (Issue #90 - Markdown Converter Engine)

Description:
    Converts cleaned Concourse HTML, Catalog Course HTML, PDF, and plain text
    syllabi into clean, standardized Markdown with structured YAML frontmatter.
===============================================================================
"""

import datetime
import re
from pathlib import Path
from bs4 import BeautifulSoup, NavigableString, Tag

try:
    from dallasai.pipeline.html_cleaner import HTMLCleaner, SyllabusHTMLCleaner
except ModuleNotFoundError:
    from apps.data.dallasai.pipeline.html_cleaner import HTMLCleaner, SyllabusHTMLCleaner


class MarkdownConverter:
    """
    Core Markdown conversion engine supporting both Syllabi and Catalog Course pages.
    Preserves tables, lists, headers, and extracts frontmatter metadata.
    """

    def __init__(self):
        self.html_cleaner = HTMLCleaner()
        self.header_pattern = re.compile(r"^h[1-6]$", re.IGNORECASE)

    def clean_html_and_markdown(
        self, raw_html: str, source_url: str = ""
    ) -> tuple[str, str]:
        """
        Cleans HTML, extracts Markdown body, and returns clean (md_str, clean_html_str).
        Auto-detects whether document is a Concourse Syllabus or Catalog Course Page.
        """
        raw_soup = BeautifulSoup(raw_html, "html.parser")
        is_catalog_course = (
            raw_soup.find(id="course_preview_title") is not None
            or "preview_course" in raw_html
        )

        if is_catalog_course:
            return self._clean_catalog_course_and_markdown(raw_html, source_url)

        # Concourse Syllabus Path
        clean_html_body = self.html_cleaner.clean_html(raw_html)
        soup = BeautifulSoup(clean_html_body, "html.parser")
        target_container: Tag | None = (
            soup.find(id="syllabus")
            or soup.find(class_="syl")
            or soup.find(class_="block_content")
            or soup.find("body")
            or soup
        )

        markdown_body = self._parse_element(target_container).strip()
        markdown_body = re.sub(r"\n{3,}", "\n\n", markdown_body)

        metadata = self.extract_metadata_from_html(
            raw_soup, markdown_body, source_url
        )
        doc_id = metadata.get("concourse_id", "UNKNOWN")
        frontmatter = self.generate_frontmatter(metadata)

        header_block_md = (
            f"**Course:** {metadata['course_id']} | **Instructor:** {metadata['instructor']}\n"
            f"**Term:** {metadata['term']} | **Section:** {metadata['section']} | **Credits:** {metadata['credit_hours']}\n"
            f"**Local Concourse File:** `{doc_id}.html`"
        )
        clean_md_str = f"{frontmatter}\n\n{header_block_md}\n\n{markdown_body}"
        clean_html_str = str(target_container) if target_container else ""

        return clean_md_str, clean_html_str

    def _clean_catalog_course_and_markdown(
        self, raw_html: str, source_url: str = ""
    ) -> tuple[str, str]:
        """Cleans and converts a Dallas College Catalog Course HTML page."""
        clean_html_body = self.html_cleaner.clean_html(raw_html)
        soup = BeautifulSoup(clean_html_body, "html.parser")

        # Parse metadata from course_preview_title
        raw_soup = BeautifulSoup(raw_html, "html.parser")
        metadata = self.extract_catalog_course_metadata(raw_soup, source_url)
        frontmatter = self.generate_frontmatter(metadata)

        markdown_body = self._parse_element(soup).strip()
        markdown_body = re.sub(r"\n{3,}", "\n\n", markdown_body)

        header_block_md = (
            f"**Catalog Course:** {metadata['course_code']} - {metadata['title']}\n"
            f"**Credits:** {metadata['credit_hours']} | **Locations:** {metadata['campus_locations']}\n"
            f"**Local Catalog File:** `{Path(source_url).stem if source_url else 'catalog'}.html`"
        )

        clean_md_str = f"{frontmatter}\n\n{header_block_md}\n\n{markdown_body}"
        return clean_md_str, clean_html_body

    def extract_catalog_course_metadata(
        self, soup: BeautifulSoup, source_url: str = ""
    ) -> dict:
        """Extracts structured metadata matching facts-course-v1 schema from catalog HTML."""
        title_el = soup.find(id="course_preview_title") or soup.find("h1")
        raw_title = title_el.get_text().strip() if title_el else ""

        # Pattern: ABDR 1307 - Collision Repair Welding (3 Credit Hours)
        course_code = "UNKNOWN"
        title = "UNKNOWN"
        credit_hours = None

        match = re.search(
            r"([A-Z]{4}\s+\d{4})\s*[\-–:]\s*(.*?)(?:\((\d+(?:\.\d+)?)\s*Credit\s*Hours?\))?$",
            raw_title,
            re.IGNORECASE,
        )
        if match:
            course_code = match.group(1).strip()
            title = match.group(2).strip()
            if match.group(3):
                try:
                    credit_hours = int(float(match.group(3)))
                except ValueError:
                    credit_hours = float(match.group(3))

        # Extract Campus Locations (e.g. Campus Location: EFC, BHC)
        campus_locations = "UNKNOWN"
        camp_el = soup.find(string=re.compile(r"Campus\s+Location", re.IGNORECASE))
        if camp_el and camp_el.parent:
            next_sib = camp_el.parent.find_next_sibling()
            if next_sib:
                campus_locations = next_sib.get_text().strip()

        doc_id = Path(source_url).stem if source_url else ""
        numeric_id = re.search(r"(\d+)", doc_id).group(1) if re.search(r"(\d+)", doc_id) else ""
        if source_url and (source_url.startswith("http://") or source_url.startswith("https://")):
            canon_url = source_url
        elif numeric_id:
            canon_url = f"https://catalog.dallascollege.edu/preview_course_nopop.php?catoid=5&coid={numeric_id}"
        else:
            canon_url = "https://catalog.dallascollege.edu"

        return {
            "source_url": canon_url,
            "extracted_date": datetime.datetime.now().isoformat(),
            "document_type": "course",
            "course_code": course_code,
            "title": title,
            "credit_hours": credit_hours,
            "campus_locations": campus_locations,
        }

    def generate_frontmatter(self, metadata: dict) -> str:
        """Formats metadata dictionary into standardized YAML frontmatter header."""
        lines = ["---"]
        for key, val in metadata.items():
            if isinstance(val, str):
                if ":" in val or "'" in val or '"' in val:
                    val = f'"{val}"'
            lines.append(f"{key}: {val}")
        lines.append("---")
        return "\n".join(lines)

    def html_to_markdown(self, html_content: str, source_url: str = "") -> str:
        """Backward-compatible helper converting HTML content to Markdown string with frontmatter."""
        clean_md_str, _ = self.clean_html_and_markdown(html_content, source_url)
        return clean_md_str

    def text_to_markdown(self, file_path_or_str: str | Path, source_url: str = "") -> str:
        """Backward-compatible helper converting plain text to Markdown string with frontmatter."""
        if isinstance(file_path_or_str, (str, Path)) and Path(file_path_or_str).exists() and Path(file_path_or_str).is_file():
            text_body = Path(file_path_or_str).read_text(encoding="utf-8", errors="ignore")
            url = source_url or str(file_path_or_str)
        else:
            text_body = str(file_path_or_str)
            url = source_url or "plain_text"

        metadata = {
            "source_url": url if (url.startswith("http://") or url.startswith("https://")) else f"local_file:{Path(url).name}",
            "extracted_date": datetime.datetime.now().isoformat(),
            "document_type": "syllabus",
            "course_id": self._infer_course_id_from_text(text_body) or "UNKNOWN",
        }
        frontmatter = self.generate_frontmatter(metadata)
        return f"{frontmatter}\n\n{text_body}"

    def pdf_to_markdown(self, pdf_path: str | Path, source_url: str = "") -> str:
        """Backward-compatible helper extracting text from PDF and returning Markdown string."""
        p = Path(pdf_path)
        extracted_text = ""
        try:
            import pdfplumber
            with pdfplumber.open(p) as pdf:
                pages_text = [page.extract_text() or "" for page in pdf.pages]
                extracted_text = "\n\n".join(pages_text)
        except Exception:
            try:
                import pypdf
                reader = pypdf.PdfReader(p)
                extracted_text = "\n\n".join([page.extract_text() or "" for page in reader.pages])
            except Exception:
                extracted_text = f"Failed to extract text from PDF: {p.name}"

        url = source_url or str(p)
        metadata = {
            "source_url": url if (url.startswith("http://") or url.startswith("https://")) else f"local_file:{p.name}",
            "extracted_date": datetime.datetime.now().isoformat(),
            "document_type": "syllabus",
            "course_id": self._infer_course_id_from_text(extracted_text) or "UNKNOWN",
        }
        frontmatter = self.generate_frontmatter(metadata)
        return f"{frontmatter}\n\n{extracted_text}"

    def extract_metadata_from_html(
        self, soup: BeautifulSoup, markdown_body: str, source_url: str
    ) -> dict:
        """Infers metadata for Concourse syllabi."""
        course_id = self._infer_course_id_from_text(markdown_body)
        if not course_id and soup.title:
            course_id = self._infer_course_id_from_text(soup.title.string)

        instructor = None
        meta_kw = soup.find("meta", attrs={"name": "keywords"})
        if meta_kw and meta_kw.get("content"):
            keywords_str = meta_kw["content"]
            kw_parts = [k.strip() for k in keywords_str.split(",")]

            skip_words = {
                "dallas", "college", "syllabus", "syllabi", "concourse",
                "government", "composition", "nursing", "welding", "business",
                "biology", "history", "english", "course", "outline", "system",
                "management", "template", "sample", "example", "master",
                "online", "spring", "summer", "fall", "winter", "2024", "2025",
                "2026", "2027", "govt", "biol", "bcis", "engl", "rnsg", "wdlg"
            }

            for part in kw_parts:
                part_clean = part.strip()
                if any(char.isdigit() for char in part_clean):
                    continue
                if any(w in part_clean.lower() for w in skip_words):
                    continue
                if len(part_clean.split()) >= 2:
                    instructor = part_clean
                    break

        if not instructor:
            inst_match = re.search(
                r"Instructor:\s*([A-Z][a-zA-Z\.\-']+(?:\s+[A-Z][a-zA-Z\.\-']+)+)",
                markdown_body,
                re.IGNORECASE,
            )
            if inst_match:
                instructor = inst_match.group(1).strip()

        term_match = re.search(
            r"(Spring|Summer|Fall|Winter)\s+\d{4}", markdown_body, re.IGNORECASE
        )
        term = term_match.group(0) if term_match else "Spring 2026"

        section_match = re.search(
            r"Section\s+(\d+)", markdown_body, re.IGNORECASE
        )
        section = section_match.group(1) if section_match else None

        credits_match = re.search(
            r"(\d+)\s+Credits?", markdown_body, re.IGNORECASE
        )
        credits = credits_match.group(1) if credits_match else None

        if source_url and (source_url.startswith("http://") or source_url.startswith("https://")):
            local_ref = source_url
            doc_id = Path(source_url.split("?")[0]).stem
        else:
            doc_id = Path(source_url).stem if source_url else ""
            numeric_id = re.search(r"(\d+)", doc_id).group(1) if re.search(r"(\d+)", doc_id) else ""
            if numeric_id:
                local_ref = f"https://concourse.dallascollege.edu/syllabus/view/{numeric_id}"
            else:
                local_ref = "https://concourse.dallascollege.edu"

        return {
            "source_url": local_ref,
            "concourse_id": doc_id if doc_id.isdigit() else "UNKNOWN",
            "extracted_date": datetime.datetime.now().isoformat(),
            "document_type": "syllabus",
            "course_id": course_id or "UNKNOWN",
            "instructor": instructor or "UNKNOWN",
            "term": term,
            "section": section or "UNKNOWN",
            "credit_hours": credits or "UNKNOWN",
        }

    def _parse_element(self, element) -> str:
        """Recursively processes HTML elements and maps them to Markdown syntax."""
        if element.name is None:
            return element.string if element.string else ""

        tag_name = element.name.lower()

        if tag_name == "table":
            return self._convert_table_to_markdown(element)

        child_markdown = "".join(
            self._parse_element(child) for child in element.children
        )

        if self.header_pattern.match(tag_name):
            level = int(tag_name[1])
            return f"\n\n{'#' * level} {child_markdown.strip()}\n\n"

        elif tag_name == "p":
            return f"\n\n{child_markdown.strip()}\n\n"

        elif tag_name == "br":
            return "\n" + child_markdown

        elif tag_name in ["strong", "b"]:
            return f"**{child_markdown.strip()}**" if child_markdown.strip() else ""

        elif tag_name in ["em", "i"]:
            return f"*{child_markdown.strip()}*" if child_markdown.strip() else ""

        elif tag_name == "a":
            href = element.get("href", "")
            if child_markdown.strip() and href:
                if not (href.startswith("http://") or href.startswith("https://") or href.startswith("mailto:")):
                    clean_href = href.lstrip("./")
                    if clean_href.startswith("/"):
                        href = f"https://catalog.dallascollege.edu{clean_href}"
                    else:
                        href = f"https://catalog.dallascollege.edu/{clean_href}"
                return f" [{child_markdown.strip()}]({href}) "
            return child_markdown

        elif tag_name in ["ul", "ol"]:
            return f"\n\n{child_markdown}\n\n"

        elif tag_name == "li":
            parent_name = element.parent.name.lower() if element.parent else "ul"
            if parent_name == "ol":
                siblings = [sib for sib in element.parent.children if sib.name == "li"]
                # identity, not equality: BeautifulSoup compares tags by
                # value, so duplicate <li> markup reused an earlier ordinal
                idx = next((n for n, s in enumerate(siblings, 1)
                            if s is element), 1)
                return f"{idx}. {child_markdown.strip()}\n"
            return f"- {child_markdown.strip()}\n"

        elif tag_name == "hr":
            return "\n\n---\n\n"

        else:
            return child_markdown

    def _convert_table_to_markdown(self, table_element) -> str:
        """Converts HTML <table> element into Markdown pipe table."""
        rows = [r for r in table_element.find_all("tr")
                if r.find_parent("table") is table_element]
        if not rows:
            return ""

        markdown_rows = []
        for i, row in enumerate(rows):
            cells = [c for c in row.find_all(["th", "td"])
                     if c.find_parent("table") is table_element]
            cell_texts = []
            for cell in cells:
                # <br> carries meaning in schedule cells: plain get_text()
                # fuses "August 26<br>August 28" into one dead token. Build the
                # text instead of mutating the tree -- clean_html_str is
                # serialised from this same soup further down.
                parts = [
                    " " if getattr(node, "name", None) == "br" else str(node)
                    for node in cell.descendants
                    if isinstance(node, NavigableString)
                    or getattr(node, "name", None) == "br"
                ]
                text = " ".join("".join(parts).split())
                cell_texts.append(text if text else " ")

            if not cell_texts:
                continue

            markdown_row = "| " + " | ".join(cell_texts) + " |"
            markdown_rows.append(markdown_row)

            if i == 0:
                separator = "| " + " | ".join(["---"] * len(cell_texts)) + " |"
                markdown_rows.append(separator)

        return "\n\n" + "\n".join(markdown_rows) + "\n\n"

    def _infer_course_id_from_text(self, text: str) -> str | None:
        """Infers course ID (e.g. GOVT-2306) from text."""
        if not text:
            return None
        match = re.search(r"([A-Z]{4})[\s-]?(\d{4})", text)
        if match:
            return f"{match.group(1)}-{match.group(2)}"
        return None
