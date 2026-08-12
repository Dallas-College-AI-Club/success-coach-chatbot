"""Self-healing sequential driver for the archive backfill (one process =
polite rate). Runs to completion without supervision.

Term-agnostic: it discovers EVERY schedule CSV in apps/data/raw/schedule/
(dallas_classes_*.csv) and processes them. Steps, in priority order (smallest/
highest-value first), all resumable so a stop/restart loses nothing:
    1. CVs      — every distinct professor across ALL schedule CSVs (deduped)
    2. Syllabi  — one step per term CSV; one representative per
                  (professor, course, modality)

Each step re-runs until it drains (a full pass fetches nothing new). If the
Concourse circuit breaker trips (sustained network errors / a block), the step
backs off with escalating delay and retries — so a transient block is waited
out, not hammered, and the job still finishes. A step gives up only after
MAX_BREAKER_TRIPS consecutive trips (logged, then on to the next step).

    python -m pipeline.run_archive_today                 # all terms in schedule/
    python -m pipeline.run_archive_today 2025_Fall 2025_Spring   # only these
    python -m pipeline.run_archive_today 2026_Summer --refresh-before 2026-07-12T00:00:00
"""

from __future__ import annotations

import argparse
import os
import time
from pathlib import Path

try:
    from dallasai.pipeline import archive_syllabi_cv as A
except ModuleNotFoundError:
    from apps.data.dallasai.pipeline import archive_syllabi_cv as A

# Raw corpus lives in apps/data/raw/ (gitignored, OneDrive-shared). This file is
# apps/data/dallasai/pipeline/run_archive_today.py, so apps/data is three parents
# up — not two. Prefer $RAW_ROOT when it is set, which is what every other stage
# keys on.
DATA = Path(
    os.environ.get("RAW_ROOT")
    or Path(__file__).resolve().parent.parent.parent / "raw"
)
SCHEDULE_DIR = DATA / "schedule"
DELAY = "2"

MAX_BREAKER_TRIPS = 12                       # per step, before giving up
BACKOFFS = [60, 120, 300, 600, 900, 1800]    # seconds; last value repeats


def _backoff(trip: int) -> int:
    return BACKOFFS[min(trip, len(BACKOFFS) - 1)]


def run_step(name: str, args: list[str]) -> None:
    """Re-run one archiver step until it completes a full pass without the
    circuit breaker tripping. A normal return from A.main() = the pass drained
    (every target is on disk or permanently failed); we're done with the step."""
    print("\n" + "=" * 72 + f"\nSTEP: {name}\n$ archive_syllabi_cv {' '.join(args)}\n"
          + "=" * 72, flush=True)
    trips = 0
    while True:
        try:
            arc = A.main(args)
            # A full pass that fetched nothing new = drained (everything is on
            # disk or permanently failing). Otherwise re-run: a new pass retries
            # this pass's transient failures (they never landed on disk).
            if arc is None or arc.n_new == 0:
                print(f"[STEP DONE: {name} — {getattr(arc,'n_fail',0)} unresolved]",
                      flush=True)
                return
            print(f"[pass fetched {arc.n_new} new, {arc.n_fail} failed; "
                  f"re-running {name} to retry gaps]", flush=True)
            trips = 0  # a productive pass resets the breaker-trip counter
            continue
        except SystemExit as e:
            msg = e.code if isinstance(e.code, str) else f"exit {e.code}"
            if isinstance(e.code, str) and "circuit breaker" in e.code:
                trips += 1
                if trips >= MAX_BREAKER_TRIPS:
                    print(f"[STEP GAVE UP after {trips} breaker trips: {name}] "
                          f"re-run later to finish (resumable).", flush=True)
                    return
                wait = _backoff(trips - 1)
                print(f"[breaker trip {trips}/{MAX_BREAKER_TRIPS} on {name}; "
                      f"backing off {wait}s then resuming]", flush=True)
                time.sleep(wait)
                continue
            # argparse / other SystemExit — not recoverable by retry
            print(f"[STEP ABORTED: {name} — {msg}]", flush=True)
            return


def discover_worklists(only: list[str]) -> list[Path]:
    """Every dallas_classes_*.csv in the schedule folder, optionally filtered to
    the labels given on the CLI (e.g. '2025_Fall' matches
    dallas_classes_2025_Fall.csv)."""
    csvs = sorted(SCHEDULE_DIR.glob("dallas_classes_*.csv"))
    if only:
        csvs = [c for c in csvs if any(tok in c.name for tok in only)]
    return csvs


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("terms", nargs="*",
                    help="optional term filters, e.g. 2025_Fall (default: all CSVs)")
    ap.add_argument("--refresh-before", default=None, metavar="ISO8601",
                    help="forwarded to the archiver: re-fetch files older than this")
    args = ap.parse_args()

    worklists = discover_worklists(args.terms)
    if not worklists:
        print(f"No schedule CSVs found in {SCHEDULE_DIR}"
              + (f" matching {args.terms}" if args.terms else ""), flush=True)
        return
    print("Work-lists:", ", ".join(w.name for w in worklists), flush=True)
    out = ["--out", str(DATA)]
    extra = (["--refresh-before", args.refresh_before] if args.refresh_before else [])

    # 1. CVs — every distinct professor across ALL work-lists, deduped.
    cv_wl = []
    for w in worklists:
        cv_wl += ["--worklist", str(w)]
    run_step("CVs (all terms, deduped by professor)",
             ["--kind", "cv", *cv_wl, *out, *extra, "--delay", DELAY])

    # 2. Syllabi — one step per term CSV (representatives per prof/course/modality).
    for w in worklists:
        run_step(f"Syllabi — {w.stem}",
                 ["--kind", "syllabus", "--worklist", str(w), *out, *extra,
                  "--delay", DELAY])

    print("\nALL STEPS COMPLETE.", flush=True)


if __name__ == "__main__":
    main()
