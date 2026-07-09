-- ============================================================================
-- MODULE 4 seed STUB — support-contact directory (Issues #43–#46)
--
-- Seeds only NON-PERSONAL scaffolding: resource categories, help topics, and
-- student guidance copy. Contact rows should normally be authored in Airtable
-- and synced into Postgres via pipeline/load_directory.py; seed contact data
-- only when it is verified public information appropriate for this repository.
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

-- The SEVEN Dallas College campuses + Online (public reference data; cities
-- per dallascollege.edu/locations — the bot cites/links the campus page).
-- sections.campus codes join to campuses.code for display & commute reasoning.
INSERT INTO campuses (code, name, city, url)
SELECT v.code, v.name, v.city, v.url
FROM (VALUES
    ('BHC',    'Brookhaven',    'Farmers Branch',  'https://www.dallascollege.edu/locations/brookhaven/'),
    ('CVC',    'Cedar Valley',  'Lancaster',       'https://www.dallascollege.edu/locations/cedar-valley/'),
    ('EFC',    'Eastfield',     'Mesquite',        'https://www.dallascollege.edu/locations/eastfield/'),
    ('ECC',    'El Centro',     'Downtown Dallas', 'https://www.dallascollege.edu/locations/el-centro/'),
    ('MVC',    'Mountain View', 'Oak Cliff, Dallas','https://www.dallascollege.edu/locations/mountain-view/'),
    ('NLC',    'North Lake',    'Irving',          'https://www.dallascollege.edu/locations/north-lake/'),
    ('RLC',    'Richland',      'North Dallas',    'https://www.dallascollege.edu/locations/richland/'),
    ('Online', 'Online',        NULL,              'https://www.dallascollege.edu/')
) AS v(code, name, city, url)
WHERE NOT EXISTS (SELECT 1 FROM campuses c WHERE c.code = v.code);

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
    ('laptops'), ('transportation'), ('childcare'), ('books'), ('tuition_gap')
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
-- TEMPLATE for stewards. Directory contact info is PUBLIC (team decision
-- 2026-07-07), so confirmed contacts MAY be committed as seeds — though the
-- recommended authoring flow is the external tool (Airtable) synced via
-- external_id, which keeps verification workflow (source/verified_by) intact:
--
-- INSERT INTO institutions (name, website)
--     VALUES ('Dallas College', 'https://www.dallascollege.edu');
-- INSERT INTO academic_units (institution_id, name)
--     VALUES ((SELECT id FROM institutions WHERE name='Dallas College'), 'ETMS');
-- INSERT INTO contacts (name, email, helps_with, active, last_verified_date)
--     VALUES ('<name>', '<public email>', 'ETMS school grants', true, CURRENT_DATE);
-- INSERT INTO assignments (contact_id, academic_unit_id, resource_category_id)
--     VALUES (<contact_id>, <academic_unit_id>,
--             (SELECT id FROM resource_categories WHERE name='grants'));
-- ----------------------------------------------------------------------------
