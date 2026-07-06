-- ============================================================================
-- Vocabulary seed — governed aliases + topic->category routing (Issue #43
-- retrieval strategy; design panel 2026-07-07). Public info only; idempotent.
--
-- Principles:
--  * Canonical names are NOT repeated here (v_vocab_resolve unions them in).
--  * One approved meaning per phrase (partial unique index enforces it).
--  * Genuinely ambiguous phrases become a HELP TOPIC whose topic_categories
--    fan-out stores the ambiguity as data; the topic's disambiguation_prompt
--    is asked VERBATIM. "Help paying for classes" = three different offices —
--    the project's core finding, represented, not smoothed over.
-- ============================================================================

-- ---- category descriptions + clarify labels (student language) -------------
UPDATE resource_categories SET
    description   = 'Grant money managed by your school. Grants are not loans — you do not pay them back, and they do not change your financial aid.',
    clarify_label = 'Grant money from your school''s programs'
WHERE name = 'grants' AND (description IS NULL OR clarify_label IS NULL);
UPDATE resource_categories SET
    description   = 'Scholarships from Dallas College. One application covers many awards.',
    clarify_label = 'A scholarship'
WHERE name = 'scholarships' AND (description IS NULL OR clarify_label IS NULL);
UPDATE resource_categories SET
    description   = 'Federal and state aid, loans, and work-study, handled by the Financial Aid Office.',
    clarify_label = 'Federal or state financial aid (FAFSA)'
WHERE name = 'financial_aid' AND (description IS NULL OR clarify_label IS NULL);
UPDATE resource_categories SET
    description   = 'Emergency help (up to $500 per semester) for sudden documented hardship, plus care coordinators who connect you to community resources.',
    clarify_label = 'Emergency help right now'
WHERE name = 'emergency_funds' AND (description IS NULL OR clarify_label IS NULL);
UPDATE resource_categories SET
    description   = 'Counseling, food, housing referrals, and ongoing support from the Student Care team.',
    clarify_label = 'Someone to talk to / ongoing support'
WHERE name = 'student_care' AND (description IS NULL OR clarify_label IS NULL);
UPDATE resource_categories SET
    description   = 'Free loaner laptops and technology help for classes.',
    clarify_label = 'A laptop or technology for class'
WHERE name = 'tech_support' AND (description IS NULL OR clarify_label IS NULL);

-- ---- the flagship ambiguity: tuition_gap fans out to THREE offices ----------
UPDATE help_topics SET disambiguation_prompt =
    'There is more than one kind of money help at Dallas College, and they come from different offices. Which sounds closest to what you need? I can also explain the differences.'
WHERE name = 'tuition_gap' AND disambiguation_prompt IS NULL;

INSERT INTO topic_categories (help_topic_id, resource_category_id, is_default)
SELECT ht.id, rc.id, false
FROM help_topics ht, resource_categories rc
WHERE ht.name = 'tuition_gap' AND rc.name IN ('grants', 'scholarships', 'financial_aid')
ON CONFLICT DO NOTHING;

-- ---- single-office topics route silently ------------------------------------
INSERT INTO topic_categories (help_topic_id, resource_category_id, is_default)
SELECT ht.id, rc.id, true
FROM (VALUES
    ('rent', 'emergency_funds'), ('utilities', 'emergency_funds'),
    ('food', 'emergency_funds'), ('transportation', 'emergency_funds'),
    ('mental health', 'student_care'), ('childcare', 'student_care'),
    ('laptops', 'tech_support'), ('books', 'scholarships')
) AS v(topic, category)
JOIN help_topics ht ON ht.name = v.topic
JOIN resource_categories rc ON rc.name = v.category
ON CONFLICT DO NOTHING;

-- ---- aliases (source='seed'; steward-governed growth from here) -------------
INSERT INTO aliases (alias, academic_unit_id, source, notes)
SELECT v.alias, au.id, 'seed', v.notes
FROM (VALUES
    ('School of Engineering, Technology, Mathematics and Sciences', 'ETMS', 'official long name'),
    ('STEM', 'ETMS', 'common shorthand; dallascollege.edu/schools/stem/'),
    ('the STEM school', 'ETMS', NULL),
    ('engineering school', 'ETMS', NULL),
    ('School of Business, Hospitality, and Global Trade', 'Business, Hospitality & Global Trade', 'official long name'),
    ('business school', 'Business, Hospitality & Global Trade', NULL),
    ('School of Creative Arts, Entertainment and Design', 'Creative Arts, Entertainment & Design', 'official long name'),
    ('School of Education', 'Education', 'official long name'),
    ('School of Health Sciences', 'Health Sciences', 'official long name'),
    ('nursing school', 'Health Sciences', 'common student phrasing'),
    ('law school', 'School of Law and Public Service', NULL),
    ('manufacturing school', 'School of Manufacturing and Industrial Technology', NULL)
) AS v(alias, unit, notes)
JOIN academic_units au ON au.name = v.unit
WHERE NOT EXISTS (SELECT 1 FROM aliases a WHERE a.normalized_alias = lower(btrim(v.alias)) AND a.status = 'approved');

INSERT INTO aliases (alias, campus_id, source)
SELECT v.alias, c.id, 'seed'
FROM (VALUES
    ('Brookhaven campus', 'BHC'), ('Cedar Valley campus', 'CVC'),
    ('Eastfield campus', 'EFC'), ('El Centro campus', 'ECC'),
    ('Mountain View campus', 'MVC'), ('North Lake campus', 'NLC'),
    ('Richland campus', 'RLC'), ('online classes', 'Online')
) AS v(alias, code)
JOIN campuses c ON c.code = v.code
WHERE NOT EXISTS (SELECT 1 FROM aliases a WHERE a.normalized_alias = lower(btrim(v.alias)) AND a.status = 'approved');

INSERT INTO aliases (alias, help_topic_id, source, notes)
SELECT v.alias, ht.id, 'seed', v.notes
FROM (VALUES
    ('paying for classes', 'tuition_gap', 'ambiguous by design -> topic fans out to 3 offices'),
    ('afford classes', 'tuition_gap', NULL),
    ('tuition help', 'tuition_gap', NULL),
    ('money for school', 'tuition_gap', NULL),
    ('cannot make rent', 'rent', 'Issue #47 example phrasing'),
    ('evicted', 'rent', NULL),
    ('behind on rent', 'rent', NULL),
    ('electric bill', 'utilities', NULL),
    ('water bill', 'utilities', NULL),
    ('groceries', 'food', NULL),
    ('food pantry', 'food', NULL),
    ('stressed', 'mental health', NULL),
    ('counseling', 'mental health', NULL),
    ('depressed', 'mental health', 'route to student_care; crisis handling is a bot-layer safety rule'),
    ('no laptop', 'laptops', NULL),
    ('computer for class', 'laptops', NULL),
    ('bus pass', 'transportation', NULL),
    ('gas money', 'transportation', NULL),
    ('daycare', 'childcare', NULL),
    ('textbooks', 'books', NULL)
) AS v(alias, topic, notes)
JOIN help_topics ht ON ht.name = v.topic
WHERE NOT EXISTS (SELECT 1 FROM aliases a WHERE a.normalized_alias = lower(btrim(v.alias)) AND a.status = 'approved');

INSERT INTO aliases (alias, resource_category_id, source)
SELECT v.alias, rc.id, 'seed'
FROM (VALUES
    ('scholarship', 'scholarships'), ('grant', 'grants'),
    ('grant money', 'grants'), ('fafsa', 'financial_aid'),
    ('emergency money', 'emergency_funds'), ('emergency fund', 'emergency_funds'),
    ('laptop loaner', 'tech_support')
) AS v(alias, category)
JOIN resource_categories rc ON rc.name = v.category
WHERE NOT EXISTS (SELECT 1 FROM aliases a WHERE a.normalized_alias = lower(btrim(v.alias)) AND a.status = 'approved');
