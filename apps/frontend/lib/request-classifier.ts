export type RequestCategory =
    | "valid"
    | "programming"
    | "homework"
    | "creativeWriting"
    | "generalKnowledge"
    | "financialAdvice"
    | "medicalAdvice"
    | "legalAdvice"
    | "officialDetermination"
    | "sensitivePersonalInformation"
    | "compound";

export interface ClassificationResult {
    category: RequestCategory;
    requiresHumanReview: boolean;
    matchedRule?: string;
}

const CATEGORY_RULES: Record<
    Exclude<RequestCategory, "valid" | "compound">,
    string[]
> = {
    programming: [
        "write code",
        "write a python",
        "debug",
        "javascript",
        "typescript",
        "c#",
        "java",
        "program",
        "script",
    ],

    homework: [
        "solve this",
        "homework",
        "assignment",
        "quiz question",
        "test question",
        "math problem",
        "calculus problem",
    ],

    creativeWriting: [
        "write a story",
        "write a poem",
        "write a novel",
        "creative writing",
        "fictional story",
    ],

    generalKnowledge: [
        "capital of",
        "who won",
        "weather",
        "current events",
    ],

    financialAdvice: [
        "should i invest",
        "financial advice",
        "investment advice",
        "stock recommendation",
        "retirement advice",
    ],

    medicalAdvice: [
        "what medication",
        "medical advice",
        "diagnose",
        "treatment recommendation",
    ],

    legalAdvice: [
        "legal advice",
        "lawsuit",
        "attorney",
        "legal opinion",
    ],

    officialDetermination: [
        "will i get accepted",
        "will i graduate",
        "guarantee graduation",
        "financial aid amount",
        "will my credits transfer",
        "scholarship award",
        "accepted into program",
    ],

    sensitivePersonalInformation: [
        "social security",
        "ssn",
        "student id",
        "password",
        "bank account",
        "credit card",
    ],
};

export function classifyRequest(
    userInput: string,
): ClassificationResult {
    const normalized = userInput.toLowerCase();

    const matches: ClassificationResult[] = [];

    for (const [category, patterns] of Object.entries(CATEGORY_RULES)) {
        for (const pattern of patterns) {
            if (normalized.includes(pattern)) {
                matches.push({
                    category: category as RequestCategory,
                    requiresHumanReview:
                        category === "officialDetermination",
                    matchedRule: pattern,
                });

                break;
            }
        }
    }

    if (matches.length > 1) {
        return {
            category: "compound",
            requiresHumanReview: matches.some(
                (m) => m.requiresHumanReview,
            ),
            matchedRule: matches
                .map((m) => m.matchedRule)
                .join(", "),
        };
    }

    if (matches.length === 1) {
        return matches[0];
    }

    return {
        category: "valid",
        requiresHumanReview: false,
    };
}