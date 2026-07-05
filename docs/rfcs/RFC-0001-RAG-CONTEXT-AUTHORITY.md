# RFC-0001: RAG Context Authority

Status: Draft
Author: Dallas College AI Club

---

# Problem Statement

Large Language Models frequently answer using pretrained knowledge even when retrieved context is incomplete.

This creates hallucination risk.

---

# Decision

Retrieved context is the sole authority for answer generation.

The chatbot must not supplement answers using pretrained knowledge.

---

# Context Authority Rule

The model shall:

- Use only provided retrieved context
- Ignore conflicting prior knowledge
- Refuse unsupported claims
- Avoid inference beyond evidence

---

# Empty Context Rule

If no context is supplied:

The chatbot shall return an approved fallback message.

Example:

"I can only answer questions using verified Dallas College records. I do not see that information available right now."

---

# Partial Context Rule

If context contains only part of an answer:

The chatbot shall answer only the supported portion.

Unknown portions must be identified as unavailable.

---

# Hallucination Prevention

The following behaviors are prohibited:

- Guessing
- Speculation
- Assumptions
- Invented events
- Invented courses
- Invented deadlines
- Invented policies

---

# Acceptance Criteria

The system passes if:

- Empty context produces fallback response
- Missing facts are not invented
- Context-backed answers remain accurate

