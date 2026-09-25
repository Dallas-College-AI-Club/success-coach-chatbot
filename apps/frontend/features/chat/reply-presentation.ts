import { getToolName, isToolUIPart, type UIMessage } from "ai";
import {
  isRecord,
  requestedSemesters,
  scopeProgramGroups,
} from "@/lib/course-details";

const words = (text: string) =>
  (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).join(" ");

const LOOKUP_WORDS = {
  schedule: new Set(
    "please show list view display find look up check me the a an saved published class classes course courses schedule schedules section sections for of in this next current upcoming fall spring summer winter term semester all every when does do it they meet meets meetings meeting days dates times and".split(
      " ",
    ),
  ),
  plan: new Set(
    "please show list view display find look up check me the a an full entire complete published actual course courses class classes elective electives choice choices option options including plan plans checklist requirements curriculum map for of in my this that program degree certificate all every what which are is do i need required semester semesters first second third fourth fifth sixth seventh eighth only starting start with would and".split(
      " ",
    ),
  ),
};

/** Omit only a routine lookup recap whose answer is already fully represented
 * by successful cards. Unknown wording, mixed requests and failed lookups keep
 * their prose. Match the student's displayed question, never chip instructions.
 * This changes presentation only: original messages remain available to follow-ups.
 */
export function cardOnlyReply(
  message: UIMessage,
  question: string,
): "schedule" | "plan" | null {
  if (message.role !== "assistant") return null;
  const tools = message.parts.filter(isToolUIPart);
  if (!tools.length) return null;
  let kind: "schedule" | "plan" | null = null;
  const records: Record<string, unknown>[] = [];
  for (const part of tools) {
    if (part.state !== "output-available" || !isRecord(part.output))
      return null;
    const name = getToolName(part);
    const output = part.output;
    if (name === "get_current_date" || name === "get_semester") {
      if (output.found === false || output.unavailable) return null;
      continue;
    }
    if (output.found !== true || output.ambiguous || output.unavailable)
      return null;
    if (name === "search_knowledge") {
      if (
        !Array.isArray(output.results) ||
        !output.results.length ||
        !output.results.every(
          (r) =>
            isRecord(r) &&
            ["course", "program_map"].includes(String(r.doc_type)),
        )
      )
        return null;
      continue;
    }
    const next =
      name === "get_class_schedule"
        ? "schedule"
        : name === "get_program_requirements"
          ? "plan"
          : null;
    if (!next || (kind && kind !== next)) return null;
    if (next === "schedule") {
      if (!Array.isArray(output.offerings) || !output.offerings.some(isRecord))
        return null;
    } else {
      if (
        !Array.isArray(output.groups) ||
        !scopeProgramGroups(output.groups, requestedSemesters(question)).some(
          (g) => isRecord(g) && Array.isArray(g.courses) && g.courses.length,
        ) ||
        (isRecord(output.planning) &&
          output.planning.needs_history_clarification)
      )
        return null;
    }
    kind = next;
    records.push(output);
  }
  if (!kind) return null;
  let remainder = ` ${words(question)} `;
  for (const record of records) {
    for (const field of ["course_code", "title", "name"]) {
      if (typeof record[field] !== "string" || !record[field].trim()) continue;
      remainder = remainder.replaceAll(` ${words(record[field])} `, " ");
    }
  }
  // Years and numbered curriculum semesters are lookup scope, not a request
  // for advice. Other numbers (work hours, budgets, etc.) retain the answer.
  remainder = remainder.replace(/\b(?:19|20)\d{2}\b/g, " ");
  if (kind === "plan") remainder = remainder.replace(/\b\d{1,2}\b/g, " ");
  const tokens = remainder.trim().split(/\s+/);
  const topic =
    kind === "schedule"
      ? /\b(?:schedule|sections?|when|meet|meets|meetings?|days|dates|times)\b/
      : /\b(?:plan|checklist|requirements|curriculum|courses?|classes|electives?|semester|start)\b/;
  return topic.test(remainder) &&
    tokens.every((token) => LOOKUP_WORDS[kind].has(token))
    ? kind
    : null;
}
