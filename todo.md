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
