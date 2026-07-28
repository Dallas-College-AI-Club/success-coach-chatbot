import { createOpenAI } from '@ai-sdk/openai';
import { streamText, stepCountIs } from 'ai';
import { toolRegistry } from '@/lib/tools/registry';

// Next.js Route Segment Configuration
export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        const { messages, systemPrompt, context } = await req.json();
        if (process.env.NODE_ENV !== 'production') {
            console.log(
                '[CHAT] incoming messages:',
                JSON.stringify(messages, null, 2),
            );
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

        let baseSystemPrompt = systemPrompt || 'You are an academic advisor for Dallas College.';
        if (context && (context.campus || context.major)) {
            baseSystemPrompt += `\n\nStudent Profile:\n- Dallas College Campus: ${context.campus || 'General'}\n- Major/Area of Interest: ${context.major || 'General studies'}`;
        }

        // Clean the message payload to ensure strict compatibility with OpenRouter's API schema
        const cleanMessages = messages.map((m: { role: string; content?: string }) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: String(m.content || ''),
        }));

        // Call streamText using openai/gpt-oss-20b:free via OpenRouter
        console.log('[CHAT] Registered tools:', Object.keys(toolRegistry));
        const result = streamText({
            model: openrouter.chat('openai/gpt-oss-20b:free'),
            messages: cleanMessages,
            system: baseSystemPrompt,
            tools: toolRegistry,
            // Allow multi-step tool execution.
            // AI SDK defaults to stepCountIs(1), which stops after tool invocation.
            stopWhen: stepCountIs(5),

            maxOutputTokens: 1000,
            temperature: 0.7,
        });

        console.log('[CHAT] stream response started');
        return result.toUIMessageStreamResponse();

    } catch (error: unknown) {
        console.error('[API Chat Route Error]:', error);
        return new Response(
            JSON.stringify({
                error: 'Failed to generate chat response',
                details: error instanceof Error ? error.message : String(error),
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
}
