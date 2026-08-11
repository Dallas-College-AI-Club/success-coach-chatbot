import { FREE_LIMIT_MESSAGE } from "@/lib/chat-errors";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { toolRegistry } from "@/lib/tools/registry";
import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  validateUIMessages,
  type UIMessage,
} from "ai";

// Next.js Route Segment Configuration
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body: { messages?: unknown } = await req.json();

    const model = process.env.LLM_MODEL;
    if (model == null) {
      console.warn("[API Chat Route]: No model detected.");
      return new Response(
        JSON.stringify({
          error: "Missing LLM_MODEL",
          details:
            "An LLM model is required. Please set LLM_MODEL in your root .env file to run live tests.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const base_url = process.env.LLM_BASE_URL;
    if (base_url == null) {
      console.warn("[API Chat Route]: No base URL detected.");
      return new Response(
        JSON.stringify({
          error: "Missing LLM_BASE_URL",
          details:
            "An api base url  is required. Please set LLM_BASE_URL in your root .env file to run live tests.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // The body is untrusted JSON — validate at the boundary instead of
    // asserting a type over it. Malformed messages get a 400, not a 500
    // from deep inside the stream.
    let messages: UIMessage[];
    try {
      messages = await validateUIMessages({ messages: body.messages });
    } catch {
      return Response.json(
        {
          error: "Invalid request",
          details: "messages must be an array of UI messages.",
        },
        { status: 400 },
      );
    }

    // UIMessage's role union includes "system", and convertToModelMessages
    // would forward it — letting any caller append to the system layer. The
    // governed prompt is the ONLY system content this route ever sends.
    if (messages.some((m) => m.role === "system")) {
      return Response.json(
        {
          error: "Invalid request",
          details: "system messages are not accepted.",
        },
        { status: 400 },
      );
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[CHAT] incoming turns:", messages.length);
    }

    const activeApiKey = process.env.OPENROUTER_API_KEY;
    if (!activeApiKey) {
      console.warn("[API Chat Route]: No active OpenRouter API key detected.");
      return new Response(
        JSON.stringify({
          error: "Missing API Key",
          details:
            "An active OpenRouter API Key is required. Please set OPENROUTER_API_KEY in your root .env file to run live tests.",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Create the OpenRouter provider using the resolved API key
    const openrouter = createOpenAI({
      baseURL: base_url,
      apiKey: activeApiKey,
      headers: {
        "HTTP-Referer":
          "https://github.com/Dallas-College-AI-Club/success-coach-chatbot",
        "X-Title": "Success Coach Chatbot Dev Test",
      },
    });

    // UI messages carry `parts` (text + tool calls), not a flat `content`
    // string. convertToModelMessages is the documented bridge and is ASYNC
    // in AI SDK v6 — the previous String(m.content) map silently sent empty
    // turns. Docs: node_modules/ai/docs/04-ai-sdk-ui/02-chatbot.mdx
    //
    // The system layer is server-owned: lib/system-prompt.ts, verbatim. The
    // former client-supplied `systemPrompt` override lost its only caller
    // when #161 deleted /dev/chat-test, and the `context` splice never had
    // one (the transport posts messages only) — both removed.
    const result = streamText({
      model: openrouter.chat(model),
      messages: await convertToModelMessages(messages),
      system: SYSTEM_PROMPT,
      tools: toolRegistry,
      // Allow multi-step tool execution.
      // AI SDK defaults to stepCountIs(1), which stops after tool invocation.
      //
      // 8 with a forced-answer phase, not 5: at stepCountIs(5) a thrashing
      // model spent every step on tool calls and the turn ended with NO text
      // ("What classes should I take for Computer Science?" → 9 calls at a
      // 15-step ceiling, observed 2026-08-10). From step 6 on, toolChoice
      // "none" forbids further calls, so the final steps cannot be tool
      // calls — a turn can no longer end mid-tool-chain. ("none", NOT
      // activeTools: [] — an empty toolset makes the openai adapter omit
      // the tools field entirely while the history still carries tool
      // calls, which strict OpenAI-compatible backends reject.)
      stopWhen: stepCountIs(8),
      prepareStep: ({ stepNumber }) =>
        stepNumber >= 6 ? { toolChoice: "none" as const } : undefined,

      // 1000 truncated 4 of 10 replies mid-word in live testing — one
      // cut a transfer-credit hedge to a bare "Just double-"; a truncated
      // caveat is worse than a short answer (#154 measurement).
      maxOutputTokens: 2000,
      // Low on purpose: this bot restates tool-returned facts, where
      // sampling variance is pure downside. At 0.7 the live proof runs
      // showed variance-shaped artifacts (1-of-8 empty replies, garbage
      // tokens in the before-runs); see the #146 experiment comment.
      temperature: 0.2,
    });

    if (process.env.NODE_ENV !== "production") {
      console.log("[CHAT] stream response started");
    }

    return result.toUIMessageStreamResponse({
      // Map known provider failures to student-facing wording; everything
      // else stays a generic line so internals never reach the client.
      onError: (error: unknown) => {
        const m = error instanceof Error ? error.message : String(error);
        if (m.includes("free-models-per-day") || m.includes("Rate limit")) {
          return FREE_LIMIT_MESSAGE;
        }
        console.error("[API Chat Route stream error]:", m);
        return "An error occurred.";
      },
    });
    
  } catch (error: unknown) {
    console.error("[API Chat Route Error]:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to generate chat response",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
