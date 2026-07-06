# Executed seed proof — `db/seed_mock.sql`

Board deliverable: *"An executed seed script proving successful database
insertion of core structures."* This is the captured output of running the
committed SQL files, in order, against a **fresh vanilla PostgreSQL database**
(no ORM, no migration framework — plain `psql`, per ADR-004).

Run date: 2026-07-07 · PostgreSQL 18.4 (local vanilla instance) · every file
applied with `-v ON_ERROR_STOP=1`.

```
schema.sql: OK                  (25 tables — modules 1/2/4/5/6)
views.sql: OK                   (8 search/comparison views)
seed_field_visibility.sql: OK   (privacy registry — emails private)
seed_directory.sql: OK          (non-personal directory scaffolding)
seed_mock.sql:
NOTICE:  embeddings: skipped (pgvector not installed — optional module, ADR-005)
COMMIT
     table_name      | rows
---------------------+------
 academic_units      |    5
 assignment_topics   |    5
 assignments         |    5
 catalog_editions    |    2
 contacts            |    5
 course_requisites   |    5
 courses             |    6
 degree_plans        |    3
 extractions         |    7
 field_visibility    |    6
 grading_components  |   16
 help_topics         |    8
 institutions        |    1
 instructors         |    5
 plan_requirements   |    5
 programs            |    2
 raw_documents       |    9
 requirement_courses |    5
 resource_categories |    6
 section_materials   |    5
 section_meetings    |    5
 sections            |   11
 student_guidance    |    3
 syllabi             |    6
 terms               |    5
(25 rows)
```

Notes:

- The `embeddings` NOTICE is expected on hosts without the pgvector extension —
  Module 3 is optional by design (ADR-005). CI runs on a pgvector-enabled
  Postgres 17 image, where the module applies and the seed inserts embedding
  rows too.
- The row-count report is printed by `seed_mock.sql` itself, so **every**
  execution reproduces this proof: apply the five files above to a fresh
  database and the same table appears (see the README runbook, "Create the
  database").
- Continuous proof: `.github/workflows/data-ci.yml` re-executes schema, views,
  seeds, both connection clients, and the acceptance-test suite on every push
  touching `apps/data/`.
