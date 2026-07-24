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

import re
import datetime
from pathlib import Path
from bs4 import BeautifulSoup, Comment
from pypdf import PdfReader


class MarkdownConverter:
    """
    Parser for HTML, PDF, and plain text catalog/syllabus files.
    """

    def __init__(self):
        # HTML tag mappings to their markdown representations
        self.header_pattern = re.compile(r'^h([1-6])$')

    def html_to_markdown(self, html_content: str, source_url: str = "") -> str:
        """
        Converts raw HTML string into clean Markdown.
        Strips away web boilerplate and targets the main content wrapper if present.
        """
        soup = BeautifulSoup(html_content, "html.parser")

        # Step 1: Remove completely unwanted elements (scripts, styles, inputs, etc.)
        unwanted_tags = ["script", "style", "iframe", "noscript", "form", "button", "input", "select"]
        for tag in soup.find_all(unwanted_tags):
            tag.decompose()

        # Step 2: Remove HTML comments
        for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
            comment.extract()

        # Step 3: Target the core content area
        # On Dallas College catalog pages, class="block_content" contains the main text.
        # On Concourse syllabi, id="syllabus" or class="syl" contains the main syllabus content.
        # Fall back to <body> if not found.
        target_container = (
            soup.find(class_="block_content") 
            or soup.find(id="syllabus") 
            or soup.find(class_="syl") 
            or soup.find("body") 
            or soup
        )

        # Step 4: Decompose boilerplate classes/tags inside the target container
        # e.g., headers, footers, navigation and sidebars
        for el in target_container.find_all(["header", "footer", "nav", "aside"]):
            el.decompose()

        # Remove elements with common boilerplate classes or IDs only if NOT in a syllabus container
        # to avoid decomposing syl-header or category-header.
        is_syllabus = target_container.get("id") == "syllabus" or (
            target_container.get("class") and any("syl" in c for c in target_container.get("class"))
        )
        if not is_syllabus:
            boilerplate_selectors = re.compile(r'header|footer|nav|sidebar|menu|logo|top-bar', re.IGNORECASE)
            for el in target_container.find_all(class_=boilerplate_selectors):
                el.decompose()
            for el in target_container.find_all(id=boilerplate_selectors):
                el.decompose()

        # Step 5: Convert HTML elements to Markdown recursively
        markdown_body = self._parse_element(target_container)
        
        # Post-processing: clean up extra spaces and newlines
        markdown_body = re.sub(r'\n{3,}', '\n\n', markdown_body).strip()

        # Step 6: Extract metadata and prepends YAML frontmatter
        metadata = self.extract_metadata_from_html(soup, markdown_body, source_url)
        frontmatter = self.generate_frontmatter(metadata)

        return f"{frontmatter}\n\n{markdown_body}"

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
                pages_text.append(f"<!-- Page {i+1} -->\n{text}")

        raw_text = "\n\n".join(pages_text)

        # Basic layout preservation: format headings
        # Syllabi headers are often on single lines. Let's make lines that look like
        # common syllabus sections (e.g. "Grading Criteria", "Required Materials") markdown headers.
        formatted_text = self._format_raw_text(raw_text)

        # Extract metadata
        course_id = self._infer_course_id_from_text(formatted_text) or self._infer_course_id_from_filename(pdf_path.name)
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

        course_id = self._infer_course_id_from_text(formatted_text) or self._infer_course_id_from_filename(file_path.name)
        metadata = {
            "source_url": source_url or file_path.name,
            "extracted_date": datetime.datetime.now().isoformat(),
            "document_type": "syllabus" if "syllabus" in file_path.name.lower() or "biol" in file_path.name.lower() else "general",
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

    def extract_metadata_from_html(self, soup: BeautifulSoup, markdown_body: str, source_url: str) -> dict:
        """
        Infers metadata like course ID, document type, and dates from the HTML context.
        """
        # Try to infer course ID (e.g. ACCT 2301)
        course_id = self._infer_course_id_from_text(markdown_body)
        
        # Attempt to extract from title tag if missing
        if not course_id and soup.title:
            course_id = self._infer_course_id_from_text(soup.title.string)

        # Inferred document type based on URLs and content
        doc_type = "general"
        if "syllabus" in source_url.lower():
            doc_type = "syllabus"
        elif "preview_course" in source_url.lower() or "course" in source_url.lower():
            doc_type = "course"
        elif "preview_program" in source_url.lower() or "program" in source_url.lower():
            doc_type = "program"

        return {
            "source_url": source_url or "scraped_catalog_page",
            "extracted_date": datetime.datetime.now().isoformat(),
            "document_type": doc_type,
            "course_id": course_id or "UNKNOWN",
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
        child_markdown = "".join(self._parse_element(child) for child in element.children)

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
            return f"**{child_markdown.strip()}**" if child_markdown.strip() else ""

        elif tag_name in ["em", "i"]:
            return f"*{child_markdown.strip()}*" if child_markdown.strip() else ""

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
            parent_name = element.parent.name.lower() if element.parent else "ul"
            if parent_name == "ol":
                siblings = [sib for sib in element.parent.children if sib.name == "li"]
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
                cell_text = "".join(self._parse_element(child) for child in cell.children)
                # Escape pipe characters inside table cells to prevent Markdown grid corruption
                cell_text = cell_text.strip().replace("\n", " ").replace("|", "\\|")
                cell_contents.append(cell_text)

            max_cols = max(max_cols, len(cell_contents))
            
            # Check if this row is a header row (all <th> tags or the first row)
            is_header = all(c.name == "th" for c in cells) or (not headers_found and len(markdown_rows) == 0)
            
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
            "course syllabus", "instructor information", "grading criteria",
            "grading scale", "grading policy", "course schedule", "course information",
            "course requirements", "attendance policy", "required materials",
            "tentative calendar", "disabilities accommodation", "academic integrity",
            "student support services", "course description", "learning outcomes"
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
                if re.match(r'^(?:[I|V|X\d]+\.|\bWeek\s+\d+|[A-Z\s\-]+:)', line_strip):
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
        match = re.search(r'([A-Z]{4})[\s-]?(\d{4})', text)
        if match:
            return f"{match.group(1)}-{match.group(2)}"
        return None

    def _infer_course_id_from_filename(self, filename: str) -> str | None:
        """
        Uses filename format (e.g. biol_1406_doe.txt) to infer the course code.
        """
        # Boundaries are relaxed to ensure we match unspaced combinations.
        match = re.search(r'([a-zA-Z]{4})_?(\d{4})', filename)
        if match:
            return f"{match.group(1).upper()}-{match.group(2)}"
        return None


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python markdown_converter.py <file_path> [source_url]")
        sys.exit(1)
        
    path = Path(sys.argv[1])
    url = sys.argv[2] if len(sys.argv) > 2 else ""
    
    if not path.exists():
        print(f"Error: File {path} not found.")
        sys.exit(1)
        
    converter = MarkdownConverter()
    ext = path.suffix.lower()
    
    if ext in (".html", ".htm"):
        with open(path, "r", encoding="utf-8") as f:
            html_data = f.read()
        res = converter.html_to_markdown(html_data, url)
    elif ext == ".pdf":
        res = converter.pdf_to_markdown(path, url)
    else:
        res = converter.text_to_markdown(path, url)
        
    print(res)
