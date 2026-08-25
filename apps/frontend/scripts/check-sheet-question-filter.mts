/**
 * Regression guard for the /summary "Questions I asked" filter
 * (features/chat/sheet-questions.ts — see there for why it is a blocklist).
 *
 * Both directions matter, but KEEP failures are the dangerous ones: a real
 * question the filter drops never reaches the printed sheet and nobody sees
 * it happen.
 *
 * Pure — no database, no network — so CI runs it on every push.
 *
 * Run: npx tsx scripts/check-sheet-question-filter.mts
 */
const { isSheetWorthyQuestion } = await import("../features/chat/sheet-questions");

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
  // "I am/I'm" only rejects with a clarifying-answer keyword (in/from/
  // taking/planning) — real first-person questions must survive.
  "i am wondering what classes to take",
];

let failures = 0;
const check = (q: string, keep: boolean) => {
  if (isSheetWorthyQuestion(q) !== keep) {
    console.error(`FAIL should-${keep ? "keep" : "reject"}: ${JSON.stringify(q)}`);
    failures++;
  }
};
REJECT.forEach((q) => check(q, false));
KEEP.forEach((q) => check(q, true));

if (failures > 0) {
  console.error(`${failures} failure(s) across ${REJECT.length + KEEP.length} cases`);
  process.exit(1);
}
console.log(`ok - ${REJECT.length + KEEP.length} cases (${REJECT.length} reject, ${KEEP.length} keep)`);
