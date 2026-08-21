/**
 * Regression guard for the /summary "Questions I asked" filter.
 *
 * isSheetWorthyQuestion keeps conversational filler off the printed hand-off
 * sheet: option picks ("1", "First one, Tri To"), acks ("yes", "thanks"), and
 * answers to Major's own clarifying questions ("I live in Dallas County…") —
 * all observed on real printed sheets during the 2026-08-21 workshop demo.
 * The filter is a deliberate blocklist: junk kept is one tap to delete on the
 * sheet, but a real question silently dropped is invisible to the student. If
 * a KEEP case fails here, students are losing coach-visit questions.
 *
 * Pure — no database, no network — so CI can run it on every push.
 *
 * Run: npx tsx scripts/check-sheet-question-filter.mts
 */
const { isSheetWorthyQuestion } = await import("../features/chat/saved-courses");

// Messages that must NOT reach the printed sheet.
const REJECT = [
  "1",
  "2.",
  "3)",
  "yes",
  "ok",
  "thanks",
  "First one, Tri To",
  "the second one",
  "I live in Dallas County and I'm planning to take 4 classes",
  "i'm from collin county",
  "don't know",
  "i don't know",
  "for printing",
  "option 2",
  "hey",
];

// Real questions that MUST survive — phrasings from live student testing,
// including lowercase, typos, and slang.
const KEEP = [
  "What do I need for an A.A. in Computer Science?",
  "give me 5 courses about cloud computing",
  "cyber security classes",
  "do yall have welding",
  "How much does a class cost?",
  "tell me more about tri to",
  "what are the prerequisits for cosc 2436",
  "When is the last day to drop a class this fall?",
  "nursing program requirements?",
  "i want to become a nurse. which program should i look at?",
];

let failures = 0;
for (const q of REJECT) {
  if (isSheetWorthyQuestion(q)) {
    console.error(`FAIL should-reject: ${JSON.stringify(q)}`);
    failures++;
  }
}
for (const q of KEEP) {
  if (!isSheetWorthyQuestion(q)) {
    console.error(`FAIL should-keep: ${JSON.stringify(q)}`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`${failures} failure(s) across ${REJECT.length + KEEP.length} cases`);
  process.exit(1);
}
console.log(`ok - ${REJECT.length + KEEP.length} cases (${REJECT.length} reject, ${KEEP.length} keep)`);
