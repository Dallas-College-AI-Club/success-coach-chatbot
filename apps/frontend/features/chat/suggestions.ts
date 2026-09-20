import { isTextUIPart, isToolUIPart, getToolName, type UIMessage } from "ai";
import { TUITION, type StarterQuestion } from "../onboarding/handoff-copy";
import { isRecord, readCourseDetails } from "@/lib/course-details";
import {
  DALLAS_COLLEGE_CALENDAR,
  resolveSemester,
} from "@/lib/tools/academicCalendar";

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Suggestions come from verified course results and questions not yet asked. */
export function conversationSuggestions(
  starters: StarterQuestion[],
  messages: UIMessage[],
  now = new Date(),
): StarterQuestion[] {
  const asked = messages
    .filter((m) => m.role === "user")
    .map((m) =>
      m.parts
        .filter(isTextUIPart)
        .map((p) => p.text)
        .join(" "),
    );
  const used = new Set(asked.map(normalize));
  const outputs = messages.flatMap((m) =>
    m.role === "assistant"
      ? m.parts
          .filter(isToolUIPart)
          .flatMap((p) =>
            p.state === "output-available" &&
            isRecord(p.output) &&
            p.output.found === true &&
            p.output.ambiguous !== true
              ? [{ name: getToolName(p), output: p.output }]
              : [],
          )
      : [],
  );
  const latestPlan = outputs.findLast(
    (p) => p.name === "get_program_requirements",
  );
  const hasPlan = !!latestPlan;
  const courseLookups = new Set(
    outputs
      .filter((p) => p.name === "get_course_info")
      .map((p) => p.output.course_code),
  );
  const scheduled = new Set(
    outputs
      .filter((p) => p.name === "get_class_schedule")
      .map((p) => p.output.course_code),
  );
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "numeric",
    day: "numeric",
    year: "numeric",
  }).formatToParts(now);
  const month = Number(date.find((p) => p.type === "month")?.value);
  const year = Number(date.find((p) => p.type === "year")?.value);
  const day = Number(date.find((p) => p.type === "day")?.value);
  const term = resolveSemester(
    { year, month, day },
    {},
    DALLAS_COLLEGE_CALENDAR,
  ).label;
  // A program switch must not send an invisible question about the old profile.
  const contextualStarters = starters.map((q) =>
    /first-semester/.test(q.prompt) &&
    typeof latestPlan?.output.name === "string"
      ? {
          ...q,
          prompt: `What prerequisites and recommended preparation does the catalog list for the first-semester courses in ${latestPlan.output.name}? Keep required prerequisites separate from recommendations.`,
        }
      : q,
  );
  const candidates = (
    contextualStarters.length ? contextualStarters : [TUITION]
  ).filter((q) => {
    if (used.has(normalize(q.prompt)) || used.has(normalize(q.label)))
      return false;
    if (hasPlan && /published course plan/i.test(q.prompt)) return false;
    if (
      /first-semester/.test(q.prompt) &&
      asked.some(
        (t) =>
          /(?:prerequisite|pre-requisite|preparation)/i.test(t) &&
          /(?:first[ -]semester|semester\s*1|1st[ -]semester)/i.test(t),
      )
    )
      return false;
    // Recognize common typed versions of the resource buttons, too.
    return !["tuition", "tutoring", "financial aid", "housing", "DART"].some(
      (topic) =>
        q.prompt.toLowerCase().includes(topic.toLowerCase()) &&
        asked.some((t) => t.toLowerCase().includes(topic.toLowerCase())),
    );
  });
  const followups: StarterQuestion[] = [];
  for (const result of [...outputs].reverse()) {
    let rawCourses =
      result.name === "get_course_info"
        ? [result.output]
        : result.name === "get_program_requirements" &&
            Array.isArray(result.output.course_details)
          ? result.output.course_details
          : [];
    if (!rawCourses.length) continue;
    if (Array.isArray(result.output.groups)) {
      const order = result.output.groups
        .filter(isRecord)
        .flatMap((g) => (Array.isArray(g.courses) ? g.courses : []));
      rawCourses = [...rawCourses].sort((a, b) => {
        const position = (value: unknown) => {
          const code = readCourseDetails(value)?.course_code;
          const index = order.findIndex(
            (entry) =>
              typeof entry === "string" && entry.startsWith(code ?? "\u0000"),
          );
          return index < 0 ? Infinity : index;
        };
        return position(a) - position(b);
      });
    }
    for (const raw of rawCourses) {
      const course = readCourseDetails(raw);
      if (!course) continue;
      if (!scheduled.has(course.course_code))
        followups.push({
          label: `When does ${course.course_code} meet?`,
          prompt: `Show the saved ${term} schedule for ${course.course_code}: individual sections, dates, days and meeting times, campus, instructor and source links. Distinguish missing times from asynchronous classes.`,
        });
      if (courseLookups.has(course.course_code)) continue;
      if (
        course.requisites_raw &&
        !asked.some((text) =>
          /prerequisite|pre-requisite|preparation/i.test(text),
        )
      )
        followups.push({
          label: `Prerequisites for ${course.course_code}?`,
          prompt: `What required prerequisites and recommended preparation does the catalog list for ${course.course_code}? Keep requirements separate from recommendations.`,
        });
      if (course.description)
        followups.push({
          label: `What will I learn in ${course.course_code}?`,
          prompt: `What does ${course.course_code} cover according to its catalog description?`,
        });
    }
    break;
  }
  const availableFollowups = followups.filter(
    (q) => !used.has(normalize(q.prompt)),
  );
  const seen = new Set<string>();
  return [
    ...availableFollowups.slice(0, 1),
    ...candidates,
    ...availableFollowups.slice(1),
  ]
    .filter((q) => {
      const key = normalize(q.prompt);
      if (used.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}
