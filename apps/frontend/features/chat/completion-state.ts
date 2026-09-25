import type { UIMessage } from "ai";
import {
  isRecord,
  isCourseCode,
  readCourseDetails,
} from "@/lib/course-details";
import {
  readCourseHistory,
  studentCourseHistory,
  type CourseHistory,
  type CourseStatus,
} from "@/lib/planning";

// Booleans remain readable for existing saved checkboxes; richer edits and a
// removal tombstone prevent earlier chat statements from restoring a removed row.
export type CompletionChoice = boolean | CourseStatus | "removed";
export type CompletionOverrides = Record<string, CompletionChoice>;
export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  completed: "Completed",
  in_progress: "In progress",
  not_completed: "Not completed",
  planned: "Planned",
  transfer_pending: "Awaiting transfer review",
  unknown: "Not sure",
};
export function completionStatus(
  value: CompletionChoice,
): CourseStatus | "removed" {
  return value === true
    ? "completed"
    : value === false
      ? "not_completed"
      : value;
}

export function readCompletionOverrides(value: unknown): CompletionOverrides {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        (entry): entry is [string, CompletionChoice] =>
          isCourseCode(entry[0]) &&
          (typeof entry[1] === "boolean" ||
            entry[1] === "removed" ||
            (typeof entry[1] === "string" &&
              Object.hasOwn(COURSE_STATUS_LABELS, entry[1]))),
      )
      .slice(0, 200),
  );
}

export function currentCourseHistory(
  raw: unknown,
  overrides: CompletionOverrides,
): CourseHistory {
  const history = readCourseHistory(raw);
  for (const [code, value] of Object.entries(overrides)) {
    const status = completionStatus(value);
    if (status === "removed") delete history[code];
    else history[code] = { status, statement: "Edited in reported courses" };
  }
  return history;
}

export function courseHistoryChanged(
  raw: unknown,
  overrides: CompletionOverrides,
): boolean {
  const before = readCourseHistory(raw);
  const after = currentCourseHistory(raw, overrides);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].some(
    (code) => before[code]?.status !== after[code]?.status,
  );
}

function completionStatement(code: string, value: CompletionChoice): string {
  switch (completionStatus(value)) {
    case "removed":
      return `Forget my course history for ${code}.`;
    case "completed":
      return `I have completed ${code}.`;
    case "not_completed":
      return `I have not completed ${code}.`;
    case "in_progress":
      return `I am taking ${code}.`;
    case "planned":
      return `I plan to take ${code}.`;
    case "transfer_pending":
      return `Transfer credit for ${code} is pending review.`;
    case "unknown":
      return `I am unsure whether I completed ${code}.`;
  }
}

/** Retrying repeats an earlier question, but edits made since that question
 * are newer. Preserve them after its text without changing the visible bubble. */
export function messagesForRetry(
  messages: UIMessage[],
  current: CompletionOverrides,
): UIMessage[] {
  const lastUser = messages.findLastIndex((message) => message.role === "user");
  return messages.map((message, index) =>
    index === lastUser
      ? {
          ...message,
          metadata: {
            ...(isRecord(message.metadata) ? message.metadata : {}),
            completionAfterMessage: readCompletionOverrides(current),
          },
        }
      : message,
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
    const changes = Object.entries(next).flatMap(([code, choice]) =>
      previous[code] !== undefined &&
      completionStatus(previous[code]) === completionStatus(choice)
        ? []
        : [completionStatement(code, choice)],
    );
    const after = readCompletionOverrides(
      isRecord(message.metadata)
        ? message.metadata.completionAfterMessage
        : undefined,
    );
    previous = { ...next, ...after };
    const text = message.parts
      .flatMap((p) => (p.type === "text" ? [p.text] : []))
      .join(" ");
    return [
      ...changes,
      text,
      ...Object.entries(after).map(([code, choice]) =>
        completionStatement(code, choice),
      ),
    ];
  });
}

/** Save the student's statements even when the answer has no planning tool,
 * fails, or is stopped. Catalog titles can resolve once a lookup returns. */
export function reportedHistoryFromMessages(
  messages: UIMessage[],
  current?: CompletionOverrides,
): CourseHistory {
  const outputs = messages
    .filter((message) => message.role === "assistant")
    .flatMap((message) => message.parts)
    .flatMap((part) =>
      "output" in part && isRecord(part.output) ? [part.output] : [],
    );
  const courses = outputs.flatMap((output) =>
    [
      output,
      ...(Array.isArray(output.course_details) ? output.course_details : []),
    ].flatMap((raw) => {
      const course = readCourseDetails(raw);
      return course ? [course] : [];
    }),
  );
  return studentCourseHistory(planningStatements(messages, current), courses);
}
