import type { UIMessage } from "ai";
import { isRecord, isCourseCode } from "@/lib/course-details";

export type CompletionOverrides = Record<string, boolean>;

export function readCompletionOverrides(value: unknown): CompletionOverrides {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        (entry): entry is [string, boolean] =>
          isCourseCode(entry[0]) && typeof entry[1] === "boolean",
      )
      .slice(0, 200),
  );
}

/** Replay checkbox CHANGES before their user turn, so later typed corrections
 * keep precedence. Reapplying every checked code on every turn would silently
 * undo a student's later "I haven't passed that course" correction. */
export function planningStatements(
  messages: UIMessage[],
  current?: CompletionOverrides,
): string[] {
  const users = messages.filter((m) => m.role === "user");
  let previous: CompletionOverrides = {};
  return users.flatMap((message, index) => {
    const stored = isRecord(message.metadata)
      ? message.metadata.completionOverrides
      : undefined;
    const next =
      index === users.length - 1 && current !== undefined
        ? current
        : stored === undefined
          ? previous
          : readCompletionOverrides(stored);
    const changes = Object.entries(next).flatMap(([code, completed]) =>
      previous[code] === completed
        ? []
        : [
            completed
              ? `I have completed ${code}.`
              : `I have not completed ${code}.`,
          ],
    );
    previous = next;
    const text = message.parts
      .flatMap((p) => (p.type === "text" ? [p.text] : []))
      .join(" ");
    return [...changes, text];
  });
}
