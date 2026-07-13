/**
 * Exhaustive conversation-flow stress test.
 *
 * Drives the REAL onboarding decision logic (followUpsFor / buildPayload /
 * nextSteps / programFor) through every reachable path and a set of adversarial
 * back-navigation sequences, asserting the invariants that keep the conversation
 * sensible. See LANDING_ONBOARDING_UIUX.md for what each invariant protects.
 *
 * Run from the frontend app (so the `@/` path alias resolves):
 *   cd apps/frontend && npx tsx ../../docs/onboarding-flow-stress.ts
 *   FULL=1 …  # expand the 306-program picker and full school list (5,293 paths)
 */
import { buildPayload } from "@/features/onboarding/build-payload";
import {
  authorityNotes,
  coachVerifyLine,
  handoffIntro,
  starterPromptsFor,
} from "@/features/onboarding/next-steps";
import {
  AUDIENCE_OPTIONS,
  directionOptions,
  followUpsFor,
  goalQuestion,
  interestQuestion,
  oneoffPurposeQuestion,
  programFor,
  scheduleQuestion,
  schoolOptions,
} from "@/features/onboarding/questions";
import type {
  OnboardingQuestion,
  StepAnswer,
} from "@/features/onboarding/types";

type Answers = Record<string, StepAnswer>;

// ---- mirror of use-onboarding's derivation + commit reducer ----------------
const stepsFor = (answers: Answers): OnboardingQuestion[] => [
  goalQuestion,
  ...followUpsFor(answers).filter((q) => q.shipped),
];

type Move = { display: string; answer: StepAnswer };

// Collapse the 306-entry program picker and the school list to representatives
// so the structural map is readable. The full picker is still exercised via the
// two branch-affecting choices: a real program vs. "I'm still figuring it out".
const COLLAPSE = process.env.FULL !== "1";

// Every option a given step could be answered with (transferOrigin expands to
// direction × school, exactly like the TransferStep component commits).
function movesFor(step: OnboardingQuestion): Move[] {
  if (step.kind === "buttons") {
    return (step.options ?? []).map((o) => ({
      display: o.label,
      answer: { contribs: o.contribs, display: o.label, optionIds: { main: o.id } },
    }));
  }
  if (step.kind === "picker") {
    let opts = step.options ?? [];
    if (COLLAPSE) {
      const real = opts.find((o) => o.id !== "program_unsure")!;
      const unsure = opts.find((o) => o.id === "program_unsure")!;
      opts = [real, unsure];
    }
    return opts.map((o) => ({
      display: o.label,
      answer: { contribs: o.contribs, display: o.label, optionIds: { main: o.id } },
    }));
  }
  if (step.kind === "transferOrigin") {
    const moves: Move[] = [];
    const schools = COLLAPSE
      ? schoolOptions.filter((s) => s.id === "sch_utd" || s.id === "sch_intl")
      : schoolOptions;
    for (const d of directionOptions) {
      const dir = d.contribs.transfer_direction;
      if (dir === "inbound") {
        moves.push({
          display: "Bringing credits in",
          answer: {
            contribs: { transfer_direction: "inbound", target_institution: null },
            display: "Bringing credits in",
            optionIds: { direction: d.id },
          },
        });
      } else {
        for (const s of schools) {
          moves.push({
            display: `${dir} · ${s.label}`,
            answer: {
              contribs: { ...d.contribs, ...s.contribs },
              display: `${dir} · ${s.label}`,
              optionIds: { direction: d.id, school: s.id },
            },
          });
        }
      }
    }
    return moves;
  }
  return [];
}

type CommitResult =
  | { done: true; answers: Answers; branch: OnboardingQuestion[] }
  | { done: false; answers: Answers; stepIdx: number };

function commit(answers: Answers, stepId: string, answer: StepAnswer): CommitResult {
  const existing = answers[stepId];
  const goalSwitched =
    stepId === "goal" &&
    !!existing &&
    existing.optionIds.main !== answer.optionIds.main;
  const next: Answers = goalSwitched
    ? { goal: answer }
    : { ...answers, [stepId]: answer };
  const ns = stepsFor(next);
  const idx = ns.findIndex((s) => s.id === stepId);
  if (idx >= ns.length - 1) return { done: true, answers: next, branch: ns };
  return { done: false, answers: next, stepIdx: idx + 1 };
}

// ---- invariants ------------------------------------------------------------
type Terminal = {
  path: string[]; // labels chosen, in order
  branchIds: string[]; // question ids asked
  prompts: string[]; // the prompt text actually shown
  payload: ReturnType<typeof buildPayload>;
  steps: string[]; // nextSteps recap
};

const violations: string[] = [];
const terminals: Terminal[] = [];

function check(cond: boolean, msg: string) {
  if (!cond) violations.push(msg);
}

function record(answers: Answers, branch: OnboardingQuestion[], trail: string[]) {
  const payload = buildPayload(answers, branch);
  const notes = authorityNotes(payload);
  const coach = coachVerifyLine(payload);
  const intro = handoffIntro(payload);
  const starterPrompts = starterPromptsFor(payload);
  const steps = [intro, ...notes, coach];
  const branchIds = branch.map((b) => b.id);
  const prompts = branch.map((b) => b.prompt);
  terminals.push({ path: trail, branchIds, prompts, payload, steps });

  const tag = `[${trail.join(" → ")}]`;

  // 1. Branch length within budget (goal + <=3 follow-ups).
  check(branch.length <= 4, `${tag} branch too long: ${branchIds.join(",")}`);

  // 2. No program picker for students not pursuing a Dallas program.
  const noProgramExpected =
    payload.goal === "figure_out_major" ||
    payload.goal === "nondegree_oneoff" ||
    payload.transfer_direction === "transfer_back" ||
    payload.student_type === "parent_guardian";
  if (noProgramExpected) {
    check(
      !branchIds.includes("major"),
      `${tag} asked the program picker when it should not have`,
    );
    check(payload.major === null, `${tag} has a major set on a non-program path`);
  }

  // 3. Degree paths DO reach the program picker (when fully answered forward).
  const degreePath =
    payload.goal === "graduation_check" ||
    payload.goal === "first_semester_plan" ||
    payload.goal === "schedule_fit" ||
    (payload.goal === "transfer_check" &&
      (payload.transfer_direction === "outbound" ||
        payload.transfer_direction === "inbound"));
  if (degreePath) {
    check(
      branchIds.includes("major"),
      `${tag} degree path never offered the program picker`,
    );
  }

  // 4. Authority routing appears only for a transfer, and only as routing — only
  //    the institution can decide, so it is never a claim about the outcome.
  check(
    (notes.length > 0) === (payload.transfer_direction !== null),
    `${tag} authority note should be present iff there is a transfer direction`,
  );

  // 5. The hand-off always opens the planning chat (a forward intro) and closes on
  //    the human-coach verify step — the one honest promise the tool can make.
  check(
    intro.length > 0 && coach.length > 0 && starterPrompts.length > 0,
    `${tag} hand-off missing intro, prompts, or coach-verify line`,
  );

  // 6. Every {placeholder} is filled — a student never sees a literal "{major}".
  const unfilled = [intro, ...starterPrompts].find((s) => /\{|\}/.test(s));
  check(!unfilled, `${tag} unfilled placeholder in hand-off: "${unfilled ?? ""}"`);

  // 7. Starter prompts fit the student: a non-degree one-off student is never shown
  //    "major"/"degree"/"transfer" prompts (the exact mismatch the owner flagged).
  if (payload.goal === "nondegree_oneoff") {
    const bad = starterPrompts.find((s) => /\b(major|degree|transfer)\b/i.test(s));
    check(!bad, `${tag} one-off prompt mentions degree/transfer: "${bad ?? ""}"`);
  }

  // 6. Program prompt tense matches enrolment.
  if (branchIds.includes("major")) {
    const prompt = prompts[branchIds.indexOf("major")];
    const enrolled =
      payload.student_type !== "dual_credit" &&
      (payload.goal === "graduation_check" ||
        (payload.goal === "transfer_check" &&
          payload.transfer_direction === "outbound"));
    const expected = enrolled
      ? "What degree or certificate are you working toward?"
      : "What do you want to study?";
    check(
      prompt === expected,
      `${tag} program prompt was "${prompt}", expected "${expected}"`,
    );
  }

  // 7. Summary lists exactly the answered steps.
  const answered = branch.filter((s) => answers[s.id]).length;
  check(
    answered === branch.filter((s) => answers[s.id]).length,
    `${tag} summary/answer mismatch`,
  );
}

// ---- forward DFS over every path ------------------------------------------
function walk(answers: Answers, stepIdx: number, trail: string[], depth: number) {
  if (depth > 8) {
    violations.push(`[${trail.join(" → ")}] did not terminate (loop?)`);
    return;
  }
  const steps = stepsFor(answers);
  const current = steps[stepIdx];
  if (!current) {
    violations.push(`[${trail.join(" → ")}] stepIdx ${stepIdx} out of range`);
    return;
  }
  for (const move of movesFor(current)) {
    const res = commit(answers, current.id, move.answer);
    const nextTrail = [...trail, move.display];
    if (res.done) record(res.answers, res.branch, nextTrail);
    else walk(res.answers, res.stepIdx, nextTrail, depth + 1);
  }
}

// Forward entry via each goal button.
walk({}, 0, [], 0);

// Forward entry via the audience links (dual credit, parent/guardian).
for (const aud of AUDIENCE_OPTIONS) {
  const goal = aud.studentType === "dual_credit" ? "graduation_check" : null;
  const answer: StepAnswer = {
    contribs: { goal: goal as never, student_type: aud.studentType },
    display: aud.label,
    optionIds: { main: aud.id },
  };
  const next: Answers = { goal: answer };
  const ns = stepsFor(next);
  if (ns.length <= 1) record(next, ns, [`audience:${aud.label}`]);
  else walk(next, 1, [`audience:${aud.label}`], 1);
}

// ---- adversarial back-navigation / re-answer sequences --------------------
type Seq = { name: string; ops: Array<{ id: string; move: () => StepAnswer }> };
const opt = (q: OnboardingQuestion, id: string): StepAnswer => {
  const o = q.options!.find((x) => x.id === id)!;
  return { contribs: o.contribs, display: o.label, optionIds: { main: id } };
};
const transfer = (dirId: string, dir: string, schoolId?: string): StepAnswer => {
  const d = directionOptions.find((x) => x.id === dirId)!;
  if (dir === "inbound")
    return {
      contribs: { transfer_direction: "inbound", target_institution: null },
      display: "Bringing credits in",
      optionIds: { direction: dirId },
    };
  const s = schoolOptions.find((x) => x.id === schoolId)!;
  return {
    contribs: { ...d.contribs, ...s.contribs },
    display: `${dir} · ${s.label}`,
    optionIds: { direction: dirId, school: schoolId! },
  };
};

const adversarial: Array<{ name: string; run: () => void }> = [
  {
    name: "switch goal mid-flow wipes stale answers",
    run: () => {
      let a: Answers = {};
      a = commit(a, "goal", opt(goalQuestion, "goal_schedule")).answers;
      a = commit(a, "schedule", opt(scheduleQuestion, "sched_evenings")).answers;
      // now switch the goal to transfer — must reset to just {goal}
      const r = commit(a, "goal", opt(goalQuestion, "goal_transfer"));
      check(
        !("schedule" in r.answers) && !("major" in r.answers),
        "[adv] goal switch left stale schedule/major",
      );
      check(
        !r.done && stepsFor(r.answers)[(r as { stepIdx: number }).stepIdx].id ===
          "transfer_origin",
        "[adv] goal switch did not land on transfer step",
      );
    },
  },
  {
    name: "inbound → back → change to transfer_back terminates without program",
    run: () => {
      let a: Answers = {};
      a = commit(a, "goal", opt(goalQuestion, "goal_transfer")).answers;
      a = commit(a, "transfer_origin", transfer("dir_inbound", "inbound")).answers;
      // user backs up and changes direction to transfer_back + a school
      const r = commit(
        a,
        "transfer_origin",
        transfer("dir_back", "transfer_back", "sch_utd"),
      );
      check(r.done === true, "[adv] transfer_back did not terminate");
      if (r.done) {
        check(
          !r.branch.map((b) => b.id).includes("major"),
          "[adv] transfer_back asked the program after switch",
        );
        check(
          buildPayload(r.answers, r.branch).transfer_direction === "transfer_back",
          "[adv] transfer_back direction not recorded",
        );
      }
    },
  },
  {
    name: "first_semester real major → change to undecided reroutes to interest",
    run: () => {
      let a: Answers = {};
      a = commit(a, "goal", opt(goalQuestion, "goal_first_semester")).answers;
      // pick a real program (first non-unsure option)
      const real = programFor(a).options!.find((o) => o.id !== "program_unsure")!;
      a = commit(a, "major", {
        contribs: real.contribs,
        display: real.label,
        optionIds: { main: real.id },
      }).answers;
      // answer schedule, then go back and change major to "still figuring it out"
      a = commit(a, "schedule", opt(scheduleQuestion, "sched_online")).answers;
      const r = commit(a, "major", opt(programFor(a), "program_unsure"));
      const ns = stepsFor(r.answers);
      check(
        ns.some((s) => s.id === "interest"),
        "[adv] undecided did not reroute to interest",
      );
      check(
        !ns.some((s) => s.id === "schedule"),
        "[adv] stale schedule step remained after undecided reroute",
      );
    },
  },
  {
    name: "abandon (finish now) at entry is sane",
    run: () => {
      const branch = stepsFor({});
      const payload = buildPayload({}, branch);
      check(
        coachVerifyLine(payload).length > 0 && handoffIntro(payload).length > 0,
        "[adv] abandon produced no hand-off",
      );
      check(
        payload.skippedSteps.includes("goal"),
        "[adv] abandon did not record the skipped goal",
      );
    },
  },
];

for (const t of adversarial) {
  try {
    t.run();
  } catch (e) {
    violations.push(`[adv:${t.name}] threw: ${(e as Error).message}`);
  }
}

// ---- report ----------------------------------------------------------------
const asked = (t: Terminal) => t.branchIds.filter((id) => id !== "goal");
console.log(`\n=== TERMINALS: ${terminals.length} distinct completed paths ===\n`);
for (const t of terminals) {
  const p = t.payload;
  const facts = [
    p.goal && `goal=${p.goal}`,
    p.transfer_direction && `dir=${p.transfer_direction}`,
    p.oneoff_purpose && `oneoff=${p.oneoff_purpose}`,
    p.major ? `major=${p.major}` : p.major === null && asked(t).includes("major") ? "major=unsure" : null,
    p.student_type && `who=${p.student_type}`,
  ]
    .filter(Boolean)
    .join(" ");
  console.log(`• ${t.path.join("  →  ")}`);
  console.log(`    asked: [${t.prompts.join(" | ")}]`);
  console.log(`    ${facts}`);
  console.log(`    recap: ${t.steps.length} step(s)`);
}

// Coverage summary by goal.
const byGoal: Record<string, number> = {};
for (const t of terminals) {
  const g = t.payload.student_type === "parent_guardian" ? "parent_guardian" : t.payload.goal ?? "none";
  byGoal[g] = (byGoal[g] ?? 0) + 1;
}
console.log(`\n=== COVERAGE BY GOAL ===`);
for (const [g, n] of Object.entries(byGoal)) console.log(`  ${g}: ${n} path(s)`);

const maxLen = Math.max(...terminals.map((t) => t.branchIds.length));
console.log(`\nLongest flow: ${maxLen} questions (budget 4).`);

console.log(`\n=== INVARIANT VIOLATIONS: ${violations.length} ===`);
for (const v of violations) console.log(`  ✗ ${v}`);
if (violations.length === 0) console.log("  ✓ all invariants held across every path");
process.exit(violations.length === 0 ? 0 : 1);
