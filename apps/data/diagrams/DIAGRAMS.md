# Diagrams — sources & rendering guide

All diagrams are Mermaid: **GitHub renders these code blocks automatically** in the repo, so non-technical reviewers see pictures, not code — and there is no image file to keep in sync with the schema. To export PNG/SVG for slides: paste a block into https://mermaid.live, or have Claude Code run `mmdc` (mermaid-cli). For the full table-level ERD, paste `schema_v2.dbml` into https://dbdiagram.io.

---

## D1 · The data journey (for non-technical audiences — use this one in presentations)

```mermaid
flowchart LR
    A["📄 Public sources<br/>class schedule, syllabi,<br/>bookstore, catalog"] --> B["🗄️ Keep the originals<br/>every document saved as-is,<br/>forever (our safety net)"]
    B --> C["🤖 AI reads & organizes<br/>turns messy syllabi into<br/>tidy, comparable facts"]
    C --> D["📚 The library<br/>courses, sections, professors,<br/>schedules, degree plans"]
    D --> E["💬 The chatbot<br/>answers with citations:<br/>find, compare, plan"]
    C -.->|"AI is swappable:<br/>Claude today, free<br/>local model later"| C
```

**The one-sentence pitch:** *we keep every original document, let AI do the tedious organizing, store the results in a small tidy library, and the chatbot only ever answers from that library — so every answer can show its source.*

## D2 · Module map (how the pieces relate)

```mermaid
flowchart TD
    subgraph M1["Module 1 · Pipeline"]
      RAW[(raw_documents)] --> EXT[(extractions<br/>versioned JSON)]
    end
    subgraph M6["Module 6 · Catalog & plans"]
      CE[(catalog_editions)] --> DP[(degree_plans)] --> PR[(plan_requirements)] --> RC[(requirement_courses)]
      CR[(course_requisites)]
    end
    subgraph M2["Module 2 · Serving core"]
      CO[(courses)] --- SE[(sections)]
      TE[(terms)] --- SE
      IN[(instructors)] --- SE
      SE --- SY[(syllabi)] --- GC[(grading_components)]
      SE --- SM[(section_meetings)]
      SE --- MA[(section_materials)]
    end
    subgraph M4["Module 4 · Directory (#43–#46)"]
      AU[(academic_units)] --- AS[(assignments)] --- CT[(contacts)]
      SG[(student_guidance)]
    end
    subgraph M3["Module 3 · Optional"]
      EM[(embeddings<br/>pgvector)]
    end
    subgraph M5["Module 5 · Governance"]
      FV[(field_visibility)]
    end
    EXT -->|loader| M2
    EXT -->|loader| M6
    RC --> CO
    CR --> CO
    DP --- AU
    SY -.-> EM
    VIEWS{{"SQL views:<br/>search · compare · distinctives ·<br/>offering history · conflicts"}} --> BOT["Chatbot"]
    M2 --> VIEWS
    M6 --> BOT
    M4 --> BOT
```

## D3 · Serving-core ERD (key tables; full ERD from the DBML)

```mermaid
erDiagram
  RAW_DOCUMENTS ||--o{ EXTRACTIONS : "LLM extracts"
  EXTRACTIONS ||--o| SYLLABI : "loader projects"
  COURSES ||--o{ SECTIONS : offers
  TERMS ||--o{ SECTIONS : schedules
  INSTRUCTORS ||--o{ SECTIONS : teaches
  SECTIONS ||--o| SYLLABI : has
  SECTIONS ||--o{ SECTION_MEETINGS : "meets at"
  SECTIONS ||--o{ SECTION_MATERIALS : "uses"
  SYLLABI ||--o{ GRADING_COMPONENTS : unnests
  CATALOG_EDITIONS ||--o{ DEGREE_PLANS : contains
  DEGREE_PLANS ||--o{ PLAN_REQUIREMENTS : requires
  PLAN_REQUIREMENTS ||--o{ REQUIREMENT_COURSES : "satisfied by"
  REQUIREMENT_COURSES }o--|| COURSES : references
  COURSES ||--o{ COURSE_REQUISITES : "needs first"
```

## D4 · A question's path through the schema (walkthrough for reviews)

```mermaid
flowchart TD
    Q["Maria asks: 'Will HIST-1301 count for<br/>my degree plan, and which section fits me?'"]
    Q --> S1["degree_plans + plan_requirements +<br/>requirement_courses<br/>→ yes: American History (2026-27 catalog)"]
    S1 --> S2["course_requisites<br/>→ TSI Reading required (shown verbatim)"]
    S2 --> S3["sections × terms × instructors<br/>→ 3 sections this fall"]
    S3 --> S4["section_meetings<br/>→ one is evening, one online,<br/>none conflict with her ENGL class"]
    S4 --> S5["v_section_compare + distinctive_features<br/>→ 'most are quiz-based; Prof. Avery's<br/>is a 5-week podcast project'"]
    S5 --> A["Answer, with catalog-edition citation<br/>+ syllabus modified-date disclaimer"]
```
