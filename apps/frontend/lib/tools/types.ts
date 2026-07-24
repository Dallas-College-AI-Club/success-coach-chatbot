import type { JSONSchema7 } from "ai";

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: JSONSchema7;
}

export interface ExecutableTool {
  readonly definition: ToolDefinition;
  run(rawInput: unknown): Promise<unknown>;
}

export interface Tool<TInput, TOutput> extends ExecutableTool {
  parseInput(raw: unknown): TInput;
  execute(input: TInput): TOutput;
  run(rawInput: unknown): Promise<Awaited<TOutput>>;
}

export interface ToolSpec<TInput, TOutput> {
  definition: ToolDefinition;
  parseInput(raw: unknown): TInput;
  execute(input: TInput): TOutput;
}

export function defineTool<TInput, TOutput>(
  spec: ToolSpec<TInput, TOutput>
): Tool<TInput, TOutput> {
  return {
    definition: spec.definition,
    parseInput: (raw) => spec.parseInput(raw),
    execute: (input) => spec.execute(input),

    async run(rawInput: unknown): Promise<Awaited<TOutput>> {
      const output: Awaited<TOutput> =
        await spec.execute(spec.parseInput(rawInput));

      return output;
    },
  };
}

export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolInputError";
  }
}

export function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
