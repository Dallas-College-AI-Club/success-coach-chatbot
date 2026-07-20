"use server";

/**
 * apps/frontend/lib/config.ts
 * 
 * Centralized Application Settings & Environment Variable Validator.
 * Prevents runtime errors by validating environment variables on startup.
 */

export interface AppConfig {
  openRouterApiKey: string;
  geminiApiKey: string;
  neonApiKey?: string;
  pineconeApiKey?: string;
  isDev: boolean;
}

/**
 * Retrieves an environment variable, throwing a descriptive error if missing and required.
 */
function getEnvVar(key: string, required = true, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  
  if (required && !value) {
    throw new Error(
      `[Configuration Error]: Missing required environment variable "${key}". ` +
      `Please ensure it is defined in your local .env file.`
    );
  }
  
  return value || '';
}

export const config: AppConfig = {
  // Required keys for basic operation
  openRouterApiKey: getEnvVar('OPENROUTER_API_KEY', true),

  // Fallback direct key (uses safe placeholder if missing)
  geminiApiKey: getEnvVar('GEMINI_API_KEY', false, 'AIzaSyFakeKeyForSprint'),

  // Optional infrastructure keys
  neonApiKey: getEnvVar('NEON_API_KEY', false),
  pineconeApiKey: getEnvVar('PINECONE_API_KEY', false),

  // Runtime environment detection
  isDev: process.env.NODE_ENV !== 'production',
};
