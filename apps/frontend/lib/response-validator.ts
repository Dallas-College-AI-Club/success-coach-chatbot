export interface ResponseValidationResult {
    passed: boolean;
    violation?: string;
}

const BLOCKED_PATTERNS = [
    // Code generation
    "def ",
    "function(",
    "class ",
    "import ",
    "pip install",

    // Admissions / program guarantees
    "guaranteed admission",
    "you will be accepted",
    "you will definitely be accepted",
    "guaranteed program acceptance",

    // Graduation guarantees
    "guaranteed graduation",
    "you will definitely graduate",

    // Financial aid / scholarship guarantees
    "guaranteed financial aid",
    "guaranteed scholarship",
    "you will receive this scholarship",

    // Transfer-credit guarantees
    "your credits will transfer",
    "transfer credits will transfer",

    // Medical advice
    "take this medication",
    "i recommend this medication",

    // Financial advice
    "investment recommendation",
    "buy this stock",
    "invest in this stock",

    // Legal advice
    "legal advice",
];

export function validateResponse(
    response: string,
): ResponseValidationResult {
    const normalized = response.toLowerCase();

    for (const pattern of BLOCKED_PATTERNS) {
        if (normalized.includes(pattern.toLowerCase())) {
            return {
                passed: false,
                violation: pattern,
            };
        }
    }

    return {
        passed: true,
    };
}