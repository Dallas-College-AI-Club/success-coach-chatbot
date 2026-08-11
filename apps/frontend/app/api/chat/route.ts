import {
  profilePromptBlock,
  studentProfileSchema,
} from "@/features/chat/profile";
import {
  FREE_LIMIT_MESSAGE,
  GENERIC_CHAT_ERROR,
  TRANSIENT_LIMIT_MESSAGE,
} from "@/lib/chat-errors";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { createToolRegistry } from "@/lib/tools/registry";
import { createOpenAI } from "@ai-sdk/openai";
import {
  APICallError,
  convertToModelMessages,
  RetryError,
  stepCountIs,
  streamText,
  validateUIMessages,
  type UIMessage,
} from "ai";

// Next.js Route Segment Configuration
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // Cross-site guard: keeps a third-party page from spending the club's
    // OpenRouter free-tier quota through a visitor's browser. Origin rather
    // than Referer — browsers always send Origin on a cross-origin POST,
    // while Referer is stripped by privacy settings. A missing Origin
    // (non-browser caller) is allowed through so this never blocks a real
    // student.
    //
    // The request's own host is always allowed, which covers localhost and
    // every preview deployment without configuration; NEXT_PUBLIC_APP_URL is
    // an additional allowed origin for the canonical domain. An unparseable
    // value is ignored rather than thrown — a typo in the env var must not
    // turn every chat request into a 500.
    const origin = req.headers.get("origin");
    if (origin) {
      const allowed = new Set<string>();
      const host = req.headers.get("host");
      if (host) {
        allowed.add(`https://${host}`);
        allowed.add(`http://${host}`);
      }
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (appUrl) {
        try {
          allowed.add(new URL(appUrl).origin);
        } catch {
          console.warn(
            "[API Chat Route]: NEXT_PUBLIC_APP_URL is not a valid URL; ignoring it for the origin check.",
          );
        }
      }
      if (!allowed.has(origin)) {
        return Response.json({ error: "Forbidden origin" }, { status: 403 });
      }
    }

    // Malformed JSON is a caller mistake, not a server failure: without this
    // guard it fell through to the catch-all 500 and leaked the raw parser
    // message, contra the chat-errors contract.
    let body: { messages?: unknown; profile?: unknown };
    try {
      body = await req.json();
    } catch {
      return Response.json(
        {
          error: "Invalid request",
          details: "request body must be JSON.",
        },
        { status: 400 },
      );
    }

    const model = process.env.LLM_MODEL;
    if (model == null) {
      console.warn("[API Chat Route]: No model detected.");
      return new Response(
        JSON.stringify({
          error: "Missing LLM_MODEL",
          details:
            "An LLM model is required. Set LLM_MODEL in apps/frontend/.env (or the deployment's environment variables).",
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
            "An API base URL is required. Set LLM_BASE_URL in apps/frontend/.env (or the deployment's environment variables).",
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
            "An active OpenRouter API key is required. Set OPENROUTER_API_KEY in apps/frontend/.env (or the deployment's environment variables).",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // The onboarding answers, validated before any of them reach the system
    // layer. A caller can only contribute the six known display fields, each
    // length-capped; anything else is dropped rather than 400'd, so a stale
    // client never loses its chat over a schema change.
    const parsedProfile = studentProfileSchema.safeParse(body.profile);
    const profileBlock = parsedProfile.success
      ? profilePromptBlock(parsedProfile.data)
      : "";

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
    // The system layer is server-owned: lib/system-prompt.ts, plus the
    // student profile, which is the only client-supplied part and reaches it
    // only after passing studentProfileSchema. The free-text `systemPrompt`
    // override is gone — it lost its only caller when #161 deleted
    // /dev/chat-test.
    const result = streamText({
      model: openrouter.chat(model),
      messages: await convertToModelMessages(messages),
      system: SYSTEM_PROMPT + profileBlock,
      tools: createToolRegistry(),
      // Allow multi-step tool execution.
      // AI SDK defaults to stepCountIs(1), which stops after tool invocation.
      //
      // 8 with a forced-answer phase, not 5: at stepCountIs(5) a thrashing
      // model spent every step on tool calls and the turn ended with NO text
      // ("What classes should I take for Computer Science?" → 9 calls at a
      // 15-step ceiling, observed 2026-08-10). From step 6 on, tools are
      // withheld (activeTools: []), so the final steps cannot be tool calls
      // — a turn can no longer end mid-tool-chain. activeTools, NOT
      // toolChoice "none": measured live 2026-08-11, OpenRouter's free-tier
      // routing sent step 7 to a backend that 400s on enforced tool_choice
      // ("inference-enforced tool_choice requires the pinned Gemma prompt
      // contract" — provider "Darkbloom"), killing exactly the long turns
      // this phase exists to save.
      // The forced step ALSO gets an explicit generation order appended to
      // the system prompt: with tools silently absent but tool history
      // present, gpt-oss-20b returned EMPTY completions (measured live —
      // two turns ended blank at steps 7-8). Telling it the budget is spent
      // and to answer now gives the step a scripted move.
      stopWhen: stepCountIs(8),
      prepareStep: ({ stepNumber }) =>
        stepNumber >= 6
          ? {
              activeTools: [],
              system:
                SYSTEM_PROMPT +
                profileBlock +
                "\n\nTOOL BUDGET EXHAUSTED for this turn. Do not request any tool. Write your final answer NOW from the tool results above; if nothing was verified, give the exact fallback sentence.",
            }
          : undefined,

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
        // The SDK exhausts its built-in retries first, then surfaces a
        // RetryError WRAPPER ("Failed after 3 attempts…") whose own message
        // carries neither the HTTP status nor OpenRouter's reason string —
        // both live in lastError. Unwrap before matching, or genuine 429s
        // fall to the generic line (both 2026-08-11 live failures did).
        const cause = RetryError.isInstance(error) ? error.lastError : error;
        const m = cause instanceof Error ? cause.message : String(cause);
        // Order matters: the daily cap is ALSO a 429. Its body names the
        // per-day limit; every other 429 (per-minute throttle, shared
        // free-pool congestion) is transient and must NOT tell the student
        // to come back tomorrow.
        if (m.includes("free-models-per-day")) {
          return FREE_LIMIT_MESSAGE;
        }
        if (
          (APICallError.isInstance(cause) && cause.statusCode === 429) ||
          m.includes("Rate limit")
        ) {
          return TRANSIENT_LIMIT_MESSAGE;
        }
        console.error("[API Chat Route stream error]:", m);
        return GENERIC_CHAT_ERROR;
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
