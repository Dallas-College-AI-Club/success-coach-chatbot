// NOT WIRED. Nothing imports this module. The production system prompt is the
// hand-written string in lib/system-prompt.ts, which route.ts uses.
//
// Kept deliberately, unlike the four guardrail validators deleted alongside it
// (#152): the label resolvers below are correct and reusable, and
// PromptBuildInput.retrievedContext is the designed integration point for
// retrieval when that lands.
//
// Do not wire buildPrompt() as-is without review — it interpolates user text
// into the system layer (which RFC-0004 exists to prevent) and omits
// declineBehavior and citationPolicy from ai-prompts.json entirely, so
// governed refusal wording would never reach the model.
import aiPrompts from "../../../src/config/ai-prompts.json";
import promptTemplates from "../../../src/config/prompt-templates.json";

import { PROGRAMS } from "@/features/onboarding/programs";
import { directionOptions, schoolOptions } from "@/features/onboarding/questions";
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

function resolveMajorLabel(
    major?: string | null,
): string | null {
    if (!major) {
        return null;
    }

    return (
        PROGRAMS.find(
            (program) => program.code === major,
        )?.label ?? major
    );
}

function resolveInstitutionLabel(
    targetInstitution?: string | null,
): string | null {
    if (!targetInstitution) {
        return null;
    }

    return (
        schoolOptions.find(
            (option) =>
                option.contribs.target_institution ===
                targetInstitution,
        )?.label ?? targetInstitution
    );
}

function resolveTransferDirectionLabel(
    transferDirection?: string | null,
): string | null {
    if (!transferDirection) {
        return null;
    }

    return (
        directionOptions.find(
            (option) =>
                option.contribs.transfer_direction ===
                transferDirection,
        )?.label ?? transferDirection
    );
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
        const majorLabel = resolveMajorLabel(
            payload.major,
        );
        lines.push(`Major: ${majorLabel}`);
    }

    if (payload.target_institution) {
        const institutionLabel =
            resolveInstitutionLabel(
                payload.target_institution,
            );
        lines.push(
            `Target Institution: ${institutionLabel}`,
        );
    }

    if (payload.transfer_direction) {
        const transferDirectionLabel =
            resolveTransferDirectionLabel(
                payload.transfer_direction,
            );
        lines.push(
            `Transfer Direction: ${transferDirectionLabel}`,
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
    if (persona) {
        return persona;
    }

    const {
        name,
        role,
        purpose,
        generalPurposeAssistant,
    } = aiPrompts.persona;

    return [
        `Name: ${name}`,
        `Role: ${role}`,
        `Purpose: ${purpose}`,
        `General Purpose Assistant: ${String(generalPurposeAssistant)}`,
    ].join("\n");
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