# Success Coach Chatbot: Vercel AI SDK Tool Calling Architecture (`LEARNING.md`)

> **Author**: Neftali & Antigravity Agent  
> **Topic**: Vercel AI SDK Function Calling, Tool Registration, and Streaming UI Integration  

---

## 1. Feynman Intuition: How AI Tool Calling Works

Imagine an **Executive Assistant** (the AI Model, such as `qwen3-235b` or `llama-3.3-70b`) sitting at a desk. 

* The assistant is smart and fluent in natural language, but **has no clock on the wall** and **no direct connection to the college registrar's computer system**.
* When a student asks: *"What time is it in Dallas and what are the prerequisites for MATH 1314?"*, the Assistant realizes it cannot answer from memory alone.
* Instead of making up an answer (hallucinating), the Assistant reaches for two **Standardized Request Forms** (Zod Schemas):
  1. Form A: `get_date`
  2. Form B: `get_course_information` with field `courseCode = "MATH-1314"`.
* The Assistant passes these forms to the **Office Clerks** (backend tool functions in `lib/tools.ts`).
* The Clerks lookup the live clock and search the course catalog, stamping the verified results onto the return slip.
* The Assistant reads the slips, combines the data into a single friendly response, and speaks back to the student.

---

## 2. Technical Architecture & Component Breakdown

### A. The Tool Registry (`apps/frontend/lib/tools.ts`)
Tools are created using `tool()` from the `ai` package:
1. **`description`**: Tells the LLM *when* and *why* to trigger the tool.
2. **`inputSchema`**: Built with `zod`, enforcing exact parameter types and passing JSON Schema hints to the model.
3. **`execute`**: Async handler receiving validated parameters. Performs defensive normalization (`trim()`, `toUpperCase()`) before returning data.

```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const get_course_information = tool({
  description: 'Lookup course details by course code.',
  inputSchema: z.object({
    courseCode: z.string().describe('Course code e.g. ENGL-1301'),
  }),
  execute: async ({ courseCode }) => {
    const code = courseCode.trim().toUpperCase().replace(/\s+/g, '-');
    return mockCatalog[code] || { error: 'Course not found' };
  },
});
```

### B. The Route Handler (`apps/frontend/app/api/chat/route.ts`)
* Uses `streamText()` from Vercel AI SDK.
* Exports `tools: successCoachTools`.
* Sets `maxSteps: 5` allowing the LLM to execute multi-turn tool loops (Call $\rightarrow$ Result $\rightarrow$ Call $\rightarrow$ Result $\rightarrow$ Answer).
* Converts incoming messages with `convertToModelMessages(messages)` to preserve context history.

### C. Client Stream & UI Badges (`apps/frontend/app/dev/chat-test/page.tsx`)
* Receives Server-Sent Events (SSE) from the backend API.
* Uses string line buffering to ensure partial network chunks never drop tool payloads.
* Renders interactive `ToolInvocationBadge` components:
  * **State `call`**: Pulsing amber indicator (*“Executing tool...”*).
  * **State `result`**: Emerald green checkmark (*“Completed tool lookup”*).
  * **Payload Toggle**: Expandable JSON code blocks to inspect raw arguments and returned data.

---

## 3. Step-by-Step Guide for Novice Developers

1. **Adding a New Tool**:
   * Open `apps/frontend/lib/tools.ts`.
   * Export a new `tool({...})` with a Zod input schema.
   * Register the tool in `successCoachTools`.

2. **Testing via OpenRouter**:
   * Ensure `OPENROUTER_API_KEY` is set in `.env`.
   * Supported models: `qwen/qwen3-235b-a22b:free` or `meta-llama/llama-3.3-70b-instruct:free`.

3. **Running Dev Server without Symlink Errors**:
   * Run `npx next dev -H 0.0.0.0 -p 3000 --webpack` in `apps/frontend`.
