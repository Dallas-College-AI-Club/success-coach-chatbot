# Issue #38: Vercel AI SDK Tools (Function Calling POC) Checklist

> **Branch**: `feature/38-tool-calling-poc`  
> **Methodology**: Agile (`subtask` -> `task` -> `section` -> `folder` -> `branch`)

---

## Section 1: Backend Tool Registry & Schemas (Completed [x])
- [x] **Task 1.1**: Define Zod schemas and create `apps/frontend/lib/tools.ts` (`get_date`, `get_course_information`).
- [x] **Task 1.2**: Write technical explainer document (`research/ISSUE_38_EXPLAINER.md`).

## Section 2: Route Handler & Stream Engine (Completed [x])
- [x] **Task 2.1**: Update `apps/frontend/app/api/chat/route.ts` with `streamText`, `tools`, `maxSteps: 5`, and `convertToModelMessages`.
- [x] **Task 2.2**: Configure OpenRouter provider model (`qwen/qwen3-235b-a22b:free`).

---

## Section 3: Frontend State Handling (Completed [x])

### Task 3.1: Client-Side Tool Invocation Parsing (`useChat` & Stream Protocol)
- [x] **Subtask 3.1.1**: Investigate how SSE stream chunks (`tool-call`, `tool-result`) are parsed from `/api/chat` into state.
- [x] **Subtask 3.1.2**: Ensure state cleanly maps `toolCallId`, `toolName`, `args`, and `result` without state drops during multi-turn streams.
- [x] **Subtask 3.1.3**: Explain tool state lifecycle to Neftali for verification.

### Task 3.2: Visual Tool Execution UI Badges (`/dev/chat-test`)
- [x] **Subtask 3.2.1**: Verify and refine the `ToolInvocationBadge` UI component in `apps/frontend/app/dev/chat-test/page.tsx`.
- [x] **Subtask 3.2.2**: Ensure live "thinking / executing" status (e.g. `⚙️ Searching course catalog for ENGL-1302...`) displays smoothly before text streams.
- [x] **Subtask 3.2.3**: Verify expandable raw JSON payload (`Show Payload` / `Hide Payload`) toggles work correctly.

### Task 3.3: Multi-Step Tool Call Execution & Natural Language Response
- [x] **Subtask 3.3.1**: Verify handling of sequential/multi-step tool calls (model calls tool $\rightarrow$ receives result $\rightarrow$ synthesizes final answer).
- [x] **Subtask 3.3.2**: Test multi-step queries (e.g., asking for both time and course prerequisites in a single prompt).

---

## Section 4: Final Deliverables & Review Gating (Completed [x])
- [x] **Deliverable 1**: Standardized Team Tool Guide (`docs/AI_TOOLS_GUIDE.md`).
- [x] **Deliverable 2**: Test 1-2 open-weight models via OpenRouter (`qwen/qwen3-235b-a22b:free` & `meta-llama/llama-3.3-70b-instruct:free`) for schema compliance without hallucination.
- [x] **Deliverable 3**: Frontend state stream & badge UI integration in `/dev/chat-test`.
- [x] **Deliverable 4**: Execute sub-agent review, stage, commit, and submit upstream Pull Request via `curl`.

---

## Section 5: Issue #90 Data Preprocessing & Dual Output (Completed [x])
- [x] **Task 5.1 (Planning & Documentation)**: Create implementation plans (`docs/ISSUE_90_PLAN.md`) and technical explainer (`research/ISSUE_90_EXPLAINER.md`).
- [x] **Task 5.2 (GitHub Issue Sync)**: Update GitHub Issue #90 description via API with reordered scope & deliverables.
- [x] **Task 5.3 (Section 1 Engine - Standalone HTML DOM Cleaner `html_cleaner.py`)**:
  - [x] **Subtask 5.3.1**: Build standalone `html_cleaner.py` module stripping non-content tags (`<script>`, `<style>`, navbars).
  - [x] **Subtask 5.3.2**: Implement footer policy truncation at `Dallas College Policies` or `Support Contacts`.
  - [x] **Subtask 5.3.3**: Output Clean HTML (`clean_syllabus.html`) containing core course DOM.
- [x] **Task 5.4 (Section 2 Engine - Clean HTML to Clean Markdown Converter `markdown_converter.py`)**:
  - [x] **Subtask 5.4.1**: Implement Rule 1 (`<br>` line break unrolling inside `<td>`/`<th>` table cells).
  - [x] **Subtask 5.4.2**: Implement Rule 2 (strict GFM pipe table preservation `| Col 1 | Col 2 |`).
  - [x] **Subtask 5.4.3**: Implement Rule 3 (`utf-8` encoding enforcement for emojis 📝, ⏰, 📚 across all file operations).
  - [x] **Subtask 5.4.4**: Output Clean Markdown (`clean_syllabus.md`).
- [x] **Task 5.5 (Section 3 Engine - Automated Validation & Diff Checks against Raw HTML)**:
  - [x] **Subtask 5.5.1**: Create automated diff check test script `apps/data/tests/test_preprocessing_diff.py` (Header counts, table row counts, non-null metadata assertions).
- [x] **Task 5.6 (Section 4 Engine - Human Baseline Spot-Check & Corpus Delivery)**:
  - [x] **Subtask 5.6.1**: Perform 5-file baseline spot check audit (`84063.html`, `98305.html`, `98301.html`, `98296.html`, `98326.html`).
  - [x] **Subtask 5.6.2**: Batch process `2026SP` corpus emitting `{id}_clean.html` and `{id}.md` in `apps/data/cleaned/2026SP/`.

---

## Section 6: Issue #61 LLM Facts Extraction & Accuracy Validation (Blocked by Issue #90 [ ])
- [x] **Task 6.1 (Architecture & Handoff)**: Document dual-engine PostgreSQL `knowledge_entry` schema (`content`, `embedding`, `facts`) and write `research/ISSUE_61_EXPLAINER.md` & `docs/ISSUE_61_PLAN.md`.
- [ ] **Task 6.2 ($0 Rule-Based Harvester)**: Build `rule_based_facts.json` generator using Python/Regex/BeautifulSoup on clean input.
- [ ] **Task 6.3 ($0 Early-Exit Gate)**: Run `Draft7Validator` on `rule_based_facts.json`. If 100% valid, skip LLM calls!
- [ ] **Task 6.4 (LLM Fallback Extraction)**: Run `extract.py` over clean Markdown to fill missing complex fields only when Early-Exit gate fails, then merge payloads.
- [ ] **Task 6.5 (Data Accuracy & Ground-Truth Reconciliation)**: Build `apps/data/tests/test_facts_reconciliation.py` (Exact substring ground-truth verification, grading math reconciliation, identity cross-check).
- [ ] **Task 6.6 (PostgreSQL Insert & Quarantine)**: Insert 100% verified JSON into PostgreSQL or move failed records to `.tmp/quarantine/` (`needs_review`).

