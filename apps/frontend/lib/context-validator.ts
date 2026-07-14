import promptTemplates from "../../../src/config/prompt-templates.json";

export interface ContextValidationResult {
    isValid: boolean;
    shouldCallModel: boolean;
    fallbackMessage?: string;
}

export function validateContext(
    context: string | string[] | null | undefined,
): ContextValidationResult {
    // No context provided
    if (context == null) {
        return {
            isValid: false,
            shouldCallModel: false,
            fallbackMessage: promptTemplates.fallbacks.emptyContext,
        };
    }

    // String context
    if (typeof context === "string") {
        if (context.trim().length === 0) {
            return {
                isValid: false,
                shouldCallModel: false,
                fallbackMessage: promptTemplates.fallbacks.emptyContext,
            };
        }

        return {
            isValid: true,
            shouldCallModel: true,
        };
    }

    // Array context
    if (Array.isArray(context)) {
        const hasContent = context.some(
            (item) => item.trim().length > 0,
        );

        if (!hasContent) {
            return {
                isValid: false,
                shouldCallModel: false,
                fallbackMessage: promptTemplates.fallbacks.emptyContext,
            };
        }

        return {
            isValid: true,
            shouldCallModel: true,
        };
    }

    return {
        isValid: false,
        shouldCallModel: false,
        fallbackMessage: promptTemplates.fallbacks.emptyContext,
    };
}