/**
 * Regression guard for course-code normalization (issue #134).
 *
 * Asserts that the TypeScript normalizer agrees with the `course_code`
 * generated-column expression (apps/data/reference/db/schema.sql:96-99) on a
 * fixed spelling table. Pure — no database, no network — so CI can run it on
 * every push. If this fails, tool lookups will miss rows that exist.
 *
 * Run: npx tsx scripts/check-course-code-normalization.mts
 */
// lib/client.ts (imported transitively) throws at module scope without a
// DATABASE_URL. This guard never queries, so a placeholder satisfies it and
// keeps the check runnable in CI with no database.
process.env.DATABASE_URL ??=
  "postgresql://guard:guard@localhost:5432/never-connected";

const { normalizeCourseCode } = await import("../lib/tools/getCourseInfo");

// input -> what the generated column stores for the same value.
const TABLE: [string, string][] = [
  ["MATH 2414", "MATH 2414"],
  ["math 2414", "MATH 2414"],
  ["  MATH  2414  ", "MATH 2414"],
  ["MATH2414", "MATH 2414"],
  ["math2414", "MATH 2414"],
  ["engl-1302", "ENGL 1302"],
  ["ENGL-1302", "ENGL 1302"],
  ["engl_1302", "ENGL 1302"],
  ["ENGL.1302", "ENGL 1302"],
  ["Biol-1406", "BIOL 1406"],
  ["biol1406", "BIOL 1406"],
  // First letter->digit boundary only, matching Postgres's flag-less inner
  // regexp_replace: later boundaries are untouched by that step but the
  // second replace still collapses separators.
  ["ABC1DEF2", "ABC 1DEF2"],
  // Strip-to-empty inputs: the column yields '' for these; the tool throws
  // ToolInputError instead (checked by parseInput, not here).
];

let failures = 0;
for (const [input, expected] of TABLE) {
  const actual = normalizeCourseCode(input);
  if (actual !== expected) {
    failures++;
    console.error(
      `FAIL ${JSON.stringify(input)} -> ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
    );
  }
}

if (failures > 0) {
  console.error(`\n${failures}/${TABLE.length} normalization cases failed.`);
  process.exit(1);
}
console.log(`normalization guard: ${TABLE.length}/${TABLE.length} cases agree with schema.sql`);
