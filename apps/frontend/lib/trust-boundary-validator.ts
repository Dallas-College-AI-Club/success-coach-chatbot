import aiPrompts from "../../../src/config/ai-prompts.json";

export interface TrustBoundaryResult {
    passed: boolean;
    detectedPattern?: string;
    reason?: string;
}

export function validateTrustBoundary(
    userInput: string,
): TrustBoundaryResult {
    const normalized = userInput.toLowerCase();

    const patterns = aiPrompts.trustBoundary.ignoredPatterns;

    for (const pattern of patterns) {
        if (normalized.includes(pattern.toLowerCase())) {
            return {
                passed: false,
                detectedPattern: pattern,
                reason: "Prompt injection or trust-boundary violation detected.",
            };
        }
    }

    return {
        passed: true,
    };
}