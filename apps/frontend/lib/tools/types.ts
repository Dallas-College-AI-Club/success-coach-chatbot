import { asSchema, type FlexibleSchema, type Tool as AiTool, type ToolSet } from "ai";
import type { JSONSchema7 } from "json-schema";

/**
 * Tool definitions in Vercel AI SDK form.
 *
 * The AI SDK's `Tool` is the provider-neutral shape: `inputSchema` accepts
 * either a Zod schema or a JSON Schema, and any provider adapter knows how to
 * render it. Defining tools this way means this module imports nothing from
 * `@anthropic-ai/sdk` — the Anthropic-specific wire format is produced in
 * `chat/client.ts`, at the provider boundary where it belongs.
 *
 * Two differences from Anthropic's tool type shape the code below:
 *
 * 1. **AI SDK tools carry no name.** A name is the key a tool is registered
 *    under in a `ToolSet` record. Since this codebase passes tools around as an
 *    array, `ExecutableTool` carries the name alongside the definition, and
 *    `toolSet()` builds the record when one is needed.
 * 2. **`inputSchema` is a `FlexibleSchema`, not raw JSON.** Reading the JSON
 *    Schema back out goes through `asSchema`, and is asynchronous, because a
 *    schema is allowed to resolve lazily.
 */
export type ToolDefinition<TInput = unknown, TOutput = unknown> = AiTool<TInput, TOutput>;

/**
 * A tool definition with its input and output types erased.
 *
 * `AiTool` is invariant in `TInput` — the type appears in `inputSchema` and in
 * `execute`'s parameter — so `ToolDefinition<GetSemesterInput, …>` is not
 * assignable to `ToolDefinition<unknown, unknown>`. `any` is what makes a mixed
 * collection typecheck, and it is what the SDK itself reaches for: its `ToolSet`
 * is a record of `Tool<any, any, any>`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolDefinition = AiTool<any, any>;

export type { FlexibleSchema, ToolSet };

/**
 * A tool the agent loop can execute.
 *
 * Type parameters are erased here so tools with unrelated signatures can sit in
 * one array without `any` or a cast.
 */
export interface ExecutableTool {
    /** The name the model calls this tool by. */
    readonly name: string;
    /** The AI SDK tool, ready to hand to `generateText` or a provider adapter. */
    readonly definition: AnyToolDefinition;
    /** Validates raw model input, then executes. Throws on invalid input. */
    run(rawInput: unknown): Promise<unknown>;
}

/**
 * A tool as its author sees it, with types intact.
 *
 * `TOutput` is literally what `execute` returns, so a synchronous tool is
 * `Tool<I, O>` and an async one is `Tool<I, Promise<O>>`. Either way `run`
 * resolves to the awaited value.
 */
export interface Tool<TInput, TOutput> extends ExecutableTool {
    // `definition` is deliberately not narrowed to `ToolDefinition<TInput, …>`.
    // `AiTool` is invariant in its type parameters, so a narrowed definition is
    // not assignable to the erased one and `Tool` could not extend
    // `ExecutableTool`. Nothing needs the narrowing: the type information that
    // matters flows through the three members below.
    parseInput(raw: unknown): TInput;
    execute(input: TInput): TOutput;
    run(rawInput: unknown): Promise<Awaited<TOutput>>;
}

export interface ToolSpec<TInput, TOutput> {
    /** Name the model calls this tool by. Must match `^[a-zA-Z0-9_-]{1,64}$`. */
    name: string;
    /** Shown to the model; the main thing it reads when deciding whether to call. */
    description: string;
    /**
     * Zod schema or `jsonSchema({...})`. ADVERTISED to the model to shape its
     * call — never enforced: `jsonSchema()` without a `validate` option gives
     * the SDK nothing to validate with, so input reaches `execute` unchecked.
     * `parseInput` below is the only runtime validation these tools have.
     */
    inputSchema: FlexibleSchema<TInput>;
    /**
     * Validates and narrows raw input from the model.
     *
     * Kept separate from the schema rather than folded into it. A JSON Schema can
     * say "timeZone is a string"; it cannot canonicalise `"spring"` to `"Spring"`,
     * reject `"EST"` for resolving to America/Panama, or enforce that `year`
     * requires `term`. Those rules live here, where they can also produce error
     * messages written for a model to read and retry from.
     *
     * @throws {ToolInputError} when `raw` does not match the schema.
     */
    parseInput(raw: unknown): TInput;
    execute(input: TInput): TOutput;
}

/**
 * Wires a spec into a `Tool`.
 *
 * The AI SDK tool's own `execute` runs the same `parseInput` → `execute`
 * pipeline as `run`, so these tools behave identically whether driven by this
 * repo's agent loop or handed to `generateText`.
 */
export function defineTool<TInput, TOutput>(spec: ToolSpec<TInput, TOutput>): Tool<TInput, TOutput> {
    // Built as a plain object rather than through the SDK's `tool()` helper.
    // `tool()` is `t => t` at runtime — it exists purely so TypeScript can infer
    // types at a concrete call site, and its overloads resolve `TInput` to `never`
    // when called from inside a generic wrapper like this one. Constructing the
    // object directly is identical at runtime and keeps the inference correct.
    const definition = {
        // `Tool` is a union, and `DynamicTool` is the variant for tools discovered
        // at runtime. Tagging this as a function tool picks the right member rather
        // than leaving the literal ambiguous between them.
        type: "function",
        description: spec.description,
        inputSchema: spec.inputSchema,
        execute: async (input: TInput) => {
            // parseInput is the ONLY runtime validation these tools get. The
            // SDK does none here: `jsonSchema()` without a `validate` option
            // returns `validate: undefined`, and the SDK's safeValidateTypes
            // short-circuits to success when validate is null — the schema is
            // advertised to the model, never enforced. Do not "simplify" this
            // away, or raw model JSON goes straight to the DB queries.
            const parsed = spec.parseInput(input);
            const output: Awaited<TOutput> = await spec.execute(parsed);
            return output;
        },
        // The one cast in this file, and a limitation of TypeScript rather than a
        // gap in the design. `FunctionTool` gates `execute` behind
        // `NeverOptional<OUTPUT, …>`, a conditional type; with `OUTPUT` still an
        // unresolved generic here, TypeScript defers the condition and cannot check
        // an object literal against it. Every concrete instantiation satisfies it.
        // `assertsFunctionTool` below checks the shape at runtime so
        // structural mistakes fail fast during tool registration.
    } as unknown as AnyToolDefinition;

    assertsFunctionTool(definition, spec.name);

    return {
        name: spec.name,
        definition,
        parseInput: (raw) => spec.parseInput(raw),
        execute: (input) => spec.execute(input),
        async run(rawInput: unknown): Promise<Awaited<TOutput>> {
            const output: Awaited<TOutput> = await spec.execute(spec.parseInput(rawInput));
            return output;
        },
    };
}

/**
 * Guards the cast in `defineTool`: verifies at construction that the object
 * really does have the shape a function tool needs. Cheap, runs once per tool,
 * and turns a silent structural mistake into an immediate, named failure.
 */
function assertsFunctionTool(
    // Structural parameter rather than `AnyToolDefinition`: this function reads
    // exactly these three fields, and asking for the full invariant tool type
    // would reintroduce the assignability problem it exists to check.
    definition: { description?: unknown; inputSchema?: unknown; execute?: unknown },
    name: string,
): void {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name)) {
        throw new Error(
            `Tool ${JSON.stringify(name)}: name must match ^[a-zA-Z0-9_-]{1,64}$.`,
        );
    }

    if (typeof definition.description !== "string" || definition.description === "") {
        throw new Error(`Tool ${name}: description must be a non-empty string.`);
    }

    if (definition.inputSchema == null) {
        throw new Error(`Tool ${name}: inputSchema is required.`);
    }

    if (typeof definition.execute !== "function") {
        throw new Error(`Tool ${name}: execute must be a function.`);
    }
}

/**
 * Builds an AI SDK `ToolSet` from an array of named tools.
 *
 * This is the shape `generateText({ tools })` expects, and the reason the name
 * is carried on `ExecutableTool` rather than inside the definition.
 *
 * @throws {Error} on duplicate names, which a record would silently collapse.
 */
export function toolSet(tools: readonly ExecutableTool[]): ToolSet {
    const set: Record<string, AnyToolDefinition> = Object.create(null);
    for (const entry of tools) {
        if (Object.prototype.hasOwnProperty.call(set, entry.name)) throw new Error(`Duplicate tool name: ${entry.name}`);
        set[entry.name] = entry.definition;
    }
    return set as ToolSet;
}

/**
 * Resolves a tool's input schema to plain JSON Schema.
 *
 * Asynchronous because `Schema.jsonSchema` may be a promise: the SDK allows
 * lazy schemas so that unused validators need not be built at startup.
 */
export async function inputJsonSchema(definition: AnyToolDefinition): Promise<JSONSchema7> {
    return await asSchema(definition.inputSchema).jsonSchema;
}

/** Reads a tool's description, resolving the function form to a string. */
export function describeTool(definition: AnyToolDefinition): string {
    const { description } = definition;
    if (typeof description === "string") return description;
    if (typeof description === "function") {
        // The dynamic form varies per call; this repo's tools all use fixed strings,
        // so an empty context is enough to render one for inspection.
        return (description as (context: unknown) => string)({});
    }
    return "";
}

/** Thrown by `parseInput` when a model sends input that does not match the schema. */
export class ToolInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ToolInputError";
    }
}

/** Type guard for a plain JSON object. */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
