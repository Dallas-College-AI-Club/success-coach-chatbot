/**
 * test_fallback.js
 * 
 * Demonstrates a production-grade cascading LLM router designed for Issue #1.
 * Features:
 * 1. Queries openrouter/free first.
 * 2. Catches specific HTTP errors (429 Rate Limits, 402 Billing/Credits, 404 Model Not Found, 503/504 Congestion).
 * 3. Switches dynamically to alternative free backup models (Llama 3.2, GLM, etc.) or falls back directly to the Google Gemini API.
 * 4. Outputs a step-by-step visual waterfall trace.
 */

const fs = require('fs');
const path = require('path');

// Helper to load environment variables from local .env files
function loadEnv() {
  const envPaths = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '../../.env'),
    path.join(__dirname, '../../../.env')
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, val] = trimmed.split('=');
          if (key && val) {
            process.env[key.trim()] = val.trim().replace(/^['"]|['"]$/g, '');
          }
        }
      });
    }
  }
}

loadEnv();

// Set up mock Gemini key if none exists to avoid execution crashes
if (!process.env.GEMINI_API_KEY) {
  process.env.GEMINI_API_KEY = 'AIzaSyFakeKeyForSprint';
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Cascading models array representing backup paths
const BACKUP_MODELS = [
  'openrouter/free',                        // Tier 1: Auto-routing free model (default)
  'meta-llama/llama-3.2-3b-instruct:free', // Tier 2: Lightweight backup
  'z-ai/glm-4.5-air:free',                  // Tier 3: Alternative LLM
  'liquid/lfm-2.5-1.2b-instruct:free'      // Tier 4: Reasoning/Lightweight fallback
];

/**
 * Calls OpenRouter with a specific model and optional simulated error injection.
 */
async function callOpenRouter(model, simulateError = null) {
  console.log(`   [Request] Invoking model: "${model}"`);

  // Simulated errors for testing fallback pathways
  if (simulateError) {
    throw { status: simulateError, message: `Simulated HTTP ${simulateError} error` };
  }

  if (!OPENROUTER_API_KEY) {
    throw { status: 401, message: "Missing OPENROUTER_API_KEY" };
  }

  const headers = {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://dc-success-coach.vercel.app',
    'X-Title': 'Dallas College Success Coach Chatbot'
  };

  const body = JSON.stringify({
    model: model,
    messages: [
      { role: 'user', content: 'Say "Connection Verified" in exactly two words.' }
    ],
    max_tokens: 100
  });

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw { status: response.status, message: responseText };
  }

  const data = JSON.parse(responseText);
  return data.choices[0].message.content.trim();
}

/**
 * Last-resort fallback contacting Gemini API directly
 */
async function callGeminiDirect() {
  console.log(`   [Request] Invoking direct Google Gemini 2.5 Flash API...`);

  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('Fake')) {
    throw new Error("Missing or invalid direct GEMINI_API_KEY.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Say "Direct Gemini Verified" in exactly three words.' }] }]
    })
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${responseText}`);
  }

  const data = JSON.parse(responseText);
  return data.candidates[0].content.parts[0].text.trim();
}

/**
 * Intelligent Router that executes the request with fallback/error logic
 */
async function runRouter(simulation = null) {
  console.log(`\n======================================================`);
  console.log(`🤖 RUNNING ROUTER [Simulation Mode: ${simulation || 'NONE'}]`);
  console.log(`======================================================`);

  let response = null;

  for (let i = 0; i < BACKUP_MODELS.length; i++) {
    const model = BACKUP_MODELS[i];
    try {
      // Inject error only on the first try to simulate specific failures
      const errorToInject = (i === 0) ? simulation : null;
      
      response = await callOpenRouter(model, errorToInject);
      console.log(`🎯 [SUCCESS] Responded via "${model}": "${response}"`);
      return response;
    } catch (err) {
      const status = err.status || 500;
      console.warn(`⚠️  [FAILED] "${model}" failed with Status Code: ${status}`);

      // Handle specific error codes
      switch (status) {
        case 402:
          console.warn(`    └─ [Billing / Credit Exhaustion]: Immediate bypass of remaining OpenRouter models.`);
          // Breaking the loop triggers the direct Gemini API immediately
          i = BACKUP_MODELS.length; 
          break;
        case 429:
          console.warn(`    └─ [Rate Limit Hit]: Cascading to the next available free model in the array.`);
          break;
        case 404:
          console.warn(`    └─ [Model Deprecated / Not Found]: Moving to alternative model.`);
          break;
        case 503:
        case 504:
          console.warn(`    └─ [Upstream Congestion / Gateway Timeout]: Attempting next backup.`);
          break;
        default:
          console.warn(`    └─ [General Error]: Attempting backup...`);
      }
    }
  }

  // Last resort: Contact Direct Gemini API
  if (!response) {
    console.log(`🚨 [ALERT] All OpenRouter pathways failed/exhausted. Initiating Direct Gemini Fallback...`);
    try {
      response = await callGeminiDirect();
      console.log(`🎯 [SUCCESS] Responded via Direct Google Gemini: "${response}"`);
    } catch (err) {
      console.error(`❌ [CRITICAL] Direct Gemini Fallback also failed: ${err.message}`);
    }
  }

  return response;
}

async function main() {
  // Standard execution without artificial errors to test real API status
  await runRouter(null);
}

main();
