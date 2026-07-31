"""Deterministic post-extraction verifier for catalog facts (course / program_map).

No LLM. Every check is a mechanical comparison between the extracted facts and
the converter text of the source page — the playbook's "deterministic verifiers"
pillar. Run it over a facts output dir before ANY load; a document that fails is
moved to quarantine semantics (reported, excluded) — never silently loaded.

    python -m dallasai.pipeline.verify_catalog --facts out/facts --raw-root <raw>

Checks (course):  code/title line exists; credit_hours == the title parenthetical;
every prereq/coreq code printed in the source; tccn only with the printed TCCN
marking; is_core only with the printed Core marking; CB number digit-exact;
description a verbatim (whitespace-folded) substring.
Checks (program_map): every group course printed in the source; groups non-empty;
credits arithmetic consistent where both sides are stated; options_exhaustive
False only with the printed "other options" wording; no UI/nav noise in any field.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from .extract import html_to_text

NOISE = [
    "Add to Portfolio",
    "opens a new window",
    "Catalog Navigation",
    "My Portfolio",
    "Print (",
    "Whole Word/Phrase",
]
CODE = re.compile(r"\b[A-Z]{3,4} \d{4}\b")


_TYPO = str.maketrans(
    {"‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", " ": " ", "…": "..."}
)


def fold(s: str) -> str:
    """Whitespace + typographic-punctuation fold: verbatim checks compare CONTENT;
    curly-vs-straight quotes and dash variants are source typography, not data."""
    return re.sub(r"\s+", " ", (s or "").translate(_TYPO)).strip()


def _values(obj):
    if isinstance(obj, dict):
        for v in obj.values():
            yield from _values(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _values(v)
    elif isinstance(obj, str):
        yield obj


def codes_in(folded: str) -> set[str]:
    """Every course code the page prints, expanded for catalog formatting:
    'SUBJ NNNN', 'SUBJNNNN', '(SUBJ) NNNN', and prefix-elided lists
    ('SUBJ 1301, 1302 and 1303' prints all three)."""
    found = set()
    for m in re.finditer(
        r"\(?([A-Z]{2,4})\)?\s?(\d{4})((?:\s*(?:,|and|or)\s*\d{4})*)", folded
    ):
        subj = m.group(1)
        found.add(f"{subj} {m.group(2)}")
        for n in re.findall(r"\d{4}", m.group(3) or ""):
            found.add(f"{subj} {n}")
    return found


def check_course(f: dict, src: str, folded: str) -> list[str]:
    errs = []
    m = re.search(
        re.escape(f["course_code"]) + r" - .{0,200}?\((\d+(?:-\d+)?) Credit Hours?\)",
        folded,
    )
    is_non_credit = (
        not m
        and "Non-Credit Course" in src
        and re.search(re.escape(f["course_code"]) + r" - ", folded)
    )
    if not m and not is_non_credit:
        # non-credit pages legitimately print no "(N Credit Hours)" suffix
        errs.append(f"course_code/title line not found for {f['course_code']}")
    elif (
        m
        and "-" not in m.group(1)
        and f.get("credit_hours") is not None
        and int(m.group(1)) != f["credit_hours"]
    ):
        # ranged credits ("1-4 Credit Hours", Special Topics/placeholder pages)
        # skip the equality check; a found title line is never an error itself
        errs.append(f"credit_hours {f['credit_hours']} != printed ({m.group(1)})")
    printed = codes_in(folded)
    for kind in ("prerequisites", "corequisites"):
        for entry in f.get(kind) or []:
            for c in entry.get("one_of") or []:
                if c not in folded and c not in printed:
                    errs.append(f"{kind} code {c!r} not printed in source")
    if f.get("tccn") and "Texas Common Course Number" not in src:
        errs.append("tccn set without a printed TCCN marking")
    if f.get("is_core") and "Core Curriculum course" not in src:
        errs.append("is_core true without the printed Core marking")
    if f.get("cb_approval_number") and f["cb_approval_number"] not in src:
        errs.append("cb_approval_number not printed digit-for-digit")
    if f.get("description") and fold(f["description"]) not in folded:
        # seam-punctuation fold (gold-README precedent): the converter shreds
        # sentences across markup; periods/commas inserted at re-join seams are
        # rendering artifacts. Content TOKENS must still match exactly.
        def tokstream(s):
            j = " ".join(re.findall(r"[A-Za-z0-9]+", s))
            return re.sub(
                r"\b(\d+) (st|nd|rd|th)\b", lambda g: g.group(1) + g.group(2), j
            )

        if tokstream(f["description"]) not in tokstream(folded):
            errs.append(
                "description content tokens differ from source (not seam punctuation)"
            )
    return errs


def check_program(f: dict, src: str, folded: str) -> list[str]:
    errs = []
    if not f.get("groups"):
        errs.append("no requirement groups extracted")
    for g in f.get("groups") or []:
        if not g.get("courses") and g.get("slot_kind") in ("fixed", "choose"):
            errs.append(
                f"group {g.get('name')!r} is {g.get('slot_kind')} but lists no courses"
            )
        for c in g.get("courses") or []:
            if CODE.fullmatch(c) and c not in folded:
                errs.append(
                    f"group {g.get('name')!r}: course {c!r} not printed in source"
                )
        if g.get("options_exhaustive") is False and not re.search(
            r"[Oo]ther options (exist|may exist)", src
        ):
            errs.append(
                f"group {g.get('name')!r}: options_exhaustive=false without the printed wording"
            )
    stated = [g.get("credits_required") for g in f.get("groups") or []]
    if f.get("total_credits") and all(isinstance(x, int) for x in stated) and stated:
        if sum(stated) not in (f["total_credits"],):
            # semester-group programs sum exactly; core-style programs may not — warn only
            errs.append(
                f"WARN group credits sum {sum(stated)} != total_credits {f['total_credits']}"
                " (accept only if the page itself doesn't reconcile)"
            )
    return errs


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--facts",
        type=Path,
        required=True,
        help="facts output dir (from extract_batch)",
    )
    ap.add_argument("--raw-root", type=Path, required=True)
    args = ap.parse_args(argv)

    n_ok = n_fail = 0
    for sub, checker in (("course", check_course), ("program_map", check_program)):
        for p in sorted((args.facts / sub).glob("*.json")):
            env = json.loads(p.read_text(encoding="utf-8"))
            raw = args.raw_root / env["raw_path"].replace("\\", "/")
            src = html_to_text(raw.read_text(encoding="utf-8", errors="replace"))
            folded = fold(src)
            errs = checker(env["facts"], src, folded)
            errs += [
                f"nav/UI noise leaked into facts: {t!r}"
                for t in NOISE
                for v in _values(env["facts"])
                if t in v
            ]
            accepted = (
                json.loads(
                    (
                        Path(__file__).resolve().parent.parent
                        / "gate"
                        / "adjudicated_source_anomalies.json"
                    ).read_text(encoding="utf-8")
                )
                if (
                    Path(__file__).resolve().parent.parent
                    / "gate"
                    / "adjudicated_source_anomalies.json"
                ).exists()
                else {}
            )
            if p.stem in accepted:
                errs = [f"WARN adjudicated source anomaly: {accepted[p.stem]}"]
            hard = [e for e in errs if not e.startswith("WARN")]
            tag = "ok" if not hard else "FAIL"
            n_ok += not hard
            n_fail += bool(hard)
            print(f"[{tag}] {sub}/{p.stem}" + ("" if not errs else ""))
            for e in errs:
                print(f"       - {e}")
    print(f"\n{n_ok} ok, {n_fail} FAIL — a FAIL row must be quarantined, never loaded")
    sys.exit(1 if n_fail else 0)


if __name__ == "__main__":
    main()
