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
  handoffIntro,
  starterQuestionsFor,
} from "../features/onboarding/handoff-copy";
import { INTEREST_GUIDE } from "../features/onboarding/interests";
import { PROGRAMS } from "../features/onboarding/programs";
import type {
  InterestArea,
  OnboardingPayload,
} from "../features/onboarding/types";
import { requestedSemesters } from "../lib/course-details";

const LABEL_MAX = 40;
const ACCOUNTING = PROGRAMS.find((p) => p.label === "Accounting A.A.S.")!;
const INTERESTS = Object.keys(INTEREST_GUIDE) as InterestArea[];

// Chips about Dallas College services rather than the student's program.
const SERVICE_LABELS = new Set([
  "What might my classes cost?",
  "Where can I get free tutoring?",
  "How can I reach a Success Coach?",
  "What housing assistance is available?",
  "How does the free DART GoPass work?",
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
    assert.match(handoffIntro(p), /You could ask:$/);
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
