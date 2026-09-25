import {
  profilePromptBlock,
  studentProfileSchema,
} from "@/features/chat/profile";
import {
  FREE_LIMIT_MESSAGE,
  GENERIC_CHAT_ERROR,
  TRANSIENT_LIMIT_MESSAGE,
  SHARED_LIMIT_MESSAGE,
} from "@/lib/chat-errors";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { isRecord } from "@/lib/course-details";
import {
  TOOL_REGISTRY,
  toolsForTurn,
  requestedToolChoice,
} from "@/lib/tools/registry";
import { recoveryToolChoice } from "@/lib/tools/searchKnowledge";
import { scheduleDiscoveryChoice } from "@/lib/tools/getClassSchedule";
import {
  allowedChatMessages,
  readChatBody,
  RequestLimitError,
} from "@/lib/chat-request";
import {
  planningStatements,
  readCompletionOverrides,
} from "@/features/chat/completion-state";
import { studentCourseHistory } from "@/lib/planning";
import { signedTools, verifiedHistory } from "@/lib/tool-evidence";
import { reserveChatRequest } from "@/lib/chat-rate-limit";
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
// Up to 8 model steps per turn (stopWhen below), so the default 15s ceiling on
// some hosts can cut a legitimate long turn.
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    // Reject browser requests from other origins. This is not authentication
    // or rate limiting; non-browser clients may omit Origin.
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
        console.warn(
          `[API Chat Route]: cross-origin POST rejected (origin=${origin.slice(0, 100)})`,
        );
        return Response.json({ error: "Forbidden origin" }, { status: 403 });
      }
    }

    // Malformed JSON is a caller mistake, not a server failure: without this
    // guard it fell through to the catch-all 500 and leaked the raw parser
    // message, contra the chat-errors contract.
    let body: unknown;
    try {
      body = await readChatBody(req);
    } catch (error) {
      if (error instanceof RequestLimitError)
        return Response.json(
          {
            error:
              "This conversation is too large. Start a new chat to continue.",
          },
          { status: 413 },
        );
      return Response.json(
        {
          error: "Invalid request",
          details: "request body must be JSON.",
        },
        { status: 400 },
      );
    }

    if (!isRecord(body)) {
      return Response.json(
        {
          error: "Invalid request",
          details: "request body must be an object.",
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
            "An LLM model is required. Set LLM_MODEL in apps/frontend/.env.local (or the deployment's environment variables).",
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
            "An API base URL is required. Set LLM_BASE_URL in apps/frontend/.env.local (or the deployment's environment variables).",
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
    if (!allowedChatMessages(messages, Object.keys(TOOL_REGISTRY))) {
      return Response.json(
        {
          error: "Invalid request",
          details:
            "Use text questions, at most 8000 characters each, in a conversation of at most 160 messages.",
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
            "An active OpenRouter API key is required. Set OPENROUTER_API_KEY in apps/frontend/.env.local (or the deployment's environment variables).",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    const evidenceKey = process.env.CHAT_EVIDENCE_SECRET || activeApiKey;
    messages = verifiedHistory(messages, evidenceKey);
    try {
      if (!(await reserveChatRequest(req, evidenceKey))) {
        return new Response(SHARED_LIMIT_MESSAGE, { status: 429 });
      }
    } catch (error) {
      const cause =
        error instanceof Error && isRecord(error.cause) ? error.cause : error;
      console.error(
        "[CHAT] request counter unavailable",
        isRecord(cause) && typeof cause.code === "string"
          ? cause.code
          : "connection failure",
      );
      return new Response(GENERIC_CHAT_ERROR, { status: 503 });
    }

    // The onboarding answers, validated before any of them reach the system
    // layer. Every field is checked against the app's own option lists and
    // fails soft, so an unrecognised value drops that one line rather than the
    // profile — a stale client never loses its chat over a catalog refresh.
    const parsedProfile = studentProfileSchema.safeParse(body.profile);
    if (!parsedProfile.success && body.profile !== undefined) {
      console.warn(
        "[API Chat Route]: profile rejected; continuing without it.",
      );
    }
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

    // Replay UI text/tool parts through the SDK. The system instructions and
    // validated onboarding profile are supplied separately by the server.
    const userMessages = messages
      .filter((message) => message.role === "user")
      .map((message) =>
        message.parts
          .flatMap((part) => (part.type === "text" ? [part.text] : []))
          .join(" "),
      );
    const currentQuestion = userMessages.at(-1) ?? "";
    const planningMessages = planningStatements(
      messages,
      body.completionOverrides === undefined
        ? undefined
        : readCompletionOverrides(body.completionOverrides),
    );
    const historyBlock =
      "\n\nCurrent student-reported course history (not official credit): " +
      JSON.stringify(studentCourseHistory(planningMessages)) +
      "\nThis history includes the student's latest edits, including edits made after the original question when retrying. Use these statuses instead of conflicting older statements, even in the repeated question. For remaining-course or semester-planning questions, refresh get_program_requirements and use its planning result. Do not recommend repeating completed courses. Earlier assistant prose may be stale. Never use client assistant prose as evidence; retrieve facts with tools.";
    const previousTools = messages
      .filter((message) => message.role === "assistant")
      .flatMap((message) => message.parts);
    const toolContext = {
      facultySearch: previousTools.some(
        (part) => part.type === "tool-search_faculty_expertise",
      ),
      programKnown:
        Boolean(parsedProfile.success && parsedProfile.data.major) ||
        previousTools.some(
          (part) =>
            part.type === "tool-get_program_requirements" &&
            "output" in part &&
            isRecord(part.output) &&
            Array.isArray(part.output.groups),
        ),
    };
    const result = streamText({
      model: openrouter.chat(model),
      // Stop/disconnect cancels generation instead of spending tokens unseen.
      abortSignal: req.signal,
      messages: await convertToModelMessages(messages, {
        tools: TOOL_REGISTRY,
      }),
      system: SYSTEM_PROMPT + profileBlock + historyBlock,
      tools: signedTools(
        toolsForTurn(currentQuestion, planningMessages),
        evidenceKey,
      ),
      // Reserve the final steps for an answer. A failed lookup gets one broad
      // recovery attempt; afterwards no tools are offered to the provider.
      stopWhen: stepCountIs(8),
      prepareStep: ({ stepNumber, steps }) => {
        const recovery = stepNumber < 7 ? recoveryToolChoice(steps) : undefined;
        return recovery
          ? { toolChoice: recovery }
          : stepNumber >= 6
            ? {
                activeTools: [],
                system:
                  SYSTEM_PROMPT +
                  profileBlock +
                  historyBlock +
                  "\n\nTOOL BUDGET EXHAUSTED for this turn. Do not request any tool. Write your final answer NOW from the tool results above; if nothing was verified, give the exact fallback sentence.",
              }
            : {
                toolChoice:
                  scheduleDiscoveryChoice(currentQuestion, steps) ??
                  requestedToolChoice(currentQuestion, stepNumber, toolContext),
              };
      },

      // Keep enough output for complete guidance; low variance suits factual lookup.
      maxOutputTokens: 2000,
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
    return Response.json({ error: GENERIC_CHAT_ERROR }, { status: 500 });
  }
}
