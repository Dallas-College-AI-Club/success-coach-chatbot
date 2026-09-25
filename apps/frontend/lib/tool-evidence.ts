import { createHmac, timingSafeEqual } from "node:crypto";
import type { ToolSet, UIMessage } from "ai";
import { isRecord } from "./course-details";

const PROOF = "_majorEvidence";
function signature(
  name: string,
  input: unknown,
  output: unknown,
  key: string,
): string {
  return createHmac("sha256", key)
    .update("major-tool-evidence-v1\n" + JSON.stringify([name, input, output]))
    .digest("hex");
}

export function signOutput(
  name: string,
  input: unknown,
  value: unknown,
  key: string,
): unknown {
  if (!isRecord(value)) return value;
  // Match the JSON representation sent over the wire (undefined is omitted).
  const output: Record<string, unknown> = JSON.parse(JSON.stringify(value));
  delete output[PROOF];
  return { ...output, [PROOF]: signature(name, input, output, key) };
}

export function verifyOutput(
  name: string,
  input: unknown,
  value: unknown,
  key: string,
): boolean {
  if (!isRecord(value) || typeof value[PROOF] !== "string") return false;
  const { [PROOF]: proof, ...output } = value;
  const expected = signature(name, input, output, key);
  return (
    /^[a-f0-9]{64}$/.test(proof) &&
    timingSafeEqual(Buffer.from(proof), Buffer.from(expected))
  );
}

export function signedTools<T extends ToolSet>(tools: T, key: string): T {
  return Object.fromEntries(
    Object.entries(tools).map(([name, definition]) => [
      name,
      {
        ...definition,
        ...(definition.execute
          ? {
              execute: async (
                input: unknown,
                options: Parameters<NonNullable<typeof definition.execute>>[1],
              ) =>
                signOutput(
                  name,
                  input,
                  await definition.execute!(input, options),
                  key,
                ),
            }
          : {}),
      },
    ]),
  ) as T;
}

/** Old/edited browser tool facts never become trusted model context. Keep the
 * student's question and ordinary assistant text; ask the model to re-retrieve. */
export function verifiedHistory(
  messages: UIMessage[],
  key: string,
): UIMessage[] {
  return messages
    .map((message) => ({
      ...message,
      parts: message.parts.filter((part) => {
        if (!part.type.startsWith("tool-")) return true;
        return (
          "state" in part &&
          part.state === "output-available" &&
          "input" in part &&
          "output" in part &&
          verifyOutput(part.type.slice(5), part.input, part.output, key)
        );
      }),
    }))
    .filter((message) => message.parts.length > 0);
}
