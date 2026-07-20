#!/usr/bin/env node
// Regenerate programs.ts (the onboarding Q2 program picker) from the canonical
// catalog program index + a display-overrides file. Run on each catalog refresh
// so the picker stays in sync without hand-editing.
//
// Contract (agreed data/#36 <-> onboarding/#52):
//   program_index.json (all catalog programs, from the scrape/index build)
//     -> drop `exclude` poids  (structural cores: not programs a student picks;
//        `exclude_notes` documents each one in the generated header)
//     -> apply `display_overrides` (poid -> trimmed label; else official catalog name)
//     -> sort by display label with localeCompare (matches the hand-finalized file)
//     -> emit PROGRAMS[]
//
// Usage:
//   node generate-programs.mjs <path/to/program_index.json> \
//        [program-overrides.json] [programs.ts]
//   (overrides + output default to this directory)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const indexPath = process.argv[2] ?? process.env.PROGRAM_INDEX;
const overridesPath = process.argv[3] ?? resolve(here, "program-overrides.json");
const outPath = process.argv[4] ?? resolve(here, "programs.ts");

if (!indexPath) {
  console.error(
    "usage: node generate-programs.mjs <program_index.json> [overrides.json] [out.ts]\n" +
    "  program_index.json lives in the raw catalog folder (out-of-repo), so its path " +
    "must be given explicitly.",
  );
  process.exit(1);
}

const index = JSON.parse(readFileSync(indexPath, "utf8"));
const overrides = JSON.parse(readFileSync(overridesPath, "utf8"));
const exclude = new Set(overrides.exclude ?? []);
const excludeNotes = overrides.exclude_notes ?? {};
const display = overrides.display_overrides ?? {};

const programs = index.programs
  .filter((p) => !exclude.has(p.poid))
  .map((p) => ({ code: p.poid, label: display[p.poid] ?? p.name }))
  .sort((a, b) => a.label.localeCompare(b.label));

// Render each excluded poid into the header with its human-readable name + rationale
// (from program-overrides.json `exclude_notes`), falling back to a bare poid line.
const excludedLines = [...exclude]
  .map((poid) => {
    const n = excludeNotes[poid];
    return n ? `//   - ${n.name} (poid ${poid}) — ${n.note}` : `//   - poid ${poid}`;
  })
  .join("\n");

const header =
  `// Dallas College programs of study for the onboarding program picker (Q2).\n` +
  `//\n` +
  `// GENERATED — do not hand-edit. The data pipeline (#36) regenerates this from the\n` +
  `// canonical catalog program index + program-overrides.json (exclude list, per-exclude\n` +
  `// notes, and trimmed picker labels) on each catalog refresh:\n` +
  `//   node generate-programs.mjs <program_index.json>\n` +
  `//\n` +
  `// \`code\` is the catalog program id (poid) — a stable, real identifier that maps one-to-one\n` +
  `// to a catalog program. \`label\` is the DISPLAY name shown in the picker; for long transfer/\n` +
  `// academic degrees it is a trimmed, student-friendly form, NOT the verbatim catalog title\n` +
  `// (the official name lives in the canonical program index, program_index.json).\n` +
  `//\n` +
  `// Intentionally EXCLUDED — requirements-for-all, not a student's choice (surfaced by the\n` +
  `// degree plan / RAG, never picked):\n` +
  `${excludedLines}\n` +
  `// These still MUST be ingested into program_map for the RAG (they supply the "choose one\n` +
  `// from Area X" slots every degree references) so graduation requirements come out complete\n` +
  `// — see docs/DATA_PIPELINE.md (degree-plan nuances) and issue #61.\n` +
  `//\n` +
  `// Sorted by label.\n` +
  `\n` +
  `export interface Program {\n  code: string;\n  label: string;\n}\n`;

const body = programs
  .map((p) => `  { code: ${JSON.stringify(p.code)}, label: ${JSON.stringify(p.label)} },`)
  .join("\n");

writeFileSync(outPath, `${header}\nexport const PROGRAMS: Program[] = [\n${body}\n];\n`);
console.error(
  `wrote ${programs.length} programs to ${outPath} ` +
  `(dropped ${exclude.size} excluded, ${Object.keys(display).length} label overrides applied)`,
);
