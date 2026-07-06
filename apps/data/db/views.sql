-- ============================================================================
-- Dallas College AI Chatbot — comparison & convenience views (plain SQL)
-- Apply AFTER db/schema.sql. Views are always-fresh; no materialization jobs
-- (ADR-004). Sources: docs/SCHEMA_HANDOVER.md §6, docs/schema_v2.dbml,
-- docs/DATA_DICTIONARY.md "Views", docs/GAP_ANALYSIS.md Q3/Q6/Q8/Q11.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- v_section_search — the hot path (acceptance query A):
-- "find all Fall 2026 HIST-1301 sections" = WHERE on this view.
-- ----------------------------------------------------------------------------
CREATE VIEW v_section_search AS
SELECT
    s.id              AS section_id,
    c.id              AS course_id,
    c.subject_prefix,
    c.course_number,
    c.title           AS course_title,
    c.credit_hours,
    t.id              AS term_id,
    t.code            AS term_code,
    t.name            AS term_name,
    s.section_number,
    i.id              AS instructor_id,
    i.full_name       AS instructor_name,
    s.modality,
    s.campus,
    s.start_date,
    s.end_date,
    -- fast-track detection (GAP Q13-3): HIST §51 computes to 5 weeks
    (s.end_date - s.start_date) AS length_days,
    s.syllabus_url,
    s.coreq_section_ref
FROM sections s
JOIN courses c            ON c.id = s.course_id
JOIN terms t              ON t.id = s.term_id
LEFT JOIN instructors i   ON i.id = s.instructor_id;


-- ----------------------------------------------------------------------------
-- v_course_assessment_profile — the per-course grading baseline:
-- what share of a course's (syllabus-bearing) sections use each canonical type.
-- ----------------------------------------------------------------------------
CREATE VIEW v_course_assessment_profile AS
WITH course_sections AS (          -- denominator: sections that have a syllabus
    SELECT s.course_id, COUNT(DISTINCT s.id) AS sections_total
    FROM sections s
    JOIN syllabi sy ON sy.section_id = s.id
    GROUP BY s.course_id
),
type_sections AS (                 -- numerator: sections using each type
    SELECT s.course_id,
           g.canonical_type,
           COUNT(DISTINCT s.id) AS sections_with_type,
           AVG(g.weight_pct)    AS avg_weight_pct
    FROM sections s
    JOIN syllabi sy            ON sy.section_id = s.id
    JOIN grading_components g  ON g.syllabus_id = sy.id
    GROUP BY s.course_id, g.canonical_type
)
SELECT
    c.id AS course_id,
    c.subject_prefix,
    c.course_number,
    ts.canonical_type,
    ts.sections_with_type,
    cs.sections_total,
    ROUND(ts.sections_with_type::numeric / cs.sections_total, 3) AS share,
    ROUND(ts.avg_weight_pct, 1) AS avg_weight_pct
FROM type_sections ts
JOIN course_sections cs ON cs.course_id = ts.course_id
JOIN courses c          ON c.id = ts.course_id;


-- ----------------------------------------------------------------------------
-- v_syllabus_distinctives — "what's unusual about this section?"
-- Grading components whose canonical type is RARE within its course.
-- Cross-checks the LLM's distinctive_features statistically (acceptance C).
--
-- RARITY THRESHOLD: 0.34 — a type used by fewer than about a third of a
-- course's sections counts as distinctive (SCHEMA_HANDOVER §6 query C).
-- Change the constant below to tune.
-- ----------------------------------------------------------------------------
CREATE VIEW v_syllabus_distinctives AS
SELECT
    p.course_id,
    p.subject_prefix,
    p.course_number,
    s.id              AS section_id,
    s.section_number,
    sy.id             AS syllabus_id,
    g.raw_label,
    g.canonical_type,
    g.weight_pct,
    p.share
FROM v_course_assessment_profile p
JOIN sections s           ON s.course_id = p.course_id
JOIN syllabi sy           ON sy.section_id = s.id
JOIN grading_components g ON g.syllabus_id = sy.id
                         AND g.canonical_type = p.canonical_type
WHERE p.share < 0.34;              -- <-- rarity threshold parameter


-- ----------------------------------------------------------------------------
-- v_section_compare — side-by-side grading mix + policies for sections of one
-- course/term (acceptance query B). One row per (section, canonical_type);
-- consumers filter WHERE course_id = ... AND term_id = ...
-- ----------------------------------------------------------------------------
CREATE VIEW v_section_compare AS
SELECT
    s.course_id,
    s.term_id,
    s.id              AS section_id,
    s.section_number,
    i.full_name       AS instructor_name,
    s.modality,
    s.campus,
    g.canonical_type,
    SUM(g.weight_pct) AS type_pct,
    sy.policies,
    sy.modified_date
FROM sections s
JOIN syllabi sy            ON sy.section_id = s.id
JOIN grading_components g  ON g.syllabus_id = sy.id
LEFT JOIN instructors i    ON i.id = s.instructor_id
GROUP BY s.course_id, s.term_id, s.id, s.section_number, i.full_name,
         s.modality, s.campus, g.canonical_type, sy.policies, sy.modified_date;


-- ----------------------------------------------------------------------------
-- v_course_similarity — "are all sections basically the same?" (GAP Q6)
-- Max per-type weight spread across a course's sections; a section that lacks
-- a type counts as 0% for that type. Low max_weight_spread_pct => the bot says
-- "sections are effectively identical — pick by time and campus."
-- ----------------------------------------------------------------------------
CREATE VIEW v_course_similarity AS
WITH section_type_pct AS (         -- per section: summed pct per canonical type
    SELECT s.course_id, s.id AS section_id, g.canonical_type,
           SUM(g.weight_pct) AS pct
    FROM sections s
    JOIN syllabi sy           ON sy.section_id = s.id
    JOIN grading_components g ON g.syllabus_id = sy.id
    GROUP BY s.course_id, s.id, g.canonical_type
),
course_sections AS (               -- every syllabus-bearing section of the course
    SELECT DISTINCT s.course_id, s.id AS section_id
    FROM sections s JOIN syllabi sy ON sy.section_id = s.id
),
course_types AS (                  -- every type seen anywhere in the course
    SELECT DISTINCT course_id, canonical_type FROM section_type_pct
),
filled AS (                        -- cross join so missing types count as 0
    SELECT cs.course_id, cs.section_id, ct.canonical_type,
           COALESCE(stp.pct, 0) AS pct
    FROM course_sections cs
    JOIN course_types ct   ON ct.course_id = cs.course_id
    LEFT JOIN section_type_pct stp
           ON stp.section_id = cs.section_id
          AND stp.canonical_type = ct.canonical_type
),
spread AS (
    SELECT course_id, canonical_type, MAX(pct) - MIN(pct) AS weight_spread_pct
    FROM filled
    GROUP BY course_id, canonical_type
)
SELECT
    c.id AS course_id,
    c.subject_prefix,
    c.course_number,
    (SELECT COUNT(*) FROM course_sections cs WHERE cs.course_id = c.id) AS sections_compared,
    MAX(sp.weight_spread_pct) AS max_weight_spread_pct
FROM spread sp
JOIN courses c ON c.id = sp.course_id
GROUP BY c.id, c.subject_prefix, c.course_number;


-- ----------------------------------------------------------------------------
-- v_course_offering_history — "is it usually offered in summer?" (GAP Q3)
-- Pattern + disclaimer, NEVER a promise: the bot phrases results as
-- "offered in N of the last M summers; the official schedule confirms next term."
-- ----------------------------------------------------------------------------
CREATE VIEW v_course_offering_history AS
SELECT
    c.id AS course_id,
    c.subject_prefix,
    c.course_number,
    t.season,
    COUNT(DISTINCT t.year)                    AS years_offered,
    ARRAY_AGG(DISTINCT t.year ORDER BY t.year) AS years,
    MAX(t.year)                               AS latest_year,
    COUNT(s.id)                               AS sections_total
FROM sections s
JOIN courses c ON c.id = s.course_id
JOIN terms t   ON t.id = s.term_id
GROUP BY c.id, c.subject_prefix, c.course_number, t.season;


-- ----------------------------------------------------------------------------
-- v_instructor_history — "is this professor new? what else do they teach?"
-- (GAP Q8). Identity comes from schedule rows (never syllabus extraction).
-- ----------------------------------------------------------------------------
CREATE VIEW v_instructor_history AS
WITH term_ordered AS (
    SELECT s.instructor_id,
           t.code,
           t.year,
           CASE t.season                      -- calendar order within a year
               WHEN 'spring' THEN 1
               WHEN 'summer' THEN 2
               WHEN 'fall'   THEN 3
               WHEN 'winter' THEN 4
               ELSE 5
           END AS season_ord
    FROM sections s
    JOIN terms t ON t.id = s.term_id
    WHERE s.instructor_id IS NOT NULL
)
SELECT
    i.id AS instructor_id,
    i.full_name,
    i.department,
    (ARRAY_AGG(o.code ORDER BY o.year, o.season_ord))[1] AS first_term_seen,
    COUNT(DISTINCT s.course_id) AS courses_taught,
    ARRAY_AGG(DISTINCT c.subject_prefix || '-' || c.course_number) AS course_codes,
    COUNT(DISTINCT s.id)        AS sections_total,
    COUNT(DISTINCT s.term_id)   AS terms_active
FROM instructors i
JOIN sections s      ON s.instructor_id = i.id
JOIN courses c       ON c.id = s.course_id
JOIN term_ordered o  ON o.instructor_id = i.id
GROUP BY i.id, i.full_name, i.department;


-- ----------------------------------------------------------------------------
-- v_section_conflicts — "do these sections overlap?" (GAP Q11 step 3 /
-- acceptance query F). Pairwise time conflicts between DIFFERENT sections in
-- the SAME term: they share at least one meeting day and their time ranges
-- overlap. A section's own lecture+lab never self-pairs (a.section_id <
-- b.section_id), so PHYS lecture 5:00–7:00 PM + lab 7:10–9:10 PM is no
-- conflict. Consumers filter to the sections a student named.
-- ----------------------------------------------------------------------------
CREATE VIEW v_section_conflicts AS
SELECT
    sa.term_id,
    ma.section_id     AS section_a,
    mb.section_id     AS section_b,
    ma.meeting_type   AS meeting_type_a,
    mb.meeting_type   AS meeting_type_b,
    ma.days           AS days_a,
    mb.days           AS days_b,
    ma.start_time     AS start_a,
    ma.end_time       AS end_a,
    mb.start_time     AS start_b,
    mb.end_time       AS end_b
FROM section_meetings ma
JOIN section_meetings mb
      ON ma.section_id < mb.section_id            -- distinct pairs, no self-pairs
JOIN sections sa ON sa.id = ma.section_id
JOIN sections sb ON sb.id = mb.section_id
     AND sb.term_id = sa.term_id                  -- same term only
WHERE ma.days IS NOT NULL AND mb.days IS NOT NULL
  AND ma.start_time IS NOT NULL AND ma.end_time IS NOT NULL
  AND mb.start_time IS NOT NULL AND mb.end_time IS NOT NULL
  -- share at least one weekday (days are MTWRFSU character sets)
  AND string_to_array(ma.days, NULL) && string_to_array(mb.days, NULL)
  -- and the time-of-day ranges overlap
  AND (ma.start_time, ma.end_time) OVERLAPS (mb.start_time, mb.end_time);
