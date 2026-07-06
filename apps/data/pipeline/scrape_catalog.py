"""Catalog scraper: Acalog (catalog.dallascollege.edu) poid pages -> raw_documents.

Catalogs are versioned by catoid (2026-27 = 5); each program is a poid page
(GAP_ANALYSIS; ADR-007). Given a catoid this scraper enumerates program links
from the catalog's program-index pages (poid links are embedded as
preview_program.php?catoid=N&poid=M), fetches each program page, and stores
its text as source_type='catalog_page' with content_hash change detection.

CLI:
    python -m pipeline.scrape_catalog --catoid 5                 # discover + fetch all programs
    python -m pipeline.scrape_catalog --catoid 5 --poid 4242     # one specific program
    python -m pipeline.scrape_catalog --catoid 5 --list-only     # just print discovered poids
"""

from __future__ import annotations

import argparse
import re
import time
from typing import Optional

from pipeline.rawdocs import store_raw_document
from pipeline.scrape_syllabi import USER_AGENT, html_to_text

BASE = "https://catalog.dallascollege.edu"
REQUEST_DELAY_S = 1.0

_POID_RE = re.compile(r"preview_program\.php\?catoid=(\d+)&(?:amp;)?poid=(\d+)")


def _get(url: str) -> str:
    import requests  # lazy

    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=60)
    resp.raise_for_status()
    return resp.text


def discover_poids(catoid: int, index_url: Optional[str] = None,
                   max_index_pages: int = 40) -> list[int]:
    """Enumerate poids for a catoid by walking the catalog's paginated program
    index (…/content.php?catoid=N&navoid=… 'Programs' pages all embed
    preview_program.php links). Falls back to scanning the catalog root."""
    seen: set[int] = set()
    pages = [index_url] if index_url else [f"{BASE}/index.php?catoid={catoid}"]
    visited: set[str] = set()

    while pages and len(visited) < max_index_pages:
        url = pages.pop(0)
        if url in visited:
            continue
        visited.add(url)
        try:
            html = _get(url)
        except Exception as e:
            print(f"  index {url}: fetch failed ({type(e).__name__}: {e})")
            continue
        for cat, poid in _POID_RE.findall(html):
            if int(cat) == catoid:
                seen.add(int(poid))
        # follow same-catoid content pages (program A–Z listings are content.php pages)
        for nav in re.findall(r'href="([^"]*content\.php\?catoid=%d[^"]*)"' % catoid, html):
            nxt = nav if nav.startswith("http") else f"{BASE}/{nav.lstrip('/')}"
            nxt = nxt.replace("&amp;", "&")
            if nxt not in visited:
                pages.append(nxt)
        time.sleep(REQUEST_DELAY_S)
    return sorted(seen)


def scrape_program(conn, catoid: int, poid: int) -> bool:
    url = f"{BASE}/preview_program.php?catoid={catoid}&poid={poid}"
    html = _get(url)
    text = html_to_text(html)
    if not text:
        print(f"  poid {poid}: empty page text; skipping")
        return False
    _, inserted = store_raw_document(
        conn, source_type="catalog_page", source_url=url, raw_text=text)
    return inserted


def main(argv: Optional[list[str]] = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--catoid", type=int, required=True,
                    help="Acalog catalog edition id (2026-27 = 5)")
    ap.add_argument("--poid", type=int, action="append", default=[],
                    help="specific program id(s); omit to discover all")
    ap.add_argument("--index-url", default=None,
                    help="program-index URL override for discovery")
    ap.add_argument("--list-only", action="store_true",
                    help="print discovered poids and exit (no DB writes)")
    args = ap.parse_args(argv)

    poids = args.poid or discover_poids(args.catoid, args.index_url)
    print(f"catoid {args.catoid}: {len(poids)} program page(s) to fetch")
    if args.list_only:
        print(" ".join(map(str, poids)))
        return

    from db.client import get_connection  # the one-file adapter (ADR-008)

    new = unchanged = failed = 0
    with get_connection() as conn:
        for poid in poids:
            try:
                if scrape_program(conn, args.catoid, poid):
                    new += 1
                else:
                    unchanged += 1
                conn.commit()
            except Exception as e:
                print(f"  poid {poid}: failed ({type(e).__name__}: {e})")
                failed += 1
            time.sleep(REQUEST_DELAY_S)

    print(f"catalog: {new} new/changed, {unchanged} unchanged, {failed} failed")


if __name__ == "__main__":
    main()
