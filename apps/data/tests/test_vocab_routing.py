"""Fuzzy-language governance: v_vocab_resolve grounding, stored disambiguation,
explicit assignment scope, and the v_support_routing serving surface."""

import psycopg
import pytest


def test_alias_grounding(q):
    # fuzzy phrases ground deterministically to governed rows
    rows = q("""SELECT entity_type, entity_id, match_kind FROM v_vocab_resolve
                WHERE phrase = lower('the STEM school')""")
    assert len(rows) == 1 and rows[0][0] == "academic_unit" and rows[0][2] == "alias"
    (etms_id,) = q("SELECT id FROM academic_units WHERE name = 'ETMS'")[0]
    assert rows[0][1] == etms_id

    # canonical names resolve without being duplicated as aliases
    rows = q("SELECT match_kind FROM v_vocab_resolve WHERE phrase = 'etms'")
    assert rows == [("canonical",)]


def test_three_office_ambiguity_is_data(q):
    # "paying for classes" -> tuition_gap topic -> THREE categories + a stored prompt
    rows = q("""SELECT entity_id FROM v_vocab_resolve
                WHERE phrase = 'paying for classes' AND entity_type = 'help_topic'""")
    assert len(rows) == 1
    topic_id = rows[0][0]
    cats = q("""SELECT rc.name, rc.clarify_label FROM topic_categories tc
                JOIN resource_categories rc ON rc.id = tc.resource_category_id
                WHERE tc.help_topic_id = %s ORDER BY rc.name""", (topic_id,))
    assert [c[0] for c in cats] == ["financial_aid", "grants", "scholarships"]
    assert all(c[1] for c in cats), "every branch needs a clarify_label option"
    (prompt,) = q("SELECT disambiguation_prompt FROM help_topics WHERE id = %s", (topic_id,))[0]
    assert prompt and "different offices" in prompt

    # single-office topics route silently via their default
    rows = q("""SELECT rc.name FROM v_vocab_resolve v
                JOIN topic_categories tc ON tc.help_topic_id = v.entity_id AND tc.is_default
                JOIN resource_categories rc ON rc.id = tc.resource_category_id
                WHERE v.phrase = 'evicted' AND v.entity_type = 'help_topic'""")
    assert rows == [("emergency_funds",)]


def test_explicit_scope_constraint(db):
    # unit-wide rows may not carry program references — the DB refuses the
    # contradiction instead of relying on a blank-means-everything convention
    with pytest.raises(psycopg.errors.CheckViolation):
        with db.cursor() as cur:
            cur.execute(
                """INSERT INTO assignments (contact_id, academic_unit_id,
                       resource_category_id, applies_to_all_programs, degree_or_program)
                   SELECT c.id, au.id, rc.id, true, 'BAT Software Development'
                   FROM contacts c, academic_units au, resource_categories rc
                   WHERE au.name='ETMS' AND rc.name='grants' LIMIT 1""")


def test_one_approved_meaning_per_phrase(db):
    with pytest.raises(psycopg.errors.UniqueViolation):
        with db.cursor() as cur:
            cur.execute(
                """INSERT INTO aliases (alias, resource_category_id)
                   SELECT ' Grant Money ', id FROM resource_categories WHERE name='scholarships'""")


def test_support_routing_surface(q):
    rows = q("""SELECT contact_name, applies_to_all_programs, criteria, prep_steps,
                       awareness_msg, is_stale
                FROM v_support_routing
                WHERE academic_unit = 'ETMS' AND resource_category = 'grants'""")
    assert len(rows) == 1
    name, unit_wide, criteria, prep, awareness, is_stale = rows[0]
    assert unit_wide is True, "Tammy's row is explicitly unit-wide, not implicitly blank"
    assert criteria and "FAFSA" in criteria
    assert prep and awareness, "guidance rides along with every routing answer"
    assert is_stale is False


def test_scope_check_is_two_sided(db):
    # review C1: a "program-specific" assignment naming NO program is a dead
    # row under additive routing — the CHECK must reject it too
    with pytest.raises(psycopg.errors.CheckViolation):
        with db.cursor() as cur:
            cur.execute(
                """INSERT INTO assignments (contact_id, academic_unit_id,
                       resource_category_id, applies_to_all_programs)
                   SELECT c.id, au.id, rc.id, false
                   FROM contacts c, academic_units au, resource_categories rc
                   WHERE au.name='ETMS' AND rc.name='grants' LIMIT 1""")


def test_no_duplicate_resolve_rows(q):
    # review C3: 'Online' campus has code == name — must resolve exactly once
    rows = q("SELECT count(*) FROM v_vocab_resolve WHERE phrase = 'online'")
    assert rows == [(1,)], "code==name campuses must not emit duplicate rows"
    dupes = q("""SELECT phrase, count(*) FROM v_vocab_resolve
                 GROUP BY phrase, entity_type, entity_id HAVING count(*) > 1""")
    assert dupes == [], f"duplicate resolve rows: {dupes}"


def test_retired_aliases_stay_retired(db, q):
    # review C2: retiring an alias must survive the mandated seed re-run
    from pathlib import Path
    with db.cursor() as cur:
        cur.execute("UPDATE aliases SET status = 'retired' WHERE normalized_alias = 'stressed'")
    seed = (Path(__file__).resolve().parent.parent / "db" / "seed_aliases.sql")
    db.execute(seed.read_text(encoding="utf-8"))
    rows = q("SELECT status, count(*) FROM aliases WHERE normalized_alias = 'stressed' GROUP BY status")
    assert rows == [("retired", 1)], f"retirement resurrected by seed re-run: {rows}"
    assert q("SELECT count(*) FROM v_vocab_resolve WHERE phrase = 'stressed'") == [(0,)]
