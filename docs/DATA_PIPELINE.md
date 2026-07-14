# How the Chatbot Learns About Courses — the Data Pipeline

---

## 1. The big picture

The Success Coach chatbot answers questions grounded in **real Dallas College data** —
what classes exist, when and where they meet, what each class is like, who teaches it,
and what a degree requires. All of that lives in **one database table**, `knowledge_entry`,
and everything the chatbot says is retrieved from it.

Data flows through four stages:

```
   SOURCES                    STAGE 1        STAGE 2         STAGE 3      STAGE 4
                              acquire        parse           embed        load
                              ───────        ─────           ─────        ────
 Class schedule (CSV)  ─┐
 Syllabus pages         ├──►  raw HTML  ──►  facts (JSON) ──► vector  ──►  knowledge_entry
 Instructor CV pages    │     + manifest       + text chunks    per chunk    (one table)
 Course catalog        ─┘                     (validated)                       │
                                                                                ▼
                                                                        the chatbot
                                                                        retrieves & answers
```

- **Acquire** — download the raw HTML/CSV exactly as published and keep it for 3 years.
- **Parse** — turn each document into clean, structured **facts** (validated JSON) plus
  readable **text chunks**.
- **Embed** — give each chunk a numeric vector so the chatbot can find it by meaning.
- **Load** — write it all into `knowledge_entry`.

Because the raw files are kept, the whole knowledge base can be rebuilt from them at any
time without re-downloading anything.

---

## 2. The knowledge table

`knowledge_entry` holds **one row per retrievable unit of information**. A single column,
`metadata → doc_type`, says what kind of thing each row is:

| `doc_type` | one row per… | answers |
|---|---|---|
| `section` | a scheduled class section — **with its syllabus facts on board** | when/where it meets, modality, campus, dates, credits, lab/co-req, **and** grading, workload, policies, weekly topics, materials |
| `syllabus` | a readable chunk of a syllabus document (for semantic search) | free-text questions about what a class covers |
| `cv` | an instructor | background, degrees, experience |
| `course` | a catalog course | description, prerequisites, credit hours, transferability |
| `program_map` | a degree/certificate plan | required courses, groups, credit totals, sequence |

A section and its syllabus describe **the same offering** (same course, professor, section),
so they are **one row, not two**: the syllabus's structured facts are embedded inside the
section row. Sibling sections that share a syllabus (same professor, course, and format)
don't repeat it — one section carries the facts, the others carry a pointer to it, and any
answer served from a sibling says which section's syllabus it came from.

Every row carries three things:

- **`chunk_text`** — human-readable text, used for meaning-based (semantic) search.
- **`facts`** — a structured JSON object (for rows that have one), used for exact lookups
  and comparisons. Its shape is fixed by a contract (`src/config/facts-schemas/`).
- **`metadata`** — a small tag block (course code, term, campus, professor…). The database
  automatically promotes the most-used tags into indexed columns, so filtered lookups are
  fast and can never disagree with the tag block.

Two kinds of rows share the table: **prose chunks** (readable sections of a document, found
by semantic search) and **fact rows** (the structured extraction, found by exact lookup).
A long document produces several prose chunks plus one fact row.

> There is also a second table, `chat_session`, that stores anonymous, PII-scrubbed chat
> analytics. It isn't part of this pipeline — this document is about the knowledge base.

---

## 3. Where the data comes from

| Source | Gives us | How we read it |
|---|---|---|
| **Class schedule** (eConnect, `schedule.dallascollege.edu`) | every section: course, professor, meeting times, campus, dates, credits | exported as a CSV per term (the site itself is bot-walled; the CSV is produced by the team's exporter) |
| **Syllabus pages** (Concourse / HB 2504, `campusconcourse.com`) | grading, policies, schedule, materials for each section | plain download (public, server-rendered HTML) |
| **Instructor CV pages** (Concourse) | each professor's background | plain download |
| **Course catalog** (Acalog, `catalog.dallascollege.edu`) | course descriptions, prerequisites, and full degree plans | **headless browser** (the catalog is behind a JavaScript challenge) |

Two of these need special handling: the **schedule site and the catalog** both sit behind a
bot-challenge that plain downloaders can't pass, so schedule data arrives as a pre-made CSV
and the catalog is read with a scripted browser. **Concourse (syllabi/CVs) has no such wall**
and is downloaded directly.

---

## 4. What we've gathered so far

The syllabus, CV, and section sources are downloaded and archived. Current corpus
(`apps/data/raw/`):

| | count |
|---|---:|
| Instructor CVs | **2,473** (one per professor) |
| Spring 2026 syllabi | **6,856** |
| Summer 2026 syllabi | **2,975** |
| **Total syllabus/CV files** | **12,304 (~410 MB)** |

Syllabi are downloaded **one representative per (professor, course, modality)** — sibling
sections of the same professor+course share a syllabus, so this avoids tens of thousands of
duplicate downloads while a manifest records which section each file came from. The **catalog**
(courses + degree plans) is the next source to bring in (see §7).

---

## 5. How each kind of data is organized

Every fact row is validated against a contract in `src/config/facts-schemas/` before it's
loaded. A universal rule holds everywhere: **`null` means "the source didn't say" — the
extractor never guesses or invents a value.**

**`section`** (schedule half from the CSV, built by code — no AI needed):
section number, instructor, **modality** (online / in-person / hybrid), campus, start/end
dates, **credit hours**, **session** (winter / 8-week / flex / full…), a **`meetings`** list
(days, times, room; an empty list means fully online — times are never invented),
materials links, and any co-requisite.

**… with its `syllabus` facts embedded** (syllabus half from the Concourse HTML, extracted
by the AI): a **`grading`** list where each item has a verbatim label, a **canonical type**
(exam / quiz / homework / project / lab / participation / paper / presentation / final_exam /
other), and its weight or points; **`policies`** (late-work, attendance, makeup, AI/plagiarism,
extra-credit); weekly **course schedule**; **required materials**; **office hours**; the
last-modified date; and a ≤120-word summary. The embedded block keeps the syllabus page's own
URL so answers cite the syllabus, not the schedule. One section per offering carries this
block; its siblings point to it. If no syllabus is posted yet, the block is simply absent —
which is what triggers the "here's last term's syllabus, it may change" fallback.

**`cv`** (from the CV HTML): name, department, email, CV link, courses taught.

**`course`** (from the catalog): code, title, credit hours, description, **structured
prerequisites and co-requisites** (including "one of X or Y" alternatives), and transfer
signals — whether it's a **Core Curriculum** course, its **Texas Common Course Number**
(which means it transfers to any Texas public university), and the component area it satisfies.

**`program_map`** (from the catalog): the **Degree Plan Code**, award type, total credits,
and the **requirement groups** — each group carrying its courses, credit target, Core
component-area code, and, importantly, *how to read the list*: whether you take **all** of
the courses or **choose** from them, whether **other options exist** beyond the ones shown,
and any **exclusions** (e.g. "can't use both BIOL 1406 and 1408").

Identity always comes from the trustworthy source, never guessed: the embedded syllabus
facts get their course/section/professor from the **schedule CSV**, not from the syllabus
body (many syllabi don't even name the instructor). The `instructor_slug` that links a CV
to its sections is computed the same deterministic way on both sides so the join always
matches.

---

## 6. What questions it can answer

We stress-tested this by extracting eight real core courses' syllabi and CVs into
`knowledge_entry` and asking 29 real degree-planning questions. The extraction was
**faithful** (no invented grades, dates, or policies) and answered the section, syllabus,
and instructor questions cleanly. Coverage by area:

| Student asks about… | Answered from | Status |
|---|---|---|
| **Sections & scheduling** — online? evenings/weekends? where/when? which campus? credits? has a lab? | `section` | ★ strong |
| **What a class is like** — grading, workload, exam count, weekly topics, attendance, project-vs-exam | `syllabus` | ★ strong |
| **The instructor** — background, degrees, what their courses emphasize | `cv` + `syllabus` | ✓ good |
| **Prerequisites & requirements** — what's the prereq? what do I need for an A.S.? what's my first semester? | `course` + `program_map` | ▲ once the catalog is loaded |
| **Transfer** — does this transfer to UNT? | `course` (TCCN) | ▲ Texas-public via TCCN; specific equivalencies need articulation data |

**Out of scope by design (the bot reminds and routes, never reads):** anything personal to a
student's record — registration holds, financial-aid status, GPA, transcript evaluation,
prior-credit (AP/CLEP/military) — lives in Workday/Navigate and is **never** read by the
chatbot. For these it points the student to the right system or a Success Coach. A small set
of **curated guidance** rows (the pre-appointment checklist, common misconceptions, F-1
basics) will be authored and reviewed, not scraped.

The takeaway: the syllabus/CV/section data answers "which class, what's it like, who teaches
it" today; **the catalog is the keystone that unlocks the degree-planning core** ("what do I
need, in what order, does it transfer").

---

## 7. The catalog & degree plans

The catalog (`catalog.dallascollege.edu`, catalog year `2026-2027` = `catoid=5`) is a
structured, high-value source. It has two page types:

- **Program pages** (`preview_program.php?...poid=N`) — 308 of them. Each is a full degree
  plan: the Degree Plan Code (e.g. `AS_SCIENCE`), total credits (e.g. 60), eligibility rules,
  and a **semester-by-semester list of requirement groups** with Core component-area codes.
  *The A.S. page literally lists "Semester 1: ENGL 1301, HIST 1301, Math, EDUC 1300"* — so the
  recommended first semester is right there in the data.
- **Course pages** (`preview_course_nopop.php?...coid=N`) — description, prerequisites, credits,
  and the transfer signals (Core, Texas Common Course Number).

**Ingestion plan:**

1. **Enumerate** — read the program index (308 program links), then collect the course links
   the programs reference (that gets exactly the courses that matter for degree plans).
2. **Fetch with a headless browser** (Playwright) — the catalog is behind a JavaScript
   challenge, so a scripted Chromium is required; archive the raw HTML like every other source.
3. **Extract** into `course` and `program_map` fact rows using the same extractor as syllabi.
4. **Load**, tagging each row with its **catalog year** (`2026-2027`). Catalog rows are
   year-namespaced so multiple catalog years coexist — a student follows the catalog they
   enrolled under ("catalog rights").

**The Core Curriculum is itself a program** in the catalog (a single `CORE-42` plan listing
the acceptable courses for each of the nine component areas). Degree plans reference the
component-area codes; the `CORE-42` row supplies the option lists behind "choose one" slots.
This is why the `program_map` groups distinguish *take-all* from *choose-one* and flag when
"other options exist."

Once the catalog is loaded, the five `doc_type`s **compose into a full plan**:

```
program_map  → what to take & in what order (the 60-hour A.S., semester by semester)
   → course  → prerequisites, credits, transfers-statewide?
      → section  → which sections run this term, when/where/modality
         → syllabus / cv  → what each section is like, who teaches it
```

---

## 8. The extractor — Claude now, a free local model later

Turning a messy syllabus or catalog page into clean facts is done by an LLM, behind a
**provider setting** so the model can be swapped without touching anything else — matching the
project's vendor-independence principle. The contract is always the same: **one JSON Schema +
one versioned prompt + a provider setting.**

```
# today — Claude (paid subscription)
EXTRACTOR="anthropic:claude-sonnet-4-6"

# later — a free local model via LM Studio (an OpenAI-compatible server on your machine)
EXTRACTOR="lmstudio:qwen2.5-14b-instruct"
LLM_BASE_URL="http://localhost:1234/v1"
```

How one document is extracted, regardless of provider:

1. Build the prompt: the target JSON Schema + the extraction rules + the document.
2. Ask the model; read back JSON.
3. **Validate** against the schema. If it doesn't fit, hand the model the exact errors and
   retry (a couple of times).
4. Every result records **which model, which prompt version, which schema version** produced
   it, so any answer is traceable and re-runnable.
5. A **low-confidence** extraction is set aside for human review, never loaded — a bad parse
   never overwrites a good one.

Switching from Claude to a local LM Studio model is a config change plus a re-run; the two
outputs can be compared side-by-side before switching over. The same idea applies to
**embeddings**: a 768-dimension model (e.g. `nomic-embed-text`, runnable locally in LM Studio,
or a hosted equivalent) turns each chunk into its search vector, using the same model at
load time and at question time.

---

## 9. Running the pipeline

**One-time setup** (from `apps/data/`):

```bash
uv sync                       # installs the pipeline's dependencies
cp .env.example .env          # then set EXTRACTOR / ANTHROPIC_API_KEY / DATABASE_URL
```

**Acquire raw files** (schedule CSVs go in `apps/data/raw/schedule/` first):

```bash
python -m pipeline.run_archive_today                       # all terms present
python -m pipeline.run_archive_today 2025_Fall 2025_Spring # only these terms
python -m pipeline.run_archive_today 2026_Summer --refresh-before 2026-07-12T00:00:00
```

The acquirer is **safe to re-run**: files already downloaded are skipped, it retries transient
failures on its own, and if the site starts refusing it backs off and resumes rather than
hammering. `--refresh-before` re-downloads anything older than a given moment (to catch
last-minute syllabus edits).

**Parse, embed, and load** run per stage and are each idempotent — re-running with unchanged
input costs nothing, and unchanged rows are never needlessly rewritten:

```bash
python -m pipeline.extract --all-pending     # documents → facts + chunks (uses EXTRACTOR)
python -m pipeline.embed   --pending          # chunks → vectors
python -m pipeline.load                        # → knowledge_entry
```

To re-extract everything after improving a prompt — on Claude or on a local model — just set
`EXTRACTOR` and re-run `extract`; because the raw archive never changes, the knowledge base
can always be rebuilt from scratch.

---

## 10. Where things live

```
success-coach-chatbot/
├─ docs/
│   ├─ DATA_PIPELINE.md              ← this file
│   └─ DATABASE_ARCHITECTURE.md      the knowledge_entry table in full detail
├─ src/config/
│   ├─ metadata-registry.json        the governed tag vocabulary
│   └─ facts-schemas/                the fact-shape contracts (course, program_map,
│                                    section, syllabus, cv, …)
└─ apps/data/
    ├─ db/                           schema.sql (the database definition) + seed_mock.sql
    ├─ pipeline/                     the scripts (acquire, extract, embed, load)
    └─ raw/                          the archived source files (shared drive, not in git)
        ├─ schedule/  cv/  syllabi/<term>/  catalog/<year>/  manifests/
```
