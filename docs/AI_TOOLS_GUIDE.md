# AI Tools Guide

## Purpose

This document explains how tool calling is implemented in the Success Coach Chatbot, how tools are registered, how they are executed by the AI SDK, how frontend tool events are streamed, and how developers can add and validate new tools.

---

# Architecture Overview

Tool execution is implemented using the Vercel AI SDK.

High-level flow:

User
  ↓
/dev/chat-test
  ↓
Custom fetch request
  ↓
apps/frontend/app/api/chat/route.ts
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

---

# Important Architectural Discovery

## /dev/chat-test Does Not Use useChat()

During Issue #38 investigation it was discovered that:

- `/dev/chat-test` does not use `useChat()`
- `/dev/chat-test` uses a custom fetch implementation
- `/dev/chat-test` manually parses streamed events

As a result:

```bash
git grep "toolInvocations" -- apps/frontend
```

returns no results in the current codebase.

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
3. Input schema (`inputSchema`)
4. Input validation and normalization (`parseInput`)
5. Execute method (`execute`)

Example:

```ts
defineTool({
  inputSchema,
  parseInput,
  execute,
});
```

---

# Input Validation

Current tools use:

- `inputSchema` definitions
- `parseInput(...)` for validation and normalization
- JSON-schema based tool contracts

Developers should follow the patterns used in:

```text
apps/frontend/lib/tools/
```

when implementing new tools.

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
finish-step
finish
```

---

# Frontend Tool State Rendering

Issue #38 investigated frontend tool execution visualization.

Note: Visual tool execution indicators were implemented on a feature branch as part of the investigation effort and may not yet exist in the current main branch at the time this document is read.

Example mappings:

```ts
get_semester
→ Looking up semester information

get_current_date
→ Checking current date
```

Displayed as:

⚙ Looking up semester information...

before the final assistant response is shown.

---

# Testing New Tools

## Backend Validation

1. Register tool in tool registry.
2. Start application.
3. Submit prompt requiring tool use.
4. Confirm tool executes.
5. Confirm output is returned.

## Frontend Validation

Add:

```ts
console.log(parsed)
```

Verify:

```text
tool-input-start
tool-output-available
```

appear in browser console.

---

# Troubleshooting

## Tool Never Executes

Verify:

```ts
tools: toolRegistry
```

exists in route handler.

Verify tool is registered.

Verify model supports tool calling.

---

## Tool Events Not Displayed

Verify event parser handles:

```text
tool-input-start
tool-output-available
```

Verify active tool UI state updates correctly.

---

# Model Validation Matrix

See separate model compatibility section in Issue #38 deliverables.

---

# Issue #38 Findings

Confirmed:

✅ Backend tool execution works

✅ Backend tool execution works

✅ Frontend stream events can be inspected

✅ get_current_date successfully executes

✅ Additional tools can be added using the existing architecture

⚠ Additional tool implementations may exist on feature branches that have not yet been merged into main.

✅ Additional tools can be added using existing architecture

Not present:

❌ useChat toolInvocations

Instead:

✅ Custom fetch

✅ Custom SSE parsing

✅ Custom rendering pipeline