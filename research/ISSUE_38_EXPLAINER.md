# Issue #38 Explainer: Vercel AI SDK Tools (Function Calling)

> **Author**: Neftali (netflix2023)  
> **Date**: 2026-07-16  
> **Status**: In Progress — Backend Tool Implementation  
> **Sprint**: Sprint 3  
> **Blocked by**: Issue #37 (LLM Chat Integration Playground — frontend PR merge)

---

## 1. The Non-Technical Feynman Explanation: The Corporate Office Analogy

To understand how tool/function calling works under the hood, let’s imagine a corporate office setting:

### 1.1 The Executive (The AI Model)
Imagine your AI chatbot is a highly capable **Executive** sitting at the main desk. By default, the executive only knows general facts from memory and does not have a watch or a live database catalog.

### 1.2 The Standard Form Creator (Zod)
Before the support staff can do any work, the office needs a standardized filing cabinet and a strict form-printing machine. Zod is this form printer. 
- **Feynman Explanation**: Zod prints strict, un-bendable intake forms. If the Executive wants a piece of information, they cannot just yell a random question down the hall. They must fill out the exact form the machine requires. If the form demands a formatted code like `MATH-1314` (five uppercase letters, a hyphen, and four numbers), they cannot write "math class" or the system instantly throws it in the trash. This keeps the input data completely clean.

### 1.3 The Support Staff (The Tools Registry / `tools.ts`)
We build a dedicated desk called the Support Staff. These are specialized clerks hired to sit right next to the Executive to handle queries:
- **Clerk 1: `get_date` (The Timekeeper)**: The Executive gets asked by a visitor, "What day is it?" The Executive doesn't have a watch, so they fill out a tiny slip asking for the timezone. The Timekeeper Clerk looks at the office wall clock, formats it nicely, and hands back a clean folder: `{ dateTime: "Thursday, July 16, 2026", timezone: "America/Chicago" }`.
- **Clerk 2: `get_course_information` (The Catalog Archivist)**: The Executive gets asked, "What do I need for ENGL 1302?" They write `ENGL-1302` on the form. The Archivist Clerk takes the form, sweeps away any sloppy handwriting (like converting "engl 1302" into clean uppercase `ENGL-1302`), looks inside a single desk drawer containing hardcoded catalog files, and pulls out the requirements. If the Executive asks for a course that doesn't exist, the Archivist immediately shoots back a note: "I don't have that file, but here are the 4 files I do have available."

### 1.4 The Inter-Office Notebook (`convertToModelMessages` in `route.ts`)
Previously, the office log only recorded what the user said and what the Executive said. But when you start calling clerks, the conversation history gets complex:
$$\text{User Prompt} \rightarrow \text{Executive Decision} \rightarrow \text{Clerk Form} \rightarrow \text{Clerk Result} \rightarrow \text{Executive Final Answer}$$
The Inter-Office Notebook is a helper function that logs every single step of this back-and-forth chain perfectly so the Executive never loses track of the project mid-stream.

### 1.5 The Action Allowance (`maxSteps: 5` in `route.ts`)
By default, the Executive is only allowed to give a single immediate answer and cannot get up from the desk. By setting `maxSteps: 5`, you are telling the Executive: 
- **Feynman Explanation**: "You have permission to get up from your desk, walk over to a clerk, ask for data, read the folder they hand you, and repeat this process up to 5 times before you give your final report to the visitor." This allows the Executive to loop internally to get all necessary details.

---

## 2. The Structural Blueprint

To build this proof of concept, we divide the backend code changes into three main phases:

1. **Setup Phase (Dependencies)**: Install `zod` into the `apps/frontend/` directory. The Vercel AI SDK's `tool()` helper completely relies on Zod parsing under the hood to compile data validation schemas into standard JSON objects for the LLM pipeline.
2. **The Registry (`lib/tools.ts`)**: A dedicated catalog where our mock tools are defined, given instructions, typed with Zod, and given dummy data to return.
3. **The Route Handler (`app/api/chat/route.ts`)**: The traffic controller that accepts the user's message, exposes the catalog to the AI, and manages the multi-step stream.

---

## 3. Technical Explanation: The Registry (`lib/tools.ts`)

Instead of cluttering our main API route file, we group all tools into a single exported registry object. Each tool follows a precise three-part structural anatomy required by the Vercel AI SDK:

- **`description`**: A plain English message telling the AI when it is appropriate to use this tool.
- **`inputSchema`**: A Zod schema object dictating the variables the AI must extract from the user's prompt before running it.
- **`execute`**: An asynchronous function that intercepts those variables, simulates any necessary data normalization, and returns hardcoded JSON.

### Zod Normalization and Defense
In `get_course_information`, we use:
```typescript
const normalized = courseCode.trim().toUpperCase().replace(/\s+/g, '-');
```
This is a defensive coding choice. It prevents the engine from breaking if a student types "engl 1302" or "Engl-1302" instead of "ENGL-1302", standardizing the lookup key before matching against our mock database.

---

## 4. Technical Explanation: Route Handler Integration (`route.ts`)

Once our tools are exported, updating our chat endpoint involves feeding this package directly into the text generation function and configuring how many conversational "steps" the server is allowed to execute.

### 4.1 Expose Tools
We supply the `tools: successCoachTools` object alongside the model configuration. The Vercel AI SDK extracts the JSON Schema of each tool and appends it to the API call payload sent to OpenRouter.

### 4.2 Set Step Multipliers (`maxSteps: 5`)
Because tools introduce a multi-phase interaction, we provide the configuration `maxSteps: 5` (replacing older configuration variables like `isStepCount` checks inside `stopWhen`). This ensures the AI has permission to loop back internally, process the hardcoded JSON data, and output its final answer in a single continuous stream to the user.

### 4.3 Message Payload Conversion (`convertToModelMessages`)
Transitioning to this helper function ensures that complex tool-use metadata roles (like tool calls and tool outputs) are correctly cataloged and fed to OpenRouter on multi-step loops rather than crashing due to missing payload components.

### 4.4 Model Optimization (`qwen/qwen3-235b-a22b:free`)
The selection of `qwen/qwen3-235b-a22b:free` is perfect. Its Mixture-of-Experts framework natively handles structured input schemas, thinking steps, and tool validation logic without hallucinating parameters during complex runs.

---

## 5. Summary of Registry and Route Configurations

### 5.1 Tool Definition Example
```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const get_course_information = tool({
  description: 'Get details about a Dallas College course.',
  inputSchema: z.object({
    courseCode: z.string().describe('Course code prefix and number, e.g. ENGL-1302'),
  }),
  execute: async ({ courseCode }) => {
    // Normalization & mock database lookup
    return { description: 'English Composition II', credits: 3 };
  }
});
```

### 5.2 streamText Configuration Example
```typescript
const result = streamText({
  model: openrouter.chat('qwen/qwen3-235b-a22b:free'),
  messages: convertToModelMessages(messages),
  system: baseSystemPrompt,
  tools: successCoachTools,
  maxSteps: 5,
});
```
