import aiPrompts from "../../../src/config/ai-prompts.json";
import promptTemplates from "../../../src/config/prompt-templates.json";

export interface PromptBuildInput {
    userQuestion: string;
    retrievedContext: string[];
}

export interface PromptBuildResult {
    systemPrompt: string;
}

export function buildPrompt(
    input: PromptBuildInput,
): PromptBuildResult {
    const context =
        input.retrievedContext.length > 0
            ? input.retrievedContext.join("\n\n")
            : "[NO CONTEXT AVAILABLE]";

    const systemPrompt = `
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

[PERSONA]

Name: ${aiPrompts.persona.name}

Role: ${aiPrompts.persona.role}

Purpose: ${aiPrompts.persona.purpose}

[SUPPORTED TOPICS]

${aiPrompts.scope.supportedTopics.join("\n")}

[UNSUPPORTED TOPICS]

${aiPrompts.scope.unsupportedTopics.join("\n")}

[CONTEXT AUTHORITY]

${aiPrompts.contextAuthority.rules.join("\n")}

If the answer is not available in the retrieved context:

${promptTemplates.fallbacks.emptyContext}

[RETRIEVED CONTEXT]

${context}

[USER QUESTION]

${input.userQuestion}
`;

    return {
        systemPrompt: systemPrompt.trim(),
    };
}