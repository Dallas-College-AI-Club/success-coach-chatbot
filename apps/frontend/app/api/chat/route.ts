import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

// Next.js Route Segment Configuration
export const runtime = 'nodejs'; // Use Node.js runtime to ensure full library compatibility

export async function POST(req: Request) {
  try {
    const { messages, systemPrompt, context } = await req.json();

    // Pull key strictly from environment variables (.env.local)
    const activeApiKey = process.env.OPENROUTER_API_KEY;

    const hasRealKey = activeApiKey && 
                       activeApiKey !== 'your-openrouter-key-here' &&
                       !activeApiKey.includes('placeholder');

    if (!hasRealKey) {
      console.warn('[API Chat Route]: No active OpenRouter API key detected in .env.local.');
      return new Response(
        JSON.stringify({
          error: 'Missing API Key',
          details: 'An active OpenRouter API Key is required in your local .env.local file to test live completions.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create the OpenRouter provider dynamically using the server API key
    const openrouter = createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: activeApiKey,
      headers: {
        'HTTP-Referer': 'https://github.com/Dallas-College-AI-Club/success-coach-chatbot',
        'X-Title': 'Success Coach Chatbot Dev Test',
      },
    });

    let baseSystemPrompt = systemPrompt || 'You are an academic advisor for Dallas College.';
    if (context && (context.campus || context.major)) {
      baseSystemPrompt += `\n\nStudent Profile:\n- Dallas College Campus: ${context.campus || 'General'}\n- Major/Area of Interest: ${context.major || 'General studies'}`;
    }

    // Call streamText using meta-llama/llama-3-8b-instruct:free via OpenRouter
    const result = streamText({
      model: openrouter('meta-llama/llama-3-8b-instruct:free'),
      messages,
      system: baseSystemPrompt,
      maxTokens: 1000,
      temperature: 0.7,
    });

    // Return the response formatted as a UI message stream
    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error('[API Chat Route Error]:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to generate chat response',
        details: error.message || String(error),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
