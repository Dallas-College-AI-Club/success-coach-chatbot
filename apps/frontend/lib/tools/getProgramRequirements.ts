import { jsonSchema } from "ai";
import { and, eq, inArray, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/client";
import { knowledgeEntry } from "@/lib/schema";

import {
    defineTool,
    isRecord,
    ToolInputError,
    type FlexibleSchema,
    type Tool,
} from "./types";

// Name lives in the client-safe manifest so the UI can label the tool
// without importing this module (which pulls in the DB client).
export { GET_PROGRAM_REQUIREMENTS_TOOL_NAME } from "./names";
import { GET_PROGRAM_REQUIREMENTS_TOOL_NAME } from "./names";

export interface GetProgramRequirementsInput {
    programName: string;
}

export interface ProgramRequirementsResult {
    found: boolean;

    /** Set when several programs match; the assistant must ask which one. */
    ambiguous?: boolean;
    matches?: string[];
    /** True when more programs matched than `matches` shows. */
    truncated?: boolean;

    name?: string | null;
    award_type?: string | null;
    total_credits?: string | number | null;
    groups?: unknown[];
    source_url?: string;
    catalog_year?: string | null;
    /** Core component areas a group defers to, resolved to their real course
     *  lists. A degree plan says "Life and Physical Sciences XXXX (CB030)";
     *  the courses that satisfy it live on the Core Curriculum page. */
    component_areas?: {
        code: string;
        name: string | null;
        courses: string[];
        choose: string;
        more_not_shown?: number;
    }[];
    /** Real catalog title per course code in this plan, so the model never
     *  supplies one itself. */
    course_titles?: Record<string, string>;
}

const DESCRIPTION = [
    "Returns the verified course requirements for a Dallas College degree or certificate.",
    "",
    "Call this tool whenever the user asks what courses a program requires.",
    "",
    "Examples:",
    '- "What courses do I need for an Associate of Science?"',
    '- "What are the requirements for the Nursing field of study?"',
    '- "What classes are in the Cybersecurity certificate?"',
    "",
    "Pass ONLY the program name, not the student's whole question.",
    "Input is the program name as the user said it; partial names are fine.",
    'If the user mentioned a program code (like "CORE-42"), keep it in',
    "programName exactly as they typed it — codes find programs whose",
    "catalog title differs from their common name.",
    "",
    "If several programs match, the tool returns ambiguous:true with a list of",
    "matching program names — show the user those names and ask which one they",
    "mean. Only after they answer, call again with the exact name they chose.",
    "When truncated is true the list is incomplete; ask the user to narrow the",
    "name rather than treating the list as exhaustive.",
    "Never list degree requirements this tool did not return.",
    "",
    "When a requirement reads like a placeholder (\"Life and Physical",
    "Sciences XXXX (CB030)\"), the real course list comes back in",
    "`component_areas` -- give the student those courses, and never show",
    "them the placeholder text.",
    "",
    "`course_titles` gives the real catalog title for each course code — use",
    "those titles verbatim and never write a title of your own.",
    "",
    "State the `catalog_year` (the catalog edition) when giving program",
    "requirements — they differ by year and the student needs to know which",
    "edition this is. Do not write out the source URL; the interface shows the",
    "link itself.",
].join("\n");

const INPUT_SCHEMA: FlexibleSchema<GetProgramRequirementsInput> = jsonSchema({
    type: "object",
    properties: {
        programName: {
            type: "string",
            description:
                "Program name as the user phrased it, e.g. 'Associate of Science', 'Nursing', 'Cybersecurity certificate'.",
        },
    },
    required: ["programName"],
    additionalProperties: false,
});

const MAX_MATCHES = 12;
/** The Core Curriculum map, where deferred component-area requirements live. */
const CORE_PROGRAM_CODE = "CORE-42";
const MAX_AREA_COURSES = 40;

/**
 * Strip everything but letters and digits, lowercased, so the search matches
 * regardless of how either side spaces or punctuates a name. The catalog says
 * "Cyber Security A.A.S."; students type "cybersecurity". Both squash equal.
 */
function squash(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function createGetProgramRequirementsTool(): Tool<
    GetProgramRequirementsInput,
    Promise<ProgramRequirementsResult>
> {
    return defineTool({
        name: GET_PROGRAM_REQUIREMENTS_TOOL_NAME,
        description: DESCRIPTION,
        inputSchema: INPUT_SCHEMA,

        parseInput(raw: unknown): GetProgramRequirementsInput {
            if (!isRecord(raw)) {
                throw new ToolInputError(
                    `Expected an object, received ${Array.isArray(raw) ? "array" : typeof raw}.`,
                );
            }

            const { programName } = raw;

            if (typeof programName !== "string") {
                throw new ToolInputError(`"programName" must be a string.`);
            }

            const trimmed = programName.trim();

            if (!squash(trimmed)) {
                throw new ToolInputError(
                    `"programName" must contain letters or digits.`,
                );
            }

            return { programName: trimmed };
        },

        async execute(
            input: GetProgramRequirementsInput,
        ): Promise<ProgramRequirementsResult> {
            if (process.env.NODE_ENV !== "production") {
                console.log(
                    `[TOOL] get_program_requirements invoked for ${input.programName}`,
                );
            }

            const name = sql<string>`${knowledgeEntry.facts}->>'name'`;

            // Token-AND: every token must appear somewhere in the name, in
            // ANY order. The previous single contiguous LIKE on the whole
            // squashed phrase missed every program whose title interleaves a
            // word the student didn't type: "python certificate" never
            // matched "Python Developer Certificate" (nor java/web ditto),
            // and the model was told the program doesn't exist. Superset of
            // the old predicate — if the concatenation matched, each token
            // matches — so no previously-reachable program is lost.
            //
            // Tokens whose squash is 1–2 chars split two ways. "C++"/"C#"
            // carry a discriminating symbol the squash deletes — they match
            // RAW against the raw lowercased name, so C++ and C# programs
            // stay distinct. Everything else that short ("aa", "as", "of",
            // "a.a.") is award shorthand or noise: catalog names spell
            // awards out ("Associate of Arts"), so requiring '%aa%' just
            // sinks the whole AND ("psychology aa" must not miss the
            // Psychology row). Those tokens are dropped. Capped at 8 tokens
            // to bound the SQL.
            // "program(s)" is also dropped: zero of the 318 catalog names
            // contain that word (measured live 2026-08-11 — titles end in
            // A.A.S./Certificate/Degree), but the model habitually appends
            // it ("Emergency Medical Services Program") and one absent
            // token sinks the whole AND.
            const tokens = input.programName
                .toLowerCase()
                .split(/\s+/)
                .slice(0, 8)
                .map((raw) => ({ raw, sq: squash(raw) }))
                .filter(
                    (t) =>
                        t.sq &&
                        !/^programs?$/.test(t.sq) &&
                        (t.sq.length >= 3 || /[#+]/.test(t.raw)),
                );

            // Bare awards resolve to their catalog row by code. "A.A." names
            // one program, but token matching cannot find it: "aa" is dropped
            // as award shorthand, and that row is the ONLY "Associate of Arts"
            // whose title lacks the word "Degree" -- so "associate of arts
            // degree" returns its 12 siblings and not it.
            const bare = input.programName
                .toLowerCase()
                // Split on WHITESPACE, then strip punctuation per word. On
                // /[^a-z]+/ the award's own letters become separate words
                // ("a.a." -> "a","a") and the `an?` filler rule eats them.
                .split(/\s+/)
                .filter(
                    (w) =>
                        w &&
                        !/^(programs?|degrees?|plans?|the|an?|my|in|of|for|to)[.,]?$/.test(
                            w,
                        ),
                )
                .join("")
                .replace(/[^a-z]/g, "");
            const aliased =
                bare === "aa" || bare === "associatearts"
                    ? "AA_ARTS"
                    : bare === "as" || bare === "associatescience"
                      ? "AS_SCIENCE"
                      : null;
            if (aliased) {
                tokens.length = 0;
                tokens.push({ raw: aliased.toLowerCase(), sq: squash(aliased) });
            }

            if (tokens.length === 0) {
                return { found: false };
            }

            // Structural programs are FILED under a code, not a subject name:
            // the Core Curriculum's map is program_code 'CORE-42' with name
            // "Core Objectives and Foundational Component Areas" — no token
            // of "Core Curriculum (CORE-42)" AND-matches that name, so the
            // row was unreachable despite existing (2026-08-11 live audit).
            // A row whose squashed code appears in the squashed input matches
            // regardless of the name tokens. ≥4 chars so two-letter award
            // shorthand ("AA" inside "drama aa") can't trigger it.
            const inputSquash = squash(aliased ?? input.programName);
            const codeSquash = sql`regexp_replace(lower(coalesce(${knowledgeEntry.programCode}, '')), '[^a-z0-9]', '', 'g')`;
            const codeMentioned = sql`(length(${codeSquash}) >= 4 AND strpos(${inputSquash}, ${codeSquash}) > 0)`;

            const rows = await getDb()
                .select({
                    name,
                    // Evaluated once, in SQL — the tie-break below reuses this
                    // instead of re-implementing the predicate in JS.
                    codeMentioned: sql<boolean>`${codeMentioned}`,
                    programCode: knowledgeEntry.programCode,
                    facts: knowledgeEntry.facts,
                    sourceUrl: knowledgeEntry.sourceUrl,
                    catalogYear: knowledgeEntry.catalogYear,
                })
                .from(knowledgeEntry)
                .where(
                    and(
                        eq(knowledgeEntry.docType, "program_map"),
                        or(
                            and(
                                ...tokens.map(({ raw, sq }) =>
                                    sq.length >= 3
                                        ? sql`${knowledgeEntry.programNameSquashed} LIKE ${`%${sq}%`}`
                                        : sql`lower(${name}) LIKE ${`%${raw}%`}`,
                                ),
                            ),
                            codeMentioned,
                        ),
                    ),
                )
                .orderBy(name)
                .limit(MAX_MATCHES + 1);

            if (rows.length === 0) {
                return { found: false };
            }

            // Squashing can collide distinct programs ("C# Developer
            // Certificate" / "C++ Developer Certificate"). An exact
            // case-insensitive name match wins outright so those programs
            // stay reachable instead of being permanently ambiguous.
            //
            // A SINGLE match auto-selects only when the tokens appear in the
            // name IN ORDER. Token-AND matches in any order, so "computer
            // science" AND-matches "Associate of Science Degree in Computer
            // Engineering" — "science" from the award words, "computer" from
            // the subject — and (the catalog having no Computer Science
            // program map) that was the lone row: auto-selecting would hand
            // a CS student the Computer Engineering plan as fact. Out-of-
            // order single matches go back as an ambiguous candidate for the
            // student to confirm instead.
            const inOrder = (r: { name: string | null }): boolean => {
                const hay = squash(r.name ?? "");
                let at = 0;
                for (const { sq } of tokens) {
                    const hit = hay.indexOf(sq, at);
                    if (hit === -1) return false;
                    at = hit + sq.length;
                }
                return true;
            };
            // A code the student actually typed beats every name heuristic:
            // it is exact by construction ("CORE-42" names one row), and the
            // in-order gate below would wrongly demote it — the tokens of
            // "Core Curriculum (CORE-42)" never appear in the row's name.
            const codeHits = rows.filter((r) => r.codeMentioned);
            const wanted = input.programName.trim().toLowerCase();
            const exact =
                codeHits.length === 1
                    ? codeHits
                    : rows.length === 1
                      ? rows.filter(inOrder)
                      : rows.filter(
                            (r) => r.name?.trim().toLowerCase() === wanted,
                        );

            if (exact.length !== 1) {
                return {
                    found: true,
                    ambiguous: true,
                    truncated: rows.length > MAX_MATCHES,
                    matches: rows.slice(0, MAX_MATCHES).map((r) => r.name),
                };
            }

            const [row] = exact;
            const facts = (row.facts ?? {}) as Record<string, unknown>;
            const rawGroups = Array.isArray(facts.groups) ? facts.groups : [];

            // The catalog repeats one exclusion sentence once per forbidden
            // pair -- 11 copies of the same 368 characters in a single group,
            // 81% of this payload. Collapse by sentence, keep every pair.
            const groups = rawGroups.map((g) => {
                const grp = (g ?? {}) as Record<string, unknown>;
                const excl = Array.isArray(grp.exclusions) ? grp.exclusions : [];
                if (excl.length < 2) return grp;
                const byText = new Map<string, unknown[]>();
                for (const e of excl) {
                    const rec = (e ?? {}) as Record<string, unknown>;
                    const key = String(rec.raw_text ?? "");
                    const bucket = byText.get(key);
                    if (bucket) bucket.push(rec.courses);
                    else byText.set(key, [rec.courses]);
                }
                return {
                    ...grp,
                    exclusions: [...byText].map(([raw_text, combinations]) => ({
                        raw_text,
                        combinations,
                    })),
                };
            });

            // Resolve deferred core requirements. Both dialects appear: a CB
            // code embedded in a courses[] placeholder string (the A.A.), and
            // a structured component_area_code on the group (the transfer
            // degrees). slot_kind is NOT a signal -- 63 of 68 CB references
            // sit in groups marked "fixed", none in groups marked
            // "placeholder".
            const areaCodes = new Set<string>();
            for (const g of groups) {
                const grp = g as Record<string, unknown>;
                const cac = String(grp.component_area_code ?? "");
                if (/^CB\d{3}$/.test(cac)) areaCodes.add(cac);
                const cs = Array.isArray(grp.courses) ? grp.courses : [];
                for (const c of cs) {
                    const found = String(c).match(/\(CB\d{3}\)/g) ?? [];
                    for (const m of found) areaCodes.add(m.slice(1, -1));
                }
            }

            let componentAreas: ProgramRequirementsResult["component_areas"];
            if (areaCodes.size > 0 && row.programCode !== CORE_PROGRAM_CODE) {
                try {
                    // One row, one read: CORE-42 holds all nine component
                    // areas. Filtering its groups in JS beats a lateral join
                    // over jsonb here -- fewer moving parts, and the row is
                    // tiny.
                    const [core] = await getDb()
                        .select({ facts: knowledgeEntry.facts })
                        .from(knowledgeEntry)
                        .where(
                            and(
                                eq(knowledgeEntry.docType, "program_map"),
                                eq(
                                    knowledgeEntry.programCode,
                                    CORE_PROGRAM_CODE,
                                ),
                            ),
                        )
                        .limit(1);
                    const coreFacts = (core?.facts ?? {}) as Record<
                        string,
                        unknown
                    >;
                    const coreGroups = Array.isArray(coreFacts.groups)
                        ? coreFacts.groups
                        : [];
                    const coreRows = coreGroups
                        .map((g) => (g ?? {}) as Record<string, unknown>)
                        .filter((g) =>
                            areaCodes.has(String(g.component_area_code ?? "")),
                        )
                        .map((g) => ({
                            code: String(g.component_area_code),
                            areaName: (g.name ?? null) as string | null,
                            courses: g.courses,
                        }));
                    componentAreas = coreRows.map((c) => {
                        const all = Array.isArray(c.courses)
                            ? (c.courses as unknown[]).map(String)
                            : [];
                        return {
                            code: c.code,
                            name: c.areaName,
                            courses: all.slice(0, MAX_AREA_COURSES),
                            // The catalog does not assert these are the only
                            // options, so this wording must not either.
                            choose:
                                "The catalog lists these as courses that satisfy this requirement; take the number of credit hours the plan asks for.",
                            ...(all.length > MAX_AREA_COURSES
                                ? {
                                      more_not_shown:
                                          all.length - MAX_AREA_COURSES,
                                  }
                                : {}),
                        };
                    });
                } catch (err) {
                    // A failed resolution must not fail the lookup -- the plan
                    // itself is still a correct answer -- but it must not be
                    // silent either, or a broken join looks like "this program
                    // defers nothing".
                    console.error(
                        "[TOOL] get_program_requirements: component-area resolution failed:",
                        err instanceof Error ? err.message : String(err),
                    );
                    componentAreas = undefined;
                }
            }

            // Titles for every course code in the plan. A degree plan stores
            // bare codes, and a model asked to present one writes the titles
            // in anyway: it rendered EDUC 1300 as "Introduction to Education"
            // (really "Learning Framework") and HIST 1301 as "American
            // History" (really "United States History I"), while getting
            // ENGL 1301 right only because it had looked that one up
            // (observed live 2026-08-11). Handing over the titles removes the
            // gap it was filling.
            const codes = new Set<string>();
            for (const g of groups) {
                for (const c of Array.isArray(
                    (g as Record<string, unknown>).courses,
                )
                    ? ((g as Record<string, unknown>).courses as unknown[])
                    : []) {
                    const t = String(c).trim();
                    if (/^[A-Z]{3,4} \d{4}$/.test(t)) codes.add(t);
                }
            }
            for (const a of componentAreas ?? []) {
                for (const c of a.courses) codes.add(c);
            }

            let courseTitles: Record<string, string> | undefined;
            if (codes.size > 0) {
                try {
                    const titleRows = await getDb()
                        .select({
                            code: knowledgeEntry.courseCode,
                            title: sql<
                                string | null
                            >`${knowledgeEntry.facts}->>'title'`,
                        })
                        .from(knowledgeEntry)
                        .where(
                            and(
                                eq(knowledgeEntry.docType, "course"),
                                inArray(knowledgeEntry.courseCode, [...codes]),
                            ),
                        );
                    const map: Record<string, string> = {};
                    for (const t of titleRows) {
                        if (t.code && t.title) map[t.code] = t.title;
                    }
                    if (Object.keys(map).length) courseTitles = map;
                } catch (err) {
                    console.error(
                        "[TOOL] get_program_requirements: course-title lookup failed:",
                        err instanceof Error ? err.message : String(err),
                    );
                }
            }

            return {
                found: true,
                name: (facts.name as string | null | undefined) ?? row.name,
                award_type:
                    (facts.award_type as string | null | undefined) ?? null,
                total_credits:
                    (facts.total_credits as string | number | null | undefined) ??
                    null,
                groups,
                source_url: row.sourceUrl,
                catalog_year: row.catalogYear ?? null,
                ...(componentAreas?.length
                    ? { component_areas: componentAreas }
                    : {}),
                ...(courseTitles ? { course_titles: courseTitles } : {}),
            };
        },
    });
}
