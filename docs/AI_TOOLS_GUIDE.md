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

During the Issue #38 investigation, tool visualization was explored using custom event handling rather than AI SDK toolInvocations.

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

Illustrative example:

```ts
defineTool({
  name: "get_current_date",
  description: "Returns the current date.",

  inputSchema: jsonSchema({
    type: "object",
    properties: {},
    additionalProperties: false,
  }),

  parseInput(input) {
    return input;
  },

  async execute(input) {
    // implementation
  },
});
```

---

# Input Validation

Current tools use:

- inputSchema definitions
- parseInput(...) for validation and normalization
- JSON-schema based tool contracts

The AI SDK supports both Zod schemas and JSON Schema through FlexibleSchema.

In the current codebase, tools use JSON Schema to describe the tool contract presented to the model. Runtime validation and normalization are performed by `parseInput(...)` before `execute(...)` runs.

Future tools may use Zod schemas where appropriate. When Zod schemas are used, the AI SDK can perform schema validation directly from the Zod definition.


Developers should follow the patterns used in:

```text
apps/frontend/lib/tools/
```

when implementing new tools.

---

# API Route Integration

File:

```text
apps/frontend/app/api/chat/route.ts
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

The following example reflects a prototype implementation explored during the investigation and may not exist in the current main branch.

Example mappings:

```ts
get_current_date
→ Checking current date
```

Example display:

```text
⚙ Checking current date...
```

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

Tool events may be present in the AI SDK stream even when they are not rendered by the current frontend implementation.

To verify tool execution:

1. Add temporary logging to the stream parser:

```ts
console.log(parsed);
```

2. Confirm events such as:

```text
tool-input-start
tool-output-available
```

appear in the browser console.

3. If visual tool status indicators are desired, extend the frontend event parser to handle tool-specific events and maintain tool-related UI state.

---

# Model Validation Matrix

Model compatibility testing remains an open deliverable under Issue #38.

See GitHub Issue #38:

Investigate & Prototype Vercel AI SDK Tools (Function Calling)

for the latest model compatibility findings and validation results.

---

# Issue #38 Findings

Confirmed:

✅ Backend tool execution works

✅ Frontend stream events can be inspected

✅ get_current_date successfully executes

✅ Additional tools can be added using the existing architecture

⚠ Additional tool implementations may exist on feature branches that have not yet been merged into main.

Not present:

❌ useChat toolInvocations

Instead:

✅ Custom fetch

✅ Custom SSE parsing

✅ Custom rendering pipeline