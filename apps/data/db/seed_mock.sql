-- ============================================================================
-- MOCK SEED — realistic fake data across all modules (CLAUDE_CODE_BRIEF step 9)
--
-- *** DEV/TEST DATABASES ONLY — this file TRUNCATES the tables it seeds. ***
-- Never point it at a database holding real data.
--
-- Purpose: (1) usage documentation — every table shown with realistic rows and
-- correct lineage (raw_documents -> extractions -> core); (2) the fixture the
-- acceptance tests (tests/test_acceptance_queries.py) run against; (3) the
-- "executed seed script proving successful database insertion" board item —
-- the row-count report at the end prints when applied with psql.
--
-- The four syllabus archetypes come from the real sample syllabi
-- (docs/GAP_ANALYSIS.md Q5), with FICTIONAL instructors and no emails:
--   ACCT-2301 §72001  exam-heavy      (62.5% exams, points -> pct)
--   HIST-1301 §71001  project-only    (History Podcasters — the distinctive)
--   PHYS-2425 §73001  lecture+lab     (evening; 60% lab-minimum gate policy)
--   ITSE-1329 §74001  online          (no meetings — absence is the signal)
--
-- All people are fictional. No emails anywhere (field_visibility marks the
-- email columns private regardless; see db/seed_field_visibility.sql).
-- ============================================================================

BEGIN;

TRUNCATE
    raw_documents, extractions,
    terms, courses, instructors, sections, syllabi, grading_components,
    section_meetings, section_materials,
    institutions, academic_units, contacts, resource_categories, help_topics,
    assignments, assignment_topics, student_guidance, programs,
    catalog_editions, degree_plans, plan_requirements, requirement_courses,
    course_requisites
    RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------------
-- MODULE 1 · raw_documents + extractions (lineage anchors)
-- ---------------------------------------------------------------------------

INSERT INTO raw_documents (id, source_type, source_url, term_code, fetched_at, content_hash, raw_text, raw_payload, is_latest) VALUES
 (1, 'schedule_csv', 'https://schedule.example.edu/2026FA.csv#HIST-1301-71001', '2026FA', now() - interval '10 days', repeat('a1', 32), NULL,
     '{"class_prefix":"HIST","class_number":"1301","section_number":"71001","professor":"Avery, Jordan","term_year":"Fall 2026"}', true),
 (2, 'syllabus_pdf',  'https://hb2504.example.edu/Syllabi/2026FA-HIST-1301-71001.pdf', '2026FA', now() - interval '9 days',  repeat('b2', 32), 'HIST 1301 — United States History I. Graded work: History Podcasters project (730 pts of 750)...', NULL, true),
 (3, 'syllabus_pdf',  'https://hb2504.example.edu/Syllabi/2026FA-HIST-1301-71002.pdf', '2026FA', now() - interval '9 days',  repeat('c3', 32), 'HIST 1301 §71002 — quizzes and exams...', NULL, true),
 (4, 'syllabus_pdf',  'https://hb2504.example.edu/Syllabi/2026FA-ACCT-2301-72001.pdf', '2026FA', now() - interval '8 days',  repeat('d4', 32), 'ACCT 2301 — Unit Exams 375/1000, Final 250/1000, Assignments 240/1000, quizzes 135/1000...', NULL, true),
 (5, 'syllabus_pdf',  'https://hb2504.example.edu/Syllabi/2026FA-PHYS-2425-73001.pdf', '2026FA', now() - interval '7 days',  repeat('e5', 32), 'PHYS 2425 — evening lecture + lab; labs below 60% cap the course grade...', NULL, true),
 (6, 'syllabus_html', 'https://hb2504.example.edu/Syllabi/2026FA-ITSE-1329-74001',     '2026FA', now() - interval '7 days',  repeat('f6', 32), 'ITSE 1329 — online; programming assignments 50%, quizzes 40%, participation 10%...', NULL, true),
 (7, 'catalog_page',  'https://catalog.example.edu/preview_program.php?catoid=5&poid=4242', NULL, now() - interval '6 days', repeat('a7', 32), 'Associate of Science — American History (060): HIST 1301 or HIST 1302; Life & Physical Sciences (030)...', NULL, true),
 (8, 'bookstore_page','https://bookstore.example.edu/course/ACCT/2301/72001', '2026FA', now() - interval '5 days', repeat('b8', 32), 'Financial Accounting 12e bundle...', NULL, true),
 (9, 'syllabus_pdf',  'https://hb2504.example.edu/Syllabi/2026FA-HIST-1301-71003.pdf', '2026FA', now() - interval '9 days', repeat('c9', 32), 'HIST 1301 §71003 — weekly quizzes and unit exams, fast-track...', NULL, true);

INSERT INTO extractions (id, raw_document_id, extractor, extraction_method, prompt_version, schema_version, extracted_at, status, data, validation_errors, is_current) VALUES
 (1, 2, 'claude-sonnet-4-6', 'api', 'v1', '1.1', now() - interval '9 days', 'ok',
     '{"confidence":"high","note":"mock: HIST project syllabus — projected into core below"}', NULL, true),
 (2, 3, 'claude-sonnet-4-6', 'api', 'v1', '1.1', now() - interval '9 days', 'ok',
     '{"confidence":"high","note":"mock: HIST quiz/exam syllabus"}', NULL, true),
 (3, 4, 'claude-sonnet-4-6', 'claude_code_session', 'v1', '1.1', now() - interval '8 days', 'ok',
     '{"confidence":"high","note":"mock: ACCT exam-heavy syllabus, points converted to pct"}', NULL, true),
 (4, 5, 'claude-sonnet-4-6', 'api', 'v1', '1.1', now() - interval '7 days', 'ok',
     '{"confidence":"high","note":"mock: PHYS lecture+lab syllabus"}', NULL, true),
 (5, 6, 'qwen2.5-14b', 'local_ollama', 'v1', '1.1', now() - interval '7 days', 'ok',
     '{"confidence":"medium","note":"mock: ITSE online syllabus via local model (ADR-002 portability)"}', NULL, true),
 (6, 7, 'claude-sonnet-4-6', 'api', 'v1', '1.0', now() - interval '6 days', 'ok',
     '{"confidence":"high","note":"mock: AS degree plan, catoid 5"}', NULL, true),
 (7, 9, 'claude-sonnet-4-6', 'api', 'v1', '1.1', now() - interval '9 days', 'ok',
     '{"confidence":"high","note":"mock: HIST fast-track quiz/exam syllabus"}', NULL, true);

-- ---------------------------------------------------------------------------
-- MODULE 2 · serving core
-- ---------------------------------------------------------------------------

INSERT INTO terms (id, code, name, year, season, start_date, end_date) VALUES
 (1, '2026FA', 'Fall 2026',   2026, 'fall',   '2026-08-24', '2026-12-10'),
 (2, '2026SP', 'Spring 2026', 2026, 'spring', '2026-01-20', '2026-05-14'),
 (3, '2025FA', 'Fall 2025',   2025, 'fall',   '2025-08-25', '2025-12-11'),
 (4, '2024FA', 'Fall 2024',   2024, 'fall',   '2024-08-26', '2024-12-12'),
 (5, '2022SU', 'Summer 2022', 2022, 'summer', '2022-06-06', '2022-08-11');

INSERT INTO courses (id, subject_prefix, course_number, title, credit_hours, description, state_outcomes, requisites) VALUES
 (1, 'HIST', '1301', 'United States History I', 3, 'A survey of the social, political, economic, cultural, and intellectual history of the United States to 1877.', 'Create an argument through the use of historical evidence...', 'TSI Reading requirements met or approved exemptions/waivers.'),
 (2, 'ACCT', '2301', 'Principles of Financial Accounting', 3, 'Introduction to the fundamental concepts of financial accounting as prescribed by U.S. GAAP.', 'Prepare and interpret the four basic financial statements...', NULL),
 (3, 'ITSE', '1329', 'Programming Logic and Design', 3, 'Problem-solving applying structured techniques and representation of algorithms.', NULL, NULL),
 (4, 'PHYS', '2425', 'University Physics I', 4, 'Calculus-based physics: mechanics, energy, thermodynamics, with laboratory.', 'Apply Newton''s laws to physical problems...', 'Prerequisite: MATH 2413 - Calculus I'),
 (5, 'MATH', '2413', 'Calculus I', 4, 'Limits and continuity; derivatives and applications; definite integrals.', NULL, 'Prerequisite: MATH 2412 or equivalent placement.'),
 (6, 'ENGL', '1301', 'Composition I', 3, 'Intensive study of and practice in writing processes.', NULL, 'TSI Writing requirements met.');

-- Fictional instructors; no emails (contacts/instructors emails are PRIVATE by
-- policy and simply absent from mock data).
INSERT INTO instructors (id, full_name, normalized_name, email, department, cv_url) VALUES
 (1, 'Avery, Jordan',  'avery, jordan',  NULL, 'Social Sciences Department',      'https://hb2504.example.edu/vitae/avery-jordan.pdf'),
 (2, 'Chen, Morgan',   'chen, morgan',   NULL, 'Social Sciences Department',      'https://hb2504.example.edu/vitae/chen-morgan.pdf'),
 (3, 'Okafor, Sam',    'okafor, sam',    NULL, 'Business Department',             'https://hb2504.example.edu/vitae/okafor-sam.pdf'),
 (4, 'Rivera, Alex',   'rivera, alex',   NULL, 'Business Department',             NULL),
 (5, 'Nguyen, Lan',    'nguyen, lan',    NULL, 'Physical Sciences Department',    'https://hb2504.example.edu/vitae/nguyen-lan.pdf');

INSERT INTO sections (id, course_id, term_id, instructor_id, section_number, modality, campus, meeting_info_raw, start_date, end_date, syllabus_url, coreq_section_ref, raw_document_id) VALUES
 -- 2026FA HIST-1301 x3 (query A; Avery's project section is the distinctive)
 (1, 1, 1, 1, '71001', 'online',    'Online', 'INET INET M T W R F S U',                        '2026-08-24', '2026-12-10', 'https://hb2504.example.edu/Syllabi/2026FA-HIST-1301-71001.pdf', NULL, 1),
 (2, 1, 1, 2, '71002', 'in_person', 'RLC',    'C245 LEC T R 10:00 AM - 11:20 AM',               '2026-08-24', '2026-12-10', 'https://hb2504.example.edu/Syllabi/2026FA-HIST-1301-71002.pdf', NULL, NULL),
 (3, 1, 1, 3, '71003', 'online',    'Online', 'INET INET M T W R F S U',                        '2026-08-24', '2026-10-16', 'https://hb2504.example.edu/Syllabi/2026FA-HIST-1301-71003.pdf', NULL, NULL),
 -- 2026FA ACCT-2301 x2 (query B cross-professor comparison)
 (4, 2, 1, 4, '72001', 'in_person', 'EFC',    'N222 LEC M W 05:30 PM - 07:30 PM',               '2026-08-24', '2026-12-10', 'https://hb2504.example.edu/Syllabi/2026FA-ACCT-2301-72001.pdf', NULL, NULL),
 (5, 2, 1, 3, '72002', 'online',    'Online', 'INET INET M T W R F S U',                        '2026-08-24', '2026-12-10', 'https://hb2504.example.edu/Syllabi/2026FA-ACCT-2301-72002.pdf', NULL, NULL),
 -- 2026FA PHYS-2425 lecture+lab evening archetype (query F: no self-conflict)
 (6, 4, 1, 5, '73001', 'in_person', 'EFC',    'W101 LEC M T W R 05:00 PM - 07:00 PM S110 LAB M T W R 07:10 PM - 09:10 PM', '2026-08-24', '2026-12-10', 'https://hb2504.example.edu/Syllabi/2026FA-PHYS-2425-73001.pdf', 'DMAT-0305-71099', NULL),
 -- 2026FA ITSE online, no meetings archetype
 (7, 3, 1, NULL, '74001', 'online', 'Online', 'INET INET M T W R F S U',                        '2026-08-24', '2026-12-10', 'https://hb2504.example.edu/Syllabi/2026FA-ITSE-1329-74001',     NULL, NULL),
 -- 2026FA ENGL evening MW — fabricated overlap with PHYS lecture (query F)
 (8, 6, 1, 2, '75001', 'in_person', 'EFC',    'L110 LEC M W 06:00 PM - 07:30 PM',               '2026-08-24', '2026-12-10', NULL, NULL, NULL),
 -- offering history back-terms for HIST (v_course_offering_history)
 (9,  1, 3, 1, '61001', 'online',   'Online', 'INET',                                            '2025-08-25', '2025-12-11', NULL, NULL, NULL),
 (10, 1, 4, 2, '51001', 'online',   'Online', 'INET',                                            '2024-08-26', '2024-12-12', NULL, NULL, NULL),
 (11, 1, 5, 1, '51',    'online',   'Online', 'INET',                                            '2022-06-06', '2022-07-08', NULL, NULL, NULL);

INSERT INTO syllabi (id, section_id, extraction_id, modified_date, withdraw_date, certification_date, instructor_outcomes, course_schedule, policies, distinctive_features, full_summary) VALUES
 (1, 1, 1, '2026-08-20', '2026-11-13', '2026-09-08',
    '["Produce a research-based history podcast episode"]',
    '[{"when":"Week 1","topic":"Onboarding + topic pitch"},{"when":"Weeks 2-6","topic":"Scaffolded podcast milestones"}]',
    '{"late_work":"No late work accepted; hard weekly deadlines","attendance":null,"makeup":null,"ai_plagiarism":"Automatic zero for AI-generated submissions","extra_credit":null}',
    '["Single scaffolded 5-week podcast project (History Podcasters) instead of exams"]',
    'Fully online survey of U.S. history to 1877 graded almost entirely through one scaffolded podcast project with hard weekly deadlines and a strict AI policy.'),
 (2, 2, 2, '2026-08-15', '2026-11-13', '2026-09-08',
    '["Analyze primary sources in weekly quizzes"]',
    '[{"when":"Weekly","topic":"Reading quiz"},{"when":"Weeks 5/10/15","topic":"Unit exams"}]',
    '{"late_work":"48-hour grace with 10% penalty","attendance":"Required; tracked","makeup":"Documented emergencies only","ai_plagiarism":"Cited AI use permitted","extra_credit":null}',
    '[]',
    'In-person U.S. history survey with weekly reading quizzes and three unit exams; moderate late-work grace.'),
 (3, 4, 3, '2026-08-10', '2026-11-13', '2026-09-08',
    '[]',
    '[{"when":"Units 1-5","topic":"SmartBook + exercises per unit"}]',
    '{"late_work":null,"attendance":null,"makeup":"Final exam may replace one missed unit exam","ai_plagiarism":null,"extra_credit":"None offered"}',
    '[]',
    'Exam-centered financial accounting: unit exams and a cumulative final dominate; homework uses unlimited-attempt SmartBook assignments. The syllabus does not state a late-work policy.'),
 (4, 6, 4, '2026-08-18', '2026-11-13', '2026-09-08',
    '["Apply calculus to mechanics problems","Perform and report laboratory measurements"]',
    '[{"when":"Weekly","topic":"Lecture + integrated lab"}]',
    '{"late_work":"Not accepted after solutions post","attendance":"Lab attendance mandatory","makeup":null,"ai_plagiarism":null,"extra_credit":null,"grade_rule":"Lab average below 60% caps the course grade at the lab average"}',
    '["Non-linear grade gate: lab average below 60% becomes the course grade"]',
    'Calculus-based evening physics with integrated lab; exams carry most weight and a lab-minimum rule can cap the course grade.'),
 (5, 7, 5, '2026-08-22', '2026-11-13', '2026-09-08',
    '["Design algorithms with pseudocode and flowcharts"]',
    '[{"when":"Weeks 1-15","topic":"Progressive programming assignments"}]',
    '{"late_work":"Accepted with flexible penalties; communicate early","attendance":null,"makeup":null,"ai_plagiarism":"Tools allowed with citation; interviews may verify authorship","extra_credit":null}',
    '[]',
    'Online programming-logic course graded mainly through build-style programming assignments and quizzes, with a lenient, communication-first late policy.'),
 (6, 3, 7, '2026-08-12', '2026-10-02', '2026-09-01',
    '[]',
    '[{"when":"Weekly","topic":"Quiz + unit exam blocks (8-week fast track)"}]',
    '{"late_work":"Not accepted","attendance":null,"makeup":null,"ai_plagiarism":null,"extra_credit":null}',
    '[]',
    'Fast-track online U.S. history survey graded through weekly quizzes and unit exams.');

INSERT INTO grading_components (id, syllabus_id, raw_label, canonical_type, weight_pct, points, notes) VALUES
 -- HIST §71001 — project-only archetype (97.4% project)
 (1,  1, 'History Podcasters',        'project',       97.4, 730, 'Scaffolded 5-week podcast; milestone deadlines'),
 (2,  1, 'Onboarding tasks',          'participation',  2.6,  20, 'Two 10-pt startup tasks'),
 -- HIST §71002 — quiz/exam baseline (makes the podcast RARE for query C)
 (3,  2, 'Weekly reading quizzes',    'quiz',          40.0, NULL, NULL),
 (4,  2, 'Unit exams',                'exam',          60.0, NULL, 'Three unit exams'),
 -- ACCT §72001 — exam-heavy archetype (points -> pct, 62.5% exams total)
 (5,  3, 'Unit Exams',                'exam',          37.5, 375, 'points/1000 converted to pct'),
 (6,  3, 'Final Exam',                'final_exam',    25.0, 250, NULL),
 (7,  3, 'Assignments',               'homework',      24.0, 240, 'SmartBook + exercises mixed; unlimited attempts, highest counts'),
 (8,  3, 'Quizzes',                   'quiz',          13.5, 135, NULL),
 -- PHYS §73001 — lecture+lab archetype
 (9,  4, 'Unit Exams',                'exam',          60.0, NULL, NULL),
 (10, 4, 'Laboratory',                'lab',           25.0, NULL, 'Lab average below 60% caps the course grade'),
 (11, 4, 'Homework',                  'homework',      15.0, NULL, NULL),
 -- ITSE §74001 — build-heavy archetype
 (12, 5, 'Programming Assignments',   'project',       50.0, NULL, 'Progressive builds'),
 (13, 5, 'Quizzes',                   'quiz',          40.0, NULL, NULL),
 (14, 5, 'Participation',             'participation', 10.0, NULL, NULL),
 -- HIST §71003 — fast-track quiz/exam (makes project share 1/3 < 0.34 for query C)
 (15, 6, 'Weekly quizzes',            'quiz',          40.0, NULL, NULL),
 (16, 6, 'Unit exams',                'exam',          60.0, NULL, NULL);

INSERT INTO section_meetings (id, section_id, meeting_type, days, start_time, end_time, campus, building, room) VALUES
 -- PHYS: lecture + lab, sequential evening blocks (NO self-conflict — query F)
 (1, 6, 'lecture', 'MTWR', '17:00', '19:00', 'EFC', 'Wichita Hall', 'W101'),
 (2, 6, 'lab',     'MTWR', '19:10', '21:10', 'EFC', 'Sabine Hall',  'S110'),
 -- ENGL MW evening — overlaps PHYS lecture on M/W (the fabricated conflict pair)
 (3, 8, 'lecture', 'MW',   '18:00', '19:30', 'EFC', 'Lakeview Hall', 'L110'),
 -- HIST in-person section, daytime TR
 (4, 2, 'lecture', 'TR',   '10:00', '11:20', 'RLC', 'Crockett Hall', 'C245'),
 -- ACCT evening MW (Hannah's evening filter: start_time >= 17:00)
 (5, 4, 'lecture', 'MW',   '17:30', '19:30', 'EFC', 'North Hall',    'N222');
 -- ITSE §74001 and HIST §71001 are online: deliberately ZERO meeting rows.

INSERT INTO section_materials (id, section_id, component, bookstore_url, items) VALUES
 (1, 4, NULL,      'https://bookstore.example.edu/course/ACCT/2301/72001', '[{"title":"Financial Accounting 12e","required":true}]'),
 (2, 6, 'lecture', 'https://bookstore.example.edu/course/PHYS/2425/73001', NULL),
 (3, 6, 'lab',     'https://bookstore.example.edu/course/PHYS/2425/73001-L1', NULL),
 (4, 7, 'lecture', 'https://bookstore.example.edu/course/ITSE/1329/74001', NULL),
 (5, 1, NULL,      'https://bookstore.example.edu/course/HIST/1301/71001', NULL);

-- ---------------------------------------------------------------------------
-- MODULE 4 · support-contact directory (fictional people, NO emails)
-- ---------------------------------------------------------------------------

INSERT INTO institutions (id, external_id, name, website) VALUES
 (1, 'inst-dallas-college', 'Dallas College', 'https://www.dallascollege.edu');

INSERT INTO academic_units (id, external_id, institution_id, name) VALUES
 (1, 'unit-etms',       1, 'ETMS'),
 (2, 'unit-business',   1, 'Business, Hospitality & Global Trade'),
 (3, 'unit-creative',   1, 'Creative Arts, Entertainment & Design'),
 (4, 'unit-education',  1, 'Education'),
 (5, 'unit-health',     1, 'Health Sciences'),
 (6, 'unit-general-all',1, 'General / All');  -- college-wide fallback — routing never dead-ends (Issue #43)

INSERT INTO contacts (id, name, email, helps_with, active, last_verified_date) VALUES
 (1, 'Grant Steward (ETMS) — fictional',      NULL, 'School-managed grant funds for ETMS programs', true,  '2026-06-15'),
 (2, 'Grant Steward (Business) — fictional',  NULL, 'School-managed grant funds for Business programs', true, '2026-06-15'),
 (3, 'Scholarship Office — fictional',        NULL, 'College-wide scholarship applications', true, '2026-05-01'),
 (4, 'Student Care Coordinator — fictional',  NULL, 'Emergency aid, food pantry, housing referrals', true, '2026-04-20'),
 (5, 'Former Grant Steward — fictional',      NULL, 'Superseded contact kept for history', false, '2025-11-01');

INSERT INTO resource_categories (id, name, routing_model) VALUES
 (1, 'grants',          'per_school — route, don''t determine eligibility'),
 (2, 'scholarships',    'centralized — route, don''t determine eligibility'),
 (3, 'financial_aid',   'centralized — route, don''t determine eligibility'),
 (4, 'emergency_funds', 'centralized — route, don''t determine eligibility'),
 (5, 'student_care',    'centralized — route, don''t determine eligibility'),
 (6, 'tech_support',    'centralized — route, don''t determine eligibility');

INSERT INTO help_topics (id, name) VALUES
 (1, 'rent'), (2, 'utilities'), (3, 'food'), (4, 'mental health'),
 (5, 'laptops'), (6, 'transportation'), (7, 'childcare'), (8, 'books');

INSERT INTO assignments (id, contact_id, academic_unit_id, resource_category_id, degree_or_program) VALUES
 (1, 1, 1, 1, NULL),                          -- ETMS grants -> ETMS steward (query E)
 (2, 2, 2, 1, NULL),                          -- Business grants -> Business steward
 (3, 3, 6, 2, NULL),                          -- scholarships: college-wide via General/All
 (4, 4, 6, 4, NULL),                          -- emergency funds: college-wide via General/All
 (5, 4, 6, 5, NULL);                          -- student care: college-wide via General/All

INSERT INTO assignment_topics (assignment_id, help_topic_id) VALUES
 (4, 1), (4, 2), (4, 3), (5, 4), (5, 5);

INSERT INTO student_guidance (id, resource_category_id, prep_steps, awareness_msg) VALUES
 (1, 1, 'FAFSA on file + declared program of study', 'Your school may have grant funding — ask your school''s grant contact what''s available for your program.'),
 (2, 2, 'FAFSA on file; check deadlines each semester', 'One scholarship application covers many awards at once.'),
 (3, 4, 'Short intake form; documentation helps but isn''t required to start', 'Emergency aid exists for rent, utilities, food, and tech — ask early.');

INSERT INTO programs (id, contact_id, name, deferred_detail) VALUES
 (1, 1, 'Engineering (legacy directory stub)', 'Planning questions use Module 6 degree_plans'),
 (2, 2, 'Business Administration (legacy directory stub)', NULL);

-- ---------------------------------------------------------------------------
-- MODULE 6 · catalog & degree plans (fulfillment is edition-cited, ADR-007)
-- ---------------------------------------------------------------------------

INSERT INTO catalog_editions (id, catoid, year_label, is_active, raw_document_id) VALUES
 (1, 5, '2026-2027', true,  7),
 (2, 4, '2025-2026', false, NULL);

INSERT INTO degree_plans (id, catalog_edition_id, poid, name, award_type, academic_unit_id, raw_document_id) VALUES
 (1, 1, 4242, 'Associate of Science',                'AS',          1, 7),
 (2, 1, 5150, 'BAT Software Development',            'BAT',         1, NULL),
 (3, 2, 3990, 'Associate of Science',                'AS',          1, NULL);

INSERT INTO plan_requirements (id, degree_plan_id, group_name, component_area_code, credits_required, rule) VALUES
 (1, 1, 'American History (060)',            '060', 6,  NULL),
 (2, 1, 'Life and Physical Sciences (030)',  '030', 6,  NULL),
 (3, 1, 'Communication (010)',               '010', 6,  NULL),
 (4, 2, 'Major Courses',                     NULL,  21, 'Complete all listed ITSE courses with grade C or better'),
 (5, 3, 'American History (060)',            '060', 6,  NULL);

INSERT INTO requirement_courses (requirement_id, course_id) VALUES
 (1, 1),   -- AS catoid5: American History <- HIST-1301  (DoD #6 question)
 (2, 4),   -- AS catoid5: Life & Physical Sciences <- PHYS-2425
 (3, 6),   -- AS catoid5: Communication <- ENGL-1301
 (4, 3),   -- BAT: Major Courses <- ITSE-1329
 (5, 1);   -- AS catoid4 (prior edition): American History <- HIST-1301

INSERT INTO course_requisites (id, course_id, kind, requisite_course_id, raw_text) VALUES
 (1, 4, 'prerequisite', 5,    'Prerequisite: MATH 2413 - Calculus I'),
 (2, 1, 'tsi',          NULL, 'TSI Reading requirements met or approved exemptions/waivers.'),
 (3, 6, 'tsi',          NULL, 'TSI Writing requirements met or approved exemptions/waivers.'),
 (4, 5, 'prerequisite', NULL, 'Prerequisite: MATH 2412 or equivalent placement (course not in mock data).'),
 (5, 3, 'other',        NULL, 'Recommended: basic computer literacy (ITSC 1301) or instructor approval.');

-- ---------------------------------------------------------------------------
-- Sequences: explicit ids were used for readable FK wiring — resync them.
-- ---------------------------------------------------------------------------
SELECT setval(pg_get_serial_sequence('raw_documents', 'id'),      (SELECT MAX(id) FROM raw_documents));
SELECT setval(pg_get_serial_sequence('extractions', 'id'),        (SELECT MAX(id) FROM extractions));
SELECT setval(pg_get_serial_sequence('terms', 'id'),              (SELECT MAX(id) FROM terms));
SELECT setval(pg_get_serial_sequence('courses', 'id'),            (SELECT MAX(id) FROM courses));
SELECT setval(pg_get_serial_sequence('instructors', 'id'),        (SELECT MAX(id) FROM instructors));
SELECT setval(pg_get_serial_sequence('sections', 'id'),           (SELECT MAX(id) FROM sections));
SELECT setval(pg_get_serial_sequence('syllabi', 'id'),            (SELECT MAX(id) FROM syllabi));
SELECT setval(pg_get_serial_sequence('grading_components', 'id'), (SELECT MAX(id) FROM grading_components));
SELECT setval(pg_get_serial_sequence('section_meetings', 'id'),   (SELECT MAX(id) FROM section_meetings));
SELECT setval(pg_get_serial_sequence('section_materials', 'id'),  (SELECT MAX(id) FROM section_materials));
SELECT setval(pg_get_serial_sequence('institutions', 'id'),       (SELECT MAX(id) FROM institutions));
SELECT setval(pg_get_serial_sequence('academic_units', 'id'),     (SELECT MAX(id) FROM academic_units));
SELECT setval(pg_get_serial_sequence('contacts', 'id'),           (SELECT MAX(id) FROM contacts));
SELECT setval(pg_get_serial_sequence('resource_categories', 'id'),(SELECT MAX(id) FROM resource_categories));
SELECT setval(pg_get_serial_sequence('help_topics', 'id'),        (SELECT MAX(id) FROM help_topics));
SELECT setval(pg_get_serial_sequence('assignments', 'id'),        (SELECT MAX(id) FROM assignments));
SELECT setval(pg_get_serial_sequence('student_guidance', 'id'),   (SELECT MAX(id) FROM student_guidance));
SELECT setval(pg_get_serial_sequence('programs', 'id'),           (SELECT MAX(id) FROM programs));
SELECT setval(pg_get_serial_sequence('catalog_editions', 'id'),   (SELECT MAX(id) FROM catalog_editions));
SELECT setval(pg_get_serial_sequence('degree_plans', 'id'),       (SELECT MAX(id) FROM degree_plans));
SELECT setval(pg_get_serial_sequence('plan_requirements', 'id'),  (SELECT MAX(id) FROM plan_requirements));
SELECT setval(pg_get_serial_sequence('course_requisites', 'id'),  (SELECT MAX(id) FROM course_requisites));

-- ---------------------------------------------------------------------------
-- MODULE 3 (optional) · embeddings — seeded ONLY when pgvector is installed.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')
       AND to_regclass('embeddings') IS NOT NULL THEN
        EXECUTE 'TRUNCATE embeddings RESTART IDENTITY';
        EXECUTE format(
            'INSERT INTO embeddings (syllabus_id, chunk_ix, chunk_text, embedding, embed_model) VALUES
             (1, 0, %L, %L::vector, %L),
             (4, 0, %L, %L::vector, %L)',
            'Podcast project milestones and no-late policy...',
            '[' || array_to_string(array_fill(0.01::float4, ARRAY[768]), ',') || ']',
            'nomic-embed-text',
            'Lab-minimum grade gate: below 60% caps the course grade...',
            '[' || array_to_string(array_fill(0.02::float4, ARRAY[768]), ',') || ']',
            'nomic-embed-text');
        -- directory retrieval target (Issue #43): helps_with + scope + topics
        EXECUTE format(
            'INSERT INTO embeddings (contact_id, chunk_ix, chunk_text, embedding, embed_model) VALUES
             (4, 0, %L, %L::vector, %L)',
            'Emergency aid, food pantry, housing referrals | college-wide (General / All) | topics: rent, utilities, food, mental health, laptops',
            '[' || array_to_string(array_fill(0.03::float4, ARRAY[768]), ',') || ']',
            'nomic-embed-text');
        RAISE NOTICE 'embeddings: seeded 3 mock rows incl. directory target (pgvector present)';
    ELSE
        RAISE NOTICE 'embeddings: skipped (pgvector not installed — optional module, ADR-005)';
    END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------------
-- Proof of insertion: per-table row counts (prints when run via psql).
-- ---------------------------------------------------------------------------
SELECT t.table_name,
       (xpath('/row/cnt/text()',
              query_to_xml(format('SELECT count(*) AS cnt FROM %I', t.table_name),
                           false, true, '')))[1]::text::int AS rows
FROM information_schema.tables t
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;
