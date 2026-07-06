# Support-Contact Directory — Governance, Intake & Fuzzy-Language Resolution

The #45 deliverable ("documented data-handling and maintenance-handoff
approach") plus the working contract for how fuzzy chatbot conversation
resolves to governed data. Companion to `schema_v2.dbml` (Module 4),
`DATA_DICTIONARY.md`, and the Airtable base *Success Coach — Support Contact
Directory*.

## 1. Ownership & handoff (Issue #45)

| Phase | Owner | Surface |
|---|---|---|
| Initial collection & content | **AI Club Data Team** | Airtable Intake Tracker + dean-outreach form |
| Ongoing upkeep (post-launch) | **Dallas College staff** | Airtable (the #44 non-technical interface) |
| Annual review | **AI Club** | "Needs re-verification" view + Intake Tracker gaps |

Postgres is the **serving store** the bot queries; Airtable is the **authoring
store** staff maintain. `pipeline/load_directory.py` syncs one way
(Airtable → Postgres), idempotently, keyed on Airtable record ids
(`external_id` columns). Nothing edits the serving store by hand.

## 2. Data handling

- Directory content is **public information** (team decision 2026-07-07):
  staff emails and office locations are published by the college. The
  `field_visibility` registry stays as the mechanism for any future genuinely
  private field.
- **Confirmation bar** (#45): web research is *provisional*. A row is
  **Confirmed** only when the administering office/dean confirms it AND a
  second reviewer checks the email/URL resolves (Intake Tracker checkbox).
  Unconfirmed rows are *Pending confirmation* or *Not found* — never guessed.
- Every contact carries `Source` (who confirmed) and `Last Verified Date`.
  Contacts unverified for >90 days surface in the **Needs re-verification**
  view, and the bot's answers automatically carry a staleness disclaimer
  (`v_support_routing.is_stale`).
- Seasonality (a grant/contact that recurs annually) is noted per Intake
  Tracker row.

## 3. Authoring rules — ambiguity is unrepresentable, not interpreted

1. **Program scope is explicit.** Every assignment has *Applies to*:
   `Whole school/unit` (default) or `Specific program(s) only` + the program.
   There is no "blank means everything" convention; the database CHECK
   rejects contradictions, and the sync **lints** them
   (`LINT assignment ...` messages are the steward's fix-list).
2. **Vocabularies are tables, and stewards own them.** Categories and topics
   are added deliberately, never inline. Category `Description` and
   `Clarify Label` are student-language content the bot quotes.
3. **One approved meaning per phrase.** Aliases link a student phrase to
   exactly ONE target (unit, campus, category, or topic). A phrase that
   legitimately means several things is not an alias — it is a **help topic**
   that fans out (see §4). The database enforces both rules.
4. **Guidance is versioned content**: `Prep Steps` / `Awareness Message` per
   category, plain language, translation-ready, with Approved By/Date.

## 4. How fuzzy student language resolves (the funnel)

Mirrors the project's extraction pattern (ADR-003): the LLM normalizes at the
boundary, but only **governed rows** ever route.

1. **Normalize** the phrase (lowercase, trim).
2. **Deterministic grounding** against `v_vocab_resolve` — canonical names
   UNION approved aliases, one query, returns `(entity_type, entity_id)`.
   Hits increment `aliases.match_count` (dead-alias detection for free).
3. **LLM grounding, closed-world**: if no exact hit, the LLM picks from the
   *existing* vocabulary lists (they are small) — an id or `none`, never an
   invented category. Optional pgvector aid (Module 3, contact/guidance
   chunks) may propose candidates; the student confirms.
4. **Topic fan-out decides routing**: a resolved topic with ONE
   `topic_categories` row routes silently; with SEVERAL, the bot asks the
   topic's stored `disambiguation_prompt` verbatim, offering each category's
   `clarify_label`. The three-office money ambiguity (grants vs scholarships
   vs financial aid — the #47 core finding) is stored data, not judgment.
5. **Answer from ONE surface**: every routing answer SELECTs
   `v_support_routing` (active contacts only; unit-wide rows always apply,
   program-specific rows add on an integer `degree_plan_id` match — never
   string comparison). The bot cites `citation_ref` + `last_verified_date`,
   adds the staleness disclaimer when `is_stale`, and **relays `criteria`
   verbatim — route, don't determine eligibility.**
6. **Never dead-end**: no unit match → `General / All`; still unresolved →
   human hand-off.

## 5. The growth loop (how the vocabulary improves)

- **Capture (bot, automatic):** phrases that missed, soft-matched, or fired a
  disambiguation prompt land in `unresolved_phrases` as short, PII-scrubbed
  key-phrases with occurrence counts — never full utterances.
- **Triage (steward, weekly, ~10 min):** frequent phrases become *Proposed*
  rows in the Airtable **Aliases** table (approve / reject / escalate).
  Escalation = the phrase reveals a missing topic or category — a deliberate
  vocabulary decision, not an alias.
- **Sync (automatic):** only **Approved** aliases resolve silently; the sync
  refuses duplicates of an already-approved phrase (lint, skip). Aliases are
  *Retired*, never deleted, so past citations stay explainable.
- **Quarterly:** re-verification sprint (stale view) + dead-alias review
  (`match_count`, `last_matched_at`).

## 6. Operational order

```
psql -f db/schema.sql && psql -f db/views.sql
psql -f db/seed_field_visibility.sql && psql -f db/seed_directory.sql
python -m pipeline.load_directory        # sync the Airtable base
psql -f db/seed_aliases.sql              # AFTER the first sync (aliases join
                                         # on unit/topic rows the sync creates;
                                         # idempotent — safe to re-run anytime)
```

Watch the sync's `LINT ...` output: it is the authoring-error report. CI runs
the schema + seeds + acceptance tests (including the vocabulary/routing tests)
on every push.
