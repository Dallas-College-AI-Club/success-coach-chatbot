#!/usr/bin/env python3
r"""
scrape.py -- Dallas College credit class schedule scraper.

Scrapes the Dallas College public class schedule for a given term, iterates
through *every* course prefix (ACCT ... WLDG), and writes one CSV row per class
section (one row per *real* section -- co-requisite/comment rows are excluded, so
a course's paired co-req section is not emitted as a separate course):

    class_prefix, class_number, section_number, professor, date_accessed,
    class_name, credit_hours, term_year, syllabus_url, start_date, end_date,
    meeting_info, location, class_features, other_links, corequisites

  * date_accessed is an ISO-8601 UTC timestamp captured when that prefix's page
    was fetched.
  * class_name   -- the course title (e.g. "Prin of Financial Accounting").
  * credit_hours -- credit hours from the Loc/Credits column (e.g. "3").
  * term_year    -- "{term} {year}" (e.g. "Summer 2026"); from --term + --year
                    (year defaults to the current calendar year).
  * syllabus_url -- absolute link to the Class Syllabus, or "" if none.
  * start_date / end_date -- the class start/end dates (e.g. "Jun 8, 2026").
  * meeting_info -- the Class Meeting Information cell (room, format, days/times).
  * location     -- the "Loc" part of Loc/Credits (e.g. "EFC", "NLC"); "Online"
                    for rows in the 100% On-Line Classes table.
  * class_features -- Class Features tags; linked tags include their URL as
                    "Label (url)", joined with " | ".
  * other_links  -- the Links column EXCLUDING the syllabus (e.g. Course
                    Materials, IncludEd Info) as "Label (url)" joined with " | ".
  * corequisites -- the paired co-requisite section token(s) for the class
                    (e.g. "ENGL-1301-C5"), joined with " | "; "none" if there
                    are no co-requisites. Co-req rows are NOT emitted as their
                    own courses -- they are captured here on the parent row.
  * Rows are de-duplicated on (class_prefix, class_number, section_number,
    professor) -- including across resumed runs.

------------------------------------------------------------------------------
SETUP
------------------------------------------------------------------------------
    pip install -r requirements.txt

    # ONLY if the Playwright fallback is selected (see "Bot protection" below):
    python -m playwright install chromium

------------------------------------------------------------------------------
USAGE
------------------------------------------------------------------------------
    python scrape.py --term Summer --output classes.csv --delay 1.5
                     [--prefixes ACCT,BIOL] [--resume] [--force]

    python scrape.py                      # crawl ALL prefixes for Summer (default term)
    python scrape.py --term Fall --year 2026   # crawl ALL prefixes for another term
    python scrape.py --term Summer --output classes.csv --delay 2 --resume
                                          # crawl ALL prefixes, custom output, resumable
    python scrape.py --prefixes ACCT      # targeted sanity run; prints first ~10 rows
    python scrape.py --selftest           # run the built-in unit tests and exit

  (Omitting --prefixes crawls every prefix the index page lists, ACCT ... WLDG.)

Defaults: --term Summer, --year current-year, --output dallas_classes_{year}_{term}.csv,
--delay 1.5 (sec).

TERM RESOLUTION: the bare /{Term}/ "current-term" alias on the site was observed to
flip between cached term snapshots (SUMMER2020 / FALL2021 / SPRING2025) from one
request to the next, which would silently scrape the WRONG term. So pages are fetched
from the EXPLICIT, deterministic year-coded path built from --term + --year, e.g.
/SUMMER2026/Prefix/ACCT. Use --year to target a specific catalog year.

------------------------------------------------------------------------------
TWO FETCH STRATEGIES (selected automatically -- "STEP 0")
------------------------------------------------------------------------------
Before crawling, the program fetches the ACCT prefix page once and checks
whether the class tables are present in the raw HTML (a token matching
^[A-Z]{2,4}-\d{3,4}-\w+$, e.g. "ACCT-2301-9"):

  * tables present in raw HTML  -> requests + BeautifulSoup  (preferred, fast)
  * tables NOT present          -> Playwright headless Chromium (fallback):
                                   loads the page in a real browser, lets any
                                   JS render / bot-challenge resolve, then parses
The chosen path is printed so the decision is visible.

------------------------------------------------------------------------------
BOT PROTECTION (AWS WAF) -- important
------------------------------------------------------------------------------
schedule.dallascollege.edu sits behind AWS WAF. A plain `requests` client may
receive an HTTP 202 / 403 response carrying a JavaScript "Human Verification"
challenge (body contains 'awsWaf') instead of the page, especially after several
rapid requests. This scraper:

  * detects the challenge (status 202/403/429/503 or a WAF marker in the body),
  * retries transient failures with exponential backoff (3 attempts), and
  * falls back to Playwright -- a real browser that can execute the challenge JS.

Please be polite: keep --delay at >= 1.5s and avoid hammering the site, or the
WAF will escalate to a hard block.
"""

from __future__ import annotations

import argparse
import csv
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urljoin
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup, NavigableString

# --------------------------------------------------------------------------- #
# Constants
# --------------------------------------------------------------------------- #

BASE_URL = "https://schedule.dallascollege.edu"
DEFAULT_TERM = "Fall"
DEFAULT_DELAY = 5

# A descriptive User-Agent (politeness + identifies the crawler).
USER_AGENT = (
    "DallasCollegeScheduleScraper/1.0 "
    "(student schedule project; contact: treysweeney@gmail.com) "
    "python-requests"
)

CSV_COLUMNS = [
    "class_prefix",
    "class_number",
    "section_number",
    "professor",
    "date_accessed",
    "class_name",      # course title, e.g. "Prin of Financial Accounting"
    "credit_hours",    # e.g. "3"
    "term_year",       # e.g. "Summer 2026" (from --term + --year)
    "syllabus_url",    # absolute link to the Class Syllabus, or ""
    "start_date",      # e.g. "Jun 8, 2026"
    "end_date",        # e.g. "Jul 9, 2026"
    "meeting_info",    # Class Meeting Information cell, e.g. "N222 In-Person Lecture M T W R 05:30 PM - 07:30 PM"
    "location",        # the "Loc" part of Loc/Credits, e.g. "EFC"; "Online" for online classes
    "class_features",  # Class Features (plain tags + "Label (url)" for linked ones)
    "other_links",     # non-syllabus links as "Label (url) | ...", or ""
    "corequisites",    # co-req section token(s), e.g. "ENGL-1301-C5", or "none"
]

# PREFIX-NUMBER-SECTION token, e.g. ACCT-2301-9 or ACCT-2301-44490 or HIST-1301-9W.
TOKEN_RE = re.compile(r"^[A-Z]{2,4}-\d{3,4}-\w+$")
# Same token, un-anchored, for pulling the token out of a larger cell of text.
TOKEN_SEARCH_RE = re.compile(r"[A-Z]{2,4}-\d{3,4}-\w+")
# A "Mon D, YYYY" date as shown in the Start / End Dates column (e.g. "Jun 8, 2026").
DATE_RE = re.compile(r"[A-Z][a-z]{2,8}\.?\s+\d{1,2},\s+\d{4}")

# Markers that identify an AWS WAF JavaScript challenge / block page.
WAF_MARKERS = (
    "awsWaf",
    "aws-waf-token",
    "Human Verification",
    "challenge-container",
    "captcha",
)
# HTTP statuses that, for this host, indicate "not the page -- try again / fall
# back" rather than a genuine page.
BLOCK_STATUSES = {202, 403, 429, 500, 502, 503, 504}

log = logging.getLogger("scrape")


# --------------------------------------------------------------------------- #
# Small helpers
# --------------------------------------------------------------------------- #

def now_utc_iso() -> str:
    """Current time as an ISO-8601 UTC timestamp, e.g. 2026-06-17T21:30:05Z."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def looks_rendered(html: str) -> bool:
    """True if the HTML contains at least one PREFIX-NUMBER-SECTION token."""
    return bool(html) and TOKEN_SEARCH_RE.search(html) is not None


def is_waf_challenge(status: int, html: str) -> bool:
    """True if the response looks like an AWS WAF challenge / block, not a page."""
    if status in BLOCK_STATUSES:
        return True
    return any(marker in (html or "") for marker in WAF_MARKERS)


# --------------------------------------------------------------------------- #
# Parsing  (pure functions -- unit-tested below)
# --------------------------------------------------------------------------- #

def parse_token(token: str):
    """Split a PREFIX-NUMBER-SECTION token into its three parts.

    Parsing is done on the TOKEN only (never on the course title or the
    instructor name), so commas in titles/names can never affect the split.

        >>> parse_token("ACCT-2301-9")
        ('ACCT', '2301', '9')

    Returns a (prefix, number, section) tuple, or None if `token` is not a
    well-formed token.
    """
    token = (token or "").strip()
    if not TOKEN_RE.match(token):
        return None
    prefix, number, section = token.split("-", 2)
    return prefix, number, section


def find_columns(table) -> dict:
    """Map logical column names -> 0-based index, from the table's header row.

    Keys (when present): title, meeting, faculty, credits, dates, features,
    links. Determined from the header text so we don't hard-code positions that
    could shift between the 'Campus Based' and '100% On-Line' tables.
    """
    cols: dict[str, int] = {}
    header = table.find("tr")
    if header is None:
        return cols
    for i, cell in enumerate(header.find_all(["th", "td"])):
        t = cell.get_text(" ", strip=True).lower()
        if "faculty" in t:
            cols["faculty"] = i
        elif "credit" in t or t.startswith("loc"):
            cols["credits"] = i        # "Loc / Credits" -> both location & credits
        elif "date" in t:
            cols["dates"] = i
        elif "meeting" in t:
            cols["meeting"] = i
        elif "feature" in t:
            cols["features"] = i
        elif "link" in t:
            cols["links"] = i
        elif "title" in t or "course" in t:
            cols["title"] = i
    cols.setdefault("title", 0)
    return cols


def extract_class_name(title_cell, token: str) -> str:
    """Course title from the title cell, excluding the token and status badge.

    In the live markup the title cell is:
        <a ...>ACCT-2301-9</a><br>Prin of Financial Accounting<div>...Class Started...</div>
    so the title is the cell's direct text node(s) -- the token lives in an <a>
    and the status ("Class Started" etc.) lives in a <div>, both excluded.
    """
    parts = [str(ch).strip() for ch in title_cell.children
             if isinstance(ch, NavigableString) and str(ch).strip()]
    name = " ".join(parts).strip()
    if not name:
        # Fallback for other layouts: full text minus the token and any status.
        name = title_cell.get_text(" ", strip=True).split(token, 1)[-1].strip()
        name = re.sub(r"\b(Class (Started|Ended|Not\s*Started|Full)|Open|Closed|"
                      r"Wait\s*list.*)\s*$", "", name, flags=re.I).strip()
    name = re.sub(r"^\(\s*\d+\s*\)\s*", "", name).strip()  # drop a leading (Reg#)
    return name


def extract_credits(cells, idx: int | None) -> str:
    """Credit hours = the trailing number in the 'Loc / Credits' cell (e.g. 3)."""
    if idx is None or not (0 <= idx < len(cells)):
        return ""
    nums = re.findall(r"\d+(?:\.\d+)?", cells[idx].get_text(" ", strip=True))
    return nums[-1] if nums else ""


def extract_dates(cells, idx: int | None):
    """(start_date, end_date) -- the first two 'Mon D, YYYY' dates in the cell."""
    if idx is None or not (0 <= idx < len(cells)):
        return "", ""
    dates = DATE_RE.findall(cells[idx].get_text(" ", strip=True))
    return (dates[0] if dates else ""), (dates[1] if len(dates) > 1 else "")


def extract_syllabus(cells, idx: int | None, page_url: str | None) -> str:
    """Absolute URL of the 'Class Syllabus' link (Links column, or anywhere)."""
    def find_in(cell):
        for a in cell.find_all("a", href=True):
            label = (a.get_text(" ", strip=True) + " " + (a.get("title") or "")).lower()
            if "syllabus" in label:
                return urljoin(page_url, a["href"]) if page_url else a["href"]
        return None

    if idx is not None and 0 <= idx < len(cells):
        url = find_in(cells[idx])
        if url:
            return url
    for cell in cells:  # fall back to the title cell's anchor, etc.
        url = find_in(cell)
        if url:
            return url
    return ""


def _cell_text(cells, idx: int | None) -> str:
    """Plain text of cell `idx`, or '' if the column is absent."""
    if idx is None or not (0 <= idx < len(cells)):
        return ""
    return cells[idx].get_text(" ", strip=True)


def _clean_link_label(text: str) -> str:
    """Drop the boilerplate '(opens in a new tab/window)' suffix from a label."""
    return re.sub(r"\s*\(opens in a new tab/window\)\s*", "", text or "", flags=re.I).strip()


def extract_location(cells, idx: int | None) -> str:
    """Location = the 'Loc / Credits' cell with the trailing credit number removed.

    e.g. "EFC 3" -> "EFC", "NLC 3" -> "NLC", "eCampus 3" -> "eCampus".
    """
    text = _cell_text(cells, idx)
    return re.sub(r"\s*\d+(?:\.\d+)?\s*$", "", text).strip()


def extract_features(cells, idx: int | None, page_url: str | None) -> str:
    """Class Features as "Tag | Linked Tag (url) | ..." (plain tags + linked ones).

    The cell mixes plain feature tags (e.g. "eCampus") with linked ones (e.g.
    "Summer Session I", "Night Classes"); we keep the plain text and append each
    linked tag as "Label (url)" so the URLs are captured.
    """
    if idx is None or not (0 <= idx < len(cells)):
        return ""
    cell = cells[idx]
    # Plain text = strings NOT inside an <a> (the linked tags are added below).
    plain = " ".join(s.strip() for s in cell.find_all(string=True)
                     if s.strip() and not s.find_parent("a"))
    items = [plain] if plain else []
    for a in cell.find_all("a", href=True):
        label = _clean_link_label(a.get_text(" ", strip=True))
        href = urljoin(page_url, a["href"]) if page_url else a["href"]
        items.append(f"{label} ({href})" if label else href)
    return " | ".join(items)


def extract_other_links(cells, idx: int | None, page_url: str | None) -> str:
    """Links column as "Label (url) | ..." EXCLUDING the Class Syllabus link."""
    if idx is None or not (0 <= idx < len(cells)):
        return ""
    items = []
    for a in cells[idx].find_all("a", href=True):
        label = _clean_link_label(a.get_text(" ", strip=True))
        if "syllabus" in (label + " " + (a.get("title") or "")).lower():
            continue  # already captured in syllabus_url
        href = urljoin(page_url, a["href"]) if page_url else a["href"]
        items.append(f"{label} ({href})" if label else href)
    return " | ".join(items)


def extract_professor(cells, faculty_idx: int | None = None) -> str:
    """Extract the instructor as verbatim 'Last, First', or 'Staff' if empty.

    Preference order:
      1. The mailto: link text inside the faculty cell (the instructor).
      2. Any mailto: link text in the row (when the faculty column is unknown).
      3. The faculty cell's plain text, with the trailing '/ Vita (PDF)' link
         stripped.
      4. 'Staff' when no instructor is present.
    """
    mailto = re.compile(r"^\s*mailto:", re.I)

    # 1 / 2 -- prefer a mailto anchor (that is how the instructor is rendered).
    search_cells = []
    if faculty_idx is not None and 0 <= faculty_idx < len(cells):
        search_cells = [cells[faculty_idx]]
    else:
        search_cells = list(cells)
    for cell in search_cells:
        a = cell.find("a", href=mailto)
        if a and a.get_text(strip=True):
            return a.get_text(" ", strip=True)

    # 3 -- fall back to the faculty cell's text (instructor without a mailto).
    if faculty_idx is not None and 0 <= faculty_idx < len(cells):
        text = cells[faculty_idx].get_text(" ", strip=True)
        text = re.sub(r"/?\s*Vita\s*\(PDF\)", "", text, flags=re.I)
        text = text.strip(" /\t").strip()
        if text:
            return text

    # 4 -- no instructor.
    return "Staff"


def parse_row(tr, cols: dict | None = None, page_url: str | None = None,
              is_online: bool = False):
    """Parse one table row into a dict of class fields, or None to skip.

    Keys: class_prefix, class_number, section_number, professor, class_name,
    credit_hours, syllabus_url, start_date, end_date, meeting_info, location,
    class_features, other_links. (term_year and date_accessed are added by the
    writer; corequisites is filled in by parse_prefix_html from the following
    co-req comment row(s) -- not derived from this single row.)

    `is_online` should be True for rows from the "100% On-Line Classes" table;
    those rows have no campus in the Loc/Credits cell, so their location is set
    to "Online" instead of "".

    Returns None for header rows, comment-only rows, co-requisite rows, and any
    row whose title cell does not contain a PREFIX-NUMBER-SECTION token.
    """
    cells = tr.find_all(["td", "th"])
    if not cells:
        return None

    # Skip the site's comment / co-requisite rows. A co-requisite is rendered as
    # a full-width comment row (<tr class="... jq_ResultRecordComment">) whose
    # text begins "Co-requisites ENGL-1301-C5 ...". It DOES carry a token, but it
    # is NOT a standalone section of this prefix -- so the bare token check below
    # would otherwise wrongly emit it as an extra course.
    classes = tr.get("class") or []
    if "jq_ResultRecordComment" in classes or \
            re.match(r"\s*co-?requisite", tr.get_text(" ", strip=True), re.I):
        return None

    cols = cols or {}
    title_idx = cols.get("title", 0)
    title_cell = cells[title_idx] if 0 <= title_idx < len(cells) else cells[0]

    m = TOKEN_SEARCH_RE.search(title_cell.get_text(" ", strip=True))
    if not m:
        return None  # header / comment / empty row
    parsed = parse_token(m.group(0))
    if not parsed:
        return None
    prefix, number, section = parsed
    start_date, end_date = extract_dates(cells, cols.get("dates"))
    location = extract_location(cells, cols.get("credits"))
    if not location and is_online:
        location = "Online"   # online classes have no campus in Loc/Credits
    return {
        "class_prefix": prefix,
        "class_number": number,
        "section_number": section,
        "professor": extract_professor(cells, cols.get("faculty")),
        "class_name": extract_class_name(title_cell, m.group(0)),
        "credit_hours": extract_credits(cells, cols.get("credits")),
        "syllabus_url": extract_syllabus(cells, cols.get("links"), page_url),
        "start_date": start_date,
        "end_date": end_date,
        "meeting_info": _cell_text(cells, cols.get("meeting")),
        "location": location,
        "class_features": extract_features(cells, cols.get("features"), page_url),
        "other_links": extract_other_links(cells, cols.get("links"), page_url),
    }


def _is_online_table(table) -> bool:
    """True if a table's caption marks it as the '100% On-Line Classes' table."""
    caption = table.find("caption")
    cap = caption.get_text(" ", strip=True).lower() if caption else ""
    return "on-line" in cap or "online" in cap


def extract_coreq_tokens(tr) -> list:
    """Co-requisite section token(s) from a "Co-requisites ..." comment row.

    A co-req is rendered as a comment row immediately after its parent class row,
    e.g. "Co-requisites ENGL-1301-C5 (4105172) Composition I". Returns the
    PREFIX-NUMBER-SECTION token(s) it lists, or [] if `tr` is not a co-req row.
    """
    text = tr.get_text(" ", strip=True)
    if not re.search(r"co-?requisite", text, re.I):
        return []
    return TOKEN_SEARCH_RE.findall(text)


def parse_prefix_html(html: str, page_url: str | None = None):
    """Parse a per-prefix page into a list of class-field dicts (see parse_row).

    Co-requisite comment rows are not emitted as their own courses; instead each
    one's token is recorded in the `corequisites` field of the preceding (parent)
    class row. A class with no co-requisites gets corequisites="none".
    """
    soup = BeautifulSoup(html, "lxml")
    rows = []
    for table in soup.find_all("table"):
        cols = find_columns(table)
        is_online = _is_online_table(table)
        current = None  # most recent real class row, to attach co-reqs to
        for tr in table.find_all("tr"):
            parsed = parse_row(tr, cols, page_url, is_online=is_online)
            if parsed is not None:
                parsed["corequisites"] = []   # collected from following co-req rows
                rows.append(parsed)
                current = parsed
            elif current is not None:
                current["corequisites"].extend(extract_coreq_tokens(tr))
    # Finalize: de-dupe and join token list -> string, or "none".
    for r in rows:
        toks = list(dict.fromkeys(r["corequisites"]))
        r["corequisites"] = " | ".join(toks) if toks else "none"
    return rows


def get_prefix_links(index_html: str, base_url: str = BASE_URL):
    """Extract {PREFIX: absolute_url} by FOLLOWING the index page's own links.

    Preferring the page's own hrefs (over reconstructing /{TERM}/Prefix/{PREFIX})
    makes us robust to path/case quirks. A real prefix is a 2-4 letter uppercase
    code; 'Back to Top'/nav anchors are filtered out.
    """
    soup = BeautifulSoup(index_html, "lxml")
    out: dict[str, str] = {}
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/Prefix/" not in href:
            continue
        code = href.rstrip("/").split("/")[-1].upper()
        if re.fullmatch(r"[A-Z]{2,4}", code):
            out.setdefault(code, urljoin(base_url, href))
    return out


# --------------------------------------------------------------------------- #
# Fetching  (requests primary, Playwright fallback, WAF-aware)
# --------------------------------------------------------------------------- #

class WafBlocked(Exception):
    """Raised when a response is an AWS WAF challenge / block, not the page."""


class FetchError(Exception):
    """Raised when a URL could not be fetched after all retries."""


class Fetcher:
    """Fetches rendered HTML, using requests first and Playwright as fallback.

    `mode` ('requests' or 'playwright') is decided up front by STEP 0, but a
    requests-mode fetcher will transparently fall back to Playwright for a given
    URL if it detects a WAF challenge mid-crawl (graceful degradation).
    """

    def __init__(self, delay: float = DEFAULT_DELAY, mode: str = "requests",
                 retries: int = 3, timeout: int = 30):
        self.delay = delay
        self.mode = mode
        self.retries = retries
        self.timeout = timeout
        self._last_request_ts = 0.0

        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        })

        # Playwright objects are created lazily (only if/when needed).
        self._pw = None
        self._browser = None
        self._context = None

    # -- politeness ------------------------------------------------------- #
    def _respect_delay(self):
        """Sleep so that consecutive requests are at least `delay` apart."""
        if self.delay <= 0:
            return
        elapsed = time.monotonic() - self._last_request_ts
        if elapsed < self.delay:
            time.sleep(self.delay - elapsed)

    # -- low-level requests GET ------------------------------------------- #
    def _requests_get(self, url: str) -> str:
        """GET via requests with retries + exponential backoff.

        Raises WafBlocked if the response is a WAF challenge after all retries;
        raises FetchError on persistent network/HTTP errors.
        """
        last_exc = None
        for attempt in range(1, self.retries + 1):
            self._respect_delay()
            try:
                resp = self.session.get(url, timeout=self.timeout)
                self._last_request_ts = time.monotonic()
            except requests.RequestException as exc:
                last_exc = exc
                wait = self.delay * (2 ** (attempt - 1))
                log.warning("  network error (attempt %d/%d): %s -- retrying in %.1fs",
                            attempt, self.retries, exc, wait)
                time.sleep(wait)
                continue

            if is_waf_challenge(resp.status_code, resp.text):
                last_exc = WafBlocked(f"HTTP {resp.status_code} WAF challenge")
                wait = self.delay * (2 ** (attempt - 1))
                log.warning("  WAF/blocked response (HTTP %d, attempt %d/%d) -- "
                            "retrying in %.1fs", resp.status_code, attempt,
                            self.retries, wait)
                time.sleep(wait)
                continue

            if resp.status_code != 200:
                last_exc = FetchError(f"HTTP {resp.status_code}")
                wait = self.delay * (2 ** (attempt - 1))
                log.warning("  HTTP %d (attempt %d/%d) -- retrying in %.1fs",
                            resp.status_code, attempt, self.retries, wait)
                time.sleep(wait)
                continue

            return resp.text

        if isinstance(last_exc, WafBlocked):
            raise last_exc
        raise FetchError(str(last_exc) if last_exc else "unknown error")

    def probe(self, url: str):
        """Single GET for STEP 0 detection -- no retries (don't poke the WAF).

        Returns (status_code, text); status is None on a network error.
        """
        self._respect_delay()
        try:
            resp = self.session.get(url, timeout=self.timeout)
            self._last_request_ts = time.monotonic()
            return resp.status_code, resp.text
        except requests.RequestException as exc:
            log.warning("  STEP 0 probe network error: %s", exc)
            return None, ""

    # -- Playwright fallback ---------------------------------------------- #
    def _ensure_playwright(self):
        if self._context is not None:
            return
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as exc:  # pragma: no cover - depends on environment
            raise FetchError(
                "Playwright is required for this site but is not installed. "
                "Run:  pip install playwright  &&  python -m playwright install chromium"
            ) from exc
        log.info("  starting headless Chromium (Playwright)...")
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        self._context = self._browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
            ),
            locale="en-US",
            viewport={"width": 1366, "height": 900},
        )
        # Light stealth: hide the webdriver flag the WAF looks for.
        self._context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
        )

    def _playwright_get(self, url: str, max_wait: int = 45) -> str:
        """Load `url` in headless Chromium, wait for the class tables to render.

        The AWS WAF "challenge" action serves a 202 interstitial whose JS mints
        an `aws-waf-token` cookie and reloads the page. That cookie persists on
        the shared browser context, so once any page clears the challenge the
        rest of the crawl reuses it. We poll until a PREFIX-NUMBER-SECTION token
        appears, and if the challenge stalls we nudge it with a single reload.
        Raises WafBlocked if it never clears (interactive CAPTCHA or an active
        rate-block).
        """
        # The WAF challenge page reloads itself; calling page.content()/title()
        # mid-navigation raises "page is navigating". Treat that as "not ready".
        def safe_content():
            try:
                return page.content()
            except Exception:
                return ""

        def safe_title():
            try:
                return page.title() or ""
            except Exception:
                return ""

        self._ensure_playwright()
        self._respect_delay()
        page = self._context.new_page()
        try:
            try:
                resp = page.goto(url, wait_until="domcontentloaded",
                                 timeout=self.timeout * 1000)
                status = resp.status if resp is not None else 200
            except Exception:
                status = 200  # navigation interrupted by the challenge reload
            nudged = False
            for i in range(max_wait):
                html = safe_content()
                if looks_rendered(html):
                    return html
                still_challenged = (is_waf_challenge(status, html)
                                    or "Verification" in safe_title())
                # If the challenge hasn't cleared after ~15s, reload once to nudge it.
                if still_challenged and not nudged and i >= 15:
                    log.info("  WAF challenge still pending after 15s; "
                             "reloading once to nudge it...")
                    try:
                        r2 = page.reload(wait_until="domcontentloaded",
                                         timeout=self.timeout * 1000)
                        if r2 is not None:
                            status = r2.status
                    except Exception:
                        pass
                    nudged = True
                page.wait_for_timeout(1000)
            html = safe_content()
            if looks_rendered(html):
                return html
            # No tokens after waiting: distinguish a real block from an empty page.
            if is_waf_challenge(status, html) or "Verification" in safe_title():
                raise WafBlocked(
                    f"Playwright: WAF challenge did not clear (HTTP {status}; "
                    "interactive CAPTCHA / active rate-block?)")
            return html  # genuinely empty page (e.g. a prefix with no sections)
        finally:
            self._last_request_ts = time.monotonic()
            page.close()

    # -- public API ------------------------------------------------------- #
    def get_html(self, url: str) -> str:
        """Return rendered HTML for `url`, using the active mode with fallback."""
        if self.mode == "playwright":
            return self._playwright_get(url)
        # requests mode, with automatic fallback to Playwright on a WAF block.
        try:
            return self._requests_get(url)
        except WafBlocked:
            log.warning("  requests blocked by WAF -- switching to Playwright.")
            self.mode = "playwright"
            return self._playwright_get(url)

    def close(self):
        try:
            if self._context is not None:
                self._context.close()
            if self._browser is not None:
                self._browser.close()
            if self._pw is not None:
                self._pw.stop()
        except Exception:  # pragma: no cover - best-effort cleanup
            pass
        self.session.close()


# --------------------------------------------------------------------------- #
# robots.txt
# --------------------------------------------------------------------------- #

def robots_allows(url: str) -> bool:
    """Check robots.txt with urllib.robotparser. Defaults to allow on errors.

    Returns True if crawling `url` is permitted (or robots.txt is missing /
    unreadable), False if explicitly disallowed.
    """
    rp = RobotFileParser()
    robots_url = urljoin(BASE_URL, "/robots.txt")
    rp.set_url(robots_url)
    try:
        rp.read()
    except Exception as exc:  # network error reading robots -> be permissive
        log.warning("Could not read robots.txt (%s); proceeding.", exc)
        return True
    return rp.can_fetch(USER_AGENT, url)


# --------------------------------------------------------------------------- #
# CSV  (incremental write, resume, dedupe)
# --------------------------------------------------------------------------- #

def load_existing(output_path: str):
    """Read an existing CSV; return (seen_keys, done_prefixes).

    seen_keys     -- set of (prefix, number, section, professor) for dedupe.
    done_prefixes -- set of class_prefix values already present (to skip on
                     --resume).

    Because co-requisite rows are skipped (see parse_row), each prefix page emits
    only its own prefix's sections, so done_prefixes contains exactly the prefix
    codes that have been crawled -- which is what --resume needs.
    """
    seen: set[tuple] = set()
    done: set[str] = set()
    if not os.path.exists(output_path):
        return seen, done
    with open(output_path, "r", newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            try:
                key = (row["class_prefix"], row["class_number"],
                       row["section_number"], row["professor"])
            except KeyError:
                continue
            seen.add(key)
            done.add(row["class_prefix"])
    return seen, done


# --------------------------------------------------------------------------- #
# STEP 0 -- choose the fetch path
# --------------------------------------------------------------------------- #

def choose_path(fetcher: Fetcher, acct_url: str) -> str:
    """STEP 0: decide 'requests' vs 'playwright' for THIS environment.

    Fetches the ACCT page once via requests and looks for a token. If the
    tables are present -> requests; if blocked/JS-injected -> playwright.
    """
    print("STEP 0: verifying how the class tables are delivered ...")
    status, html = fetcher.probe(acct_url)  # single shot -- no retries

    if status is None:
        print("STEP 0: requests could not reach the site -> using PLAYWRIGHT path.")
        return "playwright"
    if is_waf_challenge(status, html):
        print(f"STEP 0: requests hit an AWS WAF challenge (HTTP {status}) -> "
              "using PLAYWRIGHT path.")
        return "playwright"
    if looks_rendered(html):
        print("STEP 0: class tokens found in raw HTML -> using REQUESTS + "
              "BeautifulSoup path.")
        return "requests"
    print("STEP 0: no class tokens in raw HTML (JS-injected) -> using PLAYWRIGHT path.")
    return "playwright"


# --------------------------------------------------------------------------- #
# Crawl
# --------------------------------------------------------------------------- #

def crawl(term: str, output_path: str, delay: float, prefixes_filter=None,
          resume: bool = False, force: bool = False, year: int | None = None) -> int:
    """Run the full crawl. Returns process exit code (0 = ok)."""
    index_url = f"{BASE_URL}/{term}/ByPrefix"
    if year is None:
        year = datetime.now(timezone.utc).year
    term_year = f"{term.strip().title()} {year}"   # e.g. "Summer 2026"
    term_path = f"{term.strip().upper()}{year}"    # e.g. "SUMMER2026" (deterministic)
    log.info("Tagging every row with term_year=%r; fetching term path /%s/.",
             term_year, term_path)

    # --- robots.txt ------------------------------------------------------ #
    if not robots_allows(index_url):
        log.warning("robots.txt DISALLOWS %s", index_url)
        if not force:
            log.error("Refusing to crawl a disallowed path. Re-run with --force "
                      "to override.")
            return 2
        log.warning("--force given: proceeding despite robots.txt.")

    fetcher = Fetcher(delay=delay, mode="requests")

    try:
        # --- STEP 0: pick the fetch path --------------------------------- #
        acct_url = f"{BASE_URL}/{term_path}/Prefix/ACCT"
        fetcher.mode = choose_path(fetcher, acct_url)

        # --- discover prefix codes from the index ------------------------ #
        # Prefer the deterministic year-coded index (/SUMMER2026/ByPrefix); fall
        # back to the bare /{term}/ByPrefix the task documents if that 404s.
        link_map = {}
        for candidate in (f"{BASE_URL}/{term_path}/ByPrefix", index_url):
            log.info("Fetching prefix index: %s", candidate)
            try:
                index_html = fetcher.get_html(candidate)
            except (WafBlocked, FetchError) as exc:
                log.warning("Could not fetch index %s: %s", candidate, exc)
                continue
            link_map = get_prefix_links(index_html, BASE_URL)
            if link_map:
                break
            log.warning("No prefix links found on %s.", candidate)
        if not link_map:
            log.error("The site is blocking automated access (AWS WAF) or listed "
                      "no prefixes. Try a larger --delay, wait for the block to "
                      "clear, or ensure Playwright/Chromium is installed.")
            return 4

        # The index reliably gives us the PREFIX CODES (ACCT..WLDG). For the
        # per-prefix pages, though, we DON'T reuse the index's hrefs: the bare
        # /{Term}/ "current-term" alias (and the index's own links) were observed
        # to flip between cached term snapshots over time (SUMMER2020, FALL2021,
        # SPRING2025), which silently scrapes the WRONG term. Instead we fetch the
        # EXPLICIT, deterministic year-coded path (e.g. /SUMMER2026/Prefix/ACCT),
        # which returns exactly the requested term+year.
        followed_terms = {url.rstrip("/").split("/Prefix/")[0].rsplit("/", 1)[-1]
                          for url in link_map.values()}
        log.info("Index lists %d prefixes (its links target %s); fetching "
                 "per-prefix pages from the explicit term path /%s/.",
                 len(link_map), ", ".join(sorted(followed_terms)) or "?", term_path)

        def url_for(code: str) -> str:
            return f"{BASE_URL}/{term_path}/Prefix/{code}"

        # --- which prefixes to crawl ------------------------------------- #
        if prefixes_filter:
            requested = [p.strip().upper() for p in prefixes_filter if p.strip()]
            for code in requested:
                if code not in link_map:
                    log.warning("Prefix %s not listed on index; will try %s",
                                code, url_for(code))
            targets = {code: url_for(code) for code in requested}
        else:
            targets = {code: url_for(code) for code in link_map}

        # --- resume / dedupe state --------------------------------------- #
        seen, done = (set(), set())
        write_mode = "w"
        if resume:
            if os.path.exists(output_path):
                seen, done = load_existing(output_path)
                write_mode = "a"
                log.info("Resume: %d prefixes already in %s (%d rows); skipping them.",
                         len(done), output_path, len(seen))
            else:
                log.info("Resume requested but %s does not exist; starting fresh.",
                         output_path)

        sanity_mode = bool(prefixes_filter)
        sanity_rows_printed = 0

        # --- crawl loop -------------------------------------------------- #
        try:
            fh = open(output_path, write_mode, newline="", encoding="utf-8")
        except OSError as exc:
            log.error("Cannot open output file %s for writing: %s", output_path, exc)
            log.error("Is it open in Excel, or locked by OneDrive sync? Close it "
                      "(or pass --output to a different path) and re-run.")
            return 5
        with fh:
            writer = csv.writer(fh)
            if write_mode == "w":
                writer.writerow(CSV_COLUMNS)
                fh.flush()

            total_written = 0
            ordered = sorted(targets.items())
            for idx, (code, url) in enumerate(ordered, 1):
                if resume and code in done:
                    log.info("[%d/%d] %s -- already done, skipping.",
                             idx, len(ordered), code)
                    continue

                log.info("[%d/%d] %s -> %s", idx, len(ordered), code, url)
                date_accessed = now_utc_iso()  # captured at fetch time
                try:
                    html = fetcher.get_html(url)
                except (WafBlocked, FetchError) as exc:
                    log.error("  failed to fetch %s: %s -- continuing.", code, exc)
                    continue

                parsed = parse_prefix_html(html, page_url=url)
                new_rows = 0
                for row in parsed:
                    key = (row["class_prefix"], row["class_number"],
                           row["section_number"], row["professor"])
                    if key in seen:
                        continue
                    seen.add(key)
                    writer.writerow([
                        row["class_prefix"], row["class_number"],
                        row["section_number"], row["professor"], date_accessed,
                        row["class_name"], row["credit_hours"], term_year,
                        row["syllabus_url"], row["start_date"], row["end_date"],
                        row["meeting_info"], row["location"],
                        row["class_features"], row["other_links"],
                        row["corequisites"],
                    ])
                    new_rows += 1
                    total_written += 1

                    # Sanity print for targeted (--prefixes) runs.
                    if sanity_mode and sanity_rows_printed < 10:
                        if sanity_rows_printed == 0:
                            print("\n--- sanity check: first parsed rows ---")
                            print(f"{'prefix':6} {'num':5} {'sect':5} {'cr':3} "
                                  f"{'professor':24} class_name")
                        print(f"{row['class_prefix']:6} {row['class_number']:5} "
                              f"{row['section_number']:5} {row['credit_hours']:3} "
                              f"{row['professor'][:24]:24} {row['class_name']}")
                        sanity_rows_printed += 1
                        if sanity_rows_printed == 10:
                            print("--- (end sanity sample) ---\n")

                fh.flush()  # incremental: a crash now loses nothing
                os.fsync(fh.fileno())
                log.info("  parsed %d rows, %d new (%d total written).",
                         len(parsed), new_rows, total_written)

        log.info("Done. Wrote %d new rows to %s", total_written, output_path)
        return 0
    finally:
        fetcher.close()


# --------------------------------------------------------------------------- #
# Self-test (unit tests)  --  python scrape.py --selftest
# --------------------------------------------------------------------------- #

def _run_selftest() -> int:
    import unittest

    class TokenParserTests(unittest.TestCase):
        def test_basic_split(self):
            self.assertEqual(parse_token("ACCT-2301-9"), ("ACCT", "2301", "9"))

        def test_long_registration_style_section(self):
            self.assertEqual(parse_token("ACCT-2301-44490"), ("ACCT", "2301", "44490"))

        def test_three_digit_number(self):
            self.assertEqual(parse_token("BIOL-130-1"), ("BIOL", "130", "1"))

        def test_alphanumeric_section(self):
            self.assertEqual(parse_token("HIST-1301-9W"), ("HIST", "1301", "9W"))

        def test_rejects_non_tokens(self):
            self.assertIsNone(parse_token("not a token"))
            self.assertIsNone(parse_token("ACCT-2301"))      # missing section
            self.assertIsNone(parse_token("ACCTING-2301-9"))  # prefix too long
            self.assertIsNone(parse_token(""))

    class RowParserTests(unittest.TestCase):
        # Header + rows mirroring the live Summer 2026 markup: token in an <a>,
        # title as a bare text node, a "Class Started" status <div>, Loc/Credits,
        # Start/End dates, and a Class Syllabus link.
        TABLE = """
        <table>
          <caption>Campus Based Classes</caption>
          <tr><th>Course-Num-Sect (Reg#) Title</th><th>Class Meeting Information</th>
              <th>Faculty Information</th><th>Loc / Credits</th>
              <th>Start / End Dates Open Seats / Capacity</th>
              <th>Class Features</th><th>Links</th></tr>
          <tr>
            <th><a href="https://x/view_syllabus?course_id=1"
                   title="Class Syllabus for ACCT-2301-9">ACCT-2301-9</a><br>
                Prin, of Financial Accounting<div><span>Class Started</span></div></th>
            <td>N222 In-Person Lecture M T W R 05:30 PM - 07:30 PM</td>
            <td><a href="mailto:gz@dcccd.edu">Zeledon Chaves, Gilberto</a> / Vita</td>
            <td>EFC 3</td>
            <td>Jun 8, 2026 Jul 9, 2026 (5 weeks) Class Started</td>
            <td>eCampus <a href="https://schedule.dallascollege.edu/x/Topic/Night">Night Classes</a></td>
            <td><a href="https://x/view_syllabus?course_id=1">Class Syllabus (opens in a new tab/window)</a>
                <a href="https://bkstr.com/abc">Course Materials: Lecture (opens in a new tab/window)</a></td>
          </tr>
          <tr class="jq_ResultRecord jq_ResultRecordComment">
            <td colspan="7">Co-requisites ENGL-1301-C9 (4105172) Composition I J118</td>
          </tr>
          <tr><td colspan="7">NOTE: This section requires a lab fee.</td></tr>
          <tr>
            <th><a href="/v?course_id=2" title="Class Syllabus for BIOL-1406-40">BIOL-1406-40</a><br>General Biology I<div>Open</div></th>
            <td>LEC</td><td></td><td>NLC 4</td>
            <td>Jun 8, 2026 Aug 1, 2026 (8 weeks)</td><td>eCampus</td>
            <td>Textbook Info</td>
          </tr>
        </table>"""

        def test_full_table_extracts_all_fields(self):
            rows = parse_prefix_html(self.TABLE,
                                     page_url="https://schedule.dallascollege.edu/SUMMER/Prefix/ACCT")
            self.assertEqual(len(rows), 2)
            r0 = rows[0]
            # Token-derived fields unaffected by commas in title OR instructor name.
            self.assertEqual(
                (r0["class_prefix"], r0["class_number"], r0["section_number"]),
                ("ACCT", "2301", "9"))
            self.assertEqual(r0["professor"], "Zeledon Chaves, Gilberto")
            self.assertEqual(r0["class_name"], "Prin, of Financial Accounting")
            self.assertEqual(r0["credit_hours"], "3")
            self.assertEqual(r0["start_date"], "Jun 8, 2026")
            self.assertEqual(r0["end_date"], "Jul 9, 2026")
            self.assertEqual(r0["syllabus_url"], "https://x/view_syllabus?course_id=1")
            self.assertEqual(r0["meeting_info"],
                             "N222 In-Person Lecture M T W R 05:30 PM - 07:30 PM")
            self.assertEqual(r0["location"], "EFC")  # "EFC 3" minus the credits
            # Class Features: plain tag kept, linked tag carries its URL.
            self.assertEqual(
                r0["class_features"],
                "eCampus | Night Classes (https://schedule.dallascollege.edu/x/Topic/Night)")
            # other_links: syllabus excluded, "(opens in a new tab/window)" stripped.
            self.assertEqual(r0["other_links"],
                             "Course Materials: Lecture (https://bkstr.com/abc)")
            # corequisites: the following "Co-requisites ENGL-1301-C9 ..." row's token.
            self.assertEqual(r0["corequisites"], "ENGL-1301-C9")

        def test_staff_and_relative_syllabus_and_no_enddate(self):
            rows = parse_prefix_html(self.TABLE, page_url="https://schedule.dallascollege.edu/x/")
            r1 = rows[1]
            self.assertEqual(
                (r1["class_prefix"], r1["class_number"], r1["section_number"]),
                ("BIOL", "1406", "40"))
            self.assertEqual(r1["professor"], "Staff")        # empty faculty cell
            self.assertEqual(r1["class_name"], "General Biology I")
            self.assertEqual(r1["credit_hours"], "4")
            self.assertEqual(r1["start_date"], "Jun 8, 2026")
            self.assertEqual(r1["end_date"], "Aug 1, 2026")
            # Relative syllabus href on the title-cell anchor -> made absolute.
            self.assertEqual(r1["syllabus_url"],
                             "https://schedule.dallascollege.edu/v?course_id=2")
            self.assertEqual(r1["meeting_info"], "LEC")
            self.assertEqual(r1["location"], "NLC")          # "NLC 4" minus credits
            self.assertEqual(r1["class_features"], "eCampus")  # plain tag, no links
            self.assertEqual(r1["other_links"], "")          # no anchors in Links cell
            self.assertEqual(r1["corequisites"], "none")     # this class has no co-req

        def test_online_class_location_is_Online(self):
            # In the "100% On-Line Classes" table the Loc/Credits cell is just the
            # credit number (no campus) -> location should be "Online", not "".
            online = """
            <table><caption>100% On-Line Classes</caption>
              <tr><th>Course-Num-Sect (Reg#) Title</th><th>Loc / Credits</th></tr>
              <tr><th><a href="/v">ACCT-2301-44490</a><br>Prin of Accounting<div>Open</div></th>
                  <td>3</td></tr></table>"""
            r = parse_prefix_html(online)[0]
            self.assertEqual(r["section_number"], "44490")
            self.assertEqual(r["credit_hours"], "3")
            self.assertEqual(r["location"], "Online")
            # A campus row with a blank Loc must NOT be relabeled "Online".
            campus = ('<table><caption>Campus Based Classes</caption>'
                      '<tr><th>Course-Num-Sect (Reg#) Title</th><th>Loc / Credits</th></tr>'
                      '<tr><th>ACCT-2301-9 Prin</th><td>3</td></tr></table>')
            self.assertEqual(parse_prefix_html(campus)[0]["location"], "")

        def test_comment_and_header_rows_are_skipped(self):
            # The colspan NOTE row in TABLE must not appear; only 2 real rows.
            rows = parse_prefix_html(self.TABLE)
            self.assertEqual(len(rows), 2)
            header = ("<table><tr><th>Course-Num-Sect (Reg#) Title</th>"
                      "<th>Faculty Information</th></tr></table>")
            self.assertIsNone(parse_row(BeautifulSoup(header, "lxml").find("tr")))

        def test_corequisite_rows_are_not_emitted_as_courses(self):
            # The co-req comment row carries a token (ENGL-1301-C9) but must NOT
            # become a course of this prefix (the bug reported on the DIRW page);
            # instead it is captured in the parent row's `corequisites` column.
            rows = parse_prefix_html(self.TABLE)
            self.assertNotIn("ENGL", {r["class_prefix"] for r in rows})
            self.assertEqual(rows[0]["corequisites"], "ENGL-1301-C9")  # on parent
            # Multiple co-req rows after one class accumulate (de-duped, joined).
            multi = """
            <table>
              <tr><th>ACCT-2301-9 Prin</th></tr>
              <tr><td>Co-requisites ENGL-1301-C5 (1) Composition I</td></tr>
              <tr><td>Co-requisites HUMA-1301-C5 (2) Humanities</td></tr>
            </table>"""
            self.assertEqual(parse_prefix_html(multi)[0]["corequisites"],
                             "ENGL-1301-C5 | HUMA-1301-C5")
            # Both detection signals work on their own:
            coreq_classed = ('<table><tr class="jq_ResultRecord jq_ResultRecordComment">'
                             '<td colspan="7">Co-requisites ENGL-1301-C9 (1) Composition I</td>'
                             '</tr></table>')
            coreq_text = ('<table><tr><td colspan="7">'
                          'Co-requisites ENGL-1301-C9 (1) Composition I</td></tr></table>')
            self.assertIsNone(parse_row(BeautifulSoup(coreq_classed, "lxml").find("tr")))
            self.assertIsNone(parse_row(BeautifulSoup(coreq_text, "lxml").find("tr")))

    class PrefixLinkTests(unittest.TestCase):
        def test_follows_links_and_filters_nav(self):
            html = """
            <div>
              <a href="/SUMMER/Prefix/ACCT">ACCT</a>
              <a href="/SUMMER/Prefix/BIOL">BIOL</a>
              <a href="#top">Back to Top</a>
              <a href="/SUMMER/ByPrefix">By Prefix</a>
              <a href="/SUMMER/Prefix/WLDG">WLDG</a>
            </div>"""
            links = get_prefix_links(html, BASE_URL)
            self.assertEqual(set(links), {"ACCT", "BIOL", "WLDG"})
            self.assertEqual(links["ACCT"],
                             "https://schedule.dallascollege.edu/SUMMER/Prefix/ACCT")

    class WafDetectionTests(unittest.TestCase):
        def test_detects_challenge(self):
            self.assertTrue(is_waf_challenge(202, "<script>window.awsWafCookie</script>"))
            self.assertTrue(is_waf_challenge(403, "403 Forbidden"))
            self.assertTrue(is_waf_challenge(200, "<title>Human Verification</title>"))

        def test_allows_real_page(self):
            self.assertFalse(is_waf_challenge(200, "<td>ACCT-2301-9</td>"))

    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    for cls in (TokenParserTests, RowParserTests, PrefixLinkTests, WafDetectionTests):
        suite.addTests(loader.loadTestsFromTestCase(cls))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Scrape the Dallas College credit class schedule for a term.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--term", default=DEFAULT_TERM,
                   help="Term to scrape (e.g. Summer, Fall, Spring).")
    p.add_argument("--year", type=int, default=None,
                   help="Calendar year for the term_year column (default: current "
                        "year). E.g. --term Summer --year 2026 -> 'Summer 2026'.")
    p.add_argument("--output", default=None,
                   help="Output CSV path (default: dallas_classes_{year}_{term}.csv).")
    p.add_argument("--delay", type=float, default=DEFAULT_DELAY,
                   help="Seconds to wait between requests (politeness).")
    p.add_argument("--prefixes", default=None,
                   help="Comma-separated subset of prefixes to crawl, e.g. ACCT,BIOL. "
                        "Triggers a sanity print of the first ~10 parsed rows.")
    p.add_argument("--resume", action="store_true",
                   help="Skip prefixes already present in the output file.")
    p.add_argument("--force", action="store_true",
                   help="Crawl even if robots.txt disallows the path.")
    p.add_argument("--selftest", action="store_true",
                   help="Run the built-in unit tests and exit.")
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )

    if args.selftest:
        return _run_selftest()

    # Resolve the year now (default: current year) so it appears in the default
    # filename instead of "None".
    if args.year is None:
        args.year = datetime.now(timezone.utc).year
    output_path = args.output or f"dallas_classes_{args.year}_{args.term}.csv"
    prefixes_filter = args.prefixes.split(",") if args.prefixes else None

    log.info("Term=%s  Output=%s  Delay=%.1fs  Prefixes=%s  Resume=%s",
             args.term, output_path, args.delay,
             prefixes_filter or "ALL", args.resume)

    try:
        return crawl(
            term=args.term,
            output_path=output_path,
            delay=args.delay,
            prefixes_filter=prefixes_filter,
            resume=args.resume,
            force=args.force,
            year=args.year,
        )
    except KeyboardInterrupt:
        log.warning("Interrupted by user. Partial output is saved in %s", output_path)
        return 130


if __name__ == "__main__":
    sys.exit(main())
