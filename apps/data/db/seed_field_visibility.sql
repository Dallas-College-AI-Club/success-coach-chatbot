-- ============================================================================
-- MODULE 5 seed — field_visibility registry (docs/schema_v2.dbml Module 5).
-- Idempotent: safe to re-run.
--
-- TEAM DECISION 2026-07-07: the support-contact directory holds PUBLIC
-- information — staff emails and office locations are published by the
-- college, and instructor emails appear on public HB 2504 syllabi. All
-- current fields are therefore is_public=true. The registry itself is KEPT:
-- it is the mechanism for any future genuinely-private field (mark it false
-- here, and the bot/API must not expose it) — privacy expansion hangs off
-- this table instead of a schema redesign.
-- ============================================================================

INSERT INTO field_visibility (table_name, column_name, is_public, notes) VALUES
    ('contacts',    'email', true,
     'Public staff directory info (team decision 2026-07-07); freshness governed by last_verified_date, not visibility'),
    ('instructors', 'email', true,
     'Published on public HB 2504 syllabi (team decision 2026-07-07)'),
    ('instructors', 'cv_url', true,
     'TX HB 2504 requires faculty vitas be posted publicly — public by law'),
    ('instructors', 'full_name', true,
     'From the public class schedule'),
    ('contacts',    'name', true,
     'Public staff directory info'),
    ('sections',    'syllabus_url', true,
     'HB 2504 public syllabus repository')
ON CONFLICT (table_name, column_name) DO UPDATE
    SET is_public = EXCLUDED.is_public,
        notes     = EXCLUDED.notes;
