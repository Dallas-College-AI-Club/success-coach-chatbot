"""Offline unit tests for pipeline/compute_cv.py and pipeline/verify_cv.py.

No manifests, no network: registrar joins are exercised with in-memory facts.
The rules under test are the ratifiable mechanical rules — if the team changes
a rule, the matching test changes in the same commit.
"""

import copy

from dallasai.pipeline.compute_cv import (
    _country,
    _norm_prof,
    _union,
    compute,
    refresh_currency,
)
from dallasai.pipeline.verify_cv import verify

# --------------------------------------------------------------------------- union
# arithmetic


def test_union_overlaps_never_double_count():
    assert _union([(2010, 2020), (2015, 2025)]) == 15


def test_union_same_year_range_counts_one():
    # "January - December 2013" prints as [2013, 2013] — one year, not zero
    assert _union([(2013, 2013)]) == 1


def test_union_same_year_inside_wider_range_adds_nothing():
    assert _union([(2013, 2015), (2013, 2013)]) == 2


# --------------------------------------------------------------------------- countries


def test_country_us_state_abbrev():
    assert _country("Richardson, TX") == "United States"


def test_country_remote_is_us():
    assert _country("New York, NY (Remote)") == "United States"


def test_country_named():
    assert _country("Tokushima, Japan") == "Japan"


def test_country_spelled_out_us_state():
    # real corpus case (Vail CV): states printed in full, not abbreviated
    assert _country("Dallas, Texas") == "United States"
    assert _country("Bethany, West Virginia") == "United States"


def test_country_unknown_is_none():
    assert _country("somewhere unrecognizable") is None


# --------------------------------------------------------------------------- professor
# join key


def test_norm_prof_merges_case_variants():
    # real corpus case: 'GEBHART, KELLY' vs 'GEBHART, Kelly'
    assert _norm_prof("GEBHART, KELLY") == _norm_prof("GEBHART,  Kelly")


# --------------------------------------------------------------------------- compute +
# currency


def _facts(**over):
    f = {
        "name": "T Test",
        "department": None,
        "email": None,
        "cv_url": None,
        "courses_taught": [],
        "certifications": [],
        "publications": None,
        "education": [],
        "experience": [
            {
                "organization": "Acme",
                "location": "Dallas, TX",
                "role": "Engineer",
                "category": "industry",
                "start_year": 2010,
                "end_year": 2020,
                "is_current": False,
                "raw_text": "Acme Dallas, TX 2010-2020 Engineer",
            },
            {
                "organization": "Dallas College",
                "location": None,
                "role": "Faculty",
                "category": "teaching",
                "start_year": 2018,
                "end_year": None,
                "is_current": True,
                "raw_text": "Dallas College Faculty 2018 - Present",
            },
        ],
        "computed": None,
        "derived_profile": {
            "orientation": "hybrid",
            "orientation_evidence": "industry and teaching entries overlap",
            "expertise_topics": [
                {
                    "topic": "widgets",
                    "evidence": "Acme Dallas, TX 2010-2020 Engineer",
                    "currency": "historical",
                    "evidence_years": [2010, 2020],
                },
            ],
            "career_path": {
                "archetype": "engineer turned faculty",
                "stages": [
                    {
                        "label": "industry",
                        "years": "2010-2020",
                        "evidence": "Acme Dallas, TX 2010-2020 Engineer",
                    }
                ],
            },
            "summary": "T Test has {{years_industry}} years in industry and "
            "{{years_teaching}} years teaching.",
        },
        "confidence": "high",
        "teaching_record": None,
    }
    f.update(over)
    return f


def test_compute_tolerates_null_organization_and_role():
    # schema rev 6/7: organization and role are nullable (real corpus cases)
    f = _facts()
    f["experience"].append(
        {
            "organization": None,
            "location": None,
            "role": None,
            "category": "industry",
            "start_year": 2021,
            "end_year": 2022,
            "is_current": False,
            "raw_text": "2021-2022 stint",
        }
    )
    out = compute(f, 2026)
    assert None not in out["computed"]["organizations"]
    assert out["computed"]["years_industry"] == 11


def test_compute_durations_and_overlap():
    out = compute(_facts(), 2026)
    c = out["computed"]
    assert c["years_industry"] == 10  # 2010..2019
    assert c["years_teaching"] == 8  # 2018..2025 (Present -> as_of)
    assert c["years_teaching_industry_overlap"] == 2  # 2018, 2019
    assert c["computed_as_of"] == 2026


def test_compute_substitutes_summary_tokens():
    out = compute(_facts(), 2026)
    s = out["derived_profile"]["summary"]
    assert "{{" not in s and "10 years in industry" in s and "8 years teaching" in s


def test_currency_recent_within_eight_years():
    out = compute(_facts(), 2026)
    # evidence_years max 2020, 6 years back, no is_current supporting role
    assert out["derived_profile"]["expertise_topics"][0]["currency"] == "recent"


def test_currency_current_when_supporting_role_is_current():
    f = _facts()
    f["derived_profile"]["expertise_topics"][0]["evidence"] = (
        "Dallas College Faculty 2018 - Present"
    )
    out = compute(f, 2026)
    assert out["derived_profile"]["expertise_topics"][0]["currency"] == "current"


def test_refresh_currency_flips_undated_actively_taught_topic():
    f = compute(_facts(), 2026)
    f["derived_profile"]["expertise_topics"] = [
        {
            "topic": "accounting",
            "evidence": "ACNT 1303 - Introduction to Accounting",
            "currency": "historical",
            "evidence_years": [None, None],
        }
    ]
    f["teaching_record"] = {
        "source": "published Dallas College class schedules, 2024FA-2026SU",
        "currently_teaching": True,
        "courses": [
            {
                "course_code": "ACNT 1303",
                "first_term": "2024FA",
                "last_term": "2026SU",
                "terms_taught": 4,
                "modalities": ["online"],
            }
        ],
    }
    out = refresh_currency(f)
    assert out["derived_profile"]["expertise_topics"][0]["currency"] == "current"


def test_refresh_currency_leaves_dated_topics_alone():
    f = compute(_facts(), 2026)
    f["teaching_record"] = {
        "source": "published Dallas College class schedules, 2024FA-2026SU",
        "currently_teaching": True,
        "courses": [
            {
                "course_code": "ACNT 1303",
                "first_term": "2024FA",
                "last_term": "2026SU",
                "terms_taught": 4,
                "modalities": ["online"],
            }
        ],
    }
    out = refresh_currency(copy.deepcopy(f))
    assert (
        out["derived_profile"]["expertise_topics"][0]["currency"]
        == f["derived_profile"]["expertise_topics"][0]["currency"]
    )


# --------------------------------------------------------------------------- verifier

SRC = "Acme Dallas, TX 2010-2020 Engineer\nDallas College Faculty 2018 - Present\n"


def test_verify_clean_extract_stage():
    assert verify(_facts(), SRC, 2026) == []


def test_verify_flags_identity_mismatch():
    # source anomaly: the page serves a different instructor's CV
    flags = verify(
        _facts(name="Dr. Lamia Zeidan"), SRC, 2026, professor="Goswami, Smriti"
    )
    assert any("identity-mismatch" in x for x in flags)


def test_verify_accepts_reordered_name():
    assert not any(
        "identity-mismatch" in x
        for x in verify(_facts(name="T Test"), SRC, 2026, professor="Test, T")
    )


def test_verify_flags_fabricated_span():
    f = _facts()
    f["derived_profile"]["expertise_topics"][0]["evidence"] = "never printed anywhere"
    assert any("span-not-in-source" in x for x in verify(f, SRC, 2026))


def test_verify_flags_wrong_computed_arithmetic():
    f = compute(_facts(), 2026)
    f["computed"]["years_industry"] = 25
    assert any("computed-mismatch" in x for x in verify(f, SRC, 2026))


def test_verify_flags_evaluative_adjective():
    f = _facts()
    f["derived_profile"]["summary"] = (
        "A seasoned engineer with {{years_industry}} years."
    )
    assert any("adjective-ban" in x for x in verify(f, SRC, 2026))


def test_verify_flags_pronoun_not_printed():
    f = _facts()
    f["derived_profile"]["summary"] = "He has {{years_industry}} years in industry."
    assert any("pronoun-ban" in x for x in verify(f, SRC, 2026))


def test_verify_allows_pronoun_printed_in_source():
    f = _facts()
    f["derived_profile"]["summary"] = "He has {{years_industry}} years in industry."
    src = SRC + "He teaches programming.\n"
    assert not any("pronoun-ban" in x for x in verify(f, src, 2026))


def test_verify_flags_unsourced_summary_figure():
    f = _facts()
    f["derived_profile"]["summary"] = "Author of 42 studies."
    assert any("summary-figure-unsourced" in x for x in verify(f, SRC, 2026))


def test_verify_empty_shell_requires_null_derived_profile():
    f = _facts(education=[], experience=[], certifications=[], publications=None)
    assert any("empty-shell" in x for x in verify(f, "no content", 2026))


def test_verify_null_derived_profile_requires_empty_shell():
    f = _facts(derived_profile=None)
    assert any("derived_profile null" in x for x in verify(f, SRC, 2026))


# --------------------------------------------------------------------------- compose


def _tr():
    return {
        "source": "published Dallas College class schedules, 2024FA-2026SU "
        "(composed at load, not self-reported)",
        "currently_teaching": True,
        "courses": [
            {
                "course_code": "COSC 1436",
                "title": "Programming Fundamentals I",
                "first_term": "2024FA",
                "last_term": "2026SU",
                "terms_taught": 5,
                "modalities": ["online"],
            },
            {
                "course_code": "ITSE 1370",
                "title": None,
                "first_term": "2026SP",
                "last_term": "2026SP",
                "terms_taught": 1,
                "modalities": ["in_person"],
            },
        ],
    }


def test_teaching_sentence_splits_current_and_past_with_titles():
    from dallasai.pipeline.compose_cv import teaching_sentence

    s = teaching_sentence(_tr())
    # codes carry printed titles when known; bare code when the title is unknown
    assert "currently teaches COSC 1436 (Programming Fundamentals I)" in s
    assert "previously taught ITSE 1370" in s and "ITSE 1370 (" not in s
    assert "2024FA-2026SU" in s


def test_teaching_sentence_empty_record():
    from dallasai.pipeline.compose_cv import teaching_sentence

    assert teaching_sentence(None) == ""
    assert teaching_sentence({"courses": []}) == ""


def test_chunk_text_appends_teaching_to_summary():
    from dallasai.pipeline.compose_cv import chunk_text_for

    f = compute(_facts(), 2026)
    f["teaching_record"] = _tr()
    text = chunk_text_for(f)
    assert text.startswith("T Test has 10 years in industry")
    assert "currently teaches COSC 1436 (Programming Fundamentals I)" in text


def test_chunk_text_never_narrates_absence():
    from dallasai.pipeline.compose_cv import chunk_text_for

    f = _facts(
        education=[],
        experience=[],
        certifications=[],
        publications=None,
        derived_profile=None,
    )
    f["teaching_record"] = _tr()
    text = chunk_text_for(f)
    assert text.startswith("T Test is listed as an instructor")
    assert "COSC 1436" in text
    assert "no additional content" not in text and "no content" not in text


def test_empty_shell_detected_for_rescrape_quarantine():
    from dallasai.pipeline.compose_cv import is_empty_shell

    assert is_empty_shell(
        _facts(
            education=[],
            experience=[],
            certifications=[],
            publications=None,
            derived_profile=None,
        )
    )
    assert not is_empty_shell(_facts())


def test_verify_flags_absence_narration_in_summary():
    f = _facts()
    f["derived_profile"]["summary"] = (
        "T Test teaches widgets. The CV prints no publications or certifications."
    )
    assert any("absence-narration" in x for x in verify(f, SRC, 2026))
