import { tool } from 'ai';
import { z } from 'zod';

/**
 * Mock tool to get current date and time.
 * Demonstrates basic tool calling capability without complex arguments.
 */
export const get_date = tool({
  description: 'Get the current date and time.',
  inputSchema: z.object({
    timezone: z.string().optional().describe('Optional IANA timezone name (e.g., America/Chicago, America/New_York)'),
  }),
  execute: async ({ timezone }) => {
    const options: Intl.DateTimeFormatOptions = {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone: timezone || 'America/Chicago',
    };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const now = new Date();
    return {
      dateTime: formatter.format(now),
      timezone: timezone || 'America/Chicago (Default)',
    };
  },
});

/**
 * Mock tool to get details about Dallas College courses.
 * Demonstrates parameter extraction, casing normalization, and error fallbacks.
 */
export const get_course_information = tool({
  description: 'Get details about a Dallas College course, including course description, credits, and prerequisites.',
  inputSchema: z.object({
    courseCode: z.string().describe('The department prefix and course number, e.g., ENGL-1302 or MATH-1314. Do not include spaces.'),
  }),
  execute: async ({ courseCode }) => {
    // Standardize input format (upper case, replace space with hyphen if any)
    const normalized = courseCode.trim().toUpperCase().replace(/\s+/g, '-');

    const mockCatalog: Record<string, { description: string; credits: number; prerequisites: string[] }> = {
      'ENGL-1301': {
        description: 'Intensive study of and practice in writing processes, from invention and researching to drafting, revising, and editing.',
        credits: 3,
        prerequisites: [],
      },
      'ENGL-1302': {
        description: 'Intensive study of and practice in the strategies and techniques for developing research-based expository and persuasive texts.',
        credits: 3,
        prerequisites: ['ENGL-1301'],
      },
      'MATH-1314': {
        description: 'In-depth study and applications of quadratic, polynomial, rational, exponential, and logarithmic functions.',
        credits: 3,
        prerequisites: ['MATH-0314 or TSI college readiness math standard'],
      },
      'BIOL-1406': {
        description: 'Fundamental principles of living organisms, including physical and chemical properties of life, organization, function, evolutionary adaptation, and classification.',
        credits: 4,
        prerequisites: ['MATH-1314 or equivalent'],
      },
    };

    const courseInfo = mockCatalog[normalized];
    if (!courseInfo) {
      return {
        error: `Course ${courseCode} not found in the mock catalog.`,
        availableCourses: Object.keys(mockCatalog),
      };
    }

    return {
      courseCode: normalized,
      ...courseInfo,
    };
  },
});

// Registry object containing all Success Coach tools
export const successCoachTools = {
  get_date,
  get_course_information,
};
