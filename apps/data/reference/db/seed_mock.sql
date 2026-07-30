-- ============================================================================
-- Success Coach Chatbot — Mock Seed Data
--
-- Realistic sample rows showing how every kind of content lives in the
-- two-table schema (apply apps/data/db/schema.sql first):
--
--   psql "$DATABASE_URL_UNPOOLED" -f apps/data/db/seed_mock.sql
--
-- Idempotent: safe to run repeatedly (ON CONFLICT DO NOTHING).
-- All data below is FAKE and for local/dev testing only.
-- ============================================================================

-- Mock embedding generator (deterministic per seed value). Real embeddings
-- come from the ingest pipeline's embedding model — this exists only so
-- NOT NULL vector columns can be seeded and vector queries can be smoke-tested.
CREATE OR REPLACE FUNCTION mock_embedding(seed integer) RETURNS halfvec(768)
LANGUAGE sql IMMUTABLE AS $$
    SELECT ('[' || string_agg(trunc(sin(i * seed)::numeric, 6)::text, ',' ORDER BY i) || ']')::halfvec(768)
    FROM generate_series(1, 768) AS i;
$$;

-- ============================================================================
-- knowledge_entry — one example of every doc_type
-- ============================================================================

INSERT INTO knowledge_entry (source_url, chunk_index, content_hash, chunk_text, facts, metadata, embedding) VALUES

-- 1) course fact row: catalog-scoped, no prerequisites -----------------------
('https://catalog.dallascollege.edu/preview_course.php?catoid=5&coid=101#2025-2026#facts', 0,
 'seedhash-engl1301',
 'ENGL 1301 — Composition I (3 credit hours). Intensive study of and practice in writing processes, from invention and researching to drafting, revising, and editing. TSI Reading and Writing standards must be met before enrolling.',
 '{"course_code": "ENGL 1301", "title": "Composition I", "credit_hours": 3,
   "description": "Intensive study of and practice in writing processes, from invention and researching to drafting, revising, and editing, both individually and collaboratively.",
   "state_outcomes": "Demonstrate knowledge of writing as process; apply basic principles of critical thinking in analyzing texts.",
   "prerequisites": [], "corequisites": [],
   "requisites_raw": "Prerequisite: Meet TSI college-readiness standard for Reading and Writing.",
   "confidence": "high"}',
 '{"doc_type": "course", "module": "degree_planning", "course_code": "ENGL 1301", "subject": "ENGL",
   "catalog_year": "2025-2026", "acalog_catoid": "5", "acalog_coid": "101",
   "extractor": "seed", "schema_version": "facts-course-v1"}',
 mock_embedding(101)),

-- 2) course fact row: with a prerequisite ------------------------------------
('https://catalog.dallascollege.edu/preview_course.php?catoid=5&coid=102#2025-2026#facts', 0,
 'seedhash-engl1302',
 'ENGL 1302 — Composition II (3 credit hours). Continuation of ENGL 1301 focusing on academic argument, research, and rhetorical analysis. Prerequisite: ENGL 1301.',
 '{"course_code": "ENGL 1302", "title": "Composition II", "credit_hours": 3,
   "description": "Intensive study of and practice in the strategies and techniques for developing research-based expository and persuasive texts.",
   "state_outcomes": "Develop ideas and synthesize primary and secondary sources within focused academic arguments.",
   "prerequisites": [{"one_of": ["ENGL 1301"], "raw_text": "Prerequisite: ENGL 1301 with a grade of C or higher."}],
   "corequisites": [],
   "requisites_raw": "Prerequisite: ENGL 1301 with a grade of C or higher.",
   "confidence": "high"}',
 '{"doc_type": "course", "module": "degree_planning", "course_code": "ENGL 1302", "subject": "ENGL",
   "catalog_year": "2025-2026", "acalog_catoid": "5", "acalog_coid": "102",
   "extractor": "seed", "schema_version": "facts-course-v1"}',
 mock_embedding(102)),

-- 3) course fact row: lab science course --------------------------------------
('https://catalog.dallascollege.edu/preview_course.php?catoid=5&coid=210#2025-2026#facts', 0,
 'seedhash-biol1406',
 'BIOL 1406 — Biology for Science Majors I (4 credit hours). Fundamental principles of living organisms: cell structure, metabolism, genetics, and molecular biology. Includes laboratory.',
 '{"course_code": "BIOL 1406", "title": "Biology for Science Majors I", "credit_hours": 4,
   "description": "Fundamental principles of living organisms, including physical and chemical properties of life, cellular organization and function, metabolic processes, genetics, and molecular biology. Laboratory required.",
   "state_outcomes": "Describe the characteristics of life; apply scientific reasoning to biological questions; demonstrate laboratory technique.",
   "prerequisites": [], "corequisites": [],
   "requisites_raw": "Prerequisite: Meet TSI college-readiness standard in Reading; MATH 1314 recommended.",
   "confidence": "high"}',
 '{"doc_type": "course", "module": "degree_planning", "course_code": "BIOL 1406", "subject": "BIOL",
   "catalog_year": "2025-2026", "acalog_catoid": "5", "acalog_coid": "210",
   "extractor": "seed", "schema_version": "facts-course-v1"}',
 mock_embedding(210)),

-- 4) program_map fact row: degree plan with requirement groups ----------------
('https://catalog.dallascollege.edu/preview_program.php?catoid=5&poid=1420#2025-2026#facts', 0,
 'seedhash-as-biology',
 'Associate of Science in Biology (60 credit hours, 2025-2026 catalog). Core curriculum 42 credits including Communication (ENGL 1301, ENGL 1302) and Life & Physical Sciences; major preparation includes BIOL 1406 and BIOL 1407.',
 '{"program_code": "AS-BIOL", "name": "Associate of Science in Biology", "award_type": "AS",
   "school": "School of Health Sciences", "total_credits": 60, "catalog_year": "2025-2026",
   "groups": [
     {"name": "Communication (010)", "component_area_code": "010", "credits_required": 6,
      "rule": null, "courses": ["ENGL 1301", "ENGL 1302"]},
     {"name": "Life and Physical Sciences (030)", "component_area_code": "030", "credits_required": 8,
      "rule": null, "courses": ["BIOL 1406", "BIOL 1407"]},
     {"name": "Major Preparation", "component_area_code": null, "credits_required": 8,
      "rule": "Take BIOL 1406 and BIOL 1407 in sequence; complete before organic chemistry.",
      "courses": ["BIOL 1406", "BIOL 1407"]}],
   "confidence": "high"}',
 '{"doc_type": "program_map", "module": "degree_planning", "program_code": "AS-BIOL",
   "catalog_year": "2025-2026", "acalog_catoid": "5", "acalog_poid": "1420",
   "extractor": "seed", "schema_version": "facts-program-map-v1"}',
 mock_embedding(1420)),

-- 5) section fact row: online (empty meetings array = online, by convention) --
('https://schedule.dallascollege.edu/2026FA.csv#ENGL-1302-71001', 0,
 'seedhash-sec-71001',
 'ENGL 1302 section 71001, Fall 2026, online, taught by Jordan Avery. Runs 2026-08-24 to 2026-12-10.',
 '{"section_number": "71001", "instructor": "Jordan Avery", "instructor_slug": "jordan-avery-english",
   "modality": "online", "campus": "Online", "start_date": "2026-08-24", "end_date": "2026-12-10",
   "credit_hours": 3, "session": "full",
   "meetings": [], "meeting_info_raw": "ONLINE",
   "coreq_section_ref": null, "materials_links": [], "confidence": "high"}',
 '{"doc_type": "section", "module": "degree_planning", "course_code": "ENGL 1302", "subject": "ENGL",
   "year": 2026, "semester": "fall", "section": "71001", "campus": "Online", "modality": "online",
   "professor": "Jordan Avery", "instructor_slug": "jordan-avery-english",
   "credit_hours": 3, "session": "full",
   "extractor": "seed", "schema_version": "facts-section-v1"}',
 mock_embedding(71001)),

-- 6) section fact row: in-person, fast-track — WITH its syllabus facts embedded.
--    A section and its syllabus are ONE row: the offering's representative
--    section carries facts.syllabus (a facts-syllabus-v1 object) plus
--    facts.syllabus_source_url (the Concourse page cited for syllabus claims).
('https://schedule.dallascollege.edu/2026FA.csv#BIOL-1406-72002', 0,
 'seedhash-sec-72002',
 'BIOL 1406 section 72002, Fall 2026, in person at Richland (RLC), taught by Maria Chen. Lecture MW 10:00-11:15, lab W 14:00-16:45. Fast-track: runs 2026-10-19 to 2026-12-10. Syllabus: exam-focused (45%) with a substantial lab component; strict lab attendance; 48-hour late-work window with penalty.',
 '{"section_number": "72002", "instructor": "Maria Chen", "instructor_slug": "maria-chen-biology",
   "modality": "in_person", "campus": "RLC", "start_date": "2026-10-19", "end_date": "2026-12-10",
   "credit_hours": 4, "session": "8wk2",
   "meetings": [
     {"type": "lecture", "days": "MW", "start_time": "10:00", "end_time": "11:15", "building": "Sabine", "room": "S204"},
     {"type": "lab",     "days": "W",  "start_time": "14:00", "end_time": "16:45", "building": "Sabine", "room": "S117"}],
   "meeting_info_raw": "S204 LEC MW 10:00am-11:15am; S117 LAB W 2:00pm-4:45pm",
   "coreq_section_ref": null,
   "materials_links": [{"component": "lecture", "url": "https://www.bkstr.com/dallascollegestore/course/BIOL-1406-72002"}],
   "syllabus_source_url": "https://hb2504.dcccd.edu/syllabi/biol-1406-72002-fall-2026",
   "syllabus": {
     "grading": [
       {"raw_label": "Unit Exams (3)", "canonical_type": "exam", "weight_pct": 45, "points": null, "notes": "lowest exam replaced by final if higher"},
       {"raw_label": "Lab Reports", "canonical_type": "lab", "weight_pct": 25, "points": null, "notes": null},
       {"raw_label": "Reading Quizzes", "canonical_type": "quiz", "weight_pct": 15, "points": null, "notes": "unlimited attempts, highest counts"},
       {"raw_label": "Participation", "canonical_type": "participation", "weight_pct": 15, "points": null, "notes": null}],
     "policies": {"late_work": "Accepted up to 48 hours late with a 10% penalty.",
                  "attendance": "Lab attendance mandatory; two unexcused absences may result in a drop.",
                  "makeup": "Makeup exams by documented emergency only.",
                  "ai_plagiarism": "AI tools may be used for studying but not for graded submissions.",
                  "extra_credit": null},
     "instructor_outcomes": "Students will design and run a small original experiment in week 12.",
     "course_schedule": "Week 1: Chemistry of life … Week 15: Molecular genetics review.",
     "distinctive_features": "Semester-long microbiome mini-research project.",
     "full_summary": "Exam-focused section (45%) with a substantial lab component; strict lab attendance; 48-hour late-work window with penalty; includes an original mini-research project.",
     "modified_date": "2026-08-20", "withdraw_date": "2026-11-12", "certification_date": "2026-10-26",
     "confidence": "high"},
   "confidence": "high"}',
 '{"doc_type": "section", "module": "degree_planning", "course_code": "BIOL 1406", "subject": "BIOL",
   "year": 2026, "semester": "fall", "section": "72002", "campus": "RLC", "modality": "in_person",
   "professor": "Maria Chen", "instructor_slug": "maria-chen-biology",
   "credit_hours": 4, "session": "8wk2", "modified_date": "2026-08-20",
   "extractor": "seed", "schema_version": "facts-section-v1"}',
 mock_embedding(72002)),

-- 7) sibling section of the SAME offering (same professor+course+modality):
--    carries facts.syllabus_ref pointing at the representative row above
--    instead of duplicating the syllabus. Serving its syllabus answers renders
--    the provenance label ("based on the syllabus for section 72002").
('https://schedule.dallascollege.edu/2026FA.csv#BIOL-1406-72003', 0,
 'seedhash-sec-72003',
 'BIOL 1406 section 72003, Fall 2026, in person at Richland (RLC), taught by Maria Chen. Lecture TR 08:30-09:45, lab R 13:00-15:45. Full term: runs 2026-08-24 to 2026-12-10.',
 '{"section_number": "72003", "instructor": "Maria Chen", "instructor_slug": "maria-chen-biology",
   "modality": "in_person", "campus": "RLC", "start_date": "2026-08-24", "end_date": "2026-12-10",
   "credit_hours": 4, "session": "full",
   "meetings": [
     {"type": "lecture", "days": "TR", "start_time": "08:30", "end_time": "09:45", "building": "Sabine", "room": "S204"},
     {"type": "lab",     "days": "R",  "start_time": "13:00", "end_time": "15:45", "building": "Sabine", "room": "S117"}],
   "meeting_info_raw": "S204 LEC TR 8:30am-9:45am; S117 LAB R 1:00pm-3:45pm",
   "coreq_section_ref": null,
   "materials_links": [{"component": "lecture", "url": "https://www.bkstr.com/dallascollegestore/course/BIOL-1406-72003"}],
   "syllabus_ref": "https://schedule.dallascollege.edu/2026FA.csv#BIOL-1406-72002",
   "confidence": "high"}',
 '{"doc_type": "section", "module": "degree_planning", "course_code": "BIOL 1406", "subject": "BIOL",
   "year": 2026, "semester": "fall", "section": "72003", "campus": "RLC", "modality": "in_person",
   "professor": "Maria Chen", "instructor_slug": "maria-chen-biology",
   "credit_hours": 4, "session": "full",
   "extractor": "seed", "schema_version": "facts-section-v1"}',
 mock_embedding(720021)),

-- 8) syllabus prose chunk: retrievable by semantic search ----------------------
('https://hb2504.dcccd.edu/syllabi/biol-1406-72002-fall-2026', 1,
 'seedhash-syl-72002-c1',
 '### Required Materials

**Textbook**: Campbell Biology (12th Edition) by Urry et al. A digital copy is provided free to all students on the first day of class via eCampus through the Inclusive Access program — **no physical textbook purchase is required**. The lab manual (BIOL 1406 Lab Exercises) is available as free downloadable PDFs on eCampus.',
 NULL,
 '{"doc_type": "syllabus", "module": "degree_planning", "course_code": "BIOL 1406", "subject": "BIOL",
   "year": 2026, "semester": "fall", "section": "72002",
   "professor": "Maria Chen", "instructor_slug": "maria-chen-biology",
   "header_path": "Required Materials", "extractor": "seed"}',
 mock_embedding(720022)),

-- 9) cv fact row: instructor background (timeless — no term/catalog stamps) ----
('https://hb2504.dcccd.edu/Profile/maria-chen#facts', 0,
 'seedhash-cv-chen',
 'Maria Chen, Professor of Biology at Dallas College (Richland). Ph.D. in Microbiology, UT Southwestern. Ten years of industry research experience in molecular diagnostics before teaching.',
 '{"name": "Maria Chen", "department": "Biology", "email": null,
   "cv_url": "https://hb2504.dcccd.edu/Profile/maria-chen",
   "courses_taught": ["BIOL 1406", "BIOL 1407", "BIOL 2401"], "confidence": "high"}',
 '{"doc_type": "cv", "module": "degree_planning",
   "professor": "Maria Chen", "instructor_slug": "maria-chen-biology", "department": "Biology",
   "extractor": "seed", "schema_version": "facts-cv-v1"}',
 mock_embedding(9001)),

-- 10) cv prose chunk ------------------------------------------------------------
('https://hb2504.dcccd.edu/Profile/maria-chen', 1,
 'seedhash-cv-chen-c1',
 '### Professional Background

Dr. Chen spent ten years in industry molecular-diagnostics research before joining Dallas College, and brings that applied laboratory perspective into BIOL 1406: students run a semester-long microbiome mini-research project modeled on real lab workflows.',
 NULL,
 '{"doc_type": "cv", "module": "degree_planning",
   "professor": "Maria Chen", "instructor_slug": "maria-chen-biology", "department": "Biology",
   "header_path": "Professional Background", "extractor": "seed"}',
 mock_embedding(9002)),

-- 11) contact fact row: support routing (timeless) -------------------------------
('seed://contacts/etms-grants', 0,
 'seedhash-contact-etms',
 'ETMS grants contact: the School of Engineering, Technology, Mathematics and Sciences grant coordinator helps students in ETMS programs find and apply for school-administered grants. Have a FAFSA on file and a declared program of study before reaching out.',
 '{"office": "ETMS Grants Office", "unit": "ETMS", "campus": null, "category": "grants",
   "topics": ["tuition_gap", "grants", "emergency_aid"],
   "helps_with": "School-administered grants for students in ETMS programs",
   "scope": "all_programs", "program_codes": null,
   "criteria": "FAFSA on file; declared program of study in an ETMS field.",
   "prep_steps": "1) File FAFSA. 2) Declare your program of study. 3) Bring your student ID and program details.",
   "awareness_msg": "Many school-administered grants go unclaimed — if you are in an ETMS program, ask about grant options before taking a loan.",
   "url": "https://www.dallascollege.edu/paying-for-college", "email": null,
   "active": true,
   "verification": {"source": "ETMS dean office", "verified_by": "club-steward", "last_verified_date": "2026-07-01"},
   "confidence": "high"}',
 '{"doc_type": "contact", "module": "contacts", "unit": "ETMS", "category": "grants",
   "topics": ["tuition_gap", "grants", "emergency_aid"],
   "extractor": "seed", "schema_version": "facts-contact-v1"}',
 mock_embedding(4001)),

-- 11b) contact fact row: the 'General / All' never-dead-end routing fallback ----
('seed://contacts/general-all', 0,
 'seedhash-contact-general',
 'Dallas College student support - general help: the starting point for any student question when no school-specific contact applies. Success Coaches route financial aid, advising, tutoring, and personal-support questions.',
 '{"office": "Student Support (General)", "unit": "General / All", "campus": null, "category": "general",
   "topics": ["general_help"],
   "helps_with": "Any student support question without a school-specific contact",
   "scope": "all_programs", "program_codes": null,
   "criteria": null,
   "prep_steps": "Have your student ID ready.",
   "awareness_msg": null,
   "url": "https://www.dallascollege.edu/resources", "email": null,
   "active": true,
   "verification": {"source": "seed", "verified_by": null, "last_verified_date": null},
   "confidence": "high"}',
 '{"doc_type": "contact", "module": "contacts", "unit": "General / All", "category": "general",
   "topics": ["general_help"], "extractor": "seed", "schema_version": "facts-contact-v1"}',
 mock_embedding(4002)),

-- 12) knowledge_article: curated guidance content --------------------------------
('seed://articles/f1-enrollment-basics', 0,
 'seedhash-article-f1',
 '### F-1 Students: Enrollment Basics

F-1 visa students must maintain full-time enrollment (12+ credit hours in fall and spring) to keep their status, and no more than one online class (3 credit hours) may count toward that minimum each term. Always confirm your specific situation with a Designated School Official (DSO) before changing your schedule.',
 NULL,
 '{"doc_type": "knowledge_article", "module": "international", "extractor": "seed"}',
 mock_embedding(5001)),

-- 13) event fact row: term-scoped, epoch times (UTC) for typed time filtering ----
('https://www.dallascollege.edu/events/calendar#fall-welcome-fest-2026', 0,
 'seedhash-event-welcomefest',
 'Fall Welcome Fest at Richland Campus (RLC): Monday, August 24, 2026, 5:00–8:00 PM on the Guadalupe Hall lawn. Free food, club sign-ups (including the AI Club), and campus resource booths.',
 '{"title": "Fall Welcome Fest", "campus": "RLC", "location": "Guadalupe Hall lawn, Richland Campus",
   "category": "social", "event_start_epoch": 1787608800, "event_end_epoch": 1787619600,
   "registration_url": "https://www.dallascollege.edu/events/calendar", "confidence": "high"}',
 '{"doc_type": "event", "module": "events", "year": 2026, "semester": "fall", "campus": "RLC",
   "category": "social", "event_start_epoch": 1787608800, "event_end_epoch": 1787619600,
   "extractor": "seed", "schema_version": "facts-event-v1"}',
 mock_embedding(6001)),

-- 14) catalog prose chunk: catalog-scoped, year-namespaced pseudo-URI ------------
('https://catalog.dallascollege.edu/content.php?catoid=5&navoid=920#2025-2026', 0,
 'seedhash-catalog-tsi',
 '### Texas Success Initiative (TSI)

All students must meet Texas college-readiness standards in Reading, Writing, and Mathematics before enrolling in courses that carry those prerequisites. Standards can be met through the TSI Assessment or through exemptions such as qualifying SAT/ACT scores or prior college credit.',
 NULL,
 '{"doc_type": "catalog", "module": "degree_planning", "catalog_year": "2025-2026",
   "acalog_catoid": "5", "extractor": "seed"}',
 mock_embedding(7001)),

-- 15) academic_calendar fact row: term-wide deadlines (term-scoped) -------------
('https://www.dallascollege.edu/academics/academic-calendar#2026-fall', 0,
 'seedhash-cal-2026fall',
 'Fall 2026 academic calendar: registration opens April 15; last day to register August 21; census date September 8; last day to withdraw with a W is November 12 (full-term classes).',
 '{"term_label": "Fall 2026", "deadlines": [
     {"label": "Registration opens", "date": "2026-04-15", "applies_to": "all"},
     {"label": "Last day to register", "date": "2026-08-21", "applies_to": "full-term"},
     {"label": "Census date", "date": "2026-09-08", "applies_to": "full-term"},
     {"label": "Last day to withdraw with a W", "date": "2026-11-12", "applies_to": "full-term"}],
   "confidence": "high"}',
 '{"doc_type": "academic_calendar", "module": "degree_planning", "year": 2026, "semester": "fall",
   "extractor": "seed", "schema_version": "facts-academic-calendar-v1"}',
 mock_embedding(8001)),

-- 16) transfer_guide fact row: route-don't-determine guidance (catalog-scoped) ---
('seed://transfer-guides/unt-computer-science#2025-2026', 0,
 'seedhash-tg-unt-cs',
 'Transferring to UNT for Computer Science: the A.S. core generally transfers; complete calculus (MATH 2413/2414) and university physics (PHYS 2425/2426) at Dallas College. Course-by-course equivalencies are determined only by UNT admissions - always confirm with a UNT advisor.',
 '{"target_institution": "University of North Texas",
   "program_notes": "UNT BS in Computer Science: A.S. core generally accepted; take MATH 2413/2414 and PHYS 2425/2426 at Dallas College.",
   "advisor_contacts": ["UNT Transfer Center - transfer@unt.edu"],
   "source_notes": "Equivalency decisions belong to UNT admissions; this guide routes, it does not promise credit.",
   "confidence": "medium"}',
 '{"doc_type": "transfer_guide", "module": "degree_planning", "catalog_year": "2025-2026",
   "target_institution": "UNT", "extractor": "seed", "schema_version": "facts-transfer-guide-v1"}',
 mock_embedding(8002))

ON CONFLICT (source_url, chunk_index) DO NOTHING;


-- ============================================================================
-- chat_session — anonymous profiles + per-turn telemetry events
-- ============================================================================

INSERT INTO chat_session (id, student_id, profile, history) VALUES

-- a) answered question with a citation
('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '{"campus": "RLC", "major": "AS-BIOL", "student_type": "returning"}',
 '[{"v": 1, "role": "user", "ts": "2026-07-09T15:02:11Z",
    "content_scrubbed": "what are the prerequisites for ENGL 1302?",
    "event": {"intent": "prereq_lookup", "confidence": 0.94,
              "grounding": {"matched": [{"phrase": "engl 1302", "target": "ENGL 1302", "match_kind": "exact"}]}}},
   {"v": 1, "role": "assistant", "ts": "2026-07-09T15:02:13Z",
    "content_scrubbed": "ENGL 1302 requires ENGL 1301 with a grade of C or higher (2025-2026 catalog).",
    "event": {"state": "answered", "intent": "prereq_lookup", "confidence": 0.94,
              "config": {"personality": "friendly-guide", "model": "openrouter/free", "prompt_version": "v1", "experiment": null},
              "retrieval": {"k": 1, "top_score": 0.91,
                            "results": [{"source_url": "https://catalog.dallascollege.edu/preview_course.php?catoid=5&coid=102#2025-2026#facts", "chunk_index": 0, "score": 0.91}]},
              "guardrail": {"classification": "in_scope", "refusal": false, "injection_detected": false},
              "citation_present": true, "feedback": "up", "latency_ms": 1840}}]'),

-- b) empty-context fallback (no LLM call — deterministic guardrail stage)
('22222222-2222-4222-8222-222222222222', NULL,
 NULL,
 '[{"v": 1, "role": "user", "ts": "2026-07-09T16:40:03Z",
    "content_scrubbed": "does the culinary program at <campus_redacted> offer night classes in basket weaving?",
    "event": {"state": "fallback_empty_context", "intent": "course_search", "confidence": 0.41,
              "retrieval": {"k": 0, "top_score": null, "results": []},
              "guardrail": {"classification": "in_scope", "refusal": false, "injection_detected": false},
              "grounding": {"matched": [], "unresolved_phrases": ["basket weaving"]},
              "citation_present": false}}]'),

-- c) handoff to a human
('33333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '{"campus": "RLC", "major": "AS-BIOL", "student_type": "returning"}',
 '[{"v": 1, "role": "user", "ts": "2026-07-10T09:15:47Z",
    "content_scrubbed": "my F-1 status might be at risk if I drop biology, what should I do?",
    "event": {"state": "handoff", "intent": "visa_question", "confidence": 0.88,
              "guardrail": {"classification": "high_risk_visa", "refusal": false, "injection_detected": false},
              "citation_present": false, "handoff_target": "dso"}}]')

ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- Smoke tests — run these to prove the core query patterns work
-- ============================================================================

-- Row counts by doc_type (expect at least one row of every doc_type)
SELECT doc_type, count(*) FROM knowledge_entry GROUP BY doc_type ORDER BY doc_type;

-- Fact point-read: prerequisites for ENGL 1302 in the 2025-2026 catalog
SELECT facts->'prerequisites' AS prerequisites, source_url
FROM knowledge_entry
WHERE course_code = 'ENGL 1302' AND doc_type = 'course' AND catalog_year = '2025-2026';

-- Enumeration: Fall 2026 sections of BIOL 1406 (never via vector search)
SELECT facts->>'section_number' AS section, facts->>'modality' AS modality, professor
FROM knowledge_entry
WHERE doc_type = 'section' AND course_code = 'BIOL 1406' AND year = 2026 AND semester = 'fall';

-- Instructor background for a course this term (join on instructor_slug)
SELECT cv.chunk_text
FROM knowledge_entry cv
WHERE cv.doc_type = 'cv' AND cv.facts IS NOT NULL
  AND cv.instructor_slug IN (
      SELECT s.instructor_slug FROM knowledge_entry s
      WHERE s.doc_type = 'section' AND s.course_code = 'BIOL 1406'
        AND s.year = 2026 AND s.semester = 'fall' AND s.instructor_slug IS NOT NULL);

-- Event listing: upcoming events at a campus (uses the partial event_starts_at index)
SELECT facts->>'title' AS title, facts->>'category' AS category, event_starts_at
FROM knowledge_entry
WHERE doc_type = 'event' AND event_starts_at >= '2026-08-01'
  AND metadata->>'campus' = 'RLC'
ORDER BY event_starts_at;

-- Deterministic support routing: the grants contact for the ETMS school
SELECT facts->>'office' AS office, facts->>'criteria' AS criteria, facts->>'prep_steps' AS prep_steps
FROM knowledge_entry
WHERE doc_type = 'contact' AND facts IS NOT NULL AND (facts->>'active')::boolean
  AND metadata->>'category' = 'grants'
  AND (metadata->>'unit' = 'ETMS' OR metadata->>'unit' = 'General / All')
ORDER BY (metadata->>'unit' = 'General / All');

-- Vector similarity (mock vectors — proves the HNSW index and operator work)
SELECT source_url, chunk_index, embedding <=> mock_embedding(720022) AS cosine_distance
FROM knowledge_entry
ORDER BY embedding <=> mock_embedding(720022)
LIMIT 3;

-- Telemetry analytics: citation rate by intent (assistant turns carry the flag)
SELECT e->'event'->>'intent' AS intent,
       round(avg(CASE WHEN (e->'event'->>'citation_present')::boolean THEN 1 ELSE 0 END), 2) AS citation_rate,
       count(*) AS turns
FROM chat_session, jsonb_array_elements(history) AS e
WHERE e->>'role' = 'assistant'
GROUP BY 1 ORDER BY turns DESC;
