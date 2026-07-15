# Issue #34 Handoff — Web Scraping Framework (@treysweeney)

> **Goal of #34:** a reusable scraping framework so any data engineer can write a
> maintainable scraper for campus data without reinventing boilerplate.
>
> **Where things stand:** three production scrapers already exist in
> [`apps/data/pipeline/`](../../apps/data/pipeline/) and have collectively fetched
> ~25,000 pages with zero data loss. They share strong *conventions* but not yet a
> shared *framework module* — finishing #34 is mostly extracting the framework out
> of this proven code, plus a few unbuilt acceptance criteria listed below.

---

## 0. The big picture — where #34 sits

The full pipeline is documented in [`docs/DATA_PIPELINE.md`](../DATA_PIPELINE.md)
(**read it first** — it's the map everyone shares). Four stages; #34 owns the first:

```
   STAGE 1: ACQUIRE ◄── #34        STAGE 2: PARSE          STAGE 3: EMBED     STAGE 4: LOAD
   scrapers → raw HTML/CSV    →    facts JSON + chunks  →  768-dim vectors →  knowledge_entry
   + JSONL manifests               (validated contracts)                      (one table, Neon)
```

Everything downstream depends on two things Stage 1 guarantees: **the raw bytes are
archived forever** (so the whole knowledge base is rebuildable without re-crawling),
and **every fetch has a manifest record** carrying the identity (course, section,
professor, term) that later stages stamp into the database. The manifest is the
#34 → #35 handshake.

---

## 1. What exists and works today

| Module | What it scrapes | Status |
|---|---|---|
| [`archive_syllabi_cv.py`](../../apps/data/pipeline/archive_syllabi_cv.py) | Concourse syllabus + instructor-CV pages, driven by schedule-CSV work-lists | ✅ ran the 2025+2026 corpus (~24k syllabi, ~3k CVs) |
| [`catalog_fetch.py`](../../apps/data/pipeline/catalog_fetch.py) | Acalog catalog: 337 degree plans (306 in the by-Program index + 31 academic-transfer degrees) + every course they reference | ✅ ran the 2026-2027 catalog (~1.8k pages) |
| [`run_archive_today.py`](../../apps/data/pipeline/run_archive_today.py) | Self-healing driver: discovers every schedule CSV, runs CVs then per-term syllabi | ✅ overnight-safe |

**The conventions they share** (this is the de-facto framework, currently duplicated):

- **Raw-first archiving** — exact HTML bytes to `apps/data/raw/…`, plus one **JSONL
  manifest line per fetch**: `{kind, course_id, course_code, section, professor,
  term_code, session, modality, source_url, raw_path, sha256, bytes, status, fetched_at}`.
  The manifest is the provenance index every later stage reads.
- **Resumable by construction** — a target already on disk is skipped, so any run can
  be stopped/restarted freely; `--refresh-before <ISO8601>` re-fetches files older
  than a moment (how last-minute syllabus edits get picked up).
- **Circuit breaker, not hammering** — 3 consecutive network errors (403/429 counts
  as one) stop the run; the driver backs off on an escalating schedule
  (60s → 30min, 12 tries) and resumes.
- **Politeness** — single-threaded, 2s default delay, browser User-Agent.
- **OneDrive-safe writes** — local file-lock retries are separated from network
  errors so cloud-sync hiccups never trip the breaker.
- **Search-URL resolution with a persistent cache** — archived terms (e.g. Fall 2025)
  link a Concourse *search* page instead of the syllabus; the archiver resolves
  search → `course_id` by matching the section number in the results, and caches
  every resolution in `raw/manifests/resolve_cache.jsonl` so it is never repeated.

### The host playbook (hard-won facts, don't rediscover them)

| Host | Behavior | Approach |
|---|---|---|
| `dallascollege.campusconcourse.com` (syllabi, CVs) | Server-rendered; plain `GET` works | `requests` + browser UA |
| `catalog.dallascollege.edu` (Acalog) | JS challenge — plain HTTP gets a persistent **202** stub | **Playwright headless Chromium** (one context passes the challenge once) |
| `schedule.dallascollege.edu` (eConnect) | Same 202/JS wall | Not scraped — schedule CSVs are exported by the team's exporter and dropped in `raw/schedule/` |

---

## 2. Acceptance-criteria map — what's done vs. open

| #34 AC | State in code |
|---|---|
| Rate limiting / throttling | ✅ delay + single-thread + circuit breaker |
| Save original HTML so we never re-scrape for selector changes | ✅ `raw/` archive + manifests |
| Pipeline failures → exit codes | ✅ `SystemExit` breaker; driver self-heals |
| Standardized output (JSON Lines with `source_url`, timestamp, payload) | 🟡 manifests are JSONL and carry these fields, but the shape isn't formalized as *the* framework interchange |
| Modular base class with pluggable parse hooks | ❌ two purpose-built classes (`Archiver`, `CatalogFetcher`), no shared module |
| UA rotation + dynamic headers | ❌ single fixed browser UA |
| Generic schema validator on scraped payloads (Pydantic/JSON Schema) | ❌ validation happens later, at the extraction stage |
| Run-metrics logging (pages, parses, failures, timing) | 🟡 counters print per run; not persisted as a metrics report |
| Smart retry / exponential backoff on transient errors | 🟡 breaker + driver-level backoff exists; per-request exponential retry does not |
| robots.txt adherence + env-flag override | ❌ not implemented (see the compliance note below) |

**Compliance note:** the team's posture (legal-cleared, low-profile, demo-first) is
documented in [`DATA_PIPELINE.md §3.6`](../DATA_PIPELINE.md). The framework should
expose the posture as *configuration* — a `respect_robots` flag with an env override —
so each scraper's stance is explicit and reviewable rather than implicit.

---

## 3. Recommended path: extract the framework from the working code

Don't build the framework greenfield and then port the scrapers — the scrapers embody
~25k fetches of edge-case learning (the 202 challenge, OneDrive locks, Concourse
search resolution, per-term work-lists). Instead:

1. **Create `apps/data/pipeline/framework.py`** and lift into it, unchanged in
   behavior: the manifest writer, `_is_fresh`/`--refresh-before` skip logic, the
   circuit breaker, the write-retry, the politeness delay, and `_slug()`
   (the professor-name slug is also the CV↔section join key — one shared
   implementation, byte-for-byte, is a correctness requirement, see
   `metadata-registry.json → instructor_slug`).
2. **Give it the base-class DX the issue describes** — a `BaseScraper` with
   `name`, `plan()` (yield targets), `fetch()` (provided), and `parse_item()`
   (optional hook); `Archiver` and `CatalogFetcher` become subclasses. Two transports
   behind one interface: `requests` (default) and Playwright (`js_challenge=True`).
3. **Formalize the interchange** — one Pydantic/JSON-Schema model for the manifest
   record (`source_url`, `fetched_at`, `raw_path`, `sha256`, `payload`), which is
   also the #34→#35 handshake format the architecture doc calls for.
4. **Add the open ACs where they now have one home**: UA rotation list, per-request
   exponential retry (keep the breaker as the outer guard), `respect_robots` config,
   and a per-run metrics JSON written next to the manifest.
5. **Deliverables:** updated `apps/data/README.md` quick-start + a boilerplate
   template, and unit tests for retry/breaker/freshness logic (they're pure
   functions after the lift — easily testable without network).

## 4. Runbook (works today)

```bash
cd apps/data          # env: uv sync   (requests, bs4, lxml, playwright; then: playwright install chromium)

# syllabi + CVs for every schedule CSV present (resumable, self-healing):
python -m pipeline.run_archive_today
python -m pipeline.run_archive_today 2025_Fall             # one term
python -m pipeline.run_archive_today 2026_Summer --refresh-before 2026-08-20T00:00:00

# the catalog (Playwright):
python -m pipeline.catalog_fetch --catoid 5 --catalog-year 2026-2027
```

Everything lands under `apps/data/raw/` (gitignored; shared via OneDrive). The full
pipeline picture is in [`docs/DATA_PIPELINE.md`](../DATA_PIPELINE.md).
