"""File archiver: fetch Concourse syllabus + instructor-CV HTML to disk.

Stage-1 acquisition for the RAG pipeline (see docs/DATA_PIPELINE.md). Saves
RAW HTML bytes to apps/data/raw/ plus a JSONL manifest, so every later stage
(parse, extract, load) can run and re-run without touching the network (the
issue #34 "save original HTML" rule). Idempotent/resumable: a target already
on disk is skipped, so the job can be stopped and restarted freely; pass
--refresh-before to re-fetch files older than a given moment.

Layout under --out (default: apps/data/raw/):
    schedule/dallas_classes_<YYYY>_<Term>.csv   inputs (eConnect schedule scrapes)
    syllabi/<TERMCODE>/<course_id>.html         one per section (2026SP / 2026SU / ...)
    cv/<professor-slug>.html                    one per DISTINCT professor
    manifests/archive_<run_id>.jsonl            append-only: one line per fetch

Work-list = any 16-column eConnect schedule CSV (class_prefix, class_number,
section_number, professor, syllabus_url, term_year, meeting_info, ...);
a lighter course_id/course_num_sect CSV is also auto-detected by header.

CLI (run from apps/data):
    # CVs for every distinct professor across all terms (small, run first)
    python -m pipeline.archive_syllabi_cv --kind cv \
        --worklist "raw/schedule/dallas_classes_2026_Spring.csv" \
        --worklist "raw/schedule/dallas_classes_2026_Summer.csv"

    # one term's syllabi, one representative per (professor, course, modality)
    python -m pipeline.archive_syllabi_cv --kind syllabus \
        --worklist "raw/schedule/dallas_classes_2026_Spring.csv"

    # every section of specific sessions (not just representatives)
    python -m pipeline.archive_syllabi_cv --kind syllabus --all-sections \
        --worklist "raw/schedule/dallas_classes_2026_Summer.csv" \
        --sessions "Summer Session II"

    # refresh pass: re-fetch anything last fetched before July 12 (UTC)
    python -m pipeline.archive_syllabi_cv --kind syllabus \
        --worklist "raw/schedule/dallas_classes_2026_Summer.csv" \
        --refresh-before 2026-07-12T00:00:00
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import requests

CONCOURSE = "https://dallascollege.campusconcourse.com"
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)
DEFAULT_DELAY_S = 2.0  # polite; Concourse (a vendor) tolerated faster
BREAK_AFTER_CONSEC_ERRORS = 3  # circuit breaker
COURSE_ID_RE = re.compile(r"course_id=(\d+)")


# ----------------------------------------------------------------------------- work-list loading


def _slug(name: str) -> str:
    """Fold a 'First Last' (or 'Last, First') name to a filesystem-safe slug."""
    if "," in name:
        last, _, first = name.partition(",")
        name = f"{first.strip()} {last.strip()}"
    name = (
        unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    )
    name = re.sub(r"[^a-zA-Z0-9]+", "-", name).strip("-").lower()
    return name or "unknown"


def _modality_from_meeting(meeting: str) -> str:
    m = meeting or ""
    has_inperson = "In-Person" in m or "Blended" in m or "Hybrid" in m
    has_online = "Online" in m
    if "Hybrid" in m or "Blended" in m or (has_inperson and has_online):
        return "hybrid"
    if has_online and not has_inperson:
        return "online"
    if has_inperson:
        return "in_person"
    return "unknown"


def load_worklist(path: Path) -> list[dict]:
    """Return normalized records: course_id, course_code, section, professor,
    term_code, session, modality."""
    rows: list[dict] = []
    with path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        cols = set(reader.fieldnames or [])
        is_schedule = "syllabus_url" in cols and "class_prefix" in cols
        for r in reader:
            r = {
                k: (v.strip() if isinstance(v, str) else v)
                for k, v in r.items()
            }
            if is_schedule:
                cid = None
                search_url = None
                syl_url = r.get("syllabus_url", "")
                m = COURSE_ID_RE.search(syl_url)
                if m:
                    cid = m.group(1)
                elif "campusconcourse.com/search" in syl_url:
                    # archived terms (e.g. Fall 2025) link a Concourse SEARCH
                    # instead of the syllabus itself; resolved at fetch time
                    search_url = syl_url
                rows.append(
                    {
                        "course_id": cid,
                        "search_url": search_url,
                        "course_code": f"{r.get('class_prefix', '')} {r.get('class_number', '')}".strip(),
                        "section": r.get("section_number", ""),
                        "professor": r.get("professor", ""),
                        "term_code": _term_code(r.get("term_year", "")),
                        "session": _session_label(r.get("class_features", "")),
                        "modality": _modality_from_meeting(
                            r.get("meeting_info", "")
                        ),
                    }
                )
            else:  # summer work-list
                code_sect = r.get("course_num_sect", "")
                cc, _, sect = code_sect.rpartition("-")
                cc = cc.replace("-", " ") if cc else ""
                rows.append(
                    {
                        "course_id": r.get("course_id"),
                        "course_code": cc,
                        "section": sect,
                        "professor": r.get("professor", ""),
                        "term_code": "2026SU",
                        "session": r.get("session", ""),
                        "modality": "unknown",
                    }
                )
    return rows


def _term_code(term_year: str) -> str:
    t = term_year.lower()
    yr = re.search(r"(20\d{2})", term_year)
    y = yr.group(1) if yr else "2026"
    if "spring" in t:
        return f"{y}SP"
    if "summer" in t:
        return f"{y}SU"
    if "fall" in t:
        return f"{y}FA"
    if "winter" in t:
        return f"{y}WI"
    return f"{y}SP"


_SESSION_RE = re.compile(
    r"(Winter Term|(?:Spring|Summer|Fall|Winter) (?:First|Second) 8 Week Session|"
    r"Flex Term \w+|Summer Session I{1,2}|May Term|Night Classes)"
)


def _session_label(class_features: str) -> str:
    labels = _SESSION_RE.findall(class_features or "")
    labels = [l for l in labels if l != "Night Classes"]
    return labels[0] if labels else ""


# ----------------------------------------------------------------------------- fetching


class Archiver:
    def __init__(
        self,
        out: Path,
        delay: float,
        run_id: str,
        refresh_before: datetime | None = None,
    ):
        self.out = out
        self.delay = delay
        self.refresh_before = refresh_before
        self.sess = requests.Session()
        self.sess.headers.update(
            {
                "User-Agent": BROWSER_UA,
                "Accept": "text/html,application/xhtml+xml",
            }
        )
        self.manifest = out / "manifests" / f"archive_{run_id}.jsonl"
        self.manifest.parent.mkdir(parents=True, exist_ok=True)
        self.consec_errors = 0
        self.n_new = self.n_skip = self.n_fail = 0
        # search-URL -> course_id resolution cache (archived terms like Fall
        # 2025 link a Concourse search page instead of the syllabus; resolving
        # costs one fetch, so results persist across runs)
        self.resolve_cache_path = out / "manifests" / "resolve_cache.jsonl"
        self.resolve_cache: dict[str, str] = {}
        if self.resolve_cache_path.exists():
            for line in self.resolve_cache_path.read_text(
                encoding="utf-8"
            ).splitlines():
                try:
                    rec = json.loads(line)
                    self.resolve_cache[rec["search_url"]] = rec["course_id"]
                except (json.JSONDecodeError, KeyError):
                    continue

    _SYL_LINK_RE = re.compile(r"view_syllabus\?course_id=(\d+)")
    _SECTION_RE = re.compile(r"Section\s+([A-Za-z0-9]+)")

    def resolve_course_id(
        self, search_url: str, section: str, professor: str
    ) -> str | None:
        """Resolve a Concourse search URL to the section's course_id.

        The results page lists candidate syllabi as 'CODE Term Section N
        First Last' rows; we pick the row whose Section matches, falling back
        to a single-candidate result, then to a professor-name match."""
        cached = self.resolve_cache.get(search_url)
        if cached:
            return cached
        try:
            resp = self.sess.get(search_url, timeout=60)
            resp.raise_for_status()
            html = resp.text
        except Exception as e:  # noqa: BLE001
            print(
                f"  RESOLVE ERROR {search_url}: {type(e).__name__}: {e}",
                file=sys.stderr,
            )
            return None
        finally:
            time.sleep(self.delay)
        matches = list(self._SYL_LINK_RE.finditer(html))
        if not matches:
            return None
        # candidate rows: text from each link to the next link
        cands = []
        for i, m in enumerate(matches):
            end = (
                matches[i + 1].start()
                if i + 1 < len(matches)
                else m.end() + 600
            )
            row_text = re.sub(r"<[^>]+>", " ", html[m.start() : end])
            sec_m = self._SECTION_RE.search(row_text)
            cands.append(
                (m.group(1), sec_m.group(1) if sec_m else None, row_text)
            )
        chosen = None
        for cid, sec, _ in cands:
            if sec is not None and sec.lower() == (section or "").lower():
                chosen = cid
                break
        if chosen is None and len({c[0] for c in cands}) == 1:
            chosen = cands[0][0]
        if chosen is None and professor:
            last, _, first = professor.partition(",")
            display = f"{first.strip()} {last.strip()}".strip()
            hits = [
                c for c in cands if display and display.lower() in c[2].lower()
            ]
            if len({c[0] for c in hits}) == 1:
                chosen = hits[0][0]
        if chosen:
            self.resolve_cache[search_url] = chosen
            with self.resolve_cache_path.open("a", encoding="utf-8") as fh:
                fh.write(
                    json.dumps(
                        {
                            "search_url": search_url,
                            "course_id": chosen,
                            "section": section,
                        }
                    )
                    + "\n"
                )
        return chosen

    def _is_fresh(self, dest: Path) -> bool:
        """True = keep the archived copy (skip). With --refresh-before, a file
        fetched BEFORE that moment is stale and gets re-fetched/overwritten;
        the manifest keeps one line per fetch, so history is preserved there."""
        if not dest.exists():
            return False
        if self.refresh_before is None:
            return True
        mtime = datetime.fromtimestamp(dest.stat().st_mtime, tz=timezone.utc)
        return mtime >= self.refresh_before

    def _record(self, rec: dict) -> None:
        with self.manifest.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(rec) + "\n")

    def _write_bytes(self, dest: Path, body: bytes) -> None:
        """Write to a OneDrive-synced folder, tolerating transient sync locks
        (retry a few times) — a local write hiccup is NOT a network block."""
        dest.parent.mkdir(parents=True, exist_ok=True)
        for attempt in range(4):
            try:
                dest.write_bytes(body)
                return
            except (PermissionError, OSError) as e:
                if attempt == 3:
                    raise
                print(
                    f"  write retry {attempt + 1} ({type(e).__name__}) {dest.name}",
                    file=sys.stderr,
                )
                time.sleep(1.5 * (attempt + 1))

    def fetch_to(self, url: str, dest: Path, meta: dict) -> None:
        if self._is_fresh(dest):  # resumable: already archived
            self.n_skip += 1
            return
        # --- network leg: only these failures trip the circuit breaker -------
        try:
            resp = self.sess.get(url, timeout=60)
            status = resp.status_code
            if status in (403, 429):
                raise RuntimeError(f"HTTP {status} — backing off")
            resp.raise_for_status()
            body = resp.content
            self.consec_errors = 0
        except Exception as e:  # noqa: BLE001 — network failure
            self.n_fail += 1
            self.consec_errors += 1
            self._record(
                {
                    **meta,
                    "source_url": url,
                    "raw_path": None,
                    "status": "error",
                    "error": f"{type(e).__name__}: {e}",
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            print(
                f"  NET ERROR {url}: {type(e).__name__}: {e}", file=sys.stderr
            )
            if self.consec_errors >= BREAK_AFTER_CONSEC_ERRORS:
                raise SystemExit(
                    f"circuit breaker: {self.consec_errors} consecutive network "
                    f"errors — stopping. Re-run to resume (archived files skip)."
                )
            time.sleep(self.delay)
            return
        # --- disk leg: retried locally, never trips the network breaker ------
        try:
            self._write_bytes(dest, body)
        except Exception as e:  # noqa: BLE001 — persistent local write failure
            self.n_fail += 1
            self._record(
                {
                    **meta,
                    "source_url": url,
                    "raw_path": None,
                    "status": "write_error",
                    "error": f"{type(e).__name__}: {e}",
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            print(
                f"  WRITE ERROR {dest}: {type(e).__name__}: {e}",
                file=sys.stderr,
            )
            time.sleep(self.delay)
            return
        self._record(
            {
                **meta,
                "source_url": url,
                "raw_path": str(dest.relative_to(self.out)),
                "sha256": hashlib.sha256(body).hexdigest(),
                "bytes": len(body),
                "status": status,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        self.n_new += 1
        time.sleep(self.delay)


# ----------------------------------------------------------------------------- plans


def plan_cv(rows: list[dict]) -> list[dict]:
    """One target per distinct professor (across all work-lists)."""
    by_prof: dict[str, dict] = {}
    for r in rows:
        prof = r.get("professor", "")
        if not prof or prof.lower() in {"to be announced", "staff", "tba"}:
            continue
        if not (r.get("course_id") or r.get("search_url")):
            continue
        slug = _slug(prof)
        cur = by_prof.get(slug)
        # prefer a row with a direct course_id (no resolution fetch needed)
        if cur is None or (not cur.get("course_id") and r.get("course_id")):
            by_prof[slug] = r
    return list(by_prof.values())


def _rep_order(r: dict) -> tuple:
    """Deterministic representative ordering: direct-course_id rows first
    (lowest id), then search-URL rows by natural section order."""
    if r.get("course_id"):
        return (0, int(r["course_id"]), "")
    sect = r.get("section", "")
    return (1, 0, sect.zfill(8))


def plan_syllabus(rows: list[dict], representatives: bool) -> list[dict]:
    """All sections, or one representative per (professor, course, modality)."""
    rows = [r for r in rows if r.get("course_id") or r.get("search_url")]
    if not representatives:
        return rows
    by_key: dict[tuple, dict] = {}
    for r in rows:
        key = (
            _slug(r.get("professor", "")),
            r.get("course_code", ""),
            r.get("modality", ""),
        )
        cur = by_key.get(key)
        if cur is None or _rep_order(r) < _rep_order(cur):
            by_key[key] = r
    return list(by_key.values())


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument(
        "--worklist",
        action="append",
        required=True,
        type=Path,
        help="schedule CSV or summer work-list (repeatable)",
    )
    ap.add_argument("--kind", choices=["syllabus", "cv"], required=True)
    ap.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "raw",
    )
    ap.add_argument(
        "--sessions",
        default=None,
        help="comma-list KEEP filter on the session label (syllabus only)",
    )
    ap.add_argument(
        "--exclude-sessions",
        default=None,
        help="comma-list DROP filter on the session label (e.g. "
        "'Summer Session II' to skip a not-yet-started session)",
    )
    ap.add_argument(
        "--all-sections",
        action="store_true",
        help="syllabus: fetch every section, not just representatives",
    )
    ap.add_argument(
        "--refresh-before",
        default=None,
        metavar="ISO8601",
        help="re-fetch (overwrite) files last fetched before this UTC "
        "moment, e.g. 2026-07-12T00:00:00 — use to pick up "
        "last-minute syllabus edits; without it, existing files "
        "are always skipped",
    )
    ap.add_argument("--delay", type=float, default=DEFAULT_DELAY_S)
    ap.add_argument(
        "--limit", type=int, default=None, help="cap targets (testing)"
    )
    args = ap.parse_args(argv)

    refresh_before = None
    if args.refresh_before:
        refresh_before = datetime.fromisoformat(args.refresh_before)
        if refresh_before.tzinfo is None:
            refresh_before = refresh_before.replace(tzinfo=timezone.utc)

    rows: list[dict] = []
    for wl in args.worklist:
        got = load_worklist(wl)
        print(f"loaded {len(got)} rows from {wl.name}")
        rows.extend(got)

    if args.sessions:
        wanted = {s.strip() for s in args.sessions.split(",")}
        rows = [r for r in rows if r.get("session") in wanted]
        print(f"{len(rows)} rows after keep-session filter {sorted(wanted)}")
    if args.exclude_sessions:
        drop = {s.strip() for s in args.exclude_sessions.split(",")}
        before = len(rows)
        rows = [r for r in rows if r.get("session") not in drop]
        print(
            f"{len(rows)} rows after dropping {sorted(drop)} (removed {before - len(rows)})"
        )

    if args.kind == "cv":
        targets = plan_cv(rows)
        endpoint = "view_cv_information_for_course"
    else:
        targets = plan_syllabus(rows, representatives=not args.all_sections)
        endpoint = "view_syllabus"

    if args.limit:
        targets = targets[: args.limit]

    run_id = f"{args.kind}_{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}"
    arc = Archiver(args.out, args.delay, run_id, refresh_before=refresh_before)
    print(
        f"kind={args.kind}  targets={len(targets)}  delay={args.delay}s  "
        f"out={args.out}\nmanifest={arc.manifest}\n"
    )

    for i, r in enumerate(targets, 1):
        cid = r["course_id"]
        if not cid:
            # archived-term row: needs search-URL resolution first. CV dests
            # are slug-keyed, so skip cheaply before spending the resolve fetch.
            if args.kind == "cv":
                dest = args.out / "cv" / f"{_slug(r['professor'])}.html"
                if arc._is_fresh(dest):
                    arc.n_skip += 1
                    continue
            cid = arc.resolve_course_id(
                r.get("search_url", ""),
                r.get("section", ""),
                r.get("professor", ""),
            )
            if not cid:
                arc.n_fail += 1
                arc._record(
                    {
                        "kind": args.kind,
                        "course_id": None,
                        "course_code": r.get("course_code"),
                        "section": r.get("section"),
                        "professor": r.get("professor"),
                        "term_code": r.get("term_code"),
                        "source_url": r.get("search_url"),
                        "raw_path": None,
                        "status": "resolve_error",
                        "error": "could not resolve search URL to a course_id",
                        "fetched_at": datetime.now(timezone.utc).isoformat(),
                    }
                )
                continue
        url = f"{CONCOURSE}/{endpoint}?course_id={cid}"
        if args.kind == "cv":
            dest = args.out / "cv" / f"{_slug(r['professor'])}.html"
        else:
            dest = args.out / "syllabi" / r["term_code"] / f"{cid}.html"
        meta = {
            "kind": args.kind,
            "course_id": cid,
            "course_code": r.get("course_code"),
            "section": r.get("section"),
            "professor": r.get("professor"),
            "term_code": r.get("term_code"),
            "session": r.get("session"),
            "modality": r.get("modality"),
        }
        if r.get("search_url"):
            meta["resolved_from"] = r["search_url"]
        arc.fetch_to(url, dest, meta)
        if i % 50 == 0 or i == len(targets):
            print(
                f"[{i}/{len(targets)}] new={arc.n_new} skip={arc.n_skip} "
                f"fail={arc.n_fail}"
            )

    print(
        f"\nDONE {args.kind}: {arc.n_new} new, {arc.n_skip} already-archived, "
        f"{arc.n_fail} failed\nmanifest: {arc.manifest}"
    )
    return arc


if __name__ == "__main__":
    main()
