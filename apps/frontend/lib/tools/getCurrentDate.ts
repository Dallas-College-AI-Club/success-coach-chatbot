import { systemClock, type Clock } from "./clock";
import { jsonSchema } from "ai";
import { defineTool, isRecord, ToolInputError, type FlexibleSchema, type Tool } from "./types";

export { GET_CURRENT_DATE_TOOL_NAME } from "./names";
import { GET_CURRENT_DATE_TOOL_NAME } from "./names";

/** Input accepted by the `get_current_date` tool. */
export interface GetCurrentDateInput {
    /** IANA time zone name, e.g. `America/Chicago`. Defaults to the configured zone. */
    timeZone?: string;
}

/**
 * What the tool returns. Every field describes the *same* instant.
 *
 * The tool returns all representations at once rather than taking a `format`
 * parameter. One less decision for the model is one less thing it can get
 * wrong, and the extra fields cost only a handful of tokens.
 */
export interface CurrentDateResult {
    /** Calendar date in the requested zone, ISO 8601 `YYYY-MM-DD`. */
    date: string;
    /** Wall-clock time in the requested zone, 24-hour `HH:mm:ss`. */
    time: string;
    /** English weekday name, e.g. `Tuesday`. */
    dayOfWeek: string;
    /** Full ISO 8601 timestamp with offset, e.g. `2026-07-17T09:30:00-05:00`. */
    iso8601: string;
    /** The same instant in UTC, e.g. `2026-07-17T14:30:00.000Z`. */
    utcIso8601: string;
    /** IANA zone the fields above are expressed in. */
    timeZone: string;
    /** UTC offset for this zone at this instant, e.g. `-05:00`. */
    utcOffset: string;
    /** Seconds since the Unix epoch. */
    unixSeconds: number;
}

/**
 * The description is the load-bearing part of the tool: it is the only thing the
 * model reads when deciding whether to call. It states what the tool does, the
 * cases that should trigger it, the cases that should not, and — most
 * importantly — that the model has no other way to know the date. Vague
 * descriptions are the usual root cause of a model answering from memory.
 */
const DESCRIPTION = [
    "Returns the current date and time read from the host system clock.",
    "",
    "Call this tool whenever answering the user requires knowing what 'now' is. That includes:",
    "- direct questions about today's date, the current time, or the day of the week",
    "- relative expressions such as 'today', 'tonight', 'tomorrow', 'this week', 'next month', 'right now'",
    "- arithmetic anchored to the present, such as how long until an event, how long since an event, or someone's age",
    "- deciding whether a date mentioned by the user is in the past or the future",
    "",
    "You have no internal clock and your training data does not tell you the current date.",
    "Never guess or assume the date; call this tool instead. It is cheap and always available.",
    "",
    "Do not call this tool for questions that do not depend on the current date or time.",
    "",
    "Returns a JSON object with: date (YYYY-MM-DD), time (HH:mm:ss, 24-hour), dayOfWeek,",
    "iso8601 (full timestamp with UTC offset), utcIso8601, timeZone, utcOffset, and unixSeconds.",
].join("\n");

/**
 * Supplied as JSON Schema rather than Zod. Both are valid `FlexibleSchema`
 * inputs; JSON Schema is used here because these descriptions are tuned for the
 * model and this keeps them the single source of truth, with no Zod-to-JSON
 * translation step in between.
 *
 * One consequence worth knowing: `jsonSchema()` carries no `validate` function,
 * so the AI SDK cannot enforce this schema at runtime — it describes the shape
 * to the model but does not check what comes back. `parseInput` below is
 * therefore the only validation, not a convenience layer on top of the schema.
 */
const INPUT_SCHEMA: FlexibleSchema<GetCurrentDateInput> = jsonSchema({
    type: "object",
    properties: {
        timeZone: {
            type: "string",
            description:
                "Optional IANA time zone name, e.g. 'America/Chicago', 'Europe/London', 'Asia/Tokyo', or 'UTC'. " +
                "Omit this to use the user's default time zone. Only pass a value when the user asks about a " +
                "specific place. Do not pass abbreviations like 'CST' or offsets like 'UTC-6'.",
        },
    },
    required: [],
    additionalProperties: false,
});

export interface GetCurrentDateOptions {
    /** Source of "now". Defaults to the real system clock. */
    clock?: Clock;
    /** Zone used when the model does not pass one. Defaults to the host's zone. */
    defaultTimeZone?: string;
}

/**
 * Builds the `get_current_date` tool.
 *
 * @example
 * // Driven by the model via the registry; {} → { date: "2026-07-17", ... }
 */
export function createGetCurrentDateTool(
    options: GetCurrentDateOptions = {},
): Tool<GetCurrentDateInput, CurrentDateResult> {
    const clock = options.clock ?? systemClock;
    const defaultTimeZone = options.defaultTimeZone ?? hostTimeZone();
    assertValidTimeZone(defaultTimeZone);

    return defineTool({
        name: GET_CURRENT_DATE_TOOL_NAME,
        description: DESCRIPTION,
        inputSchema: INPUT_SCHEMA,

        parseInput(raw: unknown): GetCurrentDateInput {
            // A model may legitimately send `{}`, or the SDK may hand us `undefined`
            // for a no-argument call. Both mean "use the defaults".
            if (raw === undefined || raw === null) return {};
            if (!isRecord(raw)) {
                throw new ToolInputError(
                    `Expected an object, received ${Array.isArray(raw) ? "array" : typeof raw}.`,
                );
            }

            const { timeZone } = raw;
            if (timeZone === undefined || timeZone === null || timeZone === "") return {};
            if (typeof timeZone !== "string") {
                throw new ToolInputError(`"timeZone" must be a string, received ${typeof timeZone}.`);
            }
            assertIanaTimeZone(timeZone);
            return { timeZone: timeZone.trim() };
        },

        execute(input: GetCurrentDateInput): CurrentDateResult {
            if (process.env.NODE_ENV !== 'production') {
                console.log('[TOOL] get_current_date invoked');
            }

            const timeZone = input.timeZone ?? defaultTimeZone;
            assertValidTimeZone(timeZone);

            const result = describeInstant(clock(), timeZone);

            return result;
        },
    });
}

/** Formats an instant for a zone. Exported for direct use outside the agent loop. */
export function describeInstant(instant: Date, timeZone: string): CurrentDateResult {
    if (Number.isNaN(instant.getTime())) {
        throw new RangeError("describeInstant: received an invalid Date.");
    }
    assertValidTimeZone(timeZone);

    const parts = formatParts(instant, timeZone);
    const date = `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}`;
    const time = `${parts.hour}:${parts.minute}:${parts.second}`;
    const utcOffset = normalizeOffset(parts.timeZoneName);

    return {
        date,
        time,
        dayOfWeek: parts.weekday,
        iso8601: `${date}T${time}${utcOffset === "+00:00" ? "Z" : utcOffset}`,
        utcIso8601: instant.toISOString(),
        timeZone,
        utcOffset,
        unixSeconds: Math.floor(instant.getTime() / 1000),
    };
}

/** Throws a `RangeError` with an actionable message if `timeZone` is not a known IANA zone. */
export function assertValidTimeZone(timeZone: string): void {
    try {
        new Intl.DateTimeFormat("en-US", { timeZone });
    } catch {
        throw new RangeError(
            `Unknown time zone: ${JSON.stringify(timeZone)}. ` +
            `Use an IANA time zone name such as "America/Chicago", "Europe/London", or "UTC".`,
        );
    }
}

/**
 * Validates a zone supplied by a *model*, which is stricter than
 * `assertValidTimeZone`: it also rejects legacy abbreviations.
 *
 * ICU accepts abbreviations, but silently maps them to zones nobody means:
 *
 *     Intl…({ timeZone: "EST" }).resolvedOptions().timeZone  // "America/Panama"
 *     Intl…({ timeZone: "MST" }).resolvedOptions().timeZone  // "America/Phoenix"
 *
 * America/Panama never observes daylight saving, so a model that helpfully
 * passes "EST" for New York gets an answer that is silently one hour wrong for
 * eight months of the year — no exception, no warning, just a wrong time. The
 * tool description already asks models not to send abbreviations; this makes it
 * enforced rather than merely requested. Rejecting turns a silent wrong answer
 * into an error the model can read and retry from with a real zone name.
 *
 * @throws {ToolInputError} for abbreviations and unknown zones alike.
 */
export function assertIanaTimeZone(timeZone: string): void {
    const trimmed = timeZone.trim();
    const isAreaLocation = trimmed.includes("/");
    const isUtcAlias = /^(UTC|GMT)$/i.test(trimmed);

    if (!isAreaLocation && !isUtcAlias) {
        throw new ToolInputError(
            `Ambiguous time zone: ${JSON.stringify(timeZone)}. Abbreviations and offsets are not accepted ` +
            `because they resolve to unintended zones (for example "EST" resolves to America/Panama, which ` +
            `never observes daylight saving). Use a full IANA name such as "America/New_York", ` +
            `"America/Chicago", "Europe/London", "Asia/Tokyo", or "UTC".`,
        );
    }

    try {
        assertValidTimeZone(trimmed);
    } catch (error) {
        throw new ToolInputError(error instanceof Error ? error.message : String(error));
    }
}

/** The host's own time zone, e.g. `America/Chicago`. Falls back to UTC. */
export function hostTimeZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

type RequiredParts = {
    year: string;
    month: string;
    day: string;
    hour: string;
    minute: string;
    second: string;
    weekday: string;
    timeZoneName: string;
};

const PART_KEYS = ["year", "month", "day", "hour", "minute", "second", "weekday", "timeZoneName"] as const;

function formatParts(instant: Date, timeZone: string): RequiredParts {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        // `hourCycle: "h23"` rather than `hour12: false`: the latter renders midnight
        // as "24" on some ICU builds, which would produce an invalid ISO timestamp.
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        weekday: "long",
        timeZoneName: "longOffset",
    });

    const found: Partial<Record<string, string>> = {};
    for (const part of formatter.formatToParts(instant)) {
        found[part.type] = part.value;
    }

    for (const key of PART_KEYS) {
        if (found[key] === undefined) {
            throw new Error(`Intl.DateTimeFormat did not return a "${key}" part for zone ${timeZone}.`);
        }
    }
    return found as RequiredParts;
}

/** `"GMT+09:00"` -> `"+09:00"`, `"GMT-5"` -> `"-05:00"`, `"GMT"` -> `"+00:00"`. */
function normalizeOffset(timeZoneName: string): string {
    const match = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(timeZoneName);
    if (!match) return "+00:00"; // Plain "GMT" — zero offset.
    const [, sign, hours, minutes] = match;
    return `${sign}${hours!.padStart(2, "0")}:${minutes ?? "00"}`;
}
