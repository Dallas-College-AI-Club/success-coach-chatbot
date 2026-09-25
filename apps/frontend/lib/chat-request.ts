import type { UIMessage } from "ai";
import { isRecord } from "./course-details";

export const MAX_CHAT_BYTES = 4_000_000;
export const MAX_CHAT_MESSAGES = 160;
export const MAX_QUESTION_CHARS = 8000;

export class RequestLimitError extends Error {}

export async function readChatBody(req: Request): Promise<unknown> {
  if (Number(req.headers.get("content-length")) > MAX_CHAT_BYTES)
    throw new RequestLimitError();
  if (!req.body) throw new SyntaxError("Missing body");
  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_CHAT_BYTES) {
        await reader.cancel();
        throw new RequestLimitError();
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally {
    reader.releaseLock();
  }
}

export function allowedChatMessages(
  messages: UIMessage[],
  toolNames: string[],
): boolean {
  return (
    messages.length > 0 &&
    messages.length <= MAX_CHAT_MESSAGES &&
    messages.at(-1)?.role === "user" &&
    messages.every((m) => {
      if (m.role !== "user" && m.role !== "assistant") return false;
      if (!m.parts.length || m.parts.length > 80) return false;
      let length = 0;
      return m.parts.every((part) => {
        if (part.type === "text") {
          length += part.text.length;
          return length <= (m.role === "user" ? MAX_QUESTION_CHARS : 40_000);
        }
        if (m.role !== "assistant") return false;
        if (part.type === "step-start") return true;
        if (
          !part.type.startsWith("tool-") ||
          !toolNames.includes(part.type.slice(5))
        )
          return false;
        return (
          isRecord(part) &&
          "state" in part &&
          [
            "output-available",
            "output-error",
            "input-available",
            "input-streaming",
          ].includes(String(part.state))
        );
      });
    })
  );
}
