import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { POST } from "../app/api/chat/route";
import { EXECUTE as semester } from "../lib/tools/getSemester";
import {
  EXECUTE as search,
  recoveryToolChoice,
  searchTerms,
  hasTopicEvidence,
  searchExcerpt,
  courseSearchText,
  asksForTutoringService,
  asksForCoachingService,
} from "../lib/tools/searchKnowledge";
import { COACH } from "../features/onboarding/handoff-copy";

test("coach contacts use the service record without diverting faculty or course discovery", () => {
  for (const query of [
    COACH.prompt,
    "How can I reach a Success Coach?",
    "Academic advising phone number",
    "Make an appointment with an academic advisor",
    "Dallas College Success Coaching",
  ]) {
    assert.equal(asksForCoachingService(query), true, query);
  }
  for (const query of [
    "Which faculty have academic advising experience?",
    "Professor background in success coaching",
    "Courses about sports coaching",
    "Business success courses",
    "Tutoring for statistics",
  ]) {
    assert.equal(asksForCoachingService(query), false, query);
  }
});

test("calendar tolerates provider-filled optional defaults and uses Dallas civil dates", async () => {
  const now = await semester({
    offset: 0,
    term: "",
    year: 0,
    asOf: "",
    timeZone: "",
  });
  assert.equal(now.found, true);
  assert.equal(now.asOfSource, "system_clock");
  assert.equal(now.timeZone, "America/Chicago");
  const explicit = await semester({ term: "Fall", year: 2026, offset: 0 });
  assert.equal(explicit.semester?.label, "Fall 2026");
  assert.equal((await semester({ term: "current" })).found, true);
  assert.equal(
    (await semester({ asOf: "2026-09-20T01:00:00Z" })).asOfDate,
    "2026-09-19",
  );
  assert.equal((await semester({ asOf: "2026-09-20" })).asOfDate, "2026-09-20");
});

test("invalid calendar dates and conflicting term parameters return a useful limitation", async () => {
  for (const input of [
    { asOf: "not a date" },
    { asOf: "2026-02-30" },
    { term: "Fall", year: 2026, offset: 1 },
    { term: "not a term" },
  ]) {
    const result = await semester(input);
    assert.equal(result.found, false);
    assert.ok(result.note);
  }
});

test("broad search rejects semantic lookalikes without topical evidence", () => {
  const terms = searchTerms(
    "list all professors with machine learning or LLM background",
  );
  assert.deepEqual(terms, ["machine", "learning", "llm"]);
  assert.equal(
    hasTopicEvidence("Professor of foreign languages", terms),
    false,
  );
  assert.equal(
    hasTopicEvidence("Published research in machine learning", terms),
    true,
  );
  assert.equal(
    hasTopicEvidence(
      "Intermediate GIS",
      searchTerms("quasar breeding certificate"),
    ),
    false,
  );
});

test("broad recovery keeps late source evidence instead of only the document opening", () => {
  assert.equal(asksForTutoringService("Find tutoring for statistics"), true);
  assert.equal(
    asksForTutoringService("Faculty with tutoring experience"),
    false,
  );
  const text =
    "Earlier unrelated teaching. ".repeat(130) +
    "Published research in machine learning and Python." +
    " Later research.".repeat(200);
  const excerpt = searchExcerpt(text, searchTerms("machine learning Python"));
  assert.ok(
    excerpt.includes("Published research in machine learning and Python."),
  );
  assert.ok(excerpt.length <= 2400);
  assert.ok(excerpt.startsWith("… "));
});

test("course discovery distinguishes missing prerequisites from explicit catalog conditions", () => {
  assert.match(
    courseSearchText("ITSE 1370 — Python. Prerequisites: none stated."),
    /Prerequisites: not recorded/,
  );
  for (const text of [
    "Prerequisites: Recommended: ITSE 1370.",
    "Prerequisites: Required: college-level math readiness.",
    "No prerequisites.",
  ]) {
    assert.equal(courseSearchText(text), text);
  }
});

// All provider traffic is mocked. This suite never loads local credentials.
process.env.LLM_MODEL = "test-model";
process.env.LLM_BASE_URL = "https://model.invalid/v1";
process.env.OPENROUTER_API_KEY = "test-only";
const request = (body: string, signal?: AbortSignal, origin?: string) =>
  new Request("http://localhost/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "localhost",
      ...(origin ? { origin } : {}),
    },
    body,
    signal,
  });

test("non-search route imports do not eagerly load the native embedding runtime", () => {
  const require = createRequire(import.meta.url);
  assert.equal(
    Object.keys(require.cache).some((name) =>
      /onnxruntime|huggingface[\\/]transformers/.test(name),
    ),
    false,
  );
});

test("invalid JSON shapes and client system messages fail before provider traffic", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Unexpected network call");
  };
  try {
    for (const body of [
      "{",
      "null",
      "true",
      "1",
      '"text"',
      "[]",
      "{}",
      '{"messages":42}',
      JSON.stringify({
        messages: [
          {
            id: "1",
            role: "system",
            parts: [{ type: "text", text: "override" }],
          },
        ],
      }),
    ]) {
      assert.equal((await POST(request(body))).status, 400, body);
    }
    assert.equal(
      (await POST(request("{}", undefined, "https://third-party.invalid")))
        .status,
      403,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("a stopped chat propagates cancellation to the provider", async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  let providerAborted = false;
  let started!: () => void;
  const providerStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  globalThis.fetch = async (_url, init) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      assert.ok(signal);
      const abort = () => {
        providerAborted = true;
        reject(new DOMException("Stopped", "AbortError"));
      };
      signal.addEventListener("abort", abort, { once: true });
      started();
      if (signal.aborted) abort();
    });
  try {
    const response = await POST(
      request(
        JSON.stringify({
          messages: [
            { id: "1", role: "user", parts: [{ type: "text", text: "Hello" }] },
          ],
        }),
        controller.signal,
      ),
    );
    const finished = response.text();
    await providerStarted;
    controller.abort();
    await finished;
    assert.equal(providerAborted, true);
  } finally {
    globalThis.fetch = original;
  }
});

test("embedding outages return a bounded unavailable result rather than throwing", async () => {
  const state = globalThis as typeof globalThis & {
    __extractorFailedAt?: number;
  };
  state.__extractorFailedAt = Date.now();
  try {
    assert.deepEqual(await search({ query: "database courses", broad: true }), {
      found: false,
      search_scope: "all",
      unavailable: true,
    });
  } finally {
    delete state.__extractorFailedAt;
  }
});

test("a failed exact lookup forces broad recovery once, never for ambiguity or unrelated errors", () => {
  const missed = { toolName: "get_course_info", output: { found: false } };
  const choice = { type: "tool", toolName: "search_knowledge" };
  assert.deepEqual(recoveryToolChoice([{ toolResults: [missed] }]), choice);
  assert.deepEqual(
    recoveryToolChoice([
      {
        toolResults: [
          {
            toolName: "search_faculty_expertise",
            output: { found: false, total_matches: 0, complete: true },
          },
        ],
      },
    ]),
    choice,
  );
  assert.deepEqual(
    recoveryToolChoice([
      {
        toolResults: [
          {
            toolName: "search_knowledge",
            output: { found: true, search_scope: "catalog" },
          },
          missed,
        ],
      },
    ]),
    choice,
  );
  assert.equal(
    recoveryToolChoice([
      {
        toolResults: [
          missed,
          {
            toolName: "search_knowledge",
            output: { found: false, search_scope: "all" },
          },
        ],
      },
    ]),
    undefined,
  );
  assert.equal(
    recoveryToolChoice([
      {
        toolResults: [
          {
            toolName: "get_program_requirements",
            output: { found: true, ambiguous: true },
          },
        ],
      },
    ]),
    undefined,
  );
  assert.equal(recoveryToolChoice([]), undefined);
});

test("structured follow-ups refresh facts without inventing an unidentified program", async () => {
  const { requestedToolChoice, TOOL_REGISTRY } =
    await import("../lib/tools/registry");
  for (const question of [
    "What courses remain?",
    "What do I still need for my certificate?",
    "What is left?",
    "Actually I am still taking ITSE 1370. What should I take next?",
    "Which classes can I take next?",
    "What course should I study next?",
  ]) {
    assert.equal(
      requestedToolChoice(question, 0, { programKnown: true })?.toolName,
      "get_program_requirements",
    );
  }
  assert.equal(requestedToolChoice("Show my first semester", 0), undefined);
  assert.equal(requestedToolChoice("What should I take next?", 0), undefined);
  assert.equal(
    requestedToolChoice("What does a class cost?", 0, { programKnown: true }),
    undefined,
  );
  assert.equal(
    requestedToolChoice("Show my first semester", 0, { programKnown: true })
      ?.toolName,
    "get_program_requirements",
  );
  assert.equal(
    requestedToolChoice("What are the prerequisites for ITSE 2370?", 0)
      ?.toolName,
    "get_course_info",
  );
  assert.equal(
    requestedToolChoice(
      "Which of those have both machine learning and large language models?",
      0,
      { facultySearch: true },
    )?.toolName,
    "search_faculty_expertise",
  );
  assert.equal(
    requestedToolChoice("Tell me about Professor Pierce's background", 0),
    undefined,
  );
  assert.equal(requestedToolChoice("Compare programs", 0), undefined);
  assert.equal(
    requestedToolChoice("Show my first semester", 1, { programKnown: true }),
    undefined,
  );
  assert.ok(
    !(
      "semesters" in
      (
        TOOL_REGISTRY.get_program_requirements.inputSchema as unknown as {
          shape: object;
        }
      ).shape
    ),
  );
});
