/**
 * Regression guard for the chat's opening chips
 * (features/onboarding/handoff-copy.ts + interests.ts).
 *
 * Every onboarding branch must hand the chat exactly three chips whose labels
 * fit a chip (≤ 40 characters) and whose prompts are complete sentences that
 * name the student's program — a chip that says "it" or "my program" sends the
 * model a question it cannot ground. The undecided path is checked against
 * the verified interest guide, and the semester scoping the prompts rely on
 * is parsed the way the tool route parses it.
 *
 * Pure — no database, no network — so CI runs it on every push.
 *
 * Run: npx tsx --test scripts/check-starter-questions.mts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COLD_VISIT_QUESTIONS,
  handoffIntro,
  MAX_LABEL,
  starterQuestionsFor,
} from "../features/onboarding/handoff-copy";
import { INTEREST_GUIDE } from "../features/onboarding/interests";
import { PROGRAMS } from "../features/onboarding/programs";
import type {
  InterestArea,
  OnboardingPayload,
} from "../features/onboarding/types";
import { requestedSemesters } from "../lib/course-details";

const LABEL_MAX = MAX_LABEL;
const ACCOUNTING = PROGRAMS.find((p) => p.label === "Accounting A.A.S.")!;
const INTERESTS = Object.keys(INTEREST_GUIDE) as InterestArea[];

// Chips about Dallas College services rather than the student's program.
const SERVICE_LABELS = new Set([
  "What might my classes cost?",
  "Where can I get free tutoring?",
  "How can I reach a Success Coach?",
  "What housing assistance is available?",
  "How does the free DART GoPass work?",
  "How do I apply for financial aid?",
  "When can I still drop a class?",
]);

function payload(over: Partial<OnboardingPayload>): OnboardingPayload {
  return {
    goal: null,
    major: null,
    target_institution: null,
    student_type: null,
    modality_pref: null,
    dayparts_pref: null,
    transfer_direction: null,
    interest_area: null,
    oneoff_purpose: null,
    intl_status: null,
    skippedSteps: [],
    onboardingVersion: "test",
    completedAt: "2026-09-22T00:00:00.000Z",
    ...over,
  };
}

const withProgram = { major: ACCOUNTING.code };
const BRANCHES: [string, Partial<OnboardingPayload>][] = [
  ["dual credit", { student_type: "dual_credit", dayparts_pref: ["evening"] }],
  [
    "settle in",
    { student_type: "international", intl_status: "incoming", goal: "settle_in" },
  ],
  ["one-off prerequisite", { goal: "nondegree_oneoff", oneoff_purpose: "prerequisite" }],
  ["one-off job", { goal: "nondegree_oneoff", oneoff_purpose: "job_licensure" }],
  ["one-off enrichment", { goal: "nondegree_oneoff", oneoff_purpose: "enrichment" }],
  ["transfer out", { goal: "transfer_check", transfer_direction: "outbound", target_institution: "UTD", ...withProgram }],
  ["transfer out, unsure school", { goal: "transfer_check", transfer_direction: "outbound", ...withProgram }],
  ["transfer out, undecided", { goal: "transfer_check", transfer_direction: "outbound", target_institution: "UTD", interest_area: "tech" }],
  ["visiting", { goal: "transfer_check", transfer_direction: "transfer_back", target_institution: "TX_OTHER" }],
  ["visiting, named school", { goal: "transfer_check", transfer_direction: "transfer_back", target_institution: "UTA" }],
  ["transfer out, bucket school", { goal: "transfer_check", transfer_direction: "outbound", target_institution: "TX_OTHER", ...withProgram }],
  ["dual credit, no preference", { student_type: "dual_credit" }],
  ["dual credit, online", { student_type: "dual_credit", modality_pref: "online" }],
  ["schedule fit, evenings and online", { goal: "schedule_fit", modality_pref: "online", dayparts_pref: ["evening"], ...withProgram }],
  ["first semester, weekends", { goal: "first_semester_plan", dayparts_pref: ["weekend"], ...withProgram }],
  ["transfer in", { goal: "transfer_check", transfer_direction: "inbound", target_institution: "US_OTHER", ...withProgram }],
  ["transfer in, undecided", { goal: "transfer_check", transfer_direction: "inbound" }],
  ["schedule fit, evenings", { goal: "schedule_fit", dayparts_pref: ["evening"], ...withProgram }],
  ["schedule fit, weekends", { goal: "schedule_fit", dayparts_pref: ["weekend"], ...withProgram }],
  ["schedule fit, online", { goal: "schedule_fit", modality_pref: "online", ...withProgram }],
  ["schedule fit, anytime", { goal: "schedule_fit", ...withProgram }],
  ["schedule fit, undecided", { goal: "schedule_fit", modality_pref: "online", interest_area: "arts" }],
  ["graduation", { goal: "graduation_check", ...withProgram }],
  ["graduation, undecided", { goal: "graduation_check", interest_area: "business" }],
  ["first semester", { goal: "first_semester_plan", ...withProgram }],
  ["first semester, online", { goal: "first_semester_plan", modality_pref: "online", ...withProgram }],
  ["first semester, undecided", { goal: "first_semester_plan", interest_area: "trades" }],
  ["figure out major, no area", { goal: "figure_out_major" }],
  ...INTERESTS.map(
    (area): [string, Partial<OnboardingPayload>] => [
      `figure out major, ${area}`,
      { goal: "figure_out_major", interest_area: area },
    ],
  ),
];

for (const [name, over] of BRANCHES) {
  test(`branch "${name}" hands the chat three grounded chips`, () => {
    const p = payload(over);
    const chips = starterQuestionsFor(p);
    assert.equal(chips.length, 3, `${name}: expected 3 chips`);
    assert.match(handoffIntro(p), /Type a question below, or open Suggestions for ideas\.$/);
    assert.equal(new Set(chips.map((c) => c.label)).size, 3, `${name}: duplicate labels`);
    for (const chip of chips) {
      assert.ok(
        chip.label.length > 0 && chip.label.length <= LABEL_MAX,
        `${name}: label "${chip.label}" is ${chip.label.length} chars`,
      );
      // A complete sentence, with every placeholder filled.
      assert.match(chip.prompt, /^[A-Z][\s\S]{40,}[.?]$/, `${name}: "${chip.label}" prompt`);
      // An unfilled placeholder, or a lookup aimed at an unnamed program.
      assert.doesNotMatch(chip.prompt, /[{}]|\b(?:for|in) (?:my|this|that) program\b/, `${name}: "${chip.label}" prompt is not self-contained`);
      if (chip.note) assert.match(chip.note, /[.?]$/, `${name}: "${chip.label}" note`);
    }
    // Program-known: every chip about the program names it in the prompt.
    if (p.major) {
      for (const chip of chips)
        if (!SERVICE_LABELS.has(chip.label))
          assert.ok(
            chip.prompt.includes(ACCOUNTING.label),
            `${name}: "${chip.label}" prompt does not name ${ACCOUNTING.label}`,
          );
    }
  });
}

test("the interest guide only names picker programs, enough of them, with topics", () => {
  const labels = new Set(PROGRAMS.map((p) => p.label));
  for (const area of INTERESTS) {
    const { examplePrograms, expertiseTopics } = INTEREST_GUIDE[area];
    assert.ok(examplePrograms.length >= 2, `${area}: needs two programs to compare`);
    assert.ok(expertiseTopics.length >= 1, `${area}: needs a faculty topic`);
    for (const program of examplePrograms)
      assert.ok(labels.has(program), `${area}: "${program}" is not a picker label`);
  }
});

test("the undecided path opens on the verified examples and scopes its lookups", () => {
  for (const area of INTERESTS) {
    const chips = starterQuestionsFor(payload({ goal: "figure_out_major", interest_area: area }));
    const { examplePrograms } = INTEREST_GUIDE[area];
    const [examples, study, compare] = chips;
    for (const program of examplePrograms)
      assert.ok(examples.prompt.includes(program), `${area}: examples chip omits "${program}"`);
    // Three programs at once: only their first semesters, or the cards run to
    // dozens of rows; the single-program chip must show the whole plan.
    assert.deepEqual(requestedSemesters(examples.prompt), [1]);
    assert.ok(study.prompt.includes(examplePrograms[0]));
    assert.deepEqual(requestedSemesters(study.prompt), []);
    assert.ok(compare.prompt.includes(examplePrograms[0]) && compare.prompt.includes(examplePrograms[1]));
    assert.match(compare.prompt, /^Compare /);
    // "Example" in every prompt: the model must not adopt one as the student's program.
    for (const chip of chips) assert.match(chip.prompt, /example/i);
  }
  const [pick] = starterQuestionsFor(payload({ goal: "figure_out_major" }));
  assert.match(pick.prompt, /numbered list/);
  for (const area of INTERESTS)
    for (const program of INTEREST_GUIDE[area].examplePrograms)
      assert.ok(pick.prompt.includes(program), `pick-an-area chip omits "${program}"`);
});

test("the planning path scopes the first-semester chip and only that chip", () => {
  const [plan, first, next] = starterQuestionsFor(payload({ goal: "first_semester_plan", ...withProgram }));
  assert.equal(plan.label, "What courses do I need for this program?");
  assert.equal(first.label, "Which classes would I start with?");
  assert.equal(next.label, "What do I need before starting?");
  assert.deepEqual(requestedSemesters(plan.prompt), []);
  assert.deepEqual(requestedSemesters(first.prompt), [1]);
  const [, , evening] = starterQuestionsFor(payload({ goal: "first_semester_plan", dayparts_pref: ["evening"], ...withProgram }));
  assert.equal(evening.label, "Any evening sections for a first class?");
  assert.match(evening.prompt, /I prefer evening classes/);
});

test("the graduation path opens on the checklist, then history, then what is left", () => {
  const chips = starterQuestionsFor(payload({ goal: "graduation_check", ...withProgram }));
  assert.deepEqual(chips.map((c) => c.label), [
    "What's on my checklist?",
    "Which of these have I finished?",
    "How many credits do I have left?",
  ]);
  // The whole checklist, never one semester of it.
  assert.deepEqual(requestedSemesters(chips[0].prompt), []);
  for (const chip of chips.slice(1)) {
    // registry.ts refreshes the deterministic plan only when a completion word
    // AND a remaining-work word are both present; without both, the model
    // answers from an older result already in the transcript.
    assert.match(chip.prompt, /\b(?:completed|checklist)\b/, chip.label);
    assert.match(chip.prompt, /\b(?:remain|left)\b/, chip.label);
    // The one claim this path must never make.
    assert.match(chip.prompt, /student-reported|reported history/, chip.label);
    assert.match(chip.prompt, /not a transcript/, chip.label);
  }
  assert.match(handoffIntro(payload({ goal: "graduation_check", ...withProgram })), /not a transcript/);
});

test("a transfer chip names the school it is for, and never promises credit", () => {
  const outbound = (target: OnboardingPayload["target_institution"]) =>
    starterQuestionsFor(payload({ goal: "transfer_check", transfer_direction: "outbound", target_institution: target, ...withProgram }))[1];
  // A named partner belongs in the label; the whole point of the question is
  // which school it is for.
  assert.equal(outbound("UTD").label, "What should I send to UT Dallas?");
  assert.equal(outbound("UTA").label, "What should I send to UT Arlington?");
  // A name too long for a chip, and every region bucket (which resolves to a
  // phrase, not a name), fall back to the plain question.
  assert.equal(outbound("TWU").label, "What should I collect for a review?");
  assert.equal(outbound("TX_OTHER").label, "What should I collect for a review?");
  assert.equal(outbound(null).label, "What should I collect for a review?");
  // Inbound is the other authority, and says so.
  const inbound = starterQuestionsFor(payload({ goal: "transfer_check", transfer_direction: "inbound", target_institution: "US_OTHER", ...withProgram }));
  assert.equal(inbound[1].label, "What will Admissions need to see?");
  // A visiting student has no Dallas program, so the first chip looks up a
  // course rather than a plan they are not working toward.
  const visiting = starterQuestionsFor(payload({ goal: "transfer_check", transfer_direction: "transfer_back", target_institution: "UTA" }));
  assert.equal(visiting[0].label, "Can you look up a class for me?");
  assert.match(visiting[1].prompt, /UT Arlington/);
  // No transfer chip, in any direction, may assume an equivalence.
  for (const direction of ["inbound", "outbound", "transfer_back"] as const)
    for (const chip of starterQuestionsFor(payload({ goal: "transfer_check", transfer_direction: direction, target_institution: "UTD", ...(direction === "transfer_back" ? {} : withProgram) })))
      assert.doesNotMatch(chip.prompt, /will (?:count|transfer)|equivalent to|accepted at/i, chip.label);
});

test("every schedule label fits a chip and every preference survives into the prompt", () => {
  for (const [modality, dayparts] of [
    ["online", null],
    [null, ["evening"]],
    [null, ["weekend"]],
    ["online", ["evening"]],
    ["online", ["evening", "weekend"]],
    [null, null],
  ] as const) {
    const p = payload({ goal: "schedule_fit", modality_pref: modality, dayparts_pref: dayparts ? [...dayparts] : null, ...withProgram });
    const chip = starterQuestionsFor(p)[2];
    assert.ok(chip.label.length <= LABEL_MAX, `${chip.label} (${chip.label.length})`);
    for (const want of [...(modality ? [modality] : []), ...(dayparts ?? [])])
      assert.ok(chip.prompt.includes(want), `${chip.label} drops "${want}"`);
    // It must never promise that a matching section exists.
    if (modality || dayparts)
      assert.match(chip.prompt, /if none of that course's sections match/i);
  }
});

test("the cold visit opens on real questions, not only support links", () => {
  assert.equal(COLD_VISIT_QUESTIONS.length, 3);
  const [findProgram, pickArea] = COLD_VISIT_QUESTIONS;
  assert.match(findProgram.prompt, /Ask me to name the program/);
  // With no onboarding there is no program list, so the model must not offer
  // one — an invented program name is the failure grounding exists to stop.
  assert.match(findProgram.prompt, /Do not suggest a program/);
  assert.match(pickArea.prompt, /numbered list/);
  for (const chip of COLD_VISIT_QUESTIONS) {
    assert.ok(chip.label.length <= LABEL_MAX, chip.label);
    assert.match(chip.prompt, /^[A-Z][\s\S]{40,}[.?]$/, chip.label);
  }
});

test("every intro reflects what the student chose, in one sentence before the invitation", () => {
  const reflects: [Partial<OnboardingPayload>, RegExp][] = [
    [{ goal: "first_semester_plan", ...withProgram }, /Accounting A\.A\.S\. it is/],
    [{ goal: "schedule_fit", dayparts_pref: ["evening"], ...withProgram }, /around evening classes/],
    [{ goal: "graduation_check", ...withProgram }, /Accounting A\.A\.S\. checklist/],
    [{ goal: "figure_out_major", interest_area: "trades" }, /^Skilled trades, then\./],
    [{ goal: "figure_out_major" }, /No area picked yet/],
    [{ goal: "nondegree_oneoff", oneoff_purpose: "job_licensure" }, /job or licence/],
    [{ goal: "nondegree_oneoff", oneoff_purpose: "prerequisite" }, /get you ready for the program/],
    [{ goal: "transfer_check", transfer_direction: "outbound", target_institution: "UTD", ...withProgram }, /Heading to UT Dallas later/],
    [{ goal: "transfer_check", transfer_direction: "inbound", target_institution: "UTD", ...withProgram }, /Admissions decides what counts/],
    [{ goal: "transfer_check", transfer_direction: "transfer_back", target_institution: "UTA" }, /count at UT Arlington/],
    [{ student_type: "dual_credit" }, /still in high school/],
    [{ goal: "settle_in", student_type: "international", intl_status: "incoming" }, /Getting here comes before picking classes/],
  ];
  for (const [over, expected] of reflects) {
    const intro = handoffIntro(payload(over));
    assert.match(intro, expected);
    assert.match(intro, /Type a question below, or open Suggestions for ideas\.$/);
    // The parenthetical in "Skilled trades (welding, HVAC, auto)" belongs to
    // the picker, not to prose the coach speaks.
    assert.doesNotMatch(intro, /\(welding/);
  }
});
