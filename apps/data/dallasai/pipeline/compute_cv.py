"""Computed + composed tiers for facts-cv-v2 — pure Python, zero LLM.

The extractor outputs `computed: null` and `teaching_record: null`; this stage
fills both, so the numbers students see can never be hallucinated:

  computed        — union-of-ranges durations (overlaps never double-count),
                    countries from printed locations, organizations, as-of stamp;
                    per-topic `currency` recomputed from evidence_years and
                    overridden if the extractor guessed differently.
  teaching_record — joined from the registrar schedule manifests by professor,
                    stamped with its source; refreshed every term for free.

    python -m dallasai.pipeline.compute_cv --facts out/facts-cv \
        --raw-root <raw> --as-of 2026

Rules (ratify with the team; every rule stays mechanical on purpose):
  years_research_role: roles whose printed title contains Scientist/Researcher.
  currency: current if a supporting role is_current or evidence within 3y of
  as-of; recent within 8y; else historical.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

# Real postal codes only: a bare [A-Z]{2} read ", UK" / ", RO" / ", AT"
# as US states and reported "United States" for London, Bucharest, Vienna.
US_STATE = re.compile(
    r",\s*(?:A[LKZR]|C[AOT]|D[EC]|FL|GA|HI|I[DLNA]|K[SY]|LA|M[EDAINSOT]|"
    r"N[EVHJMYCD]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[TA]|W[AVIY])\b"
)
US_STATE_NAMES = re.compile(
    r"\b(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|"
    r"Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|"
    r"Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|"
    r"Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|"
    r"New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|"
    r"Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|"
    r"Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|"
    r"District of Columbia)\b"
)


def ORD_TERM(t: str) -> tuple[int, int]:
    """chronological sort key for term codes like 2026SP / 2026SU / 2026FA"""
    return (int(t[:4]), {"SP": 1, "SU": 2, "FA": 3}[t[4:6]])


# summary duration tokens the extractor emits instead of doing arithmetic;
# substituted here so the embedded chunk_text can never carry an invented figure
SUMMARY_TOKENS = (
    "years_teaching",
    "years_industry",
    "years_research_role",
    "years_teaching_industry_overlap",
)


def _norm_prof(name: str) -> str:
    """join key for professor names — manifests vary case ('GEBHART, KELLY' vs
    'GEBHART, Kelly'); an exact-string join would fragment the teaching record"""
    return re.sub(r"\s+", " ", name).strip().casefold()


COUNTRIES = [
    "Japan",
    "China",
    "India",
    "Mexico",
    "Canada",
    "Germany",
    "France",
    "United Kingdom",
    "England",
    "Korea",
    "Vietnam",
    "Nigeria",
    "Brazil",
    "Spain",
    "Italy",
    "Taiwan",
    "Philippines",
    "Pakistan",
    "Egypt",
]


def _country(location: str | None) -> str | None:
    if not location:
        return None
    for c in COUNTRIES:
        if c.lower() in location.lower():
            return "United Kingdom" if c == "England" else c
    if (
        US_STATE.search(location)
        or US_STATE_NAMES.search(location)
        or "Remote" in location
    ):
        return "United States"
    return None


def _union(ranges: list[tuple[int, int]]) -> int:
    years: set[int] = set()
    for a, b in ranges:
        # a same-year range ("January - December 2013" -> [2013, 2013]) is one
        # year of work, not zero — floor every range at one year
        years.update(range(a, max(b, a + 1)))
    return len(years)


def _ranges(entries, as_of, pred=lambda e: True):
    out = []
    for e in entries:
        if pred(e) and e.get("start_year"):
            out.append((e["start_year"], e.get("end_year") or as_of))
    return out


def compute(facts: dict, as_of: int) -> dict:
    exp = facts.get("experience") or []
    teach = _ranges(exp, as_of, lambda e: e.get("category") == "teaching")
    indus = _ranges(exp, as_of, lambda e: e.get("category") == "industry")
    sci = _ranges(
        exp, as_of, lambda e: re.search(r"Scientist|Researcher", e.get("role") or "")
    )
    overlap = [
        (max(a, c), min(b, d))
        for a, b in teach
        for c, d in indus
        if max(a, c) < min(b, d)
    ]
    countries_worked = sorted(
        {c for e in exp for c in [_country(e.get("location"))] if c}
    )
    countries_studied = sorted(
        {
            c
            for e in (facts.get("education") or [])
            for c in [_country(e.get("location"))]
            if c
        }
    )
    facts["computed"] = {
        "years_teaching": _union(teach) or None,
        "years_industry": _union(indus) or None,
        "years_research_role": _union(sci) or None,
        "years_teaching_industry_overlap": _union(overlap) or None,
        "countries_worked": countries_worked,
        "countries_studied": countries_studied,
        "organizations": sorted(
            {e["organization"] for e in exp if e.get("organization")}
        ),
        "computed_as_of": as_of,
    }
    # currency override: mechanical, never trusted from the extractor
    current_role_evidence = {e["raw_text"] for e in exp if e.get("is_current")}
    for tp in (facts.get("derived_profile") or {}).get("expertise_topics") or []:
        ymax = (tp.get("evidence_years") or [None, None])[1]
        if tp.get("evidence") in current_role_evidence or (ymax and as_of - ymax <= 3):
            tp["currency"] = "current"
        elif ymax and as_of - ymax <= 8:
            tp["currency"] = "recent"
        else:
            tp["currency"] = "historical"
    dp = facts.get("derived_profile") or {}
    if dp.get("summary"):
        for tok in SUMMARY_TOKENS:
            # A computed None means zero years. Skipping the substitution left a
            # literal {{token}} in the text that gets embedded and quoted back.
            val = facts["computed"].get(tok) or 0
            dp["summary"] = dp["summary"].replace("{{%s}}" % tok, str(val))
    return facts


COURSE_CODE = re.compile(r"\b[A-Z]{2,4} ?\d{4}\b")


def refresh_currency(facts: dict) -> dict:
    """UNDATED evidence + registrar proof of active teaching -> current.

    Thin CVs print no years, so the year rule's else-branch would grade every
    topic 'historical' — misleading for a professor teaching that subject this
    term. Stays mechanical: only topics whose evidence_years are [null, null]
    and whose evidence quotes a course code taught in the latest term flip."""
    tr = facts.get("teaching_record")
    dp = facts.get("derived_profile") or {}
    if not tr or not tr.get("currently_teaching") or not tr.get("courses"):
        return facts
    newest = max(
        (c["last_term"] for c in tr["courses"] if c.get("last_term")), key=ORD_TERM
    )
    active = {c["course_code"] for c in tr["courses"] if c.get("last_term") == newest}
    for tp in dp.get("expertise_topics") or []:
        if tp.get("evidence_years") == [None, None]:
            quoted = set(
                COURSE_CODE.findall(re.sub(r"\s+", " ", tp.get("evidence") or ""))
            )
            if quoted & active:
                tp["currency"] = "current"
    return facts


def course_titles(raw_root: Path) -> dict[str, str]:
    """course code -> printed class name, from the registrar schedule CSVs
    (latest term wins). 'COSC 1436' alone tells a student nothing — titles ride
    along wherever course codes surface."""
    import csv

    titles: dict[str, str] = {}
    # Alphabetical order sorts Summer after Fall, so last-wins delivered the
    # OLDEST title for a year. Sort by (year, season) instead.
    season = {"Spring": 1, "Summer": 2, "Fall": 3}
    for p in sorted((raw_root / "schedule").glob("*.csv"),
                    key=lambda q: (q.stem.rsplit("_", 2)[-2],
                                   season.get(q.stem.rsplit("_", 1)[-1], 0))):
        with open(p, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                code = (
                    f"{(row.get('class_prefix') or '').strip()} "
                    f"{(row.get('class_number') or '').strip()}"
                )
                name = (row.get("class_name") or "").strip()
                if code.strip() and name:
                    titles[code] = name
    return titles


def teaching_records(raw_root: Path) -> dict[str, dict]:
    """normalized professor name -> teaching_record, from the syllabus manifests.
    Course entries carry the printed title when the schedule CSVs know it."""
    titles = course_titles(raw_root)
    ORD = ORD_TERM
    per = defaultdict(
        lambda: defaultdict(lambda: {"terms": set(), "modalities": set()})
    )
    latest = None
    for mf in sorted((raw_root / "manifests").glob("archive_*.jsonl")):
        for line in mf.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            e = json.loads(line)
            if (
                e.get("kind") == "syllabus"
                and e.get("status") == 200
                and e.get("professor")
            ):
                rec = per[_norm_prof(e["professor"])][e["course_code"]]
                rec["terms"].add(e["term_code"])
                if e.get("modality") and e["modality"] != "unknown":
                    rec["modalities"].add(e["modality"])
                if latest is None or ORD(e["term_code"]) > ORD(latest):
                    latest = e["term_code"]
    out = {}
    for prof, courses in per.items():
        cs = []
        for code, d in sorted(courses.items()):
            terms = sorted(d["terms"], key=ORD)
            cs.append(
                {
                    "course_code": code,
                    "title": titles.get(code),
                    "first_term": terms[0],
                    "last_term": terms[-1],
                    "terms_taught": len(terms),
                    "modalities": sorted(d["modalities"]),
                }
            )
        first = min((t for c in courses.values() for t in c["terms"]), key=ORD)
        span = f"{first}-{latest}"
        out[prof] = {
            "source": f"published Dallas College class schedules, {span} "
            "(composed at load, not self-reported)",
            "currently_teaching": any(c["last_term"] == latest for c in cs),
            "courses": cs,
        }
    return out


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--facts", type=Path, required=True, help="cv facts envelopes dir")
    ap.add_argument("--raw-root", type=Path, required=True)
    ap.add_argument(
        "--as-of", type=int, required=True, help="scrape year resolving 'Present'"
    )
    args = ap.parse_args(argv)

    records = teaching_records(args.raw_root)
    n = 0
    for p in sorted(args.facts.glob("*.json")):
        env = json.loads(p.read_text(encoding="utf-8"))
        facts = compute(env["facts"], args.as_of)
        prof = env.get("context", {}).get("professor")
        facts["teaching_record"] = records.get(_norm_prof(prof)) if prof else None
        facts = refresh_currency(facts)
        env["facts"] = facts
        p.write_text(json.dumps(env, indent=2, ensure_ascii=False), encoding="utf-8")
        n += 1
    print(f"computed + composed tiers filled for {n} CVs (as_of={args.as_of})")


if __name__ == "__main__":
    main()
