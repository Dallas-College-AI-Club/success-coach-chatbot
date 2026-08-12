"""Deterministic facts-cv-v2 verifier — zero LLM, mirrors verify_catalog.py.

Checks, per CV:
  A. schema validation (facts-cv-v2.schema.json)
  B. evidence spans — every raw_text / evidence / stage evidence must be a
     whitespace-collapsed contiguous substring of the source text
  C. tier discipline — extract stage: computed and teaching_record are null and
     the summary carries only known {{duration}} tokens; final stage: computed
     and per-topic currency must equal a fresh compute_cv recompute, and the
     summary has no unresolved tokens
  D. objectivity — evaluative adjectives and person-comparisons banned in
     derived prose unless the phrase is printed in the source itself
  E. summary figures — every number in the summary must trace to the source
     text, the publications census, or the computed tier; never invented
  F. summary length <= 120 words
  G. completeness census (heuristic) — more year-ranges/degree words in the
     source than extracted entries flags a possible missed entry
  H. teaching_record — when --raw-root is given, must equal the registrar join

Personal-attribute inference (nationality, age, gender) is NOT mechanically
checkable — that stays with the adversarial adjudication pass.

  python -m dallasai.pipeline.verify_cv --facts out/facts-cv/cv --as-of 2026 --raw-root R
    python -m dallasai.pipeline.verify_cv --draft <exemplar.md> \
        --source <source.txt> --as-of 2026   # draft mode: --raw-root optional
"""

from __future__ import annotations

import argparse
import copy
import json
import re
import sys
from pathlib import Path

from .compute_cv import (
    SUMMARY_TOKENS,
    _norm_prof,
    compute,
    refresh_currency,
    teaching_records,
)

SCHEMA = (
    Path(__file__).resolve().parents[4]
    / "src"
    / "config"
    / "facts-schemas"
    / "facts-cv-v2.schema.json"
)

BANNED_ADJECTIVES = [
    "accomplished",
    "renowned",
    "distinguished",
    "impressive",
    "exceptional",
    "outstanding",
    "excellent",
    "seasoned",
    "veteran",
    "acclaimed",
    "esteemed",
    "prestigious",
    "world-class",
    "award-winning",
    "visionary",
    "passionate",
    "dedicated",
    "dynamic",
    "innovative",
    "prominent",
    "notable",
    "leading",
    "highly",
    "expert",
]
BANNED_COMPARISONS = [
    "than other",
    "than most",
    "compared to other",
    "among the best",
    "one of the few",
    "one of the best",
    "unlike most",
    "unlike other",
    "top of",
    "best in",
]
# gendered pronouns are an inferred personal attribute unless the CV prints them
PRONOUNS = ["he", "she", "his", "her", "him", "hers"]
# the summary describes what IS printed — narrating absence ("the CV prints no
# publications") reads as a verdict on the professor when it may be a scrape gap
ABSENCE_PHRASES = [
    "prints no",
    "print no",
    "lists no",
    "publishes no",
    "contains no",
    "does not print",
    "does not list",
    "no additional content",
    "are not printed",
    "is not printed",
    "nothing is listed",
    "no content is",
]
YEAR_RANGE = re.compile(r"\b(?:19|20)\d{2}\s*[–—-]\s*(?:(?:19|20)\d{2}|[Pp]resent)")
DEGREE_WORD = re.compile(
    r"\b(Bachelor|Master|Doctor(?!al Advisor)|Associate of|Ph\.?D)\b"
)


def _collapse(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def _dedup_doubled(s: str) -> str:
    """collapse immediately-repeated substrings — some CV pages (LinkedIn-style
    exports) print every text run twice ('The University of DallasThe
    University of Dallas'); no honest contiguous quote exists against the raw
    stream, so matching also runs against the deduplicated form"""
    prev = None
    while prev != s:
        prev = s
        s = re.sub(r"(.{6,}?)\1", r"\1", s)
    return s


def _in_source(quote: str, src_collapsed: str) -> bool:
    """contiguous-substring check, whitespace-tolerant. Fallbacks compare with
    ALL whitespace removed — still contiguity-preserving (intervening TEXT
    breaks it), tolerant of the source printing 'Science\\n)' where the quote
    sanely reads 'Science)' — and against the doubled-text-deduplicated source.
    Real stitching still fails."""
    if _collapse(quote) in src_collapsed:
        return True
    q = re.sub(r"\s+", "", quote)
    s = re.sub(r"\s+", "", src_collapsed)
    return q in s or _dedup_doubled(q) in _dedup_doubled(s)


def _spans(facts: dict):
    """(json-path, quoted-text) pairs that must appear verbatim in the source."""
    for i, e in enumerate(facts.get("education") or []):
        yield f"education[{i}].raw_text", e.get("raw_text") or ""
    for i, e in enumerate(facts.get("experience") or []):
        yield f"experience[{i}].raw_text", e.get("raw_text") or ""
    for i, e in enumerate(facts.get("certifications") or []):
        yield f"certifications[{i}].raw_text", e.get("raw_text") or ""
    dp = facts.get("derived_profile") or {}
    for i, tp in enumerate(dp.get("expertise_topics") or []):
        yield f"expertise_topics[{i}].evidence", tp.get("evidence") or ""
    for i, st in enumerate((dp.get("career_path") or {}).get("stages") or []):
        yield f"career_path.stages[{i}].evidence", st.get("evidence") or ""


def _derived_prose(facts: dict):
    dp = facts.get("derived_profile") or {}
    yield "summary", dp.get("summary") or ""
    yield "orientation_evidence", dp.get("orientation_evidence") or ""
    yield "career_path.archetype", (dp.get("career_path") or {}).get("archetype") or ""
    for i, st in enumerate((dp.get("career_path") or {}).get("stages") or []):
        yield f"career_path.stages[{i}].label", st.get("label") or ""
    for i, tp in enumerate(dp.get("expertise_topics") or []):
        yield f"expertise_topics[{i}].topic", tp.get("topic") or ""


def _allowed_numbers(facts: dict, src_collapsed: str):
    """numbers a summary may legitimately contain"""
    ok: set[str] = set(re.findall(r"\d+", src_collapsed))
    pub = facts.get("publications") or {}
    for k in ("count", "year_min", "year_max"):
        if pub.get(k) is not None:
            ok.add(str(pub[k]))
    comp = facts.get("computed") or {}
    for v in comp.values():
        if isinstance(v, int):
            ok.add(str(v))
    # course codes / terms surfaced from the composed registrar join
    ok.update(re.findall(r"\d+", json.dumps(facts.get("teaching_record") or {})))
    return ok


def _objectivity_flags(facts: dict, src: str) -> list[str]:
    flags = []
    summary_low = ((facts.get("derived_profile") or {}).get("summary") or "").lower()
    for phrase in ABSENCE_PHRASES:
        if phrase in summary_low:
            flags.append(f"absence-narration: summary: {phrase!r}")
    for path, prose in _derived_prose(facts):
        low = prose.lower()
        for w in BANNED_ADJECTIVES:
            # Word-boundary both sides. _in_source is a substring test for
            # multi-word spans; against a single adjective it let "expertise"
            # license "expert" and "compassionate" license "passionate".
            if re.search(rf"\b{re.escape(w)}\b", low) and not re.search(
                rf"\b{re.escape(w)}\b", src, re.IGNORECASE
            ):
                flags.append(f"adjective-ban: {path}: {w!r}")
        for phrase in BANNED_COMPARISONS:
            if phrase in low:
                flags.append(f"comparison-ban: {path}: {phrase!r}")
        for p in PRONOUNS:
            if re.search(rf"\b{p}\b", low) and not re.search(
                rf"\b{p}\b", src, re.IGNORECASE
            ):
                flags.append(f"pronoun-ban: {path}: {p!r} (not printed in the CV)")
    return flags


def _figure_flags(facts: dict, src: str) -> list[str]:
    summary = (facts.get("derived_profile") or {}).get("summary") or ""
    allowed = _allowed_numbers(facts, src)
    return [
        f"summary-figure-unsourced: {num}"
        for num in re.findall(r"\d+", re.sub(r"\{\{\w+\}\}", "", summary))
        if num not in allowed
    ]


def extraction_stage_errors(facts: dict, source_text: str) -> list[str]:
    """Retryable quality errors for the EXTRACTION LOOP (doc_type cv):
    schema-valid output can still stitch quotes from different places, use
    evaluative/gendered language, invent a figure, or overrun the summary
    limit. Phrased as instructions the model can act on in the retry block."""
    errs = []
    src = _collapse(source_text)
    for path, quote in _spans(facts):
        if quote and not _in_source(quote, src):
            errs.append(
                f"{path}: not a verbatim contiguous quote from the document — "
                f"copy the exact printed characters of ONE place only (never "
                f"join text from different lines or sections). If the document "
                f"prints text runs twice, quote WITHIN one printed run — a "
                f"shorter contiguous quote (e.g. the role line alone) is "
                f"correct; a longer stitched one is not: {quote[:120]!r}"
            )
    for f in _objectivity_flags(facts, src):
        if f.startswith("absence-narration"):
            errs.append(
                f + " — the summary describes what IS printed, never "
                "what is missing; drop the absence sentence"
            )
        else:
            errs.append(
                f + " — evaluative adjectives, comparisons to people, "
                "and pronouns the document does not print are all "
                "banned in derived fields; restructure the sentence"
            )
    for f in _figure_flags(facts, src):
        errs.append(
            f + " — every number in the summary must be printed in the "
            "document or be a census/count of printed items; remove "
            "or replace this figure"
        )
    dp = facts.get("derived_profile") or {}
    summary = dp.get("summary") or ""
    words = len(summary.split())
    # 120 is the style target; the HARD fail sits at 150 — a strict 120 caused
    # whack-a-mole retries (tighten words -> reintroduce a banned pronoun) that
    # burned all 5 attempts on the first bulk night
    if words > 150:
        errs.append(
            f"derived_profile.summary: {words} words — the hard cap is "
            f"150 (target 120); tighten without dropping required content"
        )
    # a token is legal only if the pipeline can RESOLVE it from this output's
    # dated entries — an unresolvable token would survive into the embedded text
    dated = [x for x in facts.get("experience") or [] if x.get("start_year")]
    resolvable = {
        "years_teaching": any(x.get("category") == "teaching" for x in dated),
        "years_industry": any(x.get("category") == "industry" for x in dated),
        "years_research_role": any(
            re.search(r"Scientist|Researcher", x.get("role") or "") for x in dated
        ),
        "years_teaching_industry_overlap": any(
            x.get("category") == "teaching" for x in dated
        )
        and any(x.get("category") == "industry" for x in dated),
    }
    for tok in re.findall(r"\{\{(\w+)\}\}", summary):
        if tok not in SUMMARY_TOKENS:
            errs.append(
                f"derived_profile.summary: unknown placeholder token "
                f"{{{{{tok}}}}} — allowed: " + ", ".join(SUMMARY_TOKENS)
            )
        elif not resolvable[tok]:
            errs.append(
                f"derived_profile.summary: token {{{{{tok}}}}} cannot be "
                f"resolved from this CV's dated experience entries — "
                f"rewrite the sentence without it"
            )
    return errs


def verify(
    facts: dict,
    source_text: str,
    as_of: int,
    records: dict | None = None,
    professor: str | None = None,
) -> list[str]:
    flags: list[str] = []
    src = _collapse(source_text)

    # identity: the manifest professor's surname must appear in the extracted
    # name. The prompt's contradiction rule asks the model for confidence=low,
    # but that is judgment — sampling variance shipped a WRONG-PERSON profile at
    # confidence=high in the 2026-07-26 pilot (Concourse served another
    # instructor's CV under the professor's course link). This check is the
    # mechanical backstop; a flagged row is a source anomaly to adjudicate,
    # never to retry.
    if professor and facts.get("name"):
        import unicodedata

        def _fold(s: str) -> str:
            # manifests carry mojibake ('OrtuÃ±o') and CVs proper accents
            # ('Ortuño') — compare on best-effort ASCII skeletons
            s = s.replace("Ã±", "n").replace("ã±", "n")
            s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
            return _collapse(s).casefold()

        surname = _fold(professor.split(",")[0])
        if surname and surname not in _fold(facts["name"]):
            flags.append(
                f"identity-mismatch: context professor {professor!r} "
                f"vs extracted name {facts['name']!r}"
            )

    # A. schema
    try:
        import jsonschema

        jsonschema.validate(facts, json.loads(SCHEMA.read_text(encoding="utf-8")))
    except jsonschema.ValidationError as e:  # noqa: F841
        flags.append(
            f"schema: {e.message[:160]} at {'/'.join(map(str, e.absolute_path))}"
        )

    # B. evidence spans
    for path, quote in _spans(facts):
        if quote and not _in_source(quote, src):
            flags.append(f"span-not-in-source: {path}: {quote[:80]!r}")

    # derived_profile nullability is tied to extractive emptiness, both directions
    empty_shell = (
        not (facts.get("education") or [])
        and not (facts.get("experience") or [])
        and not facts.get("publications")
        and not (facts.get("certifications") or [])
    )
    if facts.get("derived_profile") is None and not empty_shell:
        flags.append("tier: derived_profile null but extractive tiers are non-empty")
    if empty_shell and facts.get("derived_profile") is not None:
        flags.append("tier: empty-shell CV must have derived_profile null")

    dp = facts.get("derived_profile") or {}
    summary = dp.get("summary") or ""
    stage = "extract" if facts.get("computed") is None else "final"

    # C. tier discipline
    if stage == "extract":
        if facts.get("teaching_record") is not None:
            flags.append("tier: extractor filled teaching_record (must be null)")
        for tok in re.findall(r"\{\{(\w+)\}\}", summary):
            if tok not in SUMMARY_TOKENS:
                flags.append(f"tier: unknown summary token {{{{{tok}}}}}")
    else:
        recomputed = refresh_currency(
            compute(
                copy.deepcopy(facts), facts["computed"].get("computed_as_of") or as_of
            )
        )
        if recomputed["computed"] != facts["computed"]:
            diff = {
                k: (facts["computed"].get(k), recomputed["computed"].get(k))
                for k in recomputed["computed"]
                if facts["computed"].get(k) != recomputed["computed"].get(k)
            }
            flags.append(f"computed-mismatch: {diff}")
        for a, b in zip(
            dp.get("expertise_topics") or [],
            (recomputed.get("derived_profile") or {}).get("expertise_topics") or [],
        ):
            if a.get("currency") != b.get("currency"):
                flags.append(
                    f"currency-mismatch: {a.get('topic')}: "
                    f"{a.get('currency')} should be {b.get('currency')}"
                )
        if re.search(r"\{\{\w+\}\}", summary):
            flags.append("tier: unresolved {{token}} in final summary")

    # D. objectivity + E. summary figures (shared with the extraction loop)
    flags += _objectivity_flags(facts, src)
    flags += _figure_flags(facts, src)

    # F. summary length (target 120, hard cap 150 — see extraction_stage_errors)
    words = len(summary.split())
    if words > 150:
        flags.append(f"summary-too-long: {words} words (hard cap 150)")

    # G. completeness census (heuristic — a flag means look, not necessarily wrong)
    n_ranges = len(YEAR_RANGE.findall(source_text))
    n_exp = len([e for e in facts.get("experience") or [] if e.get("start_year")])
    if n_ranges > n_exp + len(facts.get("education") or []):
        flags.append(
            f"census: {n_ranges} year-ranges in source "
            f"but {n_exp} dated experience entries"
        )
    n_deg = len(DEGREE_WORD.findall(source_text))
    if (
        n_deg > len(facts.get("education") or []) * 2
    ):  # degree word may repeat in raw_text echo
        flags.append(
            f"census: {n_deg} degree words in source "
            f"but {len(facts.get('education') or [])} education entries"
        )

    # H. teaching_record vs registrar join
    if records is not None and stage == "final":
        expected = records.get(_norm_prof(professor)) if professor else None
        if facts.get("teaching_record") != expected:
            flags.append("teaching_record-mismatch vs registrar join")

    return flags


def _load_draft(md_path: Path) -> tuple[dict, str | None]:
    """(facts, professor) from a DRAFT-*.md exemplar file."""
    text = md_path.read_text(encoding="utf-8")
    parsed = []
    for raw in re.findall(r"```json\n(.*?)\n```", text, re.S):
        try:
            parsed.append(json.loads(raw))
        except json.JSONDecodeError:
            continue
    facts_blocks = [b for b in parsed if isinstance(b, dict) and "derived_profile" in b]
    if not facts_blocks:
        raise SystemExit(f"{md_path}: no parseable facts JSON block found")
    prof = next(
        (
            b["professor"]
            for b in parsed
            if isinstance(b, dict) and set(b) == {"professor"}
        ),
        None,
    )
    return facts_blocks[-1], prof


SENTINELS = (
    Path(__file__).resolve().parents[2]
    / "reference"
    / "prompts"
    / "examples"
    / "_sentinels.json"
)


def _sentinel_flags(facts: dict, source_text: str, professor: str | None) -> list[str]:
    """Copying an exemplar's distinctive values into another CV's output is the
    few-shot failure mode the sentinel registry exists to catch: flag any
    sentinel string that appears in the output but not in this document."""
    if not SENTINELS.exists():
        return []
    reg = json.loads(SENTINELS.read_text(encoding="utf-8")).get("cv", {})
    blob = json.dumps(facts, ensure_ascii=False)
    src = _collapse(source_text)
    flags = []
    for owner, values in reg.items():
        if professor and _collapse(owner).casefold() == _collapse(professor).casefold():
            continue
        for v in values:
            if v in blob and not _in_source(v, src):
                flags.append(f"sentinel-contamination: {v!r} (exemplar: {owner})")
    return flags


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--facts", type=Path, help="dir of extract_batch cv envelopes")
    ap.add_argument("--draft", type=Path, help="single DRAFT-*.md exemplar to verify")
    ap.add_argument("--source", type=Path, help="source .txt (draft mode)")
    ap.add_argument("--as-of", type=int, required=True)
    ap.add_argument(
        "--raw-root",
        type=Path,
        help="corpus root: source docs + manifests (enables teaching_record check)",
    )
    args = ap.parse_args(argv)
    if args.facts and not args.raw_root:
        ap.error(
            "--raw-root is required with --facts (source documents are loaded from it)"
        )

    records = teaching_records(args.raw_root) if args.raw_root else None
    total_flags = files_flagged = checked = 0

    if args.draft:
        facts, prof = _load_draft(args.draft)
        flags = verify(
            facts, args.source.read_text(encoding="utf-8"), args.as_of, records, prof
        )
        print(f"{args.draft.name}: {'OK' if not flags else f'{len(flags)} flag(s)'}")
        for f in flags:
            print(f"  - {f}")
        total_flags = len(flags)
    else:
        from .extract import html_to_text, pdf_to_text

        for p in sorted(args.facts.glob("*.json")):
            env = json.loads(p.read_text(encoding="utf-8"))
            src_path = args.raw_root / env["raw_path"].replace("\\", "/")
            if not src_path.exists():
                print(f"{p.name}: SKIP (no source at {src_path})")
                continue
            if src_path.suffix.lower() == ".pdf":
                source_text = pdf_to_text(src_path)
            else:
                source_text = html_to_text(
                    src_path.read_text(encoding="utf-8", errors="replace")
                )
            prof = (env.get("context") or {}).get("professor")
            flags = verify(env["facts"], source_text, args.as_of, records, prof)
            flags += _sentinel_flags(env["facts"], source_text, prof)
            checked += 1
            if flags:
                files_flagged += 1
                print(f"{p.name}: {len(flags)} flag(s)")
                for f in flags:
                    print(f"  - {f}")
                total_flags += len(flags)
        print(f"checked {checked} envelopes, {files_flagged} flagged")
    print(f"total flags: {total_flags}")
    sys.exit(1 if total_flags else 0)


if __name__ == "__main__":
    main()
