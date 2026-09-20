import assert from "node:assert/strict";
import { assessRequisites } from "../lib/planning";
import { test } from "node:test";
import {
  readSavedSection,
  savedSectionKey,
  useSavedCourses,
} from "../features/chat/saved-courses";
import { SummarySheet } from "../features/chat/summary-sheet";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { convertToModelMessages, tool } from "ai";
import {
  CourseResults,
  ScheduleResults,
  InstructorResults,
} from "../features/chat/course-results";
import {
  requestedSemesters,
  scopeProgramGroups,
  scheduleSection,
  groupScheduleSections,
  instructorCvLinks,
  scheduleResultForModel,
} from "../lib/course-details";
import {
  starterQuestionsFor,
  handoffIntro,
} from "../features/onboarding/handoff-copy";
import type { OnboardingPayload } from "../features/onboarding/types";
import type { Skin } from "../features/onboarding/skin";
import { PROGRAMS } from "../features/onboarding/programs";
import {
  hydrateStudentSession,
  useStudentSession,
} from "../features/onboarding/onboarding-store";
import { citationHref } from "../lib/constants";
import {
  courseDetailsFromRow,
  readCourseDetails,
  programResultForModel,
  programCourseCode,
} from "../lib/course-details";
import { INPUT_SCHEMA } from "../lib/tools/getProgramRequirements";
import {
  scheduleCourseForTurn,
  scheduleToolChoice,
  scheduleDiscoveryChoice,
  asksWhoTeachesNow,
} from "../lib/tools/getClassSchedule";

const profile: OnboardingPayload = {
  goal: "schedule_fit",
  major: "2764",
  dayparts_pref: ["weekend"],
  target_institution: null,
  modality_pref: null,
  student_type: null,
  transfer_direction: null,
  interest_area: null,
  oneoff_purpose: null,
  intl_status: null,
  skippedSteps: [],
  onboardingVersion: "test",
  completedAt: "2026-09-20T00:00:00Z",
};
const skin = { link: "link", chip: "chip" } as Skin;

test("course-title teaching questions complete discovery without guessing from CVs or ambiguous courses", () => {
  const question = "who's teaching intro to mysql?";
  assert.equal(asksWhoTeachesNow(question), true);
  assert.equal(asksWhoTeachesNow("Who teaches ITSE 1303?"), true);
  for (const suffix of [
    "in Spring 2026",
    "next term",
    "last semester",
    "across all terms",
  ])
    assert.equal(
      asksWhoTeachesNow(`who's teaching intro to mysql ${suffix}?`),
      false,
    );
  const step = (results: unknown[]) => ({
    toolResults: [
      { toolName: "search_knowledge", output: { found: true, results } },
    ],
  });
  const section = {
    doc_type: "section",
    text: "ITSE 1303 — Intro to MySQL (3 cr), section 4, 2026FA",
  };
  const cv = {
    doc_type: "cv",
    text: "Professor taught ITSE 1329 and ITSE 1303 previously",
  };
  assert.equal(
    scheduleDiscoveryChoice(question, [step([section, cv])])?.toolName,
    "get_class_schedule",
  );
  assert.equal(scheduleDiscoveryChoice(question, [step([cv])]), undefined);
  assert.equal(
    scheduleDiscoveryChoice(question, [
      step([section, { doc_type: "course", course_code: "ITSE 1329" }]),
    ]),
    undefined,
  );
  assert.equal(
    scheduleDiscoveryChoice(question, [
      step([section]),
      {
        toolResults: [
          { toolName: "get_class_schedule", output: { found: false } },
        ],
      },
    ]),
    undefined,
  );
  assert.equal(
    scheduleDiscoveryChoice("What is this professor's background?", [
      step([section]),
    ]),
    undefined,
  );
});

test("the complete instructor roster is independent of the section page, with expandable highlighted CVs", () => {
  const cv =
    "https://dallascollege.campusconcourse.com/view_cv_information_for_course?course_id=89226";
  const output = {
    found: true,
    course_code: "ITSE 1303",
    total_sections: 150,
    truncated: true,
    next_offset: 100,
    instructors: Array.from({ length: 8 }, (_, i) => ({
      name: `Professor ${i}`,
      professor_cv_url: cv,
    })),
    instructor_profiles: [
      {
        name: "Professor 7",
        source_url: cv,
        background:
          "Computer science and machine learning. C++ and C#; JavaScript is distinct. <script>unsafe()</script>",
      },
    ],
    offerings: [
      { section_number: "1", professor: "Professor 0", professor_cv_url: cv },
    ],
  };
  const html = renderToStaticMarkup(
    createElement(ScheduleResults, {
      name: "get_class_schedule",
      output,
      skin,
      showInstructors: true,
    }),
  );
  assert.match(html, /All 8 named instructors/);
  for (let i = 0; i < 8; i++)
    assert.match(html, new RegExp(`<strong>Professor ${i}</strong>`));
  assert.match(html, /<mark[^>]*>machine learning<\/mark>/i);
  assert.match(html, /<mark[^>]*>C\+\+<\/mark>/);
  assert.match(html, /<mark[^>]*>C#<\/mark>/);
  assert.doesNotMatch(html, /<mark[^>]*>Java<\/mark>Script/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /Professor CV for Professor 7/);
  const compact = scheduleResultForModel(output) as Record<string, unknown>;
  assert.equal(compact.instructor_profiles, undefined);
  assert.deepEqual(compact.instructors, output.instructors);
  assert.equal(output.instructor_profiles.length, 1);
});

test("schedule summaries count unassigned sections and keep page counts separate from totals", () => {
  const output = {
    total_sections: 942,
    offset: 100,
    truncated: true,
    offerings: [
      ...Array.from({ length: 9 }, () => ({
        modality: "online",
        professor: null,
      })),
      ...Array.from({ length: 5 }, () => ({ modality: "hybrid" })),
      { modality: "in_person" },
      { modality: "in_person" },
      { modality: null },
    ],
  };
  const result = scheduleResultForModel(output) as Record<string, unknown>;
  assert.deepEqual(result.loaded_section_counts, {
    scope: "loaded_page",
    total: 17,
    by_modality: { online: 9, hybrid: 5, in_person: 2, unknown: 1 },
  });
  assert.equal(result.total_sections, 942);
  assert.equal(result.truncated, true);
  assert.equal("loaded_section_counts" in output, false);
});

test("related CV candidates stay qualified, with long backgrounds behind show more", () => {
  const html = renderToStaticMarkup(
    createElement(InstructorResults, {
      name: "search_knowledge",
      skin,
      output: {
        found: true,
        results: [
          {
            doc_type: "cv",
            name: "Example",
            text: "Research in Python and data science.",
            source_url:
              "https://dallascollege.campusconcourse.com/view_cv_information_for_course?course_id=1",
          },
        ],
      },
    }),
  );
  assert.match(html, /not a complete faculty list/);
  assert.match(html, /<details/);
  assert.match(html, /<mark[^>]*>Python<\/mark>/);
  assert.match(html, /<strong>Example<\/strong>/);
});
const course = {
  course_code: "CDEC 1354",
  title: "Child Growth and Development",
  credit_hours: 3,
  description:
    "Physical, emotional, social, and cognitive factors impacting growth and development of children through adolescence.",
  requisites_raw: "Recommended: Check the catalog preparation requirements.",
  campus_locations: "BHC, CVC",
  catalog_year: "2026-2027",
  source_url:
    "https://catalog.dallascollege.edu/preview_course_nopop.php?catoid=5&coid=15359#2026-2027#facts",
};

test("storage-unavailable sessions finish hydration in memory", () => {
  assert.equal(useStudentSession.persist, undefined);
  hydrateStudentSession();
  assert.equal(useStudentSession.getState().hasHydrated, true);
  assert.ok(useStudentSession.getState().studentId);
});

test("official resource citations are visible and lookalike hosts are rejected", () => {
  assert.equal(
    citationHref("https://www.dallascollege.edu/resources/tutoring/"),
    "https://www.dallascollege.edu/resources/tutoring/",
  );
  assert.equal(
    citationHref("https://www.dallascollege.edu.evil.example/path"),
    null,
  );
  assert.equal(citationHref("javascript:alert(1)"), null);
});

test("schedule grouping retains sections, duplicates only across meeting groups, and does not invent online times", () => {
  const sections = [
    {
      section_number: "1",
      professor: "A",
      campus: "NLC",
      meets: ["Mon / Wed 10:20 AM–11:40 AM (lecture)"],
    },
    {
      section_number: "2",
      professor: "A",
      campus: "Online",
      meets: [],
      meeting_info_raw: "M T W R F S U",
    },
    {
      section_number: "3",
      professor: "B",
      campus: "NLC",
      meets: ["Tue 12:00 PM–01:00 PM", "Tue 05:00 PM–06:00 PM"],
    },
  ];
  assert.deepEqual(
    groupScheduleSections(sections, "professor").map(([label, rows]) => [
      label,
      rows.length,
    ]),
    [
      ["A", 2],
      ["B", 1],
    ],
  );
  assert.deepEqual(
    groupScheduleSections(sections, "day").map(([label, rows]) => [
      label,
      rows.length,
    ]),
    [
      ["Mon", 1],
      ["Tue", 1],
      ["Wed", 1],
      ["No published clock times", 1],
    ],
  );
  assert.deepEqual(
    groupScheduleSections(sections, "time").map(([label, rows]) => [
      label,
      rows.length,
    ]),
    [
      ["Morning", 1],
      ["Afternoon", 1],
      ["Evening", 1],
      ["No published clock times", 1],
    ],
  );
  for (const by of ["section", "day", "time", "campus", "professor"] as const) {
    const ids = new Set(
      groupScheduleSections(sections, by).flatMap(([, rows]) =>
        rows.map((r) => r.section_number),
      ),
    );
    assert.equal(ids.size, 3);
  }
});

test("professor links require an exact unique CV and are restricted to approved source hosts", () => {
  const cv =
    "https://dallascollege.campusconcourse.com/view_cv_information_for_course?course_id=1";
  const links = instructorCvLinks([
    { slug: "matched", sourceUrl: cv },
    { slug: "matched", sourceUrl: cv },
    { slug: "ambiguous", sourceUrl: cv },
    { slug: "ambiguous", sourceUrl: cv + "2" },
    { slug: null, sourceUrl: cv },
  ]);
  assert.equal(links.get("matched"), cv);
  assert.equal(links.has("ambiguous"), false);
  const html = renderToStaticMarkup(
    createElement(ScheduleResults, {
      name: "get_class_schedule",
      skin,
      output: {
        course_code: "ENGL 1301",
        total_sections: 942,
        truncated: true,
        offerings: [
          { section_number: "1", professor: "A", professor_cv_url: cv },
          {
            section_number: "2",
            professor: "B",
            professor_cv_url: "https://untrusted.example/cv",
          },
        ],
      },
    }),
  );
  assert.match(html, /Professor CV for A/);
  assert.doesNotMatch(html, /Professor CV for B|untrusted.example/);
  assert.match(html, /942 sections/);
  assert.match(html, /This page shows 2 sections/);
  assert.match(html, /Group by/);
});

test("an explicit schedule recheck forces one fresh lookup instead of trusting old conversation results", () => {
  const question =
    "Look up ITSE 1370 Fall 2026 again in the current records. Show all sections with their course dates and meeting times.";
  assert.equal(scheduleCourseForTurn(question), "ITSE 1370");
  assert.deepEqual(scheduleToolChoice(question, 0), {
    type: "tool",
    toolName: "get_class_schedule",
  });
  assert.equal(scheduleToolChoice(question, 1), undefined);
  assert.equal(
    scheduleCourseForTurn("Who teaches itse1370 this fall?"),
    "ITSE 1370",
  );
  assert.equal(scheduleCourseForTurn("Show Fall 2026 sections"), undefined);
  assert.equal(
    scheduleCourseForTurn("Prerequisites for ITSE 1370?"),
    undefined,
  );
  assert.equal(
    scheduleCourseForTurn("Compare ITSE 1370 and ITSE 2370 schedules"),
    undefined,
  );
  assert.equal(
    scheduleCourseForTurn(
      "Show the course plan for Python Developer Certificate",
    ),
    undefined,
  );
});

test("semester scope follows the current question and preserves its choice groups", () => {
  assert.deepEqual(
    requestedSemesters("prerequisites for first-semester courses"),
    [1],
  );
  assert.deepEqual(requestedSemesters("show semester 2"), [2]);
  assert.deepEqual(
    requestedSemesters("compare first and second semesters"),
    [1, 2],
  );
  assert.deepEqual(requestedSemesters("semesters 1 and 2"), [1, 2]);
  assert.deepEqual(requestedSemesters("show the full program plan"), []);
  assert.deepEqual(
    requestedSemesters("Who teaches Python this Fall 2026?"),
    [],
  );
  const groups = [
    { name: "Semester 1" },
    { name: "Semester 1 - Choose one" },
    { name: "Semester 2" },
    { name: "Semester 10" },
  ];
  assert.deepEqual(scopeProgramGroups(groups, [1]), groups.slice(0, 2));
  assert.deepEqual(scopeProgramGroups(groups, []), groups);
  assert.deepEqual(scopeProgramGroups([{ name: "Required courses" }], [1]), []);
});

test("first-semester display excludes other semesters, even from an older full-plan response", () => {
  const html = renderToStaticMarkup(
    createElement(CourseResults, {
      skin,
      name: "get_program_requirements",
      semesters: [1],
      output: {
        found: true,
        name: "Example",
        total_credits: 120,
        groups: [
          { name: "Semester 1", courses: [course.course_code] },
          { name: "Semester 2", courses: ["ITSE 2370"] },
        ],
        course_details: [course],
      },
    }),
  );
  assert.match(html, /Semester 1/);
  assert.match(html, /120 credits for the full program/);
  assert.doesNotMatch(html, /Semester 2|ITSE 2370/);
  const missing = renderToStaticMarkup(
    createElement(CourseResults, {
      skin,
      name: "get_program_requirements",
      output: {
        found: true,
        groups: [],
        requested_semesters: [1],
        semester_scope_found: false,
      },
    }),
  );
  assert.match(missing, /not identified in this catalog record/);
});

test("long elective rules are available behind a closed disclosure, with credits still visible", () => {
  const rule =
    "Any 3-credit ITSE/INEW course may be used. Suggested courses and pairings: " +
    "ITSE 2370 and ITSE 2317. ".repeat(12);
  const html = renderToStaticMarkup(
    createElement(CourseResults, {
      skin,
      name: "get_program_requirements",
      output: {
        found: true,
        groups: [
          {
            name: "Semester 3",
            credits_required: 15,
            rule,
            courses: ["Elective - ITSE/INEW Course (3 Credit Hours)"],
          },
        ],
      },
    }),
  );
  assert.match(html, /15 total credits/);
  assert.match(
    html,
    /<details[^>]*><summary[^>]*>Elective - ITSE\/INEW Course.*Show more.*<\/summary>/,
  );
  assert.ok(html.includes(rule.trim()));
  assert.doesNotMatch(html, /<details[^>]*\bopen\b/);
});

test("schedule rows preserve distinct sections and never treat missing times as asynchronous", () => {
  const common = {
    year: 2026,
    semester: "fall",
    professor: "Example Instructor",
    sourceUrl: course.source_url,
    metadata: { modality: "online", section: "6" },
  };
  const missing = scheduleSection({ ...common, facts: {} });
  assert.equal(missing.timing_status, "not_loaded");
  const first = scheduleSection({
    ...common,
    facts: {
      section_number: "6",
      meetings: [{ days: "W", start_time: "6:30 PM", end_time: "7:20 PM" }],
    },
  });
  const second = scheduleSection({
    ...common,
    facts: {
      section_number: "2",
      meetings: [{ days: "T", start_time: "6:30 PM", end_time: "7:20 PM" }],
    },
  });
  assert.notDeepEqual(first.meets, second.meets);
  assert.notEqual(first.section_number, second.section_number);
  const variable = scheduleSection({
    ...common,
    facts: { meeting_info_raw: "Meeting Patterns will vary.", meetings: [] },
  });
  assert.equal(variable.timing_status, "source_text_only");
  const html = renderToStaticMarkup(
    createElement(ScheduleResults, {
      skin,
      name: "get_class_schedule",
      output: {
        course_code: "CDEC 1354",
        offerings: [missing, first, second, variable],
        total_sections: 4,
        requested_term: "fall 2026",
      },
    }),
  );
  assert.match(html, /No published clock times in this record/);
  assert.match(html, /6:30 PM/);
  assert.match(html, /Meeting Patterns will vary/);
  assert.doesNotMatch(html, /no fixed time|asynchronous/i);
});

test("schedule starters use onboarding preferences and bound the saved-data claim", () => {
  const firstSemester = starterQuestionsFor({
    ...profile,
    goal: "first_semester_plan",
    dayparts_pref: ["evening"],
  });
  assert.match(firstSemester[2].prompt, /I prefer evening/);
  assert.match(firstSemester[2].prompt, /Administrative Certificate/);
  for (const [modality, dayparts, term] of [
    ["online", null, "online"],
    [null, ["weekend"], "weekend"],
    [null, ["evening"], "evening"],
    ["online", ["evening", "weekend"], "online and evening and weekend"],
    [null, null, null],
  ] as const) {
    const questions = starterQuestionsFor({
      ...profile,
      modality_pref: modality,
      dayparts_pref: dayparts ? [...dayparts] : null,
    });
    assert.equal(questions.length, 3);
    assert.match(questions[0].prompt, /Administrative Certificate/);
    assert.match(questions[1].prompt, /one required course from that semester/);
    assert.match(questions[1].prompt, /Missing meeting times are unknown/);
    assert.match(questions[1].prompt, /do not claim live availability/);
    if (term) assert.ok(questions[1].prompt.includes(`I prefer ${term}`));
  }
  assert.doesNotMatch(
    handoffIntro(profile),
    /build a schedule|schedule that fits/,
  );
});

test("every picker program yields a named course-plan prompt; missing programs never inherit the demo course", () => {
  for (const program of PROGRAMS) {
    const first = starterQuestionsFor({ ...profile, major: program.code })[0];
    assert.ok(first.prompt.includes(program.label), program.code);
    assert.deepEqual(requestedSemesters(first.prompt), [1], program.code);
    assert.ok(INPUT_SCHEMA.safeParse({ programName: program.label }).success);
  }
  const unknown = starterQuestionsFor({ ...profile, major: "missing" });
  assert.match(unknown[0].prompt, /First ask which program/);
  assert.doesNotMatch(unknown[0].prompt, /Administrative|CDEC|ENGL 1301/);
});

test("program lookup accepts returned catalog names outside display labels, but bounds empty or oversized input", () => {
  assert.ok(
    INPUT_SCHEMA.safeParse({
      programName: "Core Objectives and Foundational Component Areas",
    }).success,
  );
  assert.equal(INPUT_SCHEMA.safeParse({ programName: " " }).success, false);
  assert.equal(
    INPUT_SCHEMA.safeParse({ programName: "a".repeat(201) }).success,
    false,
  );
});

test("special scenarios stay within direct resource and catalog capabilities", () => {
  for (const purpose of [
    "job_licensure",
    "prerequisite",
    "enrichment",
  ] as const) {
    const qs = starterQuestionsFor({
      ...profile,
      major: null,
      goal: "nondegree_oneoff",
      oneoff_purpose: purpose,
    });
    assert.doesNotMatch(
      qs.map((q) => q.label).join(" "),
      /major|degree|transfer/i,
    );
  }
  const moving = starterQuestionsFor({
    ...profile,
    goal: "settle_in",
    major: null,
  });
  assert.match(
    moving.map((q) => q.prompt).join(" "),
    /housing rental assistance.*DART GoPass.*tutoring/,
  );
  assert.doesNotMatch(moving.map((q) => q.prompt).join(" "), /orientation/);
  const transfer = starterQuestionsFor({
    ...profile,
    major: null,
    goal: "transfer_check",
    transfer_direction: "transfer_back",
    target_institution: "UTA",
  });
  assert.match(transfer[1].prompt, /UT Arlington/);
  assert.match(transfer[1].prompt, /do not assume a course equivalence/);
  assert.doesNotMatch(
    transfer.map((q) => q.prompt).join(" "),
    /three questions|guaranteed transfer acceptance/i,
  );
});

test("catalog projection preserves prose recommendations and rejects placeholder/nonfinite facts", () => {
  assert.equal(
    programCourseCode(
      "ACCT 2301 - Principles of Financial Accounting (3 Credit Hours)",
    ),
    "ACCT 2301",
  );
  assert.equal(
    programCourseCode(
      "SPCH 1311 - Introduction OR SPCH 1315 - Public Speaking",
    ),
    null,
  );
  assert.equal(
    programCourseCode("Elective - General Elective (3 Credit Hours)"),
    null,
  );
  assert.equal(
    readCourseDetails({ ...course, course_code: "HIST XXXX" }),
    null,
  );
  assert.equal(
    readCourseDetails({ ...course, credit_hours: NaN })?.credit_hours,
    null,
  );
  assert.equal(
    readCourseDetails({
      ...course,
      requisites_raw: null,
      prerequisites: [
        { raw_text: "Recommended: MATH 1314.", one_of: ["MATH 1314"] },
      ],
    })?.requisites_raw,
    "Prerequisites: Recommended: MATH 1314.",
  );
  assert.equal(
    courseDetailsFromRow({
      facts: course,
      courseCode: course.course_code,
      sourceUrl: course.source_url,
      catalogYear: "2026-2027",
    })?.description,
    course.description,
  );
});

test("verified courses render collapsed details and an explicit save action with source-backed fields", () => {
  const markup = renderToStaticMarkup(
    createElement(CourseResults, {
      name: "get_course_info",
      output: { found: true, ...course },
      skin,
    }),
  );
  assert.match(markup, /Show more/);
  assert.doesNotMatch(markup, /<details[^>]*\sopen(?:=|\s|>)/);
  assert.match(markup, /Add CDEC 1354 to my notes/);
  assert.match(markup, /Child Growth and Development/);
  assert.match(markup, /Recommended: Check/);
  assert.match(markup, /3 credits/);
  assert.doesNotMatch(markup, /#2026-2027#facts/);
});

test("program cards retain rules and credits, never give placeholders or missing records a save button", () => {
  const markup = renderToStaticMarkup(
    createElement(CourseResults, {
      name: "get_program_requirements",
      skin,
      output: {
        found: true,
        name: "Test plan",
        total_credits: 18,
        catalog_year: "2026-2027",
        groups: [
          {
            name: "Semester 1",
            courses: [
              "CDEC 1354",
              "CDEC 1354 - Child Growth and Development (3 credits)",
              "HIST XXXX",
              "ABDR 1307",
              "General elective (3 credits)",
              "General elective (3 credits)",
            ],
            credits_required: 6,
            slot_kind: "choose",
            rule: "Choose one course; do not take both.",
            options_exhaustive: false,
          },
        ],
        course_details: [course],
        component_areas: [
          { name: "Communication", courses: ["ENGL 1301"], more_not_shown: 3 },
        ],
      },
    }),
  );
  assert.equal((markup.match(/Add CDEC 1354 to my notes/g) ?? []).length, 1);
  assert.doesNotMatch(markup, /Add (?:HIST XXXX|ABDR 1307) to my notes/);
  assert.match(markup, /Choose one course; do not take both/);
  assert.match(markup, /6 total credits/);
  assert.match(markup, /Other options/);
  assert.match(markup, /3 additional options/);
  assert.match(markup, /<h3[^>]*>Semester 1<\/h3>/);
  assert.match(markup, /<ol[^>]*list-decimal/);
  assert.equal(
    (markup.match(/General elective \(3 credits\)/g) ?? []).length,
    2,
  );
});

test("conversation replay keeps program rules and credits without repeating expandable descriptions in model context", async () => {
  const output = {
    found: true,
    name: "Test plan",
    groups: [
      {
        name: "Semester 1",
        courses: [course.course_code],
        rule: "Choose one course.",
      },
    ],
    course_titles: { [course.course_code]: course.title },
    course_details: [course],
  };
  const tools = {
    get_program_requirements: tool({
      inputSchema: INPUT_SCHEMA,
      execute: async () => output,
      toModelOutput: ({ output: value }) => ({
        type: "text",
        value: JSON.stringify(programResultForModel(value)),
      }),
    }),
  };
  const messages = await convertToModelMessages(
    [
      {
        role: "assistant",
        parts: [
          {
            type: "tool-get_program_requirements",
            toolCallId: "program-call",
            state: "output-available",
            input: { programName: "Test plan" },
            output,
          },
        ],
      },
    ],
    { tools },
  );
  const serialized = JSON.stringify(messages);
  assert.ok(!serialized.includes(course.description));
  assert.ok(serialized.includes("course_credits"));
  assert.ok(serialized.includes(course.requisites_raw));
  assert.ok(serialized.includes("Choose one course."));
  assert.ok(serialized.includes(course.title));
  assert.deepEqual(output.course_details, [course]);
  assert.deepEqual(programResultForModel({ found: false }), { found: false });
});

test("failed and ambiguous tool results never become course cards", () => {
  for (const output of [
    { found: false, ...course },
    { found: true, ambiguous: true, matches: ["A", "B"] },
  ]) {
    assert.equal(
      renderToStaticMarkup(
        createElement(CourseResults, { name: "get_course_info", output, skin }),
      ),
      "",
    );
  }
});

test("legacy requisite groups preserve concurrent enrollment labels", () => {
  const course = courseDetailsFromRow({
    courseCode: "ITSE 2370",
    catalogYear: "2026-2027",
    sourceUrl: "https://example.edu/course",
    facts: {
      prerequisites: [{ raw_text: "Recommended: ITSE 1370." }],
      corequisites: [{ raw_text: "Required: MATH 1314." }],
    },
  });
  const result = assessRequisites(course!.requisites_raw, {});
  assert.deepEqual(result.required, []);
  assert.deepEqual(result.recommended, ["Recommended: ITSE 1370."]);
  assert.deepEqual(result.corequisites, ["Corequisites: Required: MATH 1314."]);
});

test("restored notes are validated, unique and bounded just like newly saved notes", () => {
  const merge = useSavedCourses.persist.getOptions().merge!;
  const restored = merge(
    {
      courses: [
        course,
        { ...course, title: "Updated source title" },
        { course_code: "HIST XXXX" },
        null,
      ],
      questions: [
        "   ",
        "hello",
        "  What are my prerequisites?  ",
        "What are my prerequisites?",
        ...Array.from(
          { length: 45 },
          (_, i) => `What are the requirements for course ${i}?`,
        ),
      ],
    },
    useSavedCourses.getState(),
  );
  assert.equal(restored.courses.length, 1);
  assert.equal(restored.courses[0].title, "Updated source title");
  assert.equal(restored.questions.length, 40);
  assert.equal(new Set(restored.questions).size, 40);
  assert.ok(restored.questions.every((q) => q === q.trim() && q.length > 0));
});

test("saved notes survive unavailable browser storage and reject invalid course identifiers", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("Storage blocked");
    },
  });
  try {
    assert.doesNotThrow(() => useSavedCourses.getState().clear());
    assert.doesNotThrow(() => useSavedCourses.getState().toggle(course));
    useSavedCourses.getState().toggle({ course_code: "HIST XXXX" });
    assert.equal(useSavedCourses.getState().courses.length, 1);
    assert.doesNotThrow(() =>
      useSavedCourses.getState().addQuestion("Which prerequisites do I need?"),
    );
    assert.equal(useSavedCourses.getState().questions.length, 1);
    assert.doesNotThrow(() => useSavedCourses.getState().clear());
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("the printable sheet uses the same official citation policy as chat", () => {
  // React's server snapshot reads the initial store, not its client state.
  const initial = useSavedCourses.getInitialState();
  const previous = initial.courses;
  try {
    initial.courses = [
      { ...course, source_url: "https://untrusted.example/catalog" },
    ];
    assert.doesNotMatch(
      renderToStaticMarkup(createElement(SummarySheet)),
      /untrusted.example/,
    );
    initial.courses = [course];
    const official = renderToStaticMarkup(createElement(SummarySheet));
    assert.match(official, /<svg[^>]+sheet-bot/);
    assert.doesNotMatch(official, /dallas-college\.svg|sheet-dc-logo/);
    assert.ok(official.includes("catalog.dallascollege.edu"));
    assert.doesNotMatch(official, /#2026-2027#facts/);
  } finally {
    initial.courses = previous;
  }
});

test("print questions keep starter context without instructions and repair existing notes", () => {
  const merge = useSavedCourses.persist.getOptions().merge!;
  for (const goal of [
    "first_semester_plan",
    "transfer_check",
    "graduation_check",
    "schedule_fit",
  ] as const) {
    for (const program of PROGRAMS) {
      for (const q of starterQuestionsFor({
        ...profile,
        goal,
        major: program.code,
      })) {
        const note = q.note ?? q.label;
        assert.doesNotMatch(
          note,
          /course cards|Reply in|do not|without repeating|Use the schedule/,
        );
        if (/^Look up the published course plan/.test(q.prompt)) {
          assert.ok(note.includes(program.label), note);
          assert.deepEqual(
            requestedSemesters(note),
            requestedSemesters(q.prompt),
          );
          const restored = merge(
            { questions: [q.prompt, note] },
            useSavedCourses.getState(),
          );
          assert.deepEqual(restored.questions, [note]);
        }
      }
    }
  }
  const typed =
    "I finished ITSE 1370. What can I take next, and can I study only on weekends?";
  const restored = merge({ questions: [typed] }, useSavedCourses.getState());
  assert.deepEqual(restored.questions, [typed]);
  const screenshot =
    "Look up the published course plan for Accounting Assistant Certificate. The course cards already show the requested checklist and its credits. Reply in at most two sentences introducing those cards, without writing a course list or semester-by-semester breakdown. Keep the published credit total exact; unresolved elective choices do not change that total.";
  assert.deepEqual(
    merge({ questions: [screenshot] }, useSavedCourses.getState()).questions,
    ["Which courses are required for Accounting Assistant Certificate?"],
  );
});

test("semester ranges and unavailable numbered semesters never substitute the full plan", () => {
  for (const text of [
    "semesters 1-3",
    "first through third semesters",
    "1st to 3rd semester",
    "semester 3 to 1",
  ])
    assert.deepEqual(requestedSemesters(text), [1, 2, 3], text);
  assert.deepEqual(requestedSemesters("show semester 13"), [13]);
  assert.deepEqual(scopeProgramGroups([{ name: "Semester 1" }], [13]), []);
  assert.deepEqual(requestedSemesters("Fall 2026"), []);
  assert.equal(scheduleCourseForTurn("Who's teaching ITSE 1303?"), "ITSE 1303");
});

test("section notes preserve different terms, validate hydration, and retain the course after removal", () => {
  const state = useSavedCourses.getState();
  const original = { courses: state.courses, questions: state.questions };
  const section = {
    section_number: "1001",
    term: "Fall 2026",
    start_date: "Aug 24, 2026",
    end_date: "Dec 10, 2026",
    meets: ["Mon / Wed 09:00 AM–09:55 AM (lecture) · K103"],
    source_url:
      "https://dallascollege.campusconcourse.com/view_syllabus?course_id=12345",
  };
  try {
    useSavedCourses.setState({ courses: [] });
    state.toggleSection(course, section);
    state.toggleSection(course, { ...section, term: "Spring 2027" });
    const saved = useSavedCourses.getState().courses;
    assert.equal(saved.length, 1);
    assert.equal(saved[0].sections?.length, 2);
    assert.equal(saved[0].credit_hours, course.credit_hours);
    const merge = useSavedCourses.persist.getOptions().merge!;
    const restored = merge(
      {
        courses: [
          {
            ...saved[0],
            sections: [
              section,
              section,
              { source_url: "javascript:alert(1)" },
              null,
            ],
          },
        ],
      },
      useSavedCourses.getState(),
    );
    assert.equal(restored.courses[0].sections?.length, 1);
    assert.equal(
      savedSectionKey(restored.courses[0].sections![0]),
      savedSectionKey(readSavedSection(section)!),
    );
    state.toggleSection(course, section);
    assert.equal(useSavedCourses.getState().courses[0].sections?.length, 1);
    state.toggleSection(course, { ...section, term: "Spring 2027" });
    assert.equal(useSavedCourses.getState().courses[0].sections?.length, 0);
    assert.equal(useSavedCourses.getState().courses.length, 1);
  } finally {
    useSavedCourses.setState(original);
  }
});

test("the coach sheet prints selected section dates and times instead of catalog prose", () => {
  const initial = useSavedCourses.getInitialState(),
    previous = initial.courses;
  const section = readSavedSection({
    section_number: "1001",
    term: "Fall 2026",
    professor: "Example Instructor",
    start_date: "Aug 24, 2026",
    end_date: "Dec 10, 2026",
    meets: ["Mon / Wed 09:00 AM–09:55 AM"],
    source_url:
      "https://dallascollege.campusconcourse.com/view_syllabus?course_id=12345",
  })!;
  try {
    initial.courses = [{ ...course, sections: [section] }];
    const html = renderToStaticMarkup(createElement(SummarySheet));
    for (const text of [
      "Section 1001",
      "Fall 2026",
      "Aug 24, 2026",
      "Dec 10, 2026",
      "09:00 AM–09:55 AM",
      "Example Instructor",
    ])
      assert.ok(html.includes(text));
    assert.ok(!html.includes(course.description!));
    initial.courses = [
      {
        ...course,
        sections: [{ ...section, meets: [], start_date: null, end_date: null }],
      },
    ];
    assert.match(
      renderToStaticMarkup(createElement(SummarySheet)),
      /Start date not listed|Meeting times not published/,
    );
    initial.courses = [course];
    assert.match(
      renderToStaticMarkup(createElement(SummarySheet)),
      /No section selected/,
    );
  } finally {
    initial.courses = previous;
  }
});

test("published schedule rows offer section-specific note actions only with an official source", () => {
  const section = {
    section_number: "1001",
    term: "Fall 2026",
    meets: [],
    source_url:
      "https://dallascollege.campusconcourse.com/view_syllabus?course_id=12345",
  };
  const html = renderToStaticMarkup(
    createElement(ScheduleResults, {
      name: "get_class_schedule",
      skin,
      output: {
        course_code: "ITSE 1303",
        offerings: [
          section,
          { ...section, source_url: "https://untrusted.example/section" },
        ],
      },
    }),
  );
  assert.equal((html.match(/\+ Add section to notes/g) ?? []).length, 1);
  assert.match(html, /Add ITSE 1303 section 1001 \(Fall 2026\) to my notes/);
});
