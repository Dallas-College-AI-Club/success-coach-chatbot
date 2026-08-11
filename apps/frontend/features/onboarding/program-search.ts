// Search behaviour for the program picker.
//
// cmdk's default filter matches letters scattered ANYWHERE in order, which
// over 335 long catalog labels produces junk: 'art' returned 238 results,
// 'it' 316, 'nurse' matched "Wholesale and Manufacturing Sales
// Representative", and 'x-ray' matched "eXtended Reality" but not Radiologic
// Technology (measured 2026-08-10). This replaces it with word-prefix
// matching plus a small alias table for the words students actually use.

/** Student vocabulary → substrings of the catalog labels it should surface.
 *  Terms are matched as prefixes ("radio" hits via "radiology"). Keep this
 *  curated and small — every entry is a judgment that students say the term. */
// Only terms that word-prefix matching does NOT already cover. Note the
// direction: matching is label-word.startsWith(typed), so a typed word LONGER
// than the catalog word fails — "nurse" does NOT match "Nursing" (they part
// at the 5th character), which hid every nursing program behind the one label
// containing the literal word "Nurse".
const ALIASES: Record<string, string[]> = {
  nurse: ["Nursing"],
  nursing: ["Nursing"],
  rn: ["Nursing", "Nurse"],
  "x-ray": ["Radiologic"],
  xray: ["Radiologic"],
  radiology: ["Radiologic"],
  ultrasound: ["Sonography"],
  sonogram: ["Sonography"],
  coding: ["Computer Science", "Software", "Programming", "Web Dev"],
  programming: ["Computer Science", "Software", "Web Dev"],
  cs: ["Computer Science"],
  it: ["Information Technology", "IT ", "Computer Support", "Network"],
  cybersecurity: ["Cyber"],
  law: ["Paralegal", "Criminal Justice", "Court Report"],
  legal: ["Paralegal"],
  cooking: ["Culinary", "Pastry", "Food"],
  chef: ["Culinary", "Pastry"],
  cars: ["Automotive", "Auto Body"],
  mechanic: ["Automotive", "Auto Body", "Diesel"],
  electrician: ["Electrical"],
  ac: ["HVAC"],
  teacher: ["Teaching", "Education"],
  childcare: ["Early Childhood", "Child Development"],
  daycare: ["Early Childhood", "Child Development"],
  paramedic: ["Emergency Medical", "EMS"],
  ems: ["Emergency Medical"],
  bookkeeping: ["Accounting"],
};

/** Alias terms that apply to a given label — precomputed per item and handed
 *  to cmdk as `keywords`. */
export function keywordsFor(label: string): string[] {
  const l = label.toLowerCase();
  const out: string[] = [];
  for (const [term, targets] of Object.entries(ALIASES)) {
    if (targets.some((t) => l.includes(t.toLowerCase()))) out.push(term);
  }
  return out;
}

/** cmdk filter: every query token must start a word of the label (or of an
 *  alias keyword). No scattered-letter matching. Whole-word starts score
 *  above mid-word substrings so 'art' ranks "Arts" over "Smart". */
export function programFilter(
  value: string,
  search: string,
  keywords?: string[],
): number {
  const split = (s: string) => s.toLowerCase().split(/[^a-z0-9#+]+/).filter(Boolean);
  const tokens = split(search);
  if (tokens.length === 0) return 1;

  const label = value.toLowerCase();
  const words = split(label);
  // Alias terms word-split like the query, so a hyphenated search ("x-ray" →
  // tokens "x","ray") still meets a hyphenated alias.
  const aliasWords = (keywords ?? []).flatMap(split);

  let score = 0;
  for (const token of tokens) {
    if (words.some((w) => w.startsWith(token))) {
      // Word-prefix: "nur" → "Nursing". First-word hits rank higher, so
      // "business" puts Business Administration above Music Business.
      score += words[0]?.startsWith(token) ? 4 : 3;
    } else if (aliasWords.some((a) => a.startsWith(token))) {
      score += 2; // student vocabulary: "x-ray"/"rn" → the aliased programs
    } else if (token.length >= 3 && label.includes(token)) {
      score += 1; // mid-word substring — only for tokens long enough to mean it
    } else {
      return 0; // every token must land somewhere
    }
  }
  return score;
}
