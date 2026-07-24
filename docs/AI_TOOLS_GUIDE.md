# Success Coach Chatbot: AI Tool Integration & Developer Guide

> **Version**: 1.0.0  
> **Target Audience**: AI Club Developers & Engineering Team  
> **Framework**: Vercel AI SDK (`ai`), Zod (`zod`), Next.js App Router  

---

## 1. Executive Summary & Architecture

In the Success Coach Chatbot, **Tools (Function Calling)** empower the Large Language Model to query external databases, real-time APIs, campus catalog records, or event schedules before generating a final natural language answer for students.

```
[Student Prompt] 
       │
       ▼
[OpenRouter LLM (qwen3-235b / llama-3.3-70b)]
       │ (Evaluates Zod Tool Schemas)
       ▼
[Emits tool-call event (e.g., get_course_information)]
       │
       ▼
[Client/Server Tool Execution (lib/tools.ts)]
       │
       ▼
[Returns JSON Result back to LLM Payload]
       │
       ▼
[Streams Final Natural Language Answer to Student]
```

---

## 2. Standardized Tool Anatomy

Every tool in the project **must** be defined using the `tool()` function exported by the Vercel AI SDK and typed strictly using `zod`.

A standard tool consists of three mandatory fields:

```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const my_custom_tool = tool({
  // 1. Description: Instructions telling the LLM WHEN to call this tool
  description: 'Search for upcoming campus events, club meetings, and workshops.',

  // 2. inputSchema: Zod schema enforcing exact parameter types and descriptions
  inputSchema: z.object({
    category: z.enum(['academic', 'social', 'sports', 'career']).describe('The event category'),
    keyword: z.string().optional().describe('Optional keyword search term'),
  }),

  // 3. execute: Async function receiving validated parameters and returning JSON
  execute: async ({ category, keyword }) => {
    // Perform normalization, API fetch, or database query
    const results = await fetchEventsFromDatabase(category, keyword);
    return {
      success: true,
      count: results.length,
      events: results,
    };
  },
});
```

---

## 3. Best Practices & Defensive Coding

1. **Defensive Input Normalization**:
   LLMs may pass inputs with inconsistent casing or extra spaces (e.g., `"engl 1302"`, `"Engl-1302"`). Always normalize inputs inside `execute()` before lookup:
   ```typescript
   const normalized = inputString.trim().toUpperCase().replace(/\s+/g, '-');
   ```

2. **Graceful Error Fallbacks**:
   Never allow an `execute()` function to throw unhandled exceptions. If a database query fails or a record is missing, return a clean error object alongside recommendations:
   ```typescript
   if (!recordFound) {
     return {
       error: `No record found for ${normalized}`,
       availableOptions: ['ENGL-1301', 'ENGL-1302', 'MATH-1314'],
     };
   }
   ```

3. **Descriptive Parameter Hints**:
   Use `.describe('...')` on every Zod field. This text is passed directly into the JSON Schema sent to the LLM and guides parameter extraction accuracy.

---

## 4. Step-by-Step Tutorial: Registering a New Tool

### Step 1: Define the Tool in `apps/frontend/lib/tools.ts`
Write your new tool using the standard anatomy:
```typescript
export const search_lost_and_found = tool({
  description: 'Search Dallas College lost and found inventory for missing items.',
  inputSchema: z.object({
    itemType: z.string().describe('Type of item, e.g., laptop, keys, student ID, backpack'),
    campus: z.string().describe('Campus location, e.g., Brookhaven, Richland, Mountain View'),
  }),
  execute: async ({ itemType, campus }) => {
    // Mock inventory search
    return {
      found: true,
      item: itemType,
      campusLocation: campus,
      pickupOffice: 'Student Life Desk, Building S',
    };
  },
});
```

### Step 2: Register in `successCoachTools` Export
Add your tool to the central registry at the bottom of `lib/tools.ts`:
```typescript
export const successCoachTools = {
  get_date,
  get_course_information,
  search_lost_and_found, // <-- Add your new tool here!
};
```

### Step 3: Verify Tool Execution
Start the development server and test with a prompt like:
> *"I lost my keys at Brookhaven campus, can you check if anyone turned them in?"*

The system will automatically trigger `search_lost_and_found`, render the execution badge in `/dev/chat-test`, and provide a helpful response.

---

## 5. Tested & Recommended OpenRouter LLM Models

The following open-weight models have been verified for tool calling compatibility without parameter hallucination:

| Model ID | Provider | Tool Calling Rating | Notes |
| :--- | :--- | :--- | :--- |
| `qwen/qwen3-235b-a22b:free` | Qwen / OpenRouter | **Excellent (Primary)** | Native function calling, robust schema adherence, multi-step support. |
| `meta-llama/llama-3.3-70b-instruct:free` | Meta / OpenRouter | **Very Good (Fallback)** | High reasoning capability, clean JSON output. |

---
