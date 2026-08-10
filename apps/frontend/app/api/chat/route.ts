import { createOpenAI } from '@ai-sdk/openai';
import { streamText, stepCountIs, convertToModelMessages, validateUIMessages, type UIMessage } from 'ai';
import { SYSTEM_PROMPT } from '@/lib/system-prompt';
import { toolRegistry } from '@/lib/tools/registry';

// Next.js Route Segment Configuration
export const runtime = 'nodejs';

// Abuse guards. This endpoint is unauthenticated and proxies a paid LLM, and
// stopWhen: stepCountIs(5) means one HTTP request can cost up to five upstream
// calls — so an unthrottled caller drains the club's shared OpenRouter budget
// at 5x. These are demo-scale guards for a single instance: in-memory, per-IP,
// reset on deploy. They are a spend cap, not authentication.
const MAX_BODY_BYTES = 256 * 1024;
const MAX_MESSAGES = 30;
const MAX_TEXT_CHARS = 8000;
const RATE_LIMIT_REQUESTS = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_TRACKED_IPS = 5000;

const recentRequests = new Map<string, number[]>();

/** True when this caller has exceeded RATE_LIMIT_REQUESTS within the window. */
function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const fresh = (recentRequests.get(ip) ?? []).filter(
        (t) => now - t < RATE_LIMIT_WINDOW_MS,
    );
    fresh.push(now);
    recentRequests.set(ip, fresh);

    // Bound memory: a caller rotating IPs must not grow this map without limit.
    if (recentRequests.size > RATE_LIMIT_MAX_TRACKED_IPS) {
        for (const [key, times] of recentRequests) {
            if (times[times.length - 1] < now - RATE_LIMIT_WINDOW_MS) {
                recentRequests.delete(key);
            }
        }
    }

    return fresh.length > RATE_LIMIT_REQUESTS;
}

/** Total characters across every text part — the payload size that matters. */
function totalTextChars(messages: UIMessage[]): number {
    let total = 0;
    for (const message of messages) {
        for (const part of message.parts ?? []) {
            if (part.type === 'text') {
                total += part.text.length;
            }
        }
    }
    return total;
}

export async function POST(req: Request) {
    try {
        const clientIp =
            req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
            req.headers.get('x-real-ip') ||
            'unknown';

        if (isRateLimited(clientIp)) {
            return Response.json(
                { error: 'Too many requests', details: 'Please wait a few minutes and try again.' },
                { status: 429, headers: { 'Retry-After': '600' } },
            );
        }

        // Reject oversized bodies BEFORE parsing, so a large payload is never
        // read into memory or written to a log.
        if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
            return Response.json(
                { error: 'Request too large', details: 'Message payload exceeds the size limit.' },
                { status: 413 },
            );
        }

        const body: {
            messages?: unknown;
            systemPrompt?: string;
            context?: { campus?: string; major?: string };
        } = await req.json();
        const { systemPrompt, context } = body;

        // The body is untrusted JSON — validate at the boundary instead of
        // asserting a type over it. Malformed messages get a 400, not a 500
        // from deep inside the stream.
        let messages: UIMessage[];
        try {
            messages = await validateUIMessages({ messages: body.messages });
        } catch {
            return Response.json(
                { error: 'Invalid request', details: 'messages must be an array of UI messages.' },
                { status: 400 },
            );
        }
        // Content-Length is caller-supplied and absent on chunked bodies, so
        // re-check the real payload after parsing.
        if (messages.length > MAX_MESSAGES || totalTextChars(messages) > MAX_TEXT_CHARS) {
            return Response.json(
                { error: 'Request too large', details: 'Conversation exceeds the size limit. Start a new chat.' },
                { status: 413 },
            );
        }

        if (process.env.NODE_ENV !== 'production') {
            console.log('[CHAT] incoming turns:', messages.length);
        }
        const activeApiKey = process.env.OPENROUTER_API_KEY;

        if (!activeApiKey) {
            console.warn('[API Chat Route]: No active OpenRouter API key detected.');
            return new Response(
                JSON.stringify({
                    error: 'Missing API Key',
                    details: 'An active OpenRouter API Key is required. Please set OPENROUTER_API_KEY in your root .env file to run live tests.',
                }),
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // Create the OpenRouter provider using the resolved API key
        const openrouter = createOpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: activeApiKey,
            headers: {
                'HTTP-Referer':
                    'https://github.com/Dallas-College-AI-Club/success-coach-chatbot',
                'X-Title': 'Success Coach Chatbot Dev Test',
            },
        });

        // The governed prompt (lib/system-prompt.ts). A caller-supplied override
        // is a dev-harness affordance only — in production the system layer is
        // never client-controlled.
        let baseSystemPrompt =
            process.env.NODE_ENV !== 'production' && systemPrompt
                ? systemPrompt
                : SYSTEM_PROMPT;
        if (context && (context.campus || context.major)) {
            baseSystemPrompt += `\n\nStudent Profile:\n- Dallas College Campus: ${context.campus || 'General'}\n- Major/Area of Interest: ${context.major || 'General studies'}`;
        }

        // UI messages carry `parts` (text + tool calls), not a flat `content`
        // string. convertToModelMessages is the documented bridge and is ASYNC
        // in AI SDK v6 — the previous String(m.content) map silently sent empty
        // turns. Docs: node_modules/ai/docs/04-ai-sdk-ui/02-chatbot.mdx
        const result = streamText({
            model: openrouter.chat('openai/gpt-oss-20b:free'),
            messages: await convertToModelMessages(messages),
            system: baseSystemPrompt,
            tools: toolRegistry,
            // Allow multi-step tool execution.
            // AI SDK defaults to stepCountIs(1), which stops after tool invocation.
            stopWhen: stepCountIs(5),

            maxOutputTokens: 1000,
            temperature: 0.7,
        });

        if (process.env.NODE_ENV !== 'production') {
            console.log('[CHAT] stream response started');
        }
        return result.toUIMessageStreamResponse();

    } catch (error: unknown) {
        console.error('[API Chat Route Error]:', error);
        return new Response(
            JSON.stringify({
                error: 'Failed to generate chat response',
                // Exception text can name hosts, databases and key state. Keep
                // it in the server log; never hand it to an unauthenticated
                // caller in production.
                details:
                    process.env.NODE_ENV === 'production'
                        ? 'An unexpected error occurred. Please try again.'
                        : error instanceof Error
                          ? error.message
                          : String(error),
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
}
