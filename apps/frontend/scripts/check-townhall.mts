import assert from "node:assert/strict";
import { test } from "node:test";
import type { UIMessage } from "ai";
import {
  planningStatements,
  readCompletionOverrides,
  currentCourseHistory,
  courseHistoryChanged,
  reportedHistoryFromMessages,
  type CompletionOverrides,
} from "../features/chat/completion-state";
import {
  clearConversation,
  hydrateConversation,
  readConversation,
  saveConversation,
  useConversation,
} from "../features/chat/conversation-store";
import { followUpsFor } from "../features/chat/follow-ups";
import {
  readSheetDraft,
  useSavedCourses,
} from "../features/chat/saved-courses";
import { studentCourseHistory, assessPlan } from "../lib/planning";
import {
  allowedChatMessages,
  readChatBody,
  MAX_CHAT_BYTES,
  RequestLimitError,
} from "../lib/chat-request";
import {
  signOutput,
  verifyOutput,
  verifiedHistory,
} from "../lib/tool-evidence";
import { requestBuckets } from "../lib/chat-rate-limit";
import { scheduleResultForModel } from "../lib/course-details";
import { cardOnlyReply } from "../features/chat/reply-presentation";

const user = (
  text: string,
  completionOverrides?: CompletionOverrides,
): UIMessage => ({
  id: text,
  role: "user",
  parts: [{ type: "text", text }],
  metadata: { completionOverrides },
});
const plan = {
  name: "Python Developer Certificate",
  found: true,
  total_credits: 6,
  groups: [
    {
      name: "Semester 1",
      slot_kind: "fixed",
      courses: ["ITSE 1370", "MATH 1314"],
    },
  ],
  course_details: ["ITSE 1370", "MATH 1314"].map((course_code) => ({
    course_code,
    title: "Example",
    credit_hours: 3,
    description: null,
    requisites_raw: null,
    campus_locations: null,
    catalog_year: "2026-2027",
  })),
};

const schedule = {
  found: true,
  course_code: "ITSC 1364",
  offerings: [{ section_number: "1", meets: [], term: "Fall 2026" }],
};
const reply = (name: string, output: unknown): UIMessage => ({
  id: "reply",
  role: "assistant",
  parts: [
    {
      type: `tool-${name}`,
      toolCallId: "lookup",
      state: "output-available",
      input: {},
      output,
    },
    { type: "text", text: "A redundant recap." },
  ],
});

test("routine schedule and program lookups use the complete cards without a second recap", () => {
  for (const question of [
    "When does ITSC 1364 meet this Fall?",
    "Show Fall 2026 sections for ITSC 1364.",
    "View schedule",
  ]) {
    assert.equal(
      cardOnlyReply(reply("get_class_schedule", schedule), question),
      "schedule",
    );
  }
  for (const question of [
    "Show the full Python Developer Certificate course plan.",
    "Which courses are in semester 1 of Python Developer Certificate?",
    "Which classes would I start with?",
  ]) {
    assert.equal(
      cardOnlyReply(reply("get_program_requirements", plan), question),
      "plan",
    );
  }
});

test("schedule fit, filters, prerequisites, recommendations and mixed questions retain their answer", () => {
  for (const question of [
    "Will ITSC 1364 fit around my work schedule?",
    "Which sections are online?",
    "Are any sections in the evening?",
    "Show ITSC 1364 sections and explain how to enroll.",
    "Show sections for ITSC 1364 and MATH 1342.",
    "Show ITSC 1364 and what does it cost?",
    "Muéstrame las clases en línea.",
  ]) {
    assert.equal(
      cardOnlyReply(reply("get_class_schedule", schedule), question),
      null,
    );
  }
  for (const question of [
    "What should I take this semester?",
    "What are the prerequisites for Python Developer Certificate?",
    "Compare Python Developer Certificate and another program.",
    "What courses remain after my updated course history?",
    "What would I study in Python Developer Certificate?",
  ]) {
    assert.equal(
      cardOnlyReply(reply("get_program_requirements", plan), question),
      null,
    );
  }
});

test("failed, partial, ambiguous and mixed-result lookups never hide clarifications", () => {
  const question = "Show ITSC 1364 sections";
  for (const output of [
    { found: false, offerings: [] },
    { ...schedule, ambiguous: true },
    { ...schedule, unavailable: true },
    { ...schedule, offerings: [] },
  ]) {
    assert.equal(
      cardOnlyReply(reply("get_class_schedule", output), question),
      null,
    );
  }
  const mixed = reply("get_class_schedule", schedule);
  mixed.parts.push(
    ...reply("search_knowledge", {
      found: true,
      results: [{ doc_type: "resource", text: "Contact details" }],
    }).parts,
  );
  assert.equal(cardOnlyReply(mixed, question), null);
  const pending = reply("get_class_schedule", schedule);
  pending.parts.push({
    type: "tool-get_course_info",
    toolCallId: "pending",
    state: "input-available",
    input: {},
  });
  assert.equal(cardOnlyReply(pending, question), null);
  assert.equal(
    cardOnlyReply(reply("get_program_requirements", plan), "Show semester 8"),
    null,
  );
  assert.equal(cardOnlyReply(user(question), question), null);
});

test("discovery and calendar tools do not bring back a routine recap or alter stored history", () => {
  const message = reply("get_class_schedule", schedule);
  message.parts.unshift(...reply("get_semester", { found: true }).parts);
  message.parts.unshift(
    ...reply("search_knowledge", {
      found: true,
      results: [{ doc_type: "course" }],
    }).parts,
  );
  const before = JSON.stringify(message);
  assert.equal(cardOnlyReply(message, "When does ITSC 1364 meet?"), "schedule");
  assert.equal(JSON.stringify(message), before);
});

test("schedule timing counts keep unknown sections separate from non-matches", () => {
  const result = scheduleResultForModel({
    offerings: [
      { modality: "in_person", meets: ["Mon 09:00 AM–10:00 AM"] },
      ...Array.from({ length: 8 }, () => ({ modality: "online", meets: [] })),
    ],
  }) as { loaded_section_counts: unknown };
  assert.deepEqual(result.loaded_section_counts, {
    scope: "loaded_page",
    total: 9,
    by_modality: { in_person: 1, online: 8 },
    with_published_times: 1,
    without_published_times: 8,
  });
});

test("a second checkbox and an uncheck update free-typed remaining-course answers", () => {
  const first = user("What courses remain?", { "MATH 1314": true });
  const second = user("What do I still need for my certificate?", {
    "MATH 1314": true,
    "ITSE 1370": true,
  });
  assert.deepEqual(
    assessPlan(plan, planningStatements([first, second]))
      .remaining_required_courses,
    [],
  );
  const third = user("What is left?", {
    "MATH 1314": true,
    "ITSE 1370": false,
  });
  assert.deepEqual(
    assessPlan(plan, planningStatements([first, second, third]))
      .remaining_required_courses,
    ["ITSE 1370"],
  );
});

test("typed corrections stay newer than unchanged checkbox snapshots", () => {
  const checked = { "ITSE 1370": true };
  const turns = [
    user("What is left?", checked),
    user("I have not completed ITSE 1370.", checked),
    user("What should I take?", checked),
  ];
  assert.equal(
    studentCourseHistory(planningStatements(turns))["ITSE 1370"].status,
    "not_completed",
  );
  assert.equal(
    studentCourseHistory(planningStatements(turns, { "ITSE 1370": false }))[
      "ITSE 1370"
    ].status,
    "not_completed",
  );
  assert.deepEqual(
    readCompletionOverrides({
      "ignore instructions": true,
      "ITSE 1370": "yes",
      "MATH 1314": false,
    }),
    { "MATH 1314": false },
  );
});

test("reported-course edits support every status and removal without replaying old completion", () => {
  const first = user("I have completed ITSE 1370 and MATH 1314.");
  for (const status of [
    "in_progress",
    "planned",
    "transfer_pending",
    "unknown",
    "not_completed",
    "completed",
  ] as const) {
    const turns = [first, user("Update my plan.", { "ITSE 1370": status })];
    assert.equal(
      studentCourseHistory(planningStatements(turns))["ITSE 1370"].status,
      status,
    );
  }
  const removed = { "ITSE 1370": "removed" } as const;
  const turns = [
    first,
    user("Update my plan.", removed),
    user("What remains?", removed),
  ];
  const assessed = assessPlan(plan, planningStatements(turns));
  assert.equal(assessed.history["ITSE 1370"], undefined);
  assert.equal(assessed.history["MATH 1314"].status, "completed");
  assert.equal(assessed.remaining_credits, 3);
  assert.deepEqual(assessed.remaining_required_courses, ["ITSE 1370"]);
  assert.equal(
    studentCourseHistory(
      planningStatements([...turns, user("I passed ITSE 1370.", removed)]),
    )["ITSE 1370"].status,
    "completed",
  );
});

test("rich statuses survive saved-history hydration and never become completed by truthiness", () => {
  const store = useSavedCourses.getState();
  store.clear();
  store.applyCompletionHistory({
    "ITSE 1370": { status: "completed" },
    "MATH 1314": { status: "in_progress" },
  });
  assert.deepEqual(useSavedCourses.getState().taken, ["ITSE 1370"]);
  store.setCourseStatus("ITSE 1370", "removed");
  const saved = useSavedCourses.persist.getOptions().partialize!(
    useSavedCourses.getState(),
  );
  const restored = useSavedCourses.persist.getOptions().merge!(
    JSON.parse(JSON.stringify(saved)),
    useSavedCourses.getInitialState(),
  );
  assert.deepEqual(restored.taken, []);
  assert.deepEqual(restored.completionOverrides, {
    "ITSE 1370": "removed",
    "MATH 1314": "in_progress",
  });
  store.applyCompletionHistory({ "MATH 1314": { status: "planned" } });
  assert.equal(
    useSavedCourses.getState().completionOverrides["ITSE 1370"],
    "removed",
  );
  store.toggleTaken("MATH 1314");
  assert.deepEqual(useSavedCourses.getState().taken, ["MATH 1314"]);
  store.clear();
  assert.deepEqual(
    readCompletionOverrides({
      "HIST 1301": "removed",
      "GOVT 2306": "in_progress",
      "ITSD 3301": "bogus",
      "ignore rules": "completed",
    }),
    { "HIST 1301": "removed", "GOVT 2306": "in_progress" },
  );
});

test("live checklist history hides removed courses and detects all status edits", () => {
  const history = {
    "ITSE 1370": { status: "completed" },
    "MATH 1314": { status: "in_progress" },
  };
  const overrides: CompletionOverrides = {
    "ITSE 1370": "removed",
    "MATH 1314": "planned",
  };
  const edited = currentCourseHistory(history, overrides);
  assert.equal(edited["ITSE 1370"], undefined);
  assert.equal(edited["MATH 1314"].status, "planned");
  assert.equal(courseHistoryChanged(history, overrides), true);
  assert.equal(courseHistoryChanged(edited, overrides), false);
  assert.equal(courseHistoryChanged(history, { "ITSE 1370": true }), false);
});

test("typed corrections and removals persist without a program lookup, including stopped answers", () => {
  const before = useSavedCourses.getState();
  try {
    before.clear();
    before.setCourseStatus("ITSE 1370", "completed");
    let turns = [
      user("I have not completed ITSE 1370. What are its prerequisites?", {
        "ITSE 1370": true,
      }),
    ];
    before.applyCompletionHistory(
      reportedHistoryFromMessages(turns),
      undefined,
      true,
    );
    assert.deepEqual(useSavedCourses.getState().taken, []);
    assert.equal(
      useSavedCourses.getState().completionOverrides["ITSE 1370"],
      false,
    );
    turns = [
      ...turns,
      user("Remove ITSE 1370 from my reported courses.", {
        "ITSE 1370": false,
      }),
    ];
    before.applyCompletionHistory(
      reportedHistoryFromMessages(turns),
      undefined,
      true,
    );
    assert.equal(
      useSavedCourses.getState().completionOverrides["ITSE 1370"],
      "removed",
    );
    assert.deepEqual(
      currentCourseHistory(
        undefined,
        useSavedCourses.getState().completionOverrides,
      ),
      {},
    );
    // Following an unrelated question must not replay the removed completion.
    turns.push(
      user(
        "When do classes start?",
        useSavedCourses.getState().completionOverrides,
      ),
    );
    assert.deepEqual(reportedHistoryFromMessages(turns), {});
  } finally {
    useSavedCourses.setState(before);
  }
});

test("late course responses preserve edits and a cleared sheet", () => {
  const before = useSavedCourses.getState();
  try {
    before.clear();
    before.setCourseStatus("ITSE 1370", "completed");
    const submitted = useSavedCourses.getState().completionOverrides;
    before.setCourseStatus("ITSE 1370", "removed");
    before.applyCompletionHistory(
      { "ITSE 1370": { status: "completed" } },
      submitted,
    );
    assert.equal(
      useSavedCourses.getState().completionOverrides["ITSE 1370"],
      "removed",
    );
    before.clear();
    before.applyCompletionHistory(
      { "ITSE 1370": { status: "completed" } },
      submitted,
    );
    assert.deepEqual(useSavedCourses.getState().completionOverrides, {});
  } finally {
    useSavedCourses.setState(before);
  }
});

test("course titles resolve in saved history once their catalog cards arrive", () => {
  const turns: UIMessage[] = [
    user("I completed Introduction to Python Programming."),
    {
      id: "lookup",
      role: "assistant",
      parts: [
        {
          type: "tool-get_course_info",
          toolCallId: "course",
          state: "output-available",
          input: {},
          output: {
            course_code: "ITSE 1370",
            title: "Introduction to Python Programming",
          },
        },
      ],
    },
  ];
  assert.equal(
    reportedHistoryFromMessages(turns)["ITSE 1370"].status,
    "completed",
  );
  // A retry includes the newest edits even though its user message is reused.
  assert.equal(
    reportedHistoryFromMessages(
      [user("Show my plan.", { "ITSE 1370": true })],
      { "ITSE 1370": false },
    )["ITSE 1370"].status,
    "not_completed",
  );
});

test("negative enrollment and plan corrections never become positive course statuses", () => {
  for (const correction of [
    "I am no longer taking ITSE 1370.",
    "I'm not currently enrolled in ITSE 1370.",
    "I don't plan to take ITSE 1370.",
    "ITSE 1370 is not in progress.",
  ]) {
    const history = studentCourseHistory([
      "I am taking ITSE 1370.",
      correction,
    ]);
    assert.equal(history["ITSE 1370"].status, "not_completed", correction);
  }
  assert.equal(
    studentCourseHistory([
      "Should I remove ITSE 1370 from my reported courses?",
    ])["ITSE 1370"],
    undefined,
  );
});

test("removing a saved question also removes its coach selection", () => {
  const before = useSavedCourses.getState();
  try {
    before.clear();
    before.addQuestion(
      "What are the requirements for the Python Developer Certificate?",
    );
    const question = useSavedCourses.getState().questions[0];
    assert.ok(question);
    before.updateDraft({ toAsk: [question], notes: ["Keep this note"] });
    before.removeQuestion(0);
    before.addQuestion(question);
    assert.deepEqual(useSavedCourses.getState().draft.toAsk, []);
    assert.deepEqual(useSavedCourses.getState().draft.notes, [
      "Keep this note",
    ]);
  } finally {
    useSavedCourses.setState(before);
  }
});

test("a changed same-size course set and later uncheck keep an update action", () => {
  const context = {
    program: "Accounting",
    started: true,
    starters: [],
    askedLabels: ["Update my remaining courses"],
    taken: ["ITSE 1370"],
    completionOverrides: { "ITSE 1370": true, "MATH 1314": false },
    tools: [
      {
        name: "get_program_requirements",
        output: {
          ...plan,
          planning: {
            history: { "MATH 1314": { status: "completed" } },
            remaining_required_courses: ["ITSE 1370"],
          },
        },
      },
    ],
  };
  const chips = followUpsFor(context);
  const unchanged = followUpsFor({
    ...context,
    tools: [
      {
        name: "get_class_schedule",
        output: { found: true, course_code: "ITSE 1370", offerings: [] },
      },
    ],
    latestPlan: {
      ...plan,
      planning: {
        history: {
          "ITSE 1370": { status: "completed" },
          "MATH 1314": { status: "not_completed" },
        },
      },
    },
  });
  assert.ok(
    !unchanged.some((chip) => chip.label === "Update my remaining courses"),
  );
  assert.equal(chips[0].label, "Update my remaining courses");
  assert.ok(chips[0].prompt.includes(plan.name));
  assert.ok(!chips[0].prompt.includes("Accounting"));
  assert.equal(
    followUpsFor({
      ...context,
      taken: [],
      completionOverrides: { "MATH 1314": false },
    })[0].label,
    "Update my remaining courses",
  );
});

test("conversation restore preserves messages, input and retry state only for its onboarding", async () => {
  const messages = [
    user("Explain ITSE 1370", { "ITSE 1370": true }),
    {
      id: "answer",
      role: "assistant",
      parts: [{ type: "text", text: "Catalog answer" }],
    },
  ];
  const raw = JSON.stringify({
    key: "onboarding-a",
    messages,
    input: "next question",
    askedLabels: ["test"],
    interrupted: true,
  });
  const restored = await readConversation(raw, "onboarding-a");
  assert.deepEqual(restored?.messages, messages);
  assert.equal(restored?.input, "next question");
  assert.equal(restored?.interrupted, true);
  assert.equal(await readConversation(raw, "onboarding-b"), null);
  for (const raw of [
    "{",
    JSON.stringify({
      key: "onboarding-a",
      messages: [{ role: "system", parts: [] }],
    }),
  ])
    assert.equal(await readConversation(raw, "onboarding-a"), null);
});

test("clearing chat defeats pending hydration and preserves saved notes", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "sessionStorage",
  );
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  const savedBefore = useSavedCourses.getState();
  try {
    clearConversation();
    saveConversation({
      key: "onboarding-a",
      messages: [user("Old question")],
      input: "Unfinished question",
      askedLabels: ["Previous suggestion"],
      interrupted: true,
    });
    const pending = hydrateConversation("onboarding-a");
    clearConversation("onboarding-a");
    await pending;
    assert.deepEqual(useConversation.getState(), {
      readyFor: "onboarding-a",
      draft: null,
    });
    assert.equal(storage.size, 0);
    assert.equal(useSavedCourses.getState(), savedBefore);
    // A later navigation/refresh also cannot restore the old messages.
    clearConversation();
    await hydrateConversation("onboarding-a");
    assert.equal(useConversation.getState().draft, null);
  } finally {
    clearConversation();
    if (descriptor)
      Object.defineProperty(globalThis, "sessionStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});

test("saved sheet edits survive store serialization and clear with saved data", () => {
  const store = useSavedCourses.getState();
  store.updateDraft({
    name: "Student",
    notes: ["A long note\nwith another line"],
    toAsk: ["Question"],
    hiddenAnswers: ["Answer"],
    edited: true,
  });
  const persisted = JSON.parse(
    JSON.stringify(
      useSavedCourses.persist.getOptions().partialize!(
        useSavedCourses.getState(),
      ),
    ),
  );
  const restored = useSavedCourses.persist.getOptions().merge!(
    persisted,
    useSavedCourses.getInitialState(),
  );
  assert.deepEqual(restored.draft, useSavedCourses.getState().draft);
  assert.equal(
    readSheetDraft({ name: 123, notes: [null, "keep"] }).notes[0],
    "keep",
  );
  store.clear();
  assert.deepEqual(useSavedCourses.getState().draft.notes, []);
});

test("bounded request parsing rejects oversized streams even without Content-Length", async () => {
  const request = new Request("http://localhost/api/chat", {
    method: "POST",
    body: '"' + "x".repeat(MAX_CHAT_BYTES) + '"',
  });
  await assert.rejects(readChatBody(request), RequestLimitError);
  assert.deepEqual(
    await readChatBody(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: '{"messages":[]}',
      }),
    ),
    { messages: [] },
  );
  assert.equal(allowedChatMessages([user("x".repeat(8001))], []), false);
  assert.equal(allowedChatMessages([user("hello")], []), true);
  assert.equal(
    allowedChatMessages(
      [
        {
          id: "u",
          role: "user",
          parts: [
            {
              type: "file",
              mediaType: "image/png",
              url: "http://internal.invalid",
            },
          ],
        },
      ],
      [],
    ),
    false,
  );
});

test("modified, unsigned and wrong-tool evidence is excluded from model history", () => {
  const input = { programName: "Python Developer Certificate" };
  const output = signOutput(
    "get_program_requirements",
    input,
    plan,
    "test-only-key",
  );
  assert.ok(
    verifyOutput("get_program_requirements", input, output, "test-only-key"),
  );
  assert.ok(
    !verifyOutput(
      "get_program_requirements",
      input,
      { ...(output as object), total_credits: 0 },
      "test-only-key",
    ),
  );
  assert.ok(!verifyOutput("get_course_info", input, output, "test-only-key"));
  const message = {
    id: "result",
    role: "assistant",
    parts: [
      {
        type: "tool-get_program_requirements",
        toolCallId: "call",
        state: "output-available",
        input,
        output,
      },
    ],
  } as UIMessage;
  assert.equal(verifiedHistory([message], "test-only-key").length, 1);
  assert.equal(verifiedHistory([message], "different-key").length, 0);
  assert.equal(
    verifiedHistory(
      [
        {
          ...message,
          parts: [{ ...message.parts[0], output: plan }],
        } as UIMessage,
      ],
      "test-only-key",
    ).length,
    0,
  );
});

test("network limits share a global budget and roll over without storing IPs", () => {
  const first = requestBuckets("hash-a", 300_001),
    second = requestBuckets("hash-b", 300_001);
  assert.notEqual(first[0].key, second[0].key);
  assert.deepEqual(first.slice(1), second.slice(1));
  assert.notEqual(first[0].key, requestBuckets("hash-a", 600_001)[0].key);
});
