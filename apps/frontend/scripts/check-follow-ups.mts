/**
 * Guard for the evolving follow-up chips (features/chat/follow-ups.ts) and the
 * course history they compose.
 *
 * The dangerous failures are silent: a chip whose prompt lib/planning.ts does
 * not parse marks nothing completed, and a repeated or over-long label breaks
 * the guided path the demo walks. Both are checked here.
 *
 * Pure — no database, no network, no model calls.
 *
 * Run: npx tsx --test scripts/check-follow-ups.mts
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  followUpsFor,
  joinList,
  takenPrompt,
  INTEREST_TOPICS,
} from "../features/chat/follow-ups";
import { assessPlan, studentCourseHistory } from "../lib/planning";
import { starterQuestionsFor } from "../features/onboarding/handoff-copy";
import type { OnboardingPayload } from "../features/onboarding/types";
import { requestedSemesters } from "../lib/course-details";

const PROGRAM = "Bachelor of Applied Technology in Software Development";

const payload: OnboardingPayload = {
  goal: "first_semester_plan",
  major: "3381",
  target_institution: null,
  modality_pref: null,
  dayparts_pref: null,
  student_type: null,
  transfer_direction: null,
  interest_area: null,
  oneoff_purpose: null,
  intl_status: null,
  skippedSteps: [],
  onboardingVersion: "test",
  completedAt: "2026-09-22T00:00:00.000Z",
};

const starters = starterQuestionsFor(payload);

const planOutput = (extra: Record<string, unknown> = {}) => ({
  found: true,
  name: PROGRAM,
  total_credits: 120,
  groups: [
    {
      name: "Semester 1",
      slot_kind: "fixed",
      credits_required: 15,
      courses: ["ITSE 1303", "ITSE 1329", "ENGL 1301", "MATH 1314"],
    },
    { name: "Semester 2", slot_kind: "fixed", courses: ["ITSE 2321"] },
  ],
  ...extra,
});

const base = {
  program: PROGRAM,
  starters,
  tools: [] as { name: string; output: unknown }[],
  started: true,
  taken: [] as string[],
  askedLabels: [] as string[],
};

test("the opening keeps the onboarding starters, unchanged", () => {
  assert.deepEqual(
    followUpsFor({ ...base, started: false }),
    starters.slice(0, 3),
  );
  // Still the starters even if a stale tool result is passed in.
  assert.deepEqual(
    followUpsFor({
      ...base,
      started: false,
      tools: [{ name: "get_program_requirements", output: planOutput() }],
    }),
    starters.slice(0, 3),
  );
});

test("a program plan offers prerequisites, this Fall's meetings and the full plan", () => {
  const chips = followUpsFor({
    ...base,
    tools: [
      {
        name: "get_program_requirements",
        output: planOutput({ requested_semesters: [1] }),
      },
    ],
  });
  const labels = chips.map((c) => c.label);
  assert.deepEqual(labels, [
    "What do I need before starting?",
    "When do these classes meet this Fall?",
    "Show the full plan",
  ]);
  // Every prompt is a complete sentence naming the program.
  for (const chip of chips) {
    assert.ok(chip.prompt.includes(PROGRAM), chip.label);
    assert.ok(chip.prompt.trim().endsWith("."), chip.label);
  }
  // The scoped courses, not a whole eight-semester degree, reach the schedule.
  const meets = chips.find((c) => c.label.startsWith("When do"))!;
  assert.ok(meets.prompt.includes("ITSE 1303"));
  assert.ok(!meets.prompt.includes("ITSE 2321"));
  // The full-plan chip must not re-scope itself to one semester.
  assert.deepEqual(
    requestedSemesters(chips.find((c) => c.label === "Show the full plan")!.prompt),
    [],
  );
  // An unscoped plan has no full-plan escape hatch to offer.
  assert.ok(
    !followUpsFor({
      ...base,
      tools: [{ name: "get_program_requirements", output: planOutput() }],
    })
      .map((c) => c.label)
      .includes("Show the full plan"),
  );
});

test("ticking courses offers the what's-left chip, and planning.ts reads every code", () => {
  const taken = ["ENGL 1301", "MATH 1314", "ITSE 1303"];
  const chips = followUpsFor({
    ...base,
    taken,
    tools: [
      {
        name: "get_program_requirements",
        output: planOutput({ requested_semesters: [1] }),
      },
    ],
  });
  assert.equal(chips[0].label, "I've taken these, what's left?");
  const prompt = chips[0].prompt;
  assert.equal(prompt, takenPrompt(PROGRAM, taken));
  assert.ok(prompt.includes("ENGL 1301, MATH 1314 and ITSE 1303"));

  // Both words are load-bearing: requestedToolChoice in lib/tools/registry.ts
  // forces a fresh get_program_requirements only when a completion word AND a
  // remaining-work word are present. Without them the model answered from the
  // older semester-scoped result already in the transcript (observed live).
  // Asserted as text so this guard stays free of server-only imports.
  assert.ok(/\bcompleted\b/.test(prompt), prompt);
  assert.ok(/\b(?:remaining|left)\b/.test(prompt), prompt);
  // ...and the answer covers the whole degree, not one semester again.
  assert.deepEqual(requestedSemesters(prompt), []);

  // The composed sentence MUST parse as completed history, or the checklist
  // silently keeps courses the student already finished.
  const history = studentCourseHistory([prompt]);
  for (const code of taken) {
    assert.equal(history[code]?.status, "completed", code);
  }
  // No course is left half-parsed: a clarification demand here would make the
  // coach open by asking the student to re-type what they just ticked.
  assert.ok(
    !assessPlan(
      {
        groups: planOutput().groups,
        course_details: [],
        requested_semesters: undefined,
      },
      [prompt],
    ).needs_history_clarification,
  );

  // A single course still reads as completed, with no stray comma or "and".
  const one = takenPrompt(PROGRAM, ["ENGL 1301"]);
  assert.ok(one.startsWith("I have completed ENGL 1301. "));
  assert.equal(studentCourseHistory([one])["ENGL 1301"]?.status, "completed");
  // Two courses join with "and" only.
  assert.equal(joinList(["A", "B"]), "A and B");
  assert.equal(joinList(["A"]), "A");
  assert.equal(joinList([]), "");
});

test("a checklist with reported history moves on to this semester and professors", () => {
  const chips = followUpsFor({
    ...base,
    taken: ["ENGL 1301"],
    tools: [
      {
        name: "get_program_requirements",
        output: planOutput({
          planning: {
            history: { "ENGL 1301": { status: "completed", statement: "" } },
            remaining_required_courses: ["ITSE 1303", "MATH 1314"],
          },
        }),
      },
    ],
  });
  assert.deepEqual(chips.map((c) => c.label), [
    "What should I take this semester?",
    "Who teaches ITSE 1303?",
    `Who has ${INTEREST_TOPICS[0]} experience?`,
  ]);
  // An empty history is still the browse step, not the what's-left step.
  assert.ok(
    followUpsFor({
      ...base,
      tools: [
        {
          name: "get_program_requirements",
          output: planOutput({
            planning: { history: {}, remaining_required_courses: ["ITSE 1303"] },
          }),
        },
      ],
    })
      .map((c) => c.label)
      .includes("What do I need before starting?"),
  );
});

test("schedule and faculty results each offer their own next step", () => {
  const schedule = followUpsFor({
    ...base,
    tools: [
      {
        name: "get_class_schedule",
        output: { course_code: "ENGL 1301", offerings: [{ section: "1" }] },
      },
    ],
  }).map((c) => c.label);
  assert.deepEqual(schedule, [
    "Who are these instructors?",
    "Which sections are online?",
    "How can I reach a Success Coach?",
  ]);

  const faculty = followUpsFor({
    ...base,
    tools: [
      {
        name: "search_faculty_expertise",
        output: {
          found: true,
          results: [{ name: "Ada Lovelace" }, { name: "Grace Hopper" }],
        },
      },
    ],
  });
  assert.equal(faculty[0].label, "Which classes do they teach this Fall?");
  assert.equal(faculty[1].label, "What would I take with Lovelace?");
  assert.ok(faculty[0].prompt.includes("Ada Lovelace and Grace Hopper"));

  // Nothing recognised falls back to the human help that always applies.
  assert.deepEqual(
    followUpsFor({ ...base, tools: [{ name: "get_current_date", output: {} }] }).map(
      (c) => c.label,
    ),
    [
      "How can I reach a Success Coach?",
      "Where can I get free tutoring?",
      "What might my classes cost?",
    ],
  );
});

test("chips are never repeated, never over-long, and never duplicated in one set", () => {
  const cases = [
    { ...base, tools: [{ name: "get_program_requirements", output: planOutput({ requested_semesters: [1] }) }] },
    { ...base, taken: ["ENGL 1301", "MATH 1314"], tools: [{ name: "get_program_requirements", output: planOutput() }] },
    { ...base, tools: [{ name: "get_class_schedule", output: { course_code: "ENGL 1301", offerings: [{}] } }] },
    { ...base, tools: [{ name: "search_faculty_expertise", output: { results: [{ name: "Ada Lovelace" }] } }] },
    { ...base, tools: [] },
    { ...base, started: false },
  ];
  for (const context of cases) {
    const chips = followUpsFor(context);
    assert.ok(chips.length <= 3);
    assert.equal(new Set(chips.map((c) => c.label)).size, chips.length);
    for (const chip of chips) {
      assert.ok(chip.label.length <= 40, `${chip.label} (${chip.label.length})`);
      assert.ok(chip.prompt.length > chip.label.length, chip.label);
    }
    // An asked label never comes back — once the conversation has started.
    // Before that nothing has been asked, and the starters stand as written.
    if (!context.started) continue;
    const asked = chips.map((c) => c.label);
    for (const chip of followUpsFor({ ...context, askedLabels: asked })) {
      assert.ok(!asked.includes(chip.label), chip.label);
    }
  }
});

test("a missing program name never produces a chip with a hole in it", () => {
  // No onboarding program and a plan result that has no name of its own.
  const chips = followUpsFor({
    ...base,
    program: undefined,
    tools: [
      { name: "get_program_requirements", output: { found: true, groups: [] } },
    ],
  });
  for (const chip of chips) {
    assert.ok(!/undefined|\byour program\b|\[/.test(chip.prompt), chip.prompt);
    assert.ok(!/undefined/.test(chip.label), chip.label);
  }
  // The plan's own catalog name is used when onboarding has none.
  const named = followUpsFor({
    ...base,
    program: undefined,
    tools: [
      { name: "get_program_requirements", output: planOutput({ requested_semesters: [1] }) },
    ],
  });
  assert.ok(named.every((c) => c.prompt.includes(PROGRAM)));
});
