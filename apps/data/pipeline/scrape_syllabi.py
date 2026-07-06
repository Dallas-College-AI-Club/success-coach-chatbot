"""Syllabus scraper: Concourse pages (hb2504.dcccd.edu) -> raw_documents.

content_hash change detection is the whole game (DATA_DICTIONARY): re-scraping
an unchanged syllabus writes nothing; a changed one appends a new raw row and
demotes the old snapshot's is_latest. raw_text keeps the full extracted text
so ANY future model can re-extract without re-scraping.

Sources:
    --urls-from-db          every distinct sections.syllabus_url (from schedule rows)
    --url URL [...]         explicit page URLs
    --file PATH [...]       local .pdf/.html/.txt files (e.g. the four samples
                            in "raw data/") — stored with their file URI

CLI examples:
    python -m pipeline.scrape_syllabi --urls-from-db
    python -m pipeline.scrape_syllabi --file "raw data/University Physics I _ Syllabus _ Concourse.pdf" --term 2022SU
"""

from __future__ import annotations

import argparse
import io
import re
import time
from html.parser import HTMLParser
from pathlib import Path
from typing import Optional

from pipeline.rawdocs import store_raw_document

USER_AGENT = "dallas-chatbot-scraper/1.0 (student project; respectful crawl)"
REQUEST_DELAY_S = 1.0  # politeness delay between fetches


class _TextExtractor(HTMLParser):
    """Minimal HTML -> text (stdlib only): drops script/style, keeps block breaks."""
    _SKIP = {"script", "style", "noscript", "head"}
    _BLOCK = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6",
              "table", "section", "article"}

    def __init__(self) -> None:
        super().__init__()
        self._chunks: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in self._SKIP:
            self._skip_depth += 1
        elif tag in self._BLOCK:
            self._chunks.append("\n")

    def handle_endtag(self, tag):
        if tag in self._SKIP and self._skip_depth:
            self._skip_depth -= 1
        elif tag in self._BLOCK:
            self._chunks.append("\n")

    def handle_data(self, data):
        if not self._skip_depth:
            self._chunks.append(data)

    def text(self) -> str:
        raw = "".join(self._chunks)
        raw = re.sub(r"[ \t]+", " ", raw)
        return re.sub(r"\n\s*\n+", "\n\n", raw).strip()


def html_to_text(html: str) -> str:
    p = _TextExtractor()
    p.feed(html)
    return p.text()


def pdf_to_text(data: bytes) -> str:
    from pypdf import PdfReader  # lazy import

    reader = PdfReader(io.BytesIO(data))
    return "\n\n".join((page.extract_text() or "") for page in reader.pages).strip()


def guess_term_code(url_or_name: str) -> Optional[str]:
    """hb2504 URLs embed the term: .../2022SU-PHYS-2425-43501.pdf -> 2022SU."""
    m = re.search(r"(20\d{2})(SP|SU|FA|WI)\b", url_or_name.upper())
    return f"{m.group(1)}{m.group(2)}" if m else None


def fetch_url(url: str) -> tuple[str, str]:
    """Returns (raw_text, source_type)."""
    import requests  # lazy

    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=60)
    resp.raise_for_status()
    ctype = resp.headers.get("content-type", "").lower()
    if url.lower().endswith(".pdf") or "pdf" in ctype:
        return pdf_to_text(resp.content), "syllabus_pdf"
    return html_to_text(resp.text), "syllabus_html"


def read_file(path: str) -> tuple[str, str]:
    p = Path(path)
    if p.suffix.lower() == ".pdf":
        return pdf_to_text(p.read_bytes()), "syllabus_pdf"
    text = p.read_text(encoding="utf-8", errors="replace")
    if p.suffix.lower() in (".html", ".htm"):
        return html_to_text(text), "syllabus_html"
    return text, "syllabus_html"


def scrape_one(conn, *, source_url: str, raw_text: str, source_type: str,
               term_code: Optional[str]) -> bool:
    if not raw_text:
        print(f"  {source_url}: no text extracted; skipping")
        return False
    _, inserted = store_raw_document(
        conn, source_type=source_type, source_url=source_url,
        term_code=term_code, raw_text=raw_text)
    return inserted


def urls_from_db(conn) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            """SELECT DISTINCT syllabus_url FROM sections
               WHERE syllabus_url IS NOT NULL ORDER BY 1"""
        )
        return [r[0] for r in cur.fetchall()]


def main(argv: Optional[list[str]] = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    src = ap.add_argument_group("sources")
    src.add_argument("--urls-from-db", action="store_true",
                     help="scrape every distinct sections.syllabus_url")
    src.add_argument("--url", action="append", default=[], help="explicit page URL")
    src.add_argument("--file", action="append", default=[],
                     help="local .pdf/.html/.txt syllabus file")
    ap.add_argument("--term", default=None,
                    help="term code override (e.g. 2022SU) when not inferable")
    args = ap.parse_args(argv)
    if not (args.urls_from_db or args.url or args.file):
        ap.error("give --urls-from-db, --url, or --file")

    from db.client import get_connection  # the one-file adapter (ADR-008)

    new = unchanged = failed = 0
    with get_connection() as conn:
        targets = list(args.url)
        if args.urls_from_db:
            targets += urls_from_db(conn)
        for url in targets:
            try:
                text, source_type = fetch_url(url)
            except Exception as e:
                print(f"  {url}: fetch failed ({type(e).__name__}: {e})")
                failed += 1
                continue
            if scrape_one(conn, source_url=url, raw_text=text,
                          source_type=source_type,
                          term_code=args.term or guess_term_code(url)):
                new += 1
            else:
                unchanged += 1
            conn.commit()
            time.sleep(REQUEST_DELAY_S)

        for path in args.file:
            text, source_type = read_file(path)
            source_url = Path(path).resolve().as_uri()
            if scrape_one(conn, source_url=source_url, raw_text=text,
                          source_type=source_type,
                          term_code=args.term or guess_term_code(path)):
                new += 1
            else:
                unchanged += 1
            conn.commit()

    print(f"syllabi: {new} new/changed, {unchanged} unchanged, {failed} failed")


if __name__ == "__main__":
    main()
