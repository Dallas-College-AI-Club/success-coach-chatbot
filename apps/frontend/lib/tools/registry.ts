import { createGetCurrentDateTool } from './getCurrentDate';
import { toAiSdkTools } from './adapter';
import type { Tool } from './types';

/**
 * Canonical Project Tool instances map.
 */
export const projectTools: Record<string, Tool<any, any>> = {
  get_current_date: createGetCurrentDateTool(),
};

/**
 * AI SDK-compatible tool registry exported for streamText().
 */
export const toolRegistry = toAiSdkTools(projectTools);
