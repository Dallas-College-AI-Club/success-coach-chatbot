import { jsonSchema } from "ai";
import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/client";
import { knowledgeEntry } from "@/lib/schema";

import {
    defineTool,
    isRecord,
    ToolInputError,
    type FlexibleSchema,
    type Tool,
} from "./types";

export const GET_PROGRAM_REQUIREMENTS_TOOL_NAME = "get_program_requirements";

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
    "Input is the program name as the user said it; partial names are fine.",
    "",
    "If several programs match, the tool returns ambiguous:true with a list of",
    "matching program names — show the user those names and ask which one they",
    "mean. Only after they answer, call again with the exact name they chose.",
    "When truncated is true the list is incomplete; ask the user to narrow the",
    "name rather than treating the list as exhaustive.",
    "Never list degree requirements this tool did not return.",
    "",
    "Cite `source_url` and the `catalog_year` (the catalog edition) when stating",
    "program facts — requirements differ by catalog year and the student needs",
    "to know which edition this is.",
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
            // Tokens whose squash is 1–2 chars ("C++"→"c", "C#"→"c") would
            // LIKE-match nearly every name; those match RAW against the raw
            // lowercased name instead, so the '+'/'#' the squash deletes
            // stays discriminating. Capped at 8 tokens to bound the SQL.
            const tokens = input.programName
                .toLowerCase()
                .split(/\s+/)
                .slice(0, 8)
                .map((raw) => ({ raw, sq: squash(raw) }))
                .filter((t) => t.sq);

            const rows = await getDb()
                .select({
                    name,
                    facts: knowledgeEntry.facts,
                    sourceUrl: knowledgeEntry.sourceUrl,
                    catalogYear: knowledgeEntry.catalogYear,
                })
                .from(knowledgeEntry)
                .where(
                    and(
                        eq(knowledgeEntry.docType, "program_map"),
                        ...tokens.map(({ raw, sq }) =>
                            sq.length >= 3
                                ? sql`regexp_replace(lower(${name}), '[^a-z0-9]', '', 'g') LIKE ${`%${sq}%`}`
                                : sql`lower(${name}) LIKE ${`%${raw}%`}`,
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
            const wanted = input.programName.trim().toLowerCase();
            const exact =
                rows.length === 1
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

            return {
                found: true,
                name: (facts.name as string | null | undefined) ?? row.name,
                award_type:
                    (facts.award_type as string | null | undefined) ?? null,
                total_credits:
                    (facts.total_credits as string | number | null | undefined) ??
                    null,
                groups: Array.isArray(facts.groups) ? facts.groups : [],
                source_url: row.sourceUrl,
                catalog_year: row.catalogYear ?? null,
            };
        },
    });
}
