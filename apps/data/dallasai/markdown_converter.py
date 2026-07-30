"""
Document Ingestion & Markdown Conversion Engine.

Converts raw scraped catalog pages, plain text syllabi, and Concourse HTML/PDF
files into standardized, GitHub-Flavored Markdown (.md) pre-pended with YAML
frontmatter metadata blocks.

Design Constraints:
1. Safe to Run: Decomposes active scripts, styles, frames, and interactive elements.
2. Context Integrity: Selectively bypasses layout stripping for syllabus pages to
   protect policy, contact, and accommodation details.
3. Parser Robustness: Dynamically isolates core content containers and handles
   tag-nesting anomalies.
"""

import datetime
import re
from pathlib import Path

from bs4 import BeautifulSoup
from pypdf import PdfReader


class MarkdownConverter:
    """
    Parser for HTML, PDF, and plain text catalog/syllabus files.
    """

    def __init__(self):
        # HTML tag mappings to their markdown representations
        self.header_pattern = re.compile(r"^h([1-6])$")

    def html_to_markdown(self, html_content: str, source_url: str = "") -> str:
        """
        Converts raw HTML string into clean Markdown.
        Strips away web boilerplate, truncates footers at Dallas College Policies,
        and targets the main content wrapper.
        """
        md, _ = self.clean_html_and_markdown(html_content, source_url)
        return md

    def clean_html_and_markdown(
        self, html_content: str, source_url: str = ""
    ) -> tuple[str, str]:
        """
        Processes raw HTML string and returns a tuple of (clean_markdown, clean_html).
        Enforces 3 Structural Preprocessing Rules:
        1. Line break <br> unrolling in table cells
        2. Strict GFM pipe table preservation
        3. UTF-8 encoding compliance
        """
        from dallasai.pipeline.html_cleaner import HTMLCleaner

        raw_soup = BeautifulSoup(html_content, "html.parser")
        cleaner = HTMLCleaner()
        clean_html_str = cleaner.clean_html(html_content)

        soup = BeautifulSoup(clean_html_str, "html.parser")

        # Step 1: Pre-process table cells (Rule 1: Unroll <br> tags in cells to spaces)
        for cell in soup.find_all(["td", "th"]):
            for br in cell.find_all(["br"]):
                br.replace_with(", ")

        # Step 2: Target the core content container
        target_container = (
            soup.find(id="syllabus")
            or soup.find(class_="syl")
            or soup.find(class_="block_content")
            or soup.find("body")
            or soup
        )

        # Step 3: Convert HTML elements to Markdown recursively
        markdown_body = self._parse_element(target_container)

        # Post-processing: clean up extra spaces and newlines
        markdown_body = re.sub(r"\n{3,}", "\n\n", markdown_body).strip()

        # Step 4: Extract metadata using raw_soup (to preserve meta tags)
        metadata = self.extract_metadata_from_html(
            raw_soup, markdown_body, source_url
        )
        local_ref = metadata["source_url"]
        doc_id = metadata.get("concourse_id", "UNKNOWN")
        frontmatter = self.generate_frontmatter(metadata)

        # Append explicit unstated markers for optional policies if missing in markdown body
        unstated_markers = []
        if not re.search(r"late\s+work", markdown_body, re.IGNORECASE):
            unstated_markers.append(
                "*Late Work Policy: Not stated in syllabus*"
            )
        if not re.search(
            r"graded\s+work|grading\s+scale|grading\s+criteria",
            markdown_body,
            re.IGNORECASE,
        ):
            unstated_markers.append(
                "*Grading Criteria: Not stated in syllabus*"
            )
        if not re.search(r"attendance", markdown_body, re.IGNORECASE):
            unstated_markers.append(
                "*Attendance Policy: Not stated in syllabus*"
            )

        policy_notes = (
            ("\n\n## Policy Status Notes\n---\n" + "\n".join(unstated_markers))
            if unstated_markers
            else ""
        )

        # Structured course header block
        header_block_md = (
            f"**Course:** {metadata['course_id']} | **Instructor:** {metadata['instructor']}\n"
            f"**Term:** {metadata['term']} | **Section:** {metadata['section']} | **Credits:** {metadata['credit_hours']}\n"
            f"📄 **Local Concourse File:** `{doc_id}.html`"
        )
        clean_md_str = f"{frontmatter}\n\n{header_block_md}\n\n{markdown_body}{policy_notes}"

        # Inject metadata header into Clean HTML header
        if target_container:
            link_html = (
                f'<div class="concourse-metadata-header mb-3" style="background:#f8f9fa; padding:12px; border-radius:6px; border:1px solid #dee2e6;">\n'
                f"  <p><strong>Course:</strong> {metadata['course_id']} | <strong>Instructor:</strong> {metadata['instructor']}</p>\n"
                f"  <p><strong>Term:</strong> {metadata['term']} | <strong>Section:</strong> {metadata['section']} | <strong>Credits:</strong> {metadata['credit_hours']}</p>\n"
                f"  <p>📄 <strong>Local Concourse File:</strong> <code>{doc_id}.html</code></p>\n"
                f"</div>"
            )
            clean_html_str = f"{link_html}\n{target_container!s}"
        else:
            clean_html_str = str(target_container)

        return clean_md_str, clean_html_str

    def pdf_to_markdown(self, pdf_path: Path, source_url: str = "") -> str:
        """
        Extracts raw text page-by-page from a PDF file using pypdf
        and applies basic markdown formatting (e.g. restoring syllabus headers).
        """
        reader = PdfReader(pdf_path)
        pages_text = []

        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                pages_text.append(f"<!-- Page {i + 1} -->\n{text}")

        raw_text = "\n\n".join(pages_text)

        # Basic layout preservation: format headings
        # Syllabi headers are often on single lines. Let's make lines that look like
        # common syllabus sections (e.g. "Grading Criteria", "Required Materials") markdown headers.
        formatted_text = self._format_raw_text(raw_text)

        # Extract metadata
        course_id = self._infer_course_id_from_text(
            formatted_text
        ) or self._infer_course_id_from_filename(pdf_path.name)
        metadata = {
            "source_url": source_url or pdf_path.name,
            "extracted_date": datetime.datetime.now().isoformat(),
            "document_type": "syllabus",
            "course_id": course_id,
        }

        frontmatter = self.generate_frontmatter(metadata)
        return f"{frontmatter}\n\n{formatted_text}"

    def text_to_markdown(self, file_path: Path, source_url: str = "") -> str:
        """
        Converts a plain text file into Markdown by applying basic formatting
        and prepending structured frontmatter.
        """
        with open(file_path, "r", encoding="utf-8") as f:
            raw_text = f.read()

        formatted_text = self._format_raw_text(raw_text)

        course_id = self._infer_course_id_from_text(
            formatted_text
        ) or self._infer_course_id_from_filename(file_path.name)
        metadata = {
            "source_url": source_url or file_path.name,
            "extracted_date": datetime.datetime.now().isoformat(),
            "document_type": "syllabus"
            if "syllabus" in file_path.name.lower()
            or "biol" in file_path.name.lower()
            else "general",
            "course_id": course_id,
        }

        frontmatter = self.generate_frontmatter(metadata)
        return f"{frontmatter}\n\n{formatted_text}"

    def generate_frontmatter(self, metadata: dict) -> str:
        """
        Generates YAML frontmatter block from a dictionary of metadata.
        """
        lines = ["---"]
        for key, val in metadata.items():
            # Escape strings if they contain colons or quotes
            if isinstance(val, str):
                if ":" in val or "'" in val or '"' in val:
                    val = f'"{val}"'
            lines.append(f"{key}: {val}")
        lines.append("---")
        return "\n".join(lines)

    def extract_metadata_from_html(
        self, soup: BeautifulSoup, markdown_body: str, source_url: str
    ) -> dict:
        """
        Infers metadata like course ID, instructor name, term, section, credit hours,
        and document type from the HTML context and meta tags.
        """
        # 1. Infer course ID (e.g. GOVT-2306, BIOL-1406)
        course_id = self._infer_course_id_from_text(markdown_body)
        if not course_id and soup.title:
            course_id = self._infer_course_id_from_text(soup.title.string)

        # 2. Extract Instructor Name from meta[name="keywords"] or DOM
        instructor = None
        meta_kw = soup.find("meta", attrs={"name": "keywords"})
        if meta_kw and meta_kw.get("content"):
            keywords_str = meta_kw["content"]
            kw_parts = [k.strip() for k in keywords_str.split(",")]

            # Exclude known subject/institutional keywords
            skip_words = {
                "dallas",
                "college",
                "syllabus",
                "syllabi",
                "concourse",
                "government",
                "composition",
                "nursing",
                "welding",
                "business",
                "biology",
                "history",
                "english",
                "course",
                "outline",
                "system",
                "management",
                "template",
                "sample",
                "example",
                "master",
                "online",
                "spring",
                "summer",
                "fall",
                "winter",
                "2024",
                "2025",
                "2026",
                "2027",
                "govt",
                "biol",
                "bcis",
                "engl",
                "rnsg",
                "wdlg",
                "2306",
                "1406",
                "1305",
                "1301",
                "2443",
                "1144",
            }

            for part in kw_parts:
                part_clean = part.strip()
                # Check if contains excluded keywords or digits
                if any(char.isdigit() for char in part_clean):
                    continue
                if any(w in part_clean.lower() for w in skip_words):
                    continue

                # Match human names (allows hyphens, dots, prefixes, 2-4 words)
                if re.match(
                    r"^(?:Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)?\s*[A-Z][a-zA-Z\.\-']+(?:\s+[A-Z][a-zA-Z\.\-']+)+$",
                    part_clean,
                ):
                    instructor = part_clean
                    break

        # Fallback instructor regex search in text
        if not instructor:
            inst_match = re.search(
                r"Instructor:\s*([A-Z][a-zA-Z\.\-']+(?:\s+[A-Z][a-zA-Z\.\-']+)+)",
                markdown_body,
                re.IGNORECASE,
            )
            if inst_match:
                instructor = inst_match.group(1).strip()

        # 3. Extract Term, Section, Credit Hours
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

        # 4. Store local scraped file reference without inventing broken external URLs
        doc_id = Path(source_url).stem if source_url else ""
        if doc_id:
            local_ref = f"local_file:{doc_id}.html"
        else:
            local_ref = source_url or "local_file:unknown.html"

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

    # -------------------------------------------------------------------------
    # Internal HTML Element Parser (Recursive BeautifulSoup Traversal)
    # -------------------------------------------------------------------------
    def _parse_element(self, element) -> str:
        """
        Recursively processes HTML elements and maps them to Markdown syntax.
        """
        # If it's a NavigableString (text node), just return its text
        if element.name is None:
            return element.string if element.string else ""

        tag_name = element.name.lower()

        # If it is a table, convert it completely and do not recurse children normally
        if tag_name == "table":
            return self._convert_table_to_markdown(element)

        # For all other tags, recursively parse children first to build child markdown
        child_markdown = "".join(
            self._parse_element(child) for child in element.children
        )

        # Apply specific tag conversion rules
        if self.header_pattern.match(tag_name):
            # Headers: <h1> -> #, <h2> -> ##, etc.
            level = int(tag_name[1])
            return f"\n\n{'#' * level} {child_markdown.strip()}\n\n"

        elif tag_name == "p":
            return f"\n\n{child_markdown.strip()}\n\n"

        elif tag_name == "br":
            # Return a newline and parse any nested children. Unclosed <br> tags in malformed
            # HTML can cause BS4's html.parser to nested subsequent sibling elements (like tables)
            # inside the <br> tag. Recursing prevents those children from being silently dropped.
            return "\n" + child_markdown

        elif tag_name in ["strong", "b"]:
            return (
                f"**{child_markdown.strip()}**"
                if child_markdown.strip()
                else ""
            )

        elif tag_name in ["em", "i"]:
            return (
                f"*{child_markdown.strip()}*" if child_markdown.strip() else ""
            )

        elif tag_name == "a":
            href = element.get("href", "")
            if child_markdown.strip() and href:
                if href.startswith("/"):
                    href = f"https://catalog.dallascollege.edu{href}"
                return f" [{child_markdown.strip()}]({href}) "
            return child_markdown

        elif tag_name in ["ul", "ol"]:
            return f"\n\n{child_markdown}\n\n"

        elif tag_name == "li":
            parent_name = (
                element.parent.name.lower() if element.parent else "ul"
            )
            if parent_name == "ol":
                siblings = [
                    sib for sib in element.parent.children if sib.name == "li"
                ]
                idx = siblings.index(element) + 1 if element in siblings else 1
                return f"{idx}. {child_markdown.strip()}\n"
            return f"- {child_markdown.strip()}\n"

        elif tag_name == "hr":
            return "\n\n---\n\n"

        else:
            # Fallback for divs, spans, and cells outside tables: preserve children markdown
            return child_markdown

    def _convert_table_to_markdown(self, table_element) -> str:
        """
        Parses an HTML <table> element and builds a GitHub Flavored Markdown (GFM) table.
        """
        rows = table_element.find_all("tr")
        if not rows:
            return ""

        markdown_rows = []
        max_cols = 0
        headers_found = False

        for row in rows:
            # Find cells (either th or td)
            cells = row.find_all(["th", "td"])
            if not cells:
                continue

            # Process text in each cell, stripping extra padding and converting internal tags
            cell_contents = []
            for cell in cells:
                # Recursively parse tags inside the cell (e.g. bold, italics, inline links)
                cell_text = "".join(
                    self._parse_element(child) for child in cell.children
                )
                # Escape pipe characters inside table cells to prevent Markdown grid corruption
                cell_text = (
                    cell_text.strip().replace("\n", " ").replace("|", "\\|")
                )
                cell_contents.append(cell_text)

            max_cols = max(max_cols, len(cell_contents))

            # Check if this row is a header row (all <th> tags or the first row)
            is_header = all(c.name == "th" for c in cells) or (
                not headers_found and len(markdown_rows) == 0
            )

            markdown_rows.append((cell_contents, is_header))
            if is_header:
                headers_found = True

        if not markdown_rows:
            return ""

        # Build table parts
        final_table = []

        # 1. Header row
        header_row, _ = markdown_rows[0]
        # Pad column count if needed
        if len(header_row) < max_cols:
            header_row.extend([""] * (max_cols - len(header_row)))

        final_table.append("| " + " | ".join(header_row) + " |")

        # 2. Divider row
        dividers = ["---"] * max_cols
        final_table.append("| " + " | ".join(dividers) + " |")

        # 3. Data rows
        start_idx = 1 if headers_found else 0
        for i in range(start_idx, len(markdown_rows)):
            row_cells, _ = markdown_rows[i]
            if len(row_cells) < max_cols:
                row_cells.extend([""] * (max_cols - len(row_cells)))
            final_table.append("| " + " | ".join(row_cells) + " |")

        return "\n".join(final_table)

    # -------------------------------------------------------------------------
    # Text Analysis & Regular Expression Heuristics
    # -------------------------------------------------------------------------
    def _format_raw_text(self, text: str) -> str:
        """
        Cleans up raw extracted PDF/TXT syllabus text, highlighting section headings.
        """
        lines = text.split("\n")
        formatted_lines = []

        # Common syllabus headers
        header_keywords = [
            "course syllabus",
            "instructor information",
            "grading criteria",
            "grading scale",
            "grading policy",
            "course schedule",
            "course information",
            "course requirements",
            "attendance policy",
            "required materials",
            "tentative calendar",
            "disabilities accommodation",
            "academic integrity",
            "student support services",
            "course description",
            "learning outcomes",
        ]

        for line in lines:
            line_strip = line.strip()

            # If the line already starts with a Markdown header tag, preserve it as is
            if line_strip.startswith("#"):
                formatted_lines.append(line)
                continue

            # If the line is short, matches a known heading title, and doesn't end with a period
            if len(line_strip) > 3 and len(line_strip) < 60:
                is_header = False
                # Direct check against keywords
                for kw in header_keywords:
                    if kw in line_strip.lower():
                        is_header = True
                        break
                # Check regex: e.g. "Section I: Course Details" or "1. Introduction"
                if re.match(
                    r"^(?:[I|V|X\d]+\.|\bWeek\s+\d+|[A-Z\s\-]+:)", line_strip
                ):
                    is_header = True

                # Check capitalized headers
                if line_strip.isupper() and len(line_strip) > 5:
                    is_header = True

                if is_header:
                    formatted_lines.append(f"\n\n## {line_strip}\n")
                    continue

            formatted_lines.append(line)

        return "\n".join(formatted_lines)

    def _infer_course_id_from_text(self, text: str) -> str | None:
        """
        Uses regular expression matching to locate standard course codes
        (e.g., 'ACCT 2301', 'BIOL-1406').
        """
        # Match pattern: 4 capital letters, space or hyphen, 4 numbers
        # Boundaries are relaxed to ensure we match unspaced combinations (e.g. 'IBIOL-1406').
        match = re.search(r"([A-Z]{4})[\s-]?(\d{4})", text)
        if match:
            return f"{match.group(1)}-{match.group(2)}"
        return None

    def _infer_course_id_from_filename(self, filename: str) -> str | None:
        """
        Uses filename format (e.g. biol_1406_doe.txt) to infer the course code.
        """
        # Boundaries are relaxed to ensure we match unspaced combinations.
        match = re.search(r"([a-zA-Z]{4})_?(\d{4})", filename)
        if match:
            return f"{match.group(1).upper()}-{match.group(2)}"
        return None


if __name__ == "__main__":
    import argparse
    import glob

    parser = argparse.ArgumentParser(
        description="Reusable HTML/PDF to Clean Markdown Converter CLI tool."
    )
    parser.add_argument(
        "-i",
        "--input",
        required=True,
        help="Path to an input HTML/PDF file OR directory of HTML/PDF files.",
    )
    parser.add_argument(
        "-o",
        "--output",
        required=False,
        help="Path to output Markdown file OR directory. Defaults to stdout or <input_stem>.md",
    )
    parser.add_argument(
        "-u",
        "--url",
        required=False,
        default="",
        help="Optional source URL or local reference to inject into frontmatter metadata.",
    )

    args = parser.parse_args()
    input_path = Path(args.input)

    if not input_path.exists():
        print(f"Error: Input path '{input_path}' does not exist.")
        sys.exit(1)

    converter = MarkdownConverter()

    if input_path.is_file():
        ext = input_path.suffix.lower()
        if ext in (".html", ".htm"):
            with open(input_path, "r", encoding="utf-8", errors="ignore") as f:
                html_data = f.read()
            clean_md, clean_html = converter.clean_html_and_markdown(
                html_data, source_url=args.url or input_path.name
            )
        elif ext == ".pdf":
            clean_md = converter.pdf_to_markdown(input_path, args.url)
        else:
            clean_md = converter.text_to_markdown(input_path, args.url)

        if args.output:
            out_file = Path(args.output)
            out_file.parent.mkdir(parents=True, exist_ok=True)
            with open(out_file, "w", encoding="utf-8") as f:
                f.write(clean_md)
            print(f"SUCCESS: Clean Markdown written to {out_file.resolve()}")
        else:
            print(clean_md)

    elif input_path.is_dir():
        out_dir = (
            Path(args.output)
            if args.output
            else input_path.parent / f"{input_path.name}_markdown"
        )
        out_dir.mkdir(parents=True, exist_ok=True)

        files = glob.glob(str(input_path / "*.html")) + glob.glob(
            str(input_path / "*.htm")
        )
        print(
            f"Converting {len(files)} files from '{input_path}' -> '{out_dir}'..."
        )

        count = 0
        for filepath in files:
            p = Path(filepath)
            with open(p, "r", encoding="utf-8", errors="ignore") as f:
                html_data = f.read()

            clean_md, clean_html = converter.clean_html_and_markdown(
                html_data, source_url=p.name
            )
            out_file = out_dir / f"{p.stem}.md"
            with open(out_file, "w", encoding="utf-8") as f:
                f.write(clean_md)
            count += 1

        print(
            f"SUCCESS: Converted {count} Markdown files in {out_dir.resolve()}"
        )
