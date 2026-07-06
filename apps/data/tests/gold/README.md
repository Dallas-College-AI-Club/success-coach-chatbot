# Gold extractions (placeholder)

This directory will hold **20–40 hand-checked extraction JSONs** — the gold
set used to judge whether a new model/prompt/schema version beats the current
one before `is_current` flips (CLAUDE_CODE_BRIEF §2; SCHEMA_HANDOVER §3).

Producing gold data is document-judgment work, deliberately done in chat with
the source syllabi at hand — not by Claude Code (CLAUDE_CODE_BRIEF §1
"Also better done in chat later").

Format per file: `<term>-<prefix>-<number>-<section>.json` containing a
schema-valid extraction object, reviewed line-by-line against the source
document. Keep the reviewed `schema_version` inside each file.
