// Pure text predicate for the /summary "Questions I asked" list — no store,
// no React, so the CI guard script can import it without dragging in zustand.
// Same shape as program-search.ts: a curated heuristic beside the store that
// uses it.
//
// The sheet is a checklist for the coach visit, but addQuestion sees EVERY
// typed message — option picks ("1", "First one, Tri To"), acks ("yes",
// "thanks"), and answers to Major's own clarifying questions ("I live in
// Dallas County…"). Printed, those read as noise (live demo feedback,
// 2026-08-21).
//
// Deliberately a BLOCKLIST, not an is-it-a-question allowlist: a junk line
// that slips through is one tap to delete on the sheet, but a real question
// silently dropped is invisible to the student — so only reject shapes we
// know are conversational filler. Guarded both ways by
// scripts/check-sheet-question-filter.mts.
const FILLER: RegExp[] = [
  // Ordinal picks, with or without a trailing name: "first one, Tri To"
  /^(the\s+)?(first|second|third|last)(\s+one)?\b.{0,20}$/i,
  // Acknowledgements and greetings
  /^(yes|no|ok|okay|sure|yeah|yep|nope|thanks?|thank you|got it|cool|nice|hi|hello|hey)\b.{0,10}$/i,
  // Answers to Major's clarifying questions, not questions themselves:
  // "I live in…", "I am taking…", "I'm from…" — the keyword set keeps real
  // questions like "I'm wondering what to take?" alive.
  /^i(?:'?m|\s+am)\s+(in|from|taking|planning)\b|^i\s+live\b/i,
  /^(i\s+)?(don'?t|do not)\s+know\b/i,
  /^option\s*\d/i,
];

/** Repair saved starter prompts from before print questions were separated.
 * Only match our full instruction suffix; never truncate a student's question. */
export function summarizeSheetQuestion(text: string): string {
  const trimmed = text.trim();
  const plan =
    /^Look up the published course plan for (.+)\. The course cards already show the (?:complete )?requested checklist and its credits\. Reply in at most two sentences introducing those cards, without writing a course list or semester-by-semester breakdown\. Keep the published credit total exact; unresolved elective choices do not change that total\.$/.exec(
      trimmed,
    );
  if (plan) {
    const first = plan[1].endsWith(", only semester 1");
    const program = first
      ? plan[1].slice(0, -", only semester 1".length)
      : plan[1];
    return first
      ? `Which courses are in semester 1 of ${program}?`
      : `Which courses are required for ${program}?`;
  }
  return trimmed;
}

export function isSheetWorthyQuestion(text: string): boolean {
  const t = text.trim();
  // Also rejects bare option picks ("1", "2.", "3)") and one-word stubs —
  // nothing that short survives to the regexes.
  if (t.length < 4) return false;
  if (FILLER.some((re) => re.test(t))) return false;
  // Two-word fragments with no question mark ("for printing")
  if (t.length <= 12 && !t.includes("?") && t.split(/\s+/).length <= 2)
    return false;
  return true;
}
