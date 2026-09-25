import {
  catalogText,
  isCourseCode,
  isRecord,
  programCourseCode,
  programGroupRules,
} from "./course-details";

export interface ElectiveOptions {
  courses: string[];
  rule: string;
  source_url?: string;
  examples: boolean;
  excluded_required: string[];
}

export interface ElectiveSource {
  groups: unknown[];
  source_url?: string;
}

const courseCodes = (text: string) => [
  ...new Set(text.match(/\b[A-Z]{3,4} \d{4}\b/g) ?? []),
];
const areaName = (text: string) =>
  text
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/sciences/g, "science")
    .replace(/[^a-z]/g, "");

/** Resolve only explicit catalog references. Never infer eligibility from a
 * subject name or mix AAS general education with the bachelor/transfer core. */
export function resolveElectiveOptions(
  group: Record<string, unknown>,
  allProgramGroups: unknown[],
  programUrl: string,
  core?: ElectiveSource,
  aas?: ElectiveSource,
): Record<string, ElectiveOptions> {
  const entries = (Array.isArray(group.courses) ? group.courses : []).filter(
    (c): c is string => typeof c === "string",
  );
  const rules = programGroupRules(entries, group.rule);
  const required = new Set(
    allProgramGroups
      .filter(isRecord)
      .filter((g) => g.slot_kind === "fixed")
      .flatMap((g) =>
        (Array.isArray(g.courses) ? g.courses : []).flatMap(
          (c) => programCourseCode(c) ?? [],
        ),
      ),
  );
  const result: Record<string, ElectiveOptions> = {};
  for (const entry of entries) {
    if (programCourseCode(entry)) continue;
    const rule = rules.electives[entry] ?? "";
    let courses: string[] = [],
      sourceUrl = programUrl,
      resolvedRule = rule,
      examples = false;
    const namedCore = rule.match(
      /Must be selected from the Core Curriculum (.+?) Foundational Component Area\.?$/i,
    )?.[1];
    const coreGroup = core?.groups
      .filter(isRecord)
      .find(
        (g) => namedCore && areaName(String(g.name)) === areaName(namedCore),
      );
    if (coreGroup) {
      courses = (
        Array.isArray(coreGroup.courses) ? coreGroup.courses : []
      ).filter(isCourseCode);
      sourceUrl = core?.source_url ?? programUrl;
      resolvedRule = [rule, catalogText(coreGroup.rule)]
        .filter(Boolean)
        .join("\n");
    } else if (/Must be selected from the AAS Core Options for /i.test(rule)) {
      const category = rule.match(/AAS Core Options for (.+?)\.?$/i)?.[1];
      const aasGroup = aas?.groups
        .filter(isRecord)
        .find((g) => category && String(g.name).startsWith(category));
      if (aasGroup) {
        let choiceText = catalogText(aasGroup.rule) ?? "";
        if (category === "Humanities/Fine Arts") {
          // This source combines composition, speech and the actual humanities
          // choice. Only the final choose-one block belongs to this elective.
          const blocks = choiceText.split(
            /AND Select ONE 3-credit Hour Course from the following:/i,
          );
          choiceText = blocks.length === 3 ? blocks[2] : "";
        }
        courses = courseCodes(choiceText);
        examples = /\bXXXX\b/.test(choiceText);
        sourceUrl = aas?.source_url ?? programUrl;
        resolvedRule = rule;
      }
    } else {
      // Only the allowed/suggested list, not arbitrary codes mentioned in a
      // restriction, capstone note or prerequisite sentence.
      const list = rule.match(
        /(?:Suggested courses?(?: and pairings)?(?: are)?\s*:|Must be selected from the following:)\s*([\s\S]+)$/i,
      );
      if (list && !/\b(?:except|excluding|not|prerequisite)\b/i.test(list[1])) {
        courses = courseCodes(list[1]);
        examples = /Suggested courses?/i.test(list[0]);
      }
    }
    const unique = [...new Set(courses)];
    if (unique.length)
      result[entry] = {
        courses: unique.filter((code) => !required.has(code)),
        rule: resolvedRule,
        source_url: sourceUrl,
        examples,
        excluded_required: unique.filter((code) => required.has(code)),
      };
  }
  return result;
}

/** Persisted chats from before elective resolution may not contain this field. */
export function readElectiveOptions(value: unknown): ElectiveOptions | null {
  if (!isRecord(value) || !Array.isArray(value.courses)) return null;
  return {
    courses: [...new Set(value.courses.filter(isCourseCode))],
    rule: catalogText(value.rule) ?? "",
    source_url: catalogText(value.source_url) ?? undefined,
    examples: value.examples === true,
    excluded_required: Array.isArray(value.excluded_required)
      ? value.excluded_required.filter(isCourseCode)
      : [],
  };
}
