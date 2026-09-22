# Archive

Historical documents, superseded by a current design or already implemented differently.
Kept for attribution and engineering history, not as instructions for how the system works
today — see [../ARCHITECTURE.md](../ARCHITECTURE.md) and [../DECISIONS.md](../DECISIONS.md)
for that.

| File | Original path | Date / issue | Why superseded | Superseded by |
|---|---|---|---|---|
| [2026-09-20-SHOWCASE_AUDIT_AND_CLEANUP_STRATEGY.md](2026-09-20-SHOWCASE_AUDIT_AND_CLEANUP_STRATEGY.md) | `docs/SHOWCASE_AUDIT_AND_CLEANUP_STRATEGY.md` | 2026-09-20 · #189/#191/#195 | Dated review evidence and advisor options for a since-decided release | [../DECISIONS.md](../DECISIONS.md) |
| [2026-09-20-SHOWCASE_EXECUTIVE_DECISIONS.md](2026-09-20-SHOWCASE_EXECUTIVE_DECISIONS.md) | `docs/SHOWCASE_EXECUTIVE_DECISIONS.md` | 2026-09-20 · #189/#191/#195 | Dated decision sheet; still-open items carried forward | [../DECISIONS.md](../DECISIONS.md) |
| [AGENT_PERSONALITIES.md](AGENT_PERSONALITIES.md) | `docs/AGENT_PERSONALITIES.md` | 2026-07-14 · #41 | Candidate personality exploration; the shipped chatbot is Major, one fixed persona | `apps/frontend/lib/system-prompt.ts` |
| [AI_TOOLS_GUIDE.md](AI_TOOLS_GUIDE.md) | `docs/AI_TOOLS_GUIDE.md` | 2026-08-04 · #38 | References a `/dev/chat-test` route that no longer exists; tool architecture has since changed | [../ARCHITECTURE.md](../ARCHITECTURE.md), `apps/frontend/lib/tools/registry.ts` |
| [CAMPUS_EVENTS_STORIES.md](CAMPUS_EVENTS_STORIES.md) | `docs/user-stories/CAMPUS_EVENTS_STORIES.md` | 2026-06-22 | Campus Events is cut from MVP scope | [MVP_USER_PERSONAS.md](../MVP_USER_PERSONAS.md) |
| [CHAT_UI_HANDOFF.md](CHAT_UI_HANDOFF.md) | `docs/handoff/CHAT_UI_HANDOFF.md` | 2026-07-14 · #37 | Issue handoff note; the chat UI it describes has since shipped and changed | `apps/frontend/features/chat/` |
| [DRIZZLE_LOCAL_SETUP_AND_DEPLOYMENT.md](DRIZZLE_LOCAL_SETUP_AND_DEPLOYMENT.md) | `docs/DRIZZLE_LOCAL_SETUP_AND_DEPLOYMENT.md` | 2026-08-07 | Describes the removed `main.py`/Alembic local setup path | [../../apps/data/REPRODUCE.md](../../apps/data/REPRODUCE.md) |
| [ENGAGEMENT_ONBOARDING_STRATEGY.md](ENGAGEMENT_ONBOARDING_STRATEGY.md) | `research/ENGAGEMENT_ONBOARDING_STRATEGY.md` | 2026-07-17 · #52 | Strategy research; onboarding is built and documented at its current design | [LANDING_ONBOARDING_UIUX.md](../LANDING_ONBOARDING_UIUX.md) |
| [INFRASTRUCTURE_ARCHITECTURE.md](INFRASTRUCTURE_ARCHITECTURE.md) | `docs/INFRASTRUCTURE_ARCHITECTURE.md` | 2026-06-11 · #10 | Provider evaluation (Prisma, ChromaDB, free-tier candidates) predating the shipped stack | [../DATABASE_ARCHITECTURE.md](../DATABASE_ARCHITECTURE.md) |
| [ISSUE_12_ACADEMIC_DATA_MAP.md](ISSUE_12_ACADEMIC_DATA_MAP.md) | `docs/ISSUE_12_ACADEMIC_DATA_MAP.md` | 2026-06-22 · #12 | Early HB 2504 research draft | [../DATA_PIPELINE.md](../DATA_PIPELINE.md) |
| [ISSUE_12_ACADEMIC_DATA_MAP_TREY.md](ISSUE_12_ACADEMIC_DATA_MAP_TREY.md) | `research/ISSUE_12_ACADEMIC_DATA_MAP_TREY.md` | 2026-06-22 · #12 | Early research draft (parallel author) | [../DATA_PIPELINE.md](../DATA_PIPELINE.md) |
| [ISSUE_20_RAG_PIPELINE_RYAN.md](ISSUE_20_RAG_PIPELINE_RYAN.md) | `docs/ISSUE_20_RAG_PIPELINE_RYAN.md` | 2026-06-22 · #20 | ChromaDB/Ollama RAG proposal; never built | [../DATABASE_ARCHITECTURE.md](../DATABASE_ARCHITECTURE.md) |
| [ISSUE_34_HANDOFF.md](ISSUE_34_HANDOFF.md) | `docs/handoff/ISSUE_34_HANDOFF.md` | 2026-07-17 · #34 | Issue handoff note; the scraping framework it describes has since shipped | `apps/data/dallasai/pipeline/` |
| [ISSUE_35_EXPLAINER.md](ISSUE_35_EXPLAINER.md) | `research/ISSUE_35_EXPLAINER.md` | 2026-07-17 · #35 | Conceptual explainer for a pipeline stage now implemented differently | [../DATA_PIPELINE.md](../DATA_PIPELINE.md) |
| [ISSUE_35_HANDOFF.md](ISSUE_35_HANDOFF.md) | `docs/handoff/ISSUE_35_HANDOFF.md` | 2026-07-17 · #35 | Issue handoff note; superseded by the shipped pipeline | [../DATA_PIPELINE.md](../DATA_PIPELINE.md) |
| [ISSUE_37_ONBOARDING.md](ISSUE_37_ONBOARDING.md) | `research/ISSUE_37_ONBOARDING.md` | 2026-07-17 · #37 | Early onboarding/chat playground guide | [../LANDING_ONBOARDING_UIUX.md](../LANDING_ONBOARDING_UIUX.md) |
| [ISSUE_38_CHECKLIST.md](ISSUE_38_CHECKLIST.md) | `todo.md` | 2026-08-07 · #38 | Issue #38 task checklist, no longer referenced from anywhere | [../ARCHITECTURE.md](../ARCHITECTURE.md) |
| [ISSUE_38_EXPLAINER.md](ISSUE_38_EXPLAINER.md) | `docs/ISSUE_38_EXPLAINER.md` | 2026-08-05 · #38 | References a `/dev/chat-test` route that no longer exists | [../ARCHITECTURE.md](../ARCHITECTURE.md) |
| [ISSUE_50_HANDOFF.md](ISSUE_50_HANDOFF.md) | `docs/handoff/ISSUE_50_HANDOFF.md` | 2026-07-14 · #50 | Issue handoff note; client persistence has since shipped | `apps/frontend/features/onboarding/onboarding-store.ts` |
| [ISSUE_51_HANDOFF.md](ISSUE_51_HANDOFF.md) | `docs/handoff/ISSUE_51_HANDOFF.md` | 2026-07-17 · #51 | Issue handoff note; the schema it describes has since shipped and changed | [../DATABASE_ARCHITECTURE.md](../DATABASE_ARCHITECTURE.md) |
| [ISSUE_61_EXPLAINER.md](ISSUE_61_EXPLAINER.md) | `research/ISSUE_61_EXPLAINER.md` | 2026-07-28 · #61 | Explainer for a facts-extraction design (768-dim contract) superseded before it ran in production | [../DATA_PIPELINE.md](../DATA_PIPELINE.md) |
| [ISSUE_61_HANDOFF.md](ISSUE_61_HANDOFF.md) | `docs/handoff/ISSUE_61_HANDOFF.md` | 2026-07-17 · #61 | Issue handoff note (768-dim contract) | [../DATA_PIPELINE.md](../DATA_PIPELINE.md) |
| [ISSUE_61_PLAN.md](ISSUE_61_PLAN.md) | `docs/ISSUE_61_PLAN.md` | 2026-07-28 · #61 | Implementation plan for a facts-extraction design superseded before it shipped | [../DATA_PIPELINE.md](../DATA_PIPELINE.md) |
| [ISSUE_90_EXPLAINER.md](ISSUE_90_EXPLAINER.md) | `research/ISSUE_90_EXPLAINER.md` | 2026-07-28 · #90 | Explainer for a preprocessing design superseded before it shipped | [../DATA_PIPELINE.md](../DATA_PIPELINE.md) |
| [ISSUE_90_PLAN.md](ISSUE_90_PLAN.md) | `docs/ISSUE_90_PLAN.md` | 2026-07-28 · #90 | Implementation plan for a preprocessing design superseded before it shipped | [../DATA_PIPELINE.md](../DATA_PIPELINE.md) |
| [ISSUE_91_LOCAL_INGESTION_GUIDE.md](ISSUE_91_LOCAL_INGESTION_GUIDE.md) | `docs/ISSUE_91_LOCAL_INGESTION_GUIDE.md` | 2026-08-07 · #91 | Guide for `main.py`/`db_setup.py` (768-dim); that ingestion path was removed | [../../apps/data/REPRODUCE.md](../../apps/data/REPRODUCE.md) |
| [Issue2Markdown.md](Issue2Markdown.md) | `research/Issue2Markdown.md` | 2026-06-22 · #12 | Duplicate of an early research draft | [../DATA_PIPELINE.md](../DATA_PIPELINE.md) |
| [LOST_AND_FOUND_STORIES.md](LOST_AND_FOUND_STORIES.md) | `docs/user-stories/LOST_AND_FOUND_STORIES.md` | 2026-06-22 | Lost & Found is cut from MVP scope | [MVP_USER_PERSONAS.md](../MVP_USER_PERSONAS.md) |
| [RAG_EVALUATION.md](RAG_EVALUATION.md) | `docs/RAG_EVALUATION.md` | 2026-06-22 · #20 | ChromaDB evaluation predating the shipped Neon/pgvector stack | [../DATABASE_ARCHITECTURE.md](../DATABASE_ARCHITECTURE.md) |
| [RAG_POC_RESULTS.md](RAG_POC_RESULTS.md) | `docs/RAG_POC_RESULTS.md` | 2026-06-10 (run) | June proof-of-concept run against ChromaDB, not the shipped retrieval path | [../DATABASE_ARCHITECTURE.md](../DATABASE_ARCHITECTURE.md) |
| [SCRAPING_AND_CHUNKING_EXPLAINER.md](SCRAPING_AND_CHUNKING_EXPLAINER.md) | `research/SCRAPING_AND_CHUNKING_EXPLAINER.md` | 2026-06-22 · #20 | Early scraping/chunking guide superseded by the shipped pipeline | [../DATA_PIPELINE.md](../DATA_PIPELINE.md) |
| [conversation-entry-design.md](conversation-entry-design.md) + [conversation-entry-flow.png](conversation-entry-flow.png) | `docs/conversation-entry-design.md`, `docs/conversation-entry-flow.png` | 2026-07-14 · #40 | Early entry-flow proposal; never shipped as designed | [../LANDING_ONBOARDING_UIUX.md](../LANDING_ONBOARDING_UIUX.md) |
| [dallas-college-events-research.md](dallas-college-events-research.md) | `research/dallas-college-events-research.md` | 2026-06-08 | Research for the cut Campus Events feature | [MVP_USER_PERSONAS.md](../MVP_USER_PERSONAS.md) |

Two files kept for currency but not archived: [DATABASE_ARCHITECTURE.md](../DATABASE_ARCHITECTURE.md)
carries an inline status note instead of being replaced, since most of its query design still holds.
[GOVERNANCE_CHARTER.md](../governance/GOVERNANCE_CHARTER.md) and the RFCs in
[../rfcs/](../rfcs/) keep their original filenames with an updated `Status:` line, since they are
still the canonical prompt/guardrail contract even though the implementation moved on from a couple
of their assumptions.
