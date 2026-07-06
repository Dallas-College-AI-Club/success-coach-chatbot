-- ============================================================================
-- MODULE 4 seed STUB — support-contact directory (Issues #43–#46)
--
-- Seeds only NON-PERSONAL scaffolding: resource categories, help topics, and
-- student guidance copy. Real contact people/emails live in the
-- access-controlled Issue #45 location and are entered directly in the
-- database by a steward — NEVER committed to this public repo (CLAUDE.md).
-- Idempotent-ish: guarded by NOT EXISTS on natural names.
-- ============================================================================

-- The institution + the "General / All" fallback unit (Issue #43): college-wide
-- contacts hang off this explicit unit so routing never dead-ends.
INSERT INTO institutions (external_id, name, website)
SELECT 'inst-dallas-college', 'Dallas College', 'https://www.dallascollege.edu'
WHERE NOT EXISTS (SELECT 1 FROM institutions WHERE name = 'Dallas College');

INSERT INTO academic_units (external_id, institution_id, name)
SELECT 'unit-general-all',
       (SELECT id FROM institutions WHERE name = 'Dallas College'),
       'General / All'
WHERE NOT EXISTS (SELECT 1 FROM academic_units WHERE name = 'General / All');

-- Resource categories: grants/scholarships/financial_aid are DIFFERENT offices
-- (the Issue #47 interview's core finding). routing_model records the boundary.
INSERT INTO resource_categories (name, routing_model)
SELECT v.name, v.routing_model
FROM (VALUES
    ('grants',          'per_school — route, don''t determine eligibility'),
    ('scholarships',    'centralized — route, don''t determine eligibility'),
    ('financial_aid',   'centralized — route, don''t determine eligibility'),
    ('emergency_funds', 'centralized — route, don''t determine eligibility'),
    ('student_care',    'centralized — route, don''t determine eligibility'),
    ('tech_support',    'centralized — route, don''t determine eligibility')
) AS v(name, routing_model)
WHERE NOT EXISTS (SELECT 1 FROM resource_categories rc WHERE rc.name = v.name);

-- Trigger topics that surface emergency/support resources proactively.
INSERT INTO help_topics (name)
SELECT v.name
FROM (VALUES
    ('rent'), ('utilities'), ('food'), ('mental health'),
    ('laptops'), ('transportation'), ('childcare'), ('books')
) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM help_topics ht WHERE ht.name = v.name);

-- Guidance copy the bot says verbatim (non-personal content).
INSERT INTO student_guidance (resource_category_id, prep_steps, awareness_msg)
SELECT rc.id,
       'FAFSA on file + declared program of study',
       'Did you know your school may have grant funding? Ask your school''s grant contact what''s available for your program.'
FROM resource_categories rc
WHERE rc.name = 'grants'
  AND NOT EXISTS (
      SELECT 1 FROM student_guidance sg WHERE sg.resource_category_id = rc.id
  );

-- ----------------------------------------------------------------------------
-- TEMPLATE for stewards (run manually against the DB; do NOT commit filled-in
-- versions — emails stay out of the repo, and field_visibility marks
-- contacts.email private regardless):
--
-- INSERT INTO institutions (name, website)
--     VALUES ('Dallas College', 'https://www.dallascollege.edu');
-- INSERT INTO academic_units (institution_id, name)
--     VALUES ((SELECT id FROM institutions WHERE name='Dallas College'), 'ETMS');
-- INSERT INTO contacts (name, email, helps_with, active, last_verified_date)
--     VALUES ('<name>', '<email — private, from #45>', 'ETMS school grants', true, CURRENT_DATE);
-- INSERT INTO assignments (contact_id, academic_unit_id, resource_category_id)
--     VALUES (<contact_id>, <academic_unit_id>,
--             (SELECT id FROM resource_categories WHERE name='grants'));
-- ----------------------------------------------------------------------------
