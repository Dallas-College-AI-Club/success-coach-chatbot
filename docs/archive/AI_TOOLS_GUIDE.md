# AI Tools Guide

## Purpose

This document explains how tool calling is implemented in the Success Coach Chatbot, how tools are registered, how they are executed by the AI SDK, how frontend tool events are streamed, and how developers can add and validate new tools.

---

# Architecture Overview

Tool execution is implemented using the Vercel AI SDK.

High-level flow:

```text
User
  ↓
/dev/chat-test
  ↓
Custom fetch request
  ↓
app/api/chat/route.ts
  ↓
generateText / streamText
  ↓
toolRegistry
  ↓
Tool Execution
  ↓
AI SDK Stream Events
  ↓
Frontend Event Parser
  ↓
UI Rendering
```

---

# Important Architectural Discovery

## /dev/chat-test Does Not Use useChat()

During Issue #38 investigation it was discovered that:

- `/dev/chat-test` does not use `useChat()`
- `/dev/chat-test` uses a custom fetch implementation
- `/dev/chat-test` manually parses streamed events

As a result:

```bash
git grep "toolInvocations"
```

returns no results.

Tool visualization is implemented through custom event handling rather than AI SDK `toolInvocations`.

---

# Tool Registration

## Tool Registry

File:

```text
apps/frontend/lib/tools/registry.ts
```

Example:

```ts
export const toolsList = [
  createGetCurrentDateTool(),
  createGetSemesterTool(),
];
```

The registry is converted into:

```ts
toolRegistry
```

which is supplied to the AI SDK.

---

# Creating a Tool

A tool consists of:

1. Name
2. Description
3. Zod input schema
4. Execute method

Example:

```ts
createTool({
  name: "get_semester",
  description: "...",
  parameters: z.object({
    ...
  }),
  execute(input) {
    ...
  }
});
```

---

# Zod Validation

Each tool defines its input contract using Zod.

Benefits:

- Runtime validation
- Strong typing
- AI SDK schema generation
- Safer execution

Example:

```ts
z.object({
  timeZone: z.string().optional(),
})
```

---

# API Route Integration

File:

```text
app/api/chat/route.ts
```

Critical configuration:

```ts
tools: toolRegistry
```

Enables tool execution.

```ts
stopWhen: stepCountIs(5)
```

Allows multi-step reasoning and tool calls.

```ts
return result.toUIMessageStreamResponse();
```

Streams tool events to the frontend.

---

# Stream Event Lifecycle

Observed events:

```text
start
start-step
tool-input-start
tool-input-delta
tool-input-available
tool-output-available
text-start
text-delta
error
finish-step
finish
```

---

# Frontend Tool State Rendering

Inside `/dev/chat-test` (`apps/frontend/app/dev/chat-test/page.tsx`), streamed SSE events update visual UI status badges in real time:

- ⚙ **Executing Tool**: Renders an animated status badge (`tool-input-start`) when tool execution begins.
- ✅ **Tool Complete**: Renders an interactive tool badge with an expandable JSON payload inspection toggle when `tool-output-available` is received.

Example display:

```text
⚙ Executing getSemester...
[ Toggle Input / Output JSON ]
```

---

# Model Validation Matrix

Below is the verified compatibility matrix for OpenRouter models tested for Vercel AI SDK multi-step tool calling (`maxSteps: 5`):

| Model ID | Provider | Tool Calling Support | Multi-Step Reasoning | Notes / Recommendation |
| :--- | :--- | :---: | :---: | :--- |
| `openai/gpt-oss-20b:free` | OpenRouter | ✅ Verified | ✅ Pass | **Default Active Model**. Reliable tool schema parsing & multi-step loops. |
| `qwen/qwen3-235b-a22b:free` | Qwen / Alibaba | ✅ Verified | ✅ Pass | Fast response time, high accuracy on structured parameter extraction. |
| `meta-llama/llama-3.3-70b-instruct` | Meta AI | ✅ Verified | ✅ Pass | Excellent fallback model for complex reasoning and tool execution logic. |
| `liquid/lfm-40b` | Liquid AI | ⚠️ Partial | ❌ Fallback | Requires explicit system prompt steering for structured tool calls. |

---

# Testing New Tools

## Backend Validation

1. Register tool in tool registry (`apps/frontend/lib/tools/registry.ts`).
2. Start application (`npm run dev`).
3. Submit prompt requiring tool use in `/dev/chat-test`.
4. Confirm tool executes.
5. Confirm output payload is returned.

## Frontend Validation

Add:

```ts
console.log(parsed);
```

Verify:

```text
tool-input-start
tool-output-available
```

appear in the browser console, and check that visual status badges render in `/dev/chat-test`.

---

# Troubleshooting

## Tool Never Executes

Verify:

```ts
tools: toolRegistry
```

exists in the route handler.

Verify tool is registered in `registry.ts`.

Verify model supports tool calling.

---

## Tool Events Not Displayed

If tool events are present in the AI SDK stream but missing in UI:

1. Add temporary logging to the stream parser:

```ts
console.log(parsed);
```

2. Confirm `tool-input-start` and `tool-output-available` events stream in browser console.
3. Ensure the custom SSE parser in `app/dev/chat-test/page.tsx` maps tool names to visual badges.

---

# Issue #38 Findings Summary

Confirmed:

✅ Backend tool execution works reliably across multi-step loops (`maxSteps: 5`)

✅ Frontend stream events are captured and displayed with visual status badges and payload toggles

✅ `get_current_date` and `getSemester` tools successfully execute

✅ Additional tools can be added cleanly via `apps/frontend/lib/tools/`

✅ OpenRouter free model validation matrix completed and documented

Not present:

❌ Default `useChat` `toolInvocations`

Instead:

✅ Custom fetch

✅ Custom SSE parsing

✅ Custom rendering pipeline