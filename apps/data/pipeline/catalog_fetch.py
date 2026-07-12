"""Playwright catalog fetcher: Acalog program + course pages -> raw HTML archive.

The Dallas College catalog (catalog.dallascollege.edu) sits behind a JavaScript
challenge that plain HTTP (requests/urllib) cannot pass - a bare GET returns an
HTTP 202 challenge stub with no content. So we drive a headless Chromium via
Playwright: it runs the challenge JS, and one browser context passes it once
(cookie), after which every page loads directly. This is the ONLY source in the
pipeline that needs a browser engine; Concourse (syllabi/CVs) is plain HTTP.

Two-pass, so we fetch exactly the courses degree plans actually use:
  pass 1  program index -> every program poid; fetch each program page and
          harvest the course coids it references
  pass 2  fetch those course pages

Layout under --out (default apps/data/raw/):
    catalog/<catalog_year>/index.html            the program index (provenance)
    catalog/<catalog_year>/programs/<poid>.html  one per degree/certificate plan
    catalog/<catalog_year>/courses/<coid>.html   one per referenced course
    manifests/archive_catalog_<run_id>.jsonl     one line per fetch

Resumable/idempotent: a page already on disk is skipped, so a stopped run
resumes freely. Polite: one context, a delay between pages, a circuit breaker
that stops (rather than hammers) if the site starts refusing.

One-time setup (from apps/data):
    uv add playwright        # or: pip install playwright
    playwright install chromium

CLI (from apps/data):
    python -m pipeline.catalog_fetch --catoid 5 --catalog-year 2026-2027
    python -m pipeline.catalog_fetch --catoid 5 --catalog-year 2026-2027 --limit-programs 3
    python -m pipeline.catalog_fetch --catoid 5 --catalog-year 2026-2027 --programs-only
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

BASE = "https://catalog.dallascollege.edu"
PROGRAM_INDEX_NAVOID = 1227  # "Degrees and Certificates (by Program)"
BROWSER_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
DEFAULT_DELAY_MS = 2000            # polite pause between page loads
MIN_REAL_BYTES = 20000            # the JS challenge stub is ~2 KB; real pages are >150 KB
BREAK_AFTER_CONSEC_ERRORS = 3     # circuit breaker

POID_RE = re.compile(r"poid=(\d+)")
# course ids appear as ...coid=NNN (hrefs/popups) AND showCourse('<catoid>', 'NNN', ...) (onclick)
COID_HREF_RE = re.compile(r"coid=(\d+)")
COID_ONCLICK_RE = re.compile(r"showCourse\(\s*'\d+'\s*,\s*'(\d+)'")


def extract_poids(index_html: str) -> list[str]:
    return sorted(set(POID_RE.findall(index_html)), key=int)


def extract_coids(program_html: str) -> list[str]:
    coids = set(COID_HREF_RE.findall(program_html))
    coids |= set(COID_ONCLICK_RE.findall(program_html))
    return sorted(coids, key=int)


class CatalogFetcher:
    """Wraps a Playwright page; fetch() returns real HTML past the JS challenge."""

    def __init__(self, out: Path, catalog_year: str, delay_ms: int, run_id: str):
        self.out = out
        self.year = catalog_year
        self.delay_ms = delay_ms
        self.manifest = out / "manifests" / f"archive_catalog_{run_id}.jsonl"
        self.manifest.parent.mkdir(parents=True, exist_ok=True)
        self.consec_errors = 0
        self.n_new = self.n_skip = self.n_fail = 0
        self._pw = self._browser = self._ctx = self.page = None

    # -- lifecycle ------------------------------------------------------------
    def __enter__(self):
        from playwright.sync_api import sync_playwright  # lazy: only when fetching
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(headless=True)
        self._ctx = self._browser.new_context(user_agent=BROWSER_UA)
        self._ctx.set_default_timeout(45000)
        self.page = self._ctx.new_page()
        # block heavy assets we never archive (images/fonts/media) - faster, lighter
        self.page.route(re.compile(r"\.(png|jpe?g|gif|svg|woff2?|ttf|mp4|css)(\?|$)"),
                        lambda route: route.abort())
        return self

    def __exit__(self, *exc):
        for closer in (self._ctx, self._browser):
            try:
                closer and closer.close()
            except Exception:
                # best-effort teardown: ignore close() errors so cleanup continues
                pass
        try:
            self._pw and self._pw.stop()
        except Exception:
            # best-effort teardown: ignore Playwright stop() errors during shutdown
            pass

    # -- fetching -------------------------------------------------------------
    def _get_real_html(self, url: str) -> tuple[str, int]:
        """Navigate and return (html, http_status). Retries while the challenge
        is still resolving (content still smaller than a real page)."""
        status = -1
        html = ""
        for attempt in range(3):
            resp = self.page.goto(url, wait_until="domcontentloaded")
            status = resp.status if resp else status
            try:
                self.page.wait_for_load_state("networkidle", timeout=15000)
            except Exception:
                # networkidle can time out behind the JS challenge; the
                # content-length retry loop below handles readiness instead.
                pass
            html = self.page.content()
            if len(html) >= MIN_REAL_BYTES:
                return html, status
            self.page.wait_for_timeout(2000 * (attempt + 1))  # challenge still clearing
        return html, status

    def fetch(self, url: str, dest: Path, meta: dict) -> Optional[str]:
        """Fetch url -> dest (skip if present). Returns the HTML (for parsing),
        or None on skip/failure. Trips the circuit breaker on repeated failure."""
        if dest.exists():
            self.n_skip += 1
            return dest.read_text(encoding="utf-8", errors="replace")
        try:
            html, status = self._get_real_html(url)
            if len(html) < MIN_REAL_BYTES:
                raise RuntimeError(f"challenge not cleared (got {len(html)} bytes, "
                                   f"status {status})")
        except Exception as e:  # noqa: BLE001 - archival loop stays resilient
            self.n_fail += 1
            self.consec_errors += 1
            self._record({**meta, "source_url": url, "raw_path": None,
                          "status": "error", "error": f"{type(e).__name__}: {e}",
                          "fetched_at": datetime.now(timezone.utc).isoformat()})
            print(f"  ERROR {url}: {type(e).__name__}: {e}", file=sys.stderr)
            if self.consec_errors >= BREAK_AFTER_CONSEC_ERRORS:
                raise SystemExit(
                    f"circuit breaker: {self.consec_errors} consecutive errors - "
                    f"stopping. Re-run to resume (archived files skip).")
            self.page.wait_for_timeout(self.delay_ms)
            return None
        body = html.encode("utf-8")
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(body)
        self._record({**meta, "source_url": url,
                      "raw_path": str(dest.relative_to(self.out)),
                      "sha256": hashlib.sha256(body).hexdigest(),
                      "bytes": len(body), "status": status,
                      "fetched_at": datetime.now(timezone.utc).isoformat()})
        self.n_new += 1
        self.consec_errors = 0
        self.page.wait_for_timeout(self.delay_ms)
        return html

    def _record(self, rec: dict) -> None:
        with self.manifest.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(rec) + "\n")


def main(argv: Optional[list[str]] = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--catoid", required=True, help="Acalog catalog id (2026-2027 = 5)")
    ap.add_argument("--catalog-year", required=True, help="e.g. 2026-2027 (the scoping key)")
    ap.add_argument("--out", type=Path,
                    default=Path(__file__).resolve().parent.parent / "raw")
    ap.add_argument("--navoid", type=int, default=PROGRAM_INDEX_NAVOID,
                    help="program-index navoid (default 1227)")
    ap.add_argument("--programs-only", action="store_true",
                    help="fetch program pages only; skip the course pass")
    ap.add_argument("--limit-programs", type=int, default=None,
                    help="cap program count (testing)")
    ap.add_argument("--delay-ms", type=int, default=DEFAULT_DELAY_MS)
    args = ap.parse_args(argv)

    cat = args.out / "catalog" / args.catalog_year
    run_id = f"{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}"
    idx_url = f"{BASE}/content.php?catoid={args.catoid}&navoid={args.navoid}"

    with CatalogFetcher(args.out, args.catalog_year, args.delay_ms, run_id) as fx:
        print(f"catalog {args.catalog_year} (catoid={args.catoid})  out={cat}\n"
              f"manifest={fx.manifest}\n", flush=True)

        # ---- pass 0: the program index -------------------------------------
        index_html = fx.fetch(idx_url, cat / "index.html",
                              {"kind": "index", "catalog_year": args.catalog_year,
                               "catoid": args.catoid, "navoid": args.navoid})
        if not index_html:
            print("could not fetch the program index; aborting", file=sys.stderr)
            return
        poids = extract_poids(index_html)
        if args.limit_programs:
            poids = poids[:args.limit_programs]
        print(f"pass 1: {len(poids)} programs", flush=True)

        # ---- pass 1: program pages, harvesting coids -----------------------
        coids: set[str] = set()
        for i, poid in enumerate(poids, 1):
            url = f"{BASE}/preview_program.php?catoid={args.catoid}&poid={poid}"
            html = fx.fetch(url, cat / "programs" / f"{poid}.html",
                            {"kind": "program", "catalog_year": args.catalog_year,
                             "catoid": args.catoid, "poid": poid})
            if html:
                coids.update(extract_coids(html))
            if i % 25 == 0 or i == len(poids):
                print(f"  [{i}/{len(poids)}] programs  new={fx.n_new} skip={fx.n_skip} "
                      f"fail={fx.n_fail}  coids so far={len(coids)}", flush=True)

        # ---- pass 2: course pages ------------------------------------------
        if not args.programs_only:
            coid_list = sorted(coids, key=int)
            print(f"pass 2: {len(coid_list)} distinct courses referenced by programs",
                  flush=True)
            for i, coid in enumerate(coid_list, 1):
                url = f"{BASE}/preview_course_nopop.php?catoid={args.catoid}&coid={coid}"
                fx.fetch(url, cat / "courses" / f"{coid}.html",
                         {"kind": "course", "catalog_year": args.catalog_year,
                          "catoid": args.catoid, "coid": coid})
                if i % 50 == 0 or i == len(coid_list):
                    print(f"  [{i}/{len(coid_list)}] courses  new={fx.n_new} "
                          f"skip={fx.n_skip} fail={fx.n_fail}", flush=True)

        print(f"\nDONE catalog {args.catalog_year}: {fx.n_new} new, {fx.n_skip} "
              f"already-archived, {fx.n_fail} failed\nmanifest: {fx.manifest}", flush=True)


if __name__ == "__main__":
    main()
