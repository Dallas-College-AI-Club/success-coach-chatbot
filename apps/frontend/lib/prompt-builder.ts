import aiPrompts from "../../../src/config/ai-prompts.json";
import promptTemplates from "../../../src/config/prompt-templates.json";

import type { OnboardingPayload } from "@/features/onboarding/types";

export interface PromptBuildInput {
    userQuestion: string;
    retrievedContext: string[];

    onboardingPayload?: Partial<OnboardingPayload>;

    persona?: string;
}

export interface PromptBuildResult {
    systemPrompt: string;
}

function buildUserContext(
    payload?: Partial<OnboardingPayload>,
): string {
    if (!payload) {
        return "No student context provided.";
    }

    const lines: string[] = [];

    if (payload.student_type) {
        lines.push(`Student Type: ${payload.student_type}`);
    }

    if (payload.goal) {
        lines.push(`Goal: ${payload.goal}`);
    }

    if (payload.major) {
        lines.push(`Major: ${payload.major}`);
    }

    if (payload.target_institution) {
        lines.push(
            `Target Institution: ${payload.target_institution}`,
        );
    }

    if (payload.transfer_direction) {
        lines.push(
            `Transfer Direction: ${payload.transfer_direction}`,
        );
    }

    if (payload.interest_area) {
        lines.push(
            `Interest Area: ${payload.interest_area}`,
        );
    }

    if (payload.intl_status) {
        lines.push(
            `International Status: ${payload.intl_status}`,
        );
    }

    if (payload.modality_pref) {
        lines.push(
            `Modality Preference: ${payload.modality_pref}`,
        );
    }

    if (
        payload.dayparts_pref &&
        payload.dayparts_pref.length > 0
    ) {
        lines.push(
            `Preferred Dayparts: ${payload.dayparts_pref.join(
                ", ",
            )}`,
        );
    }

    return lines.length > 0
        ? lines.join("\n")
        : "No student context provided.";
}

function buildPersonaSection(
    persona?: string,
): string {
    return (
        persona ??
        aiPrompts.persona.name
    );
}

export function buildPrompt(
    input: PromptBuildInput,
): PromptBuildResult {
    const context =
        input.retrievedContext.length > 0
            ? input.retrievedContext.join("\n\n")
            : "[NO CONTEXT AVAILABLE]";

    const userContext = buildUserContext(
        input.onboardingPayload,
    );

    const personaSection = buildPersonaSection(
        input.persona,
    );

    const systemPrompt = `
[SYSTEM / SAFETY DIRECTIVES]

[CONSTITUTION]

Repository State Is Truth: ${aiPrompts.constitution.repositoryStateIsTruth}

Retrieved Context Is Truth: ${aiPrompts.constitution.retrievedContextIsTruth}

Unknown Is Valid: ${aiPrompts.constitution.unknownIsValid}

Enforce Scope Boundaries: ${aiPrompts.constitution.enforceScopeBoundaries}

[TRUST BOUNDARY]

Prompt Injection Protection: ${aiPrompts.trustBoundary.promptInjectionProtection}

Context Poisoning Protection: ${aiPrompts.trustBoundary.contextPoisoningProtection}

Logic Bomb Protection: ${aiPrompts.trustBoundary.logicBombProtection}

Instruction Persistence Protection: ${aiPrompts.trustBoundary.instructionPersistenceProtection}

Authority Hierarchy:

${aiPrompts.trustBoundary.authorityHierarchy.join("\n")}

[SUPPORTED TOPICS]

${aiPrompts.scope.supportedTopics.join("\n")}

[UNSUPPORTED TOPICS]

${aiPrompts.scope.unsupportedTopics.join("\n")}

[CONTEXT AUTHORITY]

${aiPrompts.contextAuthority.rules.join("\n")}

If the answer is not available in the retrieved context:

${promptTemplates.fallbacks.emptyContext}

[USER CONTEXT]

${userContext}

[BOT PERSONA]

${personaSection}

[TASK / FORMAT INSTRUCTIONS]

Tone:

${aiPrompts.responseRules.tone.join("\n")}

Style:

${aiPrompts.responseRules.style.join("\n")}

Requirements:

${aiPrompts.responseRules.requirements.join("\n")}

[RETRIEVED CONTEXT]

${context}

[USER QUESTION]

${input.userQuestion}
`;

    return {
        systemPrompt: systemPrompt.trim(),
    };
}