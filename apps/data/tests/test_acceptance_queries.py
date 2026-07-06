"""Acceptance queries A–F (SCHEMA_HANDOVER §6) + the GAP_ANALYSIS Part 2
conflict check, against the committed mock fixture (db/seed_mock.sql).

"The schema is correct iff these are easy" — each test is one plain-SQL query
(or one view lookup), mirroring exactly what the chatbot's read path will run.
"""

from datetime import date


# ---------------------------------------------------------------------------
# A. Fast class search (DP-010/011): all Fall 2026 HIST-1301 sections
# ---------------------------------------------------------------------------

def test_a_section_search(q):
    rows = q(
        """
        SELECT section_number, instructor_name, modality, campus, start_date
        FROM v_section_search
        WHERE subject_prefix = 'HIST' AND course_number = '1301'
          AND term_code = '2026FA'
        ORDER BY section_number
        """
    )
    assert len(rows) == 3, f"expected 3 HIST-1301 sections in 2026FA, got {rows}"
    by_number = {r[0]: r for r in rows}
    assert by_number["71001"][1] == "Avery, Jordan"
    assert by_number["71001"][2] == "online"
    assert by_number["71002"][2] == "in_person" and by_number["71002"][3] == "RLC"
    assert all(r[4] is not None for r in rows), "start dates must be populated"


# ---------------------------------------------------------------------------
# B. Compare sections of the same course (the flagship feature)
# ---------------------------------------------------------------------------

def test_b_cross_professor_grading_comparison(q):
    rows = q(
        """
        SELECT s.section_number, i.full_name, g.canonical_type,
               SUM(g.weight_pct) AS pct
        FROM sections s
        JOIN syllabi sy ON sy.section_id = s.id
        JOIN grading_components g ON g.syllabus_id = sy.id
        JOIN instructors i ON i.id = s.instructor_id
        JOIN courses c ON c.id = s.course_id
        JOIN terms t ON t.id = s.term_id
        WHERE c.subject_prefix = 'HIST' AND c.course_number = '1301'
          AND t.code = '2026FA'
        GROUP BY 1, 2, 3
        ORDER BY 1, 4 DESC
        """
    )
    profile = {(r[0], r[2]): float(r[3]) for r in rows}
    # Avery's section is project-dominated; Chen's is exam/quiz — comparable rows
    assert profile[("71001", "project")] > 90
    assert profile[("71002", "exam")] == 60.0
    assert profile[("71002", "quiz")] == 40.0
    instructors = {r[1] for r in rows}
    assert len(instructors) >= 2, "comparison must span professors"

    # the same comparison through the packaged view
    view_rows = q(
        """
        SELECT section_number, canonical_type, type_pct FROM v_section_compare
        WHERE course_id = (SELECT id FROM courses
                           WHERE subject_prefix='ACCT' AND course_number='2301')
          AND term_id = (SELECT id FROM terms WHERE code = '2026FA')
        """
    )
    acct = {(r[0], r[1]): float(r[2]) for r in view_rows}
    assert acct[("72001", "exam")] == 37.5      # 375/1000 points -> pct
    assert acct[("72001", "final_exam")] == 25.0


# ---------------------------------------------------------------------------
# C. What's unique about a section? — the podcast project must be flagged
# ---------------------------------------------------------------------------

def test_c_distinctives_flag_podcast_project(q):
    rows = q(
        """
        SELECT section_number, raw_label, canonical_type, share
        FROM v_syllabus_distinctives
        WHERE subject_prefix = 'HIST' AND course_number = '1301'
        """
    )
    flagged = {(r[0], r[2]) for r in rows}
    assert ("71001", "project") in flagged, \
        f"the History Podcasters project must be flagged distinctive; got {rows}"
    assert all(float(r[3]) < 0.34 for r in rows), "shares must respect the threshold"
    # the common quiz/exam pattern must NOT be flagged
    assert not any(t in ("quiz", "exam") for _, t in flagged)


# ---------------------------------------------------------------------------
# D. Staleness disclaimer (DP-041): newest syllabus modified_date per course
# ---------------------------------------------------------------------------

def test_d_staleness_dates(q):
    rows = q(
        """
        SELECT c.subject_prefix, c.course_number, MAX(sy.modified_date)
        FROM syllabi sy
        JOIN sections s ON s.id = sy.section_id
        JOIN courses c ON c.id = s.course_id
        GROUP BY 1, 2
        """
    )
    newest = {(r[0], r[1]): r[2] for r in rows}
    assert newest[("HIST", "1301")] == date(2026, 8, 20)
    assert newest[("ACCT", "2301")] == date(2026, 8, 10)
    assert all(v is not None for v in newest.values())


# ---------------------------------------------------------------------------
# E. Financial routing (Issue #47): grant contact for a school
# ---------------------------------------------------------------------------

def test_e_grant_contact_routing(q):
    rows = q(
        """
        SELECT ct.name, ct.helps_with, rc.name AS category, sg.prep_steps
        FROM assignments a
        JOIN contacts ct ON ct.id = a.contact_id
        JOIN resource_categories rc ON rc.id = a.resource_category_id
        LEFT JOIN student_guidance sg ON sg.resource_category_id = rc.id
        JOIN academic_units au ON au.id = a.academic_unit_id
        WHERE au.name = 'ETMS' AND rc.name = 'grants' AND ct.active
        """
    )
    assert len(rows) == 1, f"exactly one active ETMS grants contact expected, got {rows}"
    name, helps_with, category, prep = rows[0]
    assert "ETMS" in name and category == "grants"
    assert "FAFSA" in prep, "prep_steps guidance must ride along"
    # the routing boundary is recorded, not just implied
    (routing_model,) = q(
        "SELECT routing_model FROM resource_categories WHERE name = 'grants'")[0]
    assert "eligibility" in routing_model


# ---------------------------------------------------------------------------
# F. Section time conflicts (GAP_ANALYSIS Part 2 / Q11): PHYS lecture+lab must
#    NOT self-conflict; the fabricated PHYS x ENGL evening overlap MUST show.
# ---------------------------------------------------------------------------

def test_f_conflicts(q):
    assert q("SELECT count(*) FROM v_section_conflicts WHERE section_a = section_b") \
        == [(0,)], "a section must never conflict with itself"

    # PHYS (§73001, id 6) lecture 17:00-19:00 + lab 19:10-21:10 are sequential:
    # no PHYS-only pair may exist in either column order
    phys_self = q(
        """
        SELECT count(*) FROM v_section_conflicts c
        JOIN sections sa ON sa.id = c.section_a
        JOIN sections sb ON sb.id = c.section_b
        WHERE sa.section_number = '73001' AND sb.section_number = '73001'
        """
    )
    assert phys_self == [(0,)], "PHYS lecture+lab must not self-conflict"

    # the fabricated overlapping pair: PHYS lecture (MTWR 17-19) x ENGL (MW 18-19:30)
    pair = q(
        """
        SELECT DISTINCT sa.section_number, sb.section_number
        FROM v_section_conflicts c
        JOIN sections sa ON sa.id = c.section_a
        JOIN sections sb ON sb.id = c.section_b
        WHERE (sa.section_number, sb.section_number) IN (('73001','75001'), ('75001','73001'))
        """
    )
    assert pair, "the fabricated PHYS x ENGL evening overlap must be detected"

    # daytime TR section (HIST §71002) conflicts with nothing
    tr_clean = q(
        """
        SELECT count(*) FROM v_section_conflicts c
        JOIN sections sa ON sa.id = c.section_a
        JOIN sections sb ON sb.id = c.section_b
        WHERE sa.section_number = '71002' OR sb.section_number = '71002'
        """
    )
    assert tr_clean == [(0,)], "the daytime TR section must be conflict-free"


# ---------------------------------------------------------------------------
# DoD #6: "does HIST-1301 fulfill American History in catoid 5?" — edition cited
# ---------------------------------------------------------------------------

def test_fulfillment_cites_edition(q):
    rows = q(
        """
        SELECT ce.catoid, ce.year_label, dp.name, pr.group_name, pr.component_area_code
        FROM requirement_courses rc
        JOIN plan_requirements pr ON pr.id = rc.requirement_id
        JOIN degree_plans dp ON dp.id = pr.degree_plan_id
        JOIN catalog_editions ce ON ce.id = dp.catalog_edition_id
        JOIN courses c ON c.id = rc.course_id
        WHERE c.subject_prefix = 'HIST' AND c.course_number = '1301'
          AND ce.catoid = 5
        """
    )
    assert rows == [(5, "2026-2027", "Associate of Science", "American History (060)", "060")]
    # requirements are versioned: the same course also fulfills in the PRIOR
    # edition as separate rows (ADR-007 — never un-versioned)
    prior = q(
        """
        SELECT count(*) FROM requirement_courses rc
        JOIN plan_requirements pr ON pr.id = rc.requirement_id
        JOIN degree_plans dp ON dp.id = pr.degree_plan_id
        JOIN catalog_editions ce ON ce.id = dp.catalog_edition_id
        WHERE ce.catoid = 4
        """
    )
    assert prior == [(1,)]


# ---------------------------------------------------------------------------
# Evening filter (Hannah, GAP Q13-2): meetings from 17:00, or online
# ---------------------------------------------------------------------------

def test_evening_or_online_filter(q):
    rows = q(
        """
        SELECT DISTINCT s.section_number
        FROM sections s
        JOIN terms t ON t.id = s.term_id
        WHERE t.code = '2026FA'
          AND (s.modality = 'online'
               OR EXISTS (SELECT 1 FROM section_meetings m
                          WHERE m.section_id = s.id AND m.start_time >= '17:00'))
        ORDER BY 1
        """
    )
    numbers = {r[0] for r in rows}
    assert {"71001", "71003", "72001", "72002", "73001", "74001", "75001"} == numbers
    assert "71002" not in numbers, "daytime in-person section must not match"


# ---------------------------------------------------------------------------
# Issue #43 acceptance: the "General / All" college-wide fallback unit exists
# and college-wide resources route through it — the bot never dead-ends.
# ---------------------------------------------------------------------------

def test_general_all_fallback_unit(q):
    rows = q(
        """
        SELECT au.external_id, count(a.id)
        FROM academic_units au
        LEFT JOIN assignments a ON a.academic_unit_id = au.id
        WHERE au.name = 'General / All'
        GROUP BY au.external_id
        """
    )
    assert len(rows) == 1, "exactly one 'General / All' fallback unit must exist"
    external_id, n_assignments = rows[0]
    assert external_id, "fallback unit carries a stable external sync key (Issue #43)"
    assert n_assignments >= 1, "college-wide contacts must route through the fallback unit"
    # stable external keys exist on the sync-relevant tables
    (inst_ext,) = q("SELECT external_id FROM institutions WHERE name = 'Dallas College'")[0]
    assert inst_ext, "institutions carry a stable external sync key"
