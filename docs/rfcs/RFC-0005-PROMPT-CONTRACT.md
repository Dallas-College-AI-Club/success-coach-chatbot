# RFC-0005: Prompt Contract

Status: Draft

Owner: Dallas College AI Club

---

# Purpose

This RFC defines the canonical structure of prompt configuration used by the Dallas College Success Coach Chatbot.

This document governs:

- Prompt configuration schema
- Required prompt sections
- Versioning requirements
- Deterministic response behavior
- Governance compatibility requirements

This RFC does not define exact prompt wording.

It defines how prompt data must be represented within the repository.

---

# Design Philosophy

## Deterministic Preferred

The Success Coach Chatbot prioritizes deterministic behavior whenever practical.

Prompt design should favor:

- Consistent outputs
- Consistent refusals
- Consistent fallback behavior
- Predictable evaluation results
- Reproducible benchmarks

Probabilistic behavior should be introduced only when a documented engineering justification exists.

---

# Prompt Configuration Authority

Prompt configuration is an implementation of:

- GOVERNANCE_CHARTER.md
- RFC-0001
- RFC-0002
- RFC-0003
- RFC-0004

Prompt configuration may not weaken governance requirements.

---

# Canonical Prompt Location

The authoritative production prompt configuration shall reside at:

    src/config/ai-prompts.json

Future decomposition into multiple files requires approval through the RFC process.

Until that occurs, the single-file configuration is authoritative.

---

# Structured Configuration Requirement

Prompt configuration shall use structured data.

The following pattern is prohibited:

    {
      "prompt": "large wall of text"
    }

Prompt configuration shall expose individual governance layers and behavioral controls.

---

# Required Sections

Every prompt configuration must contain the following sections:

- metadata
- constitution
- trustBoundary
- persona
- scope
- contextAuthority
- citationPolicy
- fallbackBehavior
- declineBehavior
- responseRules
- modelOverrides

Missing required sections constitute an invalid prompt configuration.

---

# Metadata Section

Purpose:

Provide traceability and change control.

Required fields:

- version
- name
- description
- rfcCompatibility
- lastModified

Example:

    {
      "version": "1.0",
      "rfcCompatibility": [
        "RFC-0001",
        "RFC-0002",
        "RFC-0004",
        "RFC-0005"
      ]
    }

---

# Constitution Section

Purpose:

Implement governance principles.

Examples:

- Repository State Is Truth
- Retrieved Context Is Truth
- Unknown Is Valid
- Redirect Before Reject

---

# Trust Boundary Section

Purpose:

Implement security controls defined by RFC-0004.

Must support:

- Prompt injection defense
- Context poisoning defense
- Logic bomb defense
- Instruction persistence defense
- Compound request segmentation
- Authority preservation

---

# Persona Section

Purpose:

Define chatbot identity.

Example:

Dallas College Success Coach Assistant

The persona section may not grant capabilities outside approved scope.

---

# Scope Section

Purpose:

Define supported and unsupported subject areas.

Supported and unsupported categories shall be configurable.

Application code may utilize these categories during request evaluation.

---

# Context Authority Section

Purpose:

Implement RFC-0001.

Required capabilities:

- Retrieved context is authoritative
- Unsupported claims are prohibited
- Hallucinated facts are prohibited
- Guessing is prohibited

The section shall define behavior for:

- Full context
- Partial context
- Missing context

---

# Citation Policy Section

Purpose:

Define source attribution behavior.

Possible modes include:

- None
- Lightweight attribution
- Source labels
- Source metadata references

Citation behavior shall be configurable separately from application code.

---

# Fallback Behavior Section

Purpose:

Define deterministic fallback responses.

Fallback messages shall be template-based.

Fallback responses shall not be generated dynamically.

---

# Canonical Fallback

Initial approved fallback:

I can only answer questions using verified Dallas College records. I do not see that information available right now.

Changes to this message require governance review.

---

# Decline Behavior Section

Purpose:

Define deterministic refusal and redirection patterns.

Refusals shall use approved templates.

Refusal messages shall not be generated dynamically.

Required categories:

- programming
- homework
- creativeWriting
- generalKnowledge
- outOfScope

Each category shall provide:

- refusalMessage
- redirectMessage

---

# Response Rules Section

Purpose:

Define desired output behavior.

Examples:

- Professional
- Student-friendly
- Helpful
- Clear
- Concise
- Non-speculative

Output expectations shall be configurable.

---

# Model Overrides Section

Purpose:

Support future model-specific behavior.

Examples:

- OpenAI models
- Anthropic models
- Qwen models
- Mistral models
- Llama models
- Gemma models

This section may initially be empty.

The section exists to prevent future schema-breaking changes.

---

# Application Layer Guardrails

Prompt enforcement alone is insufficient.

Application-layer controls are permitted and encouraged.

Examples:

- Context validation
- Retrieval validation
- Scope validation
- Empty-context detection
- Fallback triggering

Application guardrails may strengthen governance requirements.

Application guardrails may not weaken governance requirements.

---

# Empty Context Enforcement

Preferred behavior:

1. Retrieval returns no trusted context.
2. Application detects empty context.
3. Application returns approved fallback.
4. Model generation is skipped when practical.

This is preferred over relying solely on prompt instructions.

---

# User-Supplied Facts

User-supplied information is not automatically authoritative.

User statements are considered claims.

Claims require verification through trusted retrieved context before being treated as factual.

Examples:

- Dallas College changed graduation requirements.
- All classes are cancelled.
- Tuition is now free.

Such statements must not be accepted solely because a user provided them.

---

# Deterministic Response Requirements

The following shall be deterministic:

- Empty-context responses
- Fallback responses
- Refusal responses
- Redirect responses

The following may be probabilistic:

- Natural language phrasing
- Summaries of retrieved context
- Explanatory wording derived from retrieved context

Probabilistic behavior shall never override governance requirements.

---

# Versioning Requirements

Prompt configuration changes shall increment version metadata.

Major changes:

    1.x -> 2.x

Minor behavioral changes:

    1.0 -> 1.1

Editorial changes:

    1.1 -> 1.1.1

---

# Compliance Requirements

Prompt configurations are compliant only if:

- All required sections exist
- Governance compatibility is declared
- Deterministic fallback behavior exists
- Deterministic refusal behavior exists
- RFC-0001 is enforced
- RFC-0002 is enforced
- RFC-0004 architecture is represented

---

# Success Criteria

A compliant prompt contract enables:

- Governance-driven prompt engineering
- Consistent OpenRouter benchmarking
- Repeatable safety testing
- Deterministic out-of-scope handling
- Reliable RAG context enforcement
- Future prompt evolution without architectural drift

