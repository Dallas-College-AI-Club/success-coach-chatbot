-- ============================================================================
-- MODULE 5 seed — field_visibility registry (docs/schema_v2.dbml Module 5;
-- Issue #47 privacy note). Idempotent: safe to re-run.
--
-- Policy: everything is PUBLIC except the rows below marked is_public=false.
-- The table's default is is_public=true; this seed records the private
-- exceptions plus a few explicit public rows whose status is worth
-- documenting. The future privacy expansion hangs off this registry.
-- ============================================================================

INSERT INTO field_visibility (table_name, column_name, is_public, notes) VALUES
    -- PRIVATE: personal contact details never exposed via the public repo/bot
    ('contacts',    'email', false,
     'Issue #47: confirmed grant/support POC emails are access-controlled (#45); never public until verified publishable'),
    ('instructors', 'email', false,
     'Private until verified public; the bot routes via department/school contacts instead'),

    -- Explicitly documented PUBLIC rows
    ('instructors', 'cv_url', true,
     'TX HB 2504 requires faculty vitas be posted publicly — public by law'),
    ('instructors', 'full_name', true,
     'From the public class schedule'),
    ('contacts',    'name', true,
     'Role/name is public; email is the private part'),
    ('sections',    'syllabus_url', true,
     'HB 2504 public syllabus repository')
ON CONFLICT (table_name, column_name) DO UPDATE
    SET is_public = EXCLUDED.is_public,
        notes     = EXCLUDED.notes;
