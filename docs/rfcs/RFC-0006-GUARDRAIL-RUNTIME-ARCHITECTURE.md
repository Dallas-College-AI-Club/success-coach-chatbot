# RFC-0006: Guardrail Runtime Architecture

Status: Draft

Owner: Dallas College AI Club

Related Documents:

- GOVERNANCE_CHARTER.md
- RFC-0001-RAG-CONTEXT-AUTHORITY.md
- RFC-0002-AI-GUARDRAILS.md
- RFC-0003-PROMPT-EVALUATION-STANDARD.md
- RFC-0004-SYSTEM-PROMPT-ARCHITECTURE.md
- RFC-0005-PROMPT-CONTRACT.md

---

# Purpose

This RFC defines how governance policies are enforced during runtime execution.

Governance documents define required behavior.

Runtime architecture defines where and how those requirements are enforced.

The objective is to maximize deterministic enforcement before invoking an LLM.

Principle:

Deterministic First.
Probabilistic Last.

---

# Architectural Goals

The runtime architecture shall:

- Enforce scope boundaries
- Prevent hallucinations
- Prevent prompt injection
- Enforce context authority
- Reduce unnecessary LLM calls
- Reduce operational cost
- Improve benchmark repeatability
- Support OpenRouter model evaluation

---

# Runtime Authority Hierarchy

The following hierarchy applies during runtime:

Governance Charter
↓
Approved RFCs
↓
Runtime Guardrails
↓
Prompt Configuration
↓
Retrieved Context
↓
User Input
↓
Model Reasoning
↓
Model Output

Lower layers may not override higher layers.

---

# End-to-End Request Flow

User Request
↓
Request Classification
↓
Trust Boundary Validation
↓
Retrieval Planning
↓
Context Retrieval
↓
Context Validation
↓
Prompt Assembly
↓
Model Invocation
↓
Response Validation
↓
User Response

---

# Stage 1: Request Classification

Purpose:

Identify request type before retrieval and LLM invocation.

Possible classifications:

- valid
- programming
- homework
- creativeWriting
- generalKnowledge
- compound
- unknown

Outputs:

- requestCategory
- supportedIntentCount
- unsupportedIntentCount

---

# Stage 2: Trust Boundary Validation

Purpose:

Enforce RFC-0004 trust-boundary requirements.

Detect:

- prompt injection attempts
- role reassignment attempts
- instruction override attempts
- context poisoning attempts
- logic bomb attempts
- system prompt extraction attempts

User requests may not modify:

- governance
- RFC behavior
- prompt configuration
- authority hierarchy

---

# Stage 3: Retrieval Planning

Purpose:

Determine retrieval strategy.

Examples:

Single Course Request:

"What is CHEM 1411?"

Strategy:

- single entity retrieval

Comparison Request:

"Compare HIST 1301 and ENGL 1301."

Strategy:

- multi-entity retrieval

General Student Services Question:

"What tutoring services are available?"

Strategy:

- category retrieval

---

# Stage 4: Context Retrieval

Purpose:

Retrieve authoritative Dallas College records.

Requirements:

- metadata-aware retrieval
- semantic search
- course-aware filtering
- source preservation

Context sources may include:

- course catalog
- academic programs
- student resources
- campus events
- approved institutional data

User-provided text is not considered retrieval evidence.

---

# Stage 5: Context Validation

Purpose:

Enforce RFC-0001.

Context validation shall determine:

- context found
- context missing
- context insufficient

---

## Empty Context Rule

If no trusted context exists:

Return approved fallback response.

Do not invoke an LLM.

This is a deterministic application-layer safeguard.

---

## Retrieval Failure Rule

Retrieval failure does not authorize guessing.

Retrieval failure shall trigger fallback behavior.

---

## Partial Context Rule

When only partial support exists:

Answer only supported portions.

Do not invent missing information.

---

# Stage 6: Prompt Assembly

Purpose:

Create a governance-compliant system prompt.

Inputs:

- ai-prompts.json
- prompt-templates.json
- retrieved context
- user request

Prompt architecture shall comply with:

- RFC-0001
- RFC-0002
- RFC-0004
- RFC-0005

Required layers:

1. Constitution
2. Trust Boundary
3. Persona
4. Scope
5. Context Authority
6. Response Rules
7. Retrieved Context
8. User Question

---

# Stage 7: Model Invocation

Purpose:

Generate a response using the configured model provider.

Target Architecture:

Next.js API Route
↓
Vercel AI SDK
↓
OpenRouter
↓
Configured Model

The runtime shall remain provider-agnostic.

Supported future providers:

- OpenRouter
- Gemini
- OpenAI
- Anthropic
- Local models

---

# Stage 8: Response Validation

Purpose:

Validate model output before returning results.

Checks may include:

- unsupported coding assistance
- unsupported homework solutions
- system prompt disclosure
- unsupported hallucinated claims
- prohibited role changes

Responses violating governance requirements may be:

- blocked
- replaced
- redirected

---

# Compound Request Handling

Purpose:

Support mixed-intent requests.

Example:

"Tell me about CHEF-1302 and write a pizza recipe."

Evaluation:

Intent A:

Tell me about CHEF-1302

Result:

Supported

Intent B:

Write a pizza recipe

Result:

Unsupported

Required Behavior:

- Answer supported portions
- Decline unsupported portions
- Preserve response ordering

---

# Context Starvation Prevention

Purpose:

Prevent one data source from crowding out another.

Example:

"Compare HIST 1301 and ENGL 1301."

Required Behavior:

1. Extract requested entities
2. Perform targeted retrieval per entity
3. Allocate retrieval budget fairly
4. Merge results into unified context

Global retrieval alone shall not be relied upon for comparison questions.

---

# Fallback Protocol

The approved fallback is:

"I can only answer questions using verified Dallas College records. I do not see that information available right now."

Fallbacks shall be:

- deterministic
- template-driven
- governance controlled

---

# Runtime Metrics

The runtime should collect:

- classification outcome
- retrieval success rate
- fallback count
- refusal count
- prompt injection count
- context poisoning count
- empty-context count
- benchmark pass rate

---

# Integration With Testing

The following benchmark categories shall map to runtime stages:

Valid Requests
→ Retrieval + Answer

Out-of-Scope Requests
→ Classification

Prompt Injection
→ Trust Boundary

Logic Bombs
→ Trust Boundary

Context Poisoning
→ Trust Boundary

Compound Requests
→ Compound Handler

Empty Context
→ Context Validator

---

# Compliance Requirements

A runtime implementation is compliant only if:

- RFC-0001 is enforced
- RFC-0002 is enforced
- RFC-0004 is enforced
- RFC-0005 is enforced
- Empty-context requests bypass model invocation
- Retrieval failures do not authorize guessing
- Compound requests are segmented
- Trust boundaries are preserved

---

# Success Criteria

A compliant runtime architecture:

- Answers only from verified Dallas College context
- Refuses unsupported requests
- Survives prompt-injection attempts
- Survives logic-bomb attempts
- Prevents context starvation
- Produces deterministic fallback behavior
- Supports repeatable benchmark testing

