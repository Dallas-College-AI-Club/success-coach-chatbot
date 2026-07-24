import { createOpenAI } from '@ai-sdk/openai';
import { streamText, convertToModelMessages } from 'ai';
import fs from 'fs';
import path from 'path';
import { successCoachTools } from '../../../lib/tools';

// Next.js Route Segment Configuration
export const runtime = 'nodejs';

/**
 * Reads the OPENROUTER_API_KEY directly from the project root .env file.
 * This bypasses Next.js env caching so team members only need to set
 * their key once in the root .env and never touch apps/frontend/.env.local.
 */
function getApiKey(): string | null {
  // 1. First try reading fresh from root .env (always up to date)
  try {
    const envPath = path.resolve(process.cwd(), '../../.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || !trimmed.startsWith('OPENROUTER_API_KEY')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        const val = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
        if (val && !/^your-.*-here$/.test(val) && !val.includes('placeholder')) {
          return val;
        }
      }
    }
  } catch (err) {
    console.error('[API Chat Route]: Failed to read root .env:', err);
  }

  // 2. Fallback to process.env (from frontend .env.local if configured)
  const envKey = process.env.OPENROUTER_API_KEY;
  if (envKey && !/^your-.*-here$/.test(envKey) && !envKey.includes('placeholder')) {
    return envKey;
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const { messages, systemPrompt, context } = await req.json();

    const activeApiKey = getApiKey();

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
        'HTTP-Referer': 'https://github.com/Dallas-College-AI-Club/success-coach-chatbot',
        'X-Title': 'Success Coach Chatbot Dev Test',
      },
    });

    let baseSystemPrompt = systemPrompt || 'You are an academic advisor for Dallas College.';
    if (context && (context.campus || context.major)) {
      baseSystemPrompt += `\n\nStudent Profile:\n- Dallas College Campus: ${context.campus || 'General'}\n- Major/Area of Interest: ${context.major || 'General studies'}`;
    }

    // Call streamText using qwen/qwen3-235b-a22b:free via OpenRouter to support tool calling
    const result = streamText({
      model: openrouter.chat('qwen/qwen3-235b-a22b:free'),
      messages: convertToModelMessages(messages),
      system: baseSystemPrompt,
      maxTokens: 1500, // increased for tool calling and reasoning overhead
      temperature: 0.7,
      tools: successCoachTools,
      maxSteps: 5, // allow up to 5 rounds of tool calling
    });

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
