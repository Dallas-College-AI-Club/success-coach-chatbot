import { tool as aiTool, jsonSchema } from "ai";
import type { Tool } from "./types";

/**
 * Converts a canonical Project Tool definition into an AI SDK v6 Tool.
 * Wraps canonical input_schema in jsonSchema() and uses parseInput() inside execute().
 */
export function toAiSdkTool<Input, Output>(
    projectTool: Tool<Input, Output>
) {
    return aiTool({
        description: projectTool.definition.description,
        inputSchema: jsonSchema<Input>(
            projectTool.definition.input_schema
        ),
        execute: async (input: unknown) => {
            const parsed = projectTool.parseInput(input);
            return projectTool.execute(parsed);
        },
    });
}

/**
 * Converts a map of Project Tools into an AI SDK tool map for streamText().
 */
export function toAiSdkTools(
    tools: Record<string, Tool<any, any>>
) {
    const converted: Record<string, any> = {};

    for (const [name, tool] of Object.entries(tools)) {
        converted[name] = toAiSdkTool(tool);
    }

    return converted;
}
