import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  assessPlan,
  assessRequisites,
  comparePlans,
  studentCourseHistory,
} from "../lib/planning";
import {
  facultyProfiles,
  matchFacultyEvidence,
  modelOutput,
} from "../lib/tools/searchFacultyExpertise";
import {
  CourseResults,
  InstructorResults,
} from "../features/chat/course-results";
import { requestedSemesters, type CourseDetails } from "../lib/course-details";
import type { Skin } from "../features/onboarding/skin";

const course = (
  code: string,
  title = "Catalog course",
  raw: string | null = null,
): CourseDetails => ({
  course_code: code,
  title,
  credit_hours: 3,
  requisites_raw: raw,
  description: null,
  campus_locations: null,
  catalog_year: "2026-2027",
});
const details = [
  course("ITSE 1370", "Introduction to Python Programming"),
  course(
    "ITSE 2370",
    "Intermediate Python Programming",
    "Prerequisites: Recommended: ITSE 1370.",
  ),
  course("MATH 1314", "College Algebra"),
];
const plan = {
  name: "Example",
  catalog_year: "2026-2027",
  total_credits: 9,
  groups: [
    {
      name: "Semester 1",
      slot_kind: "fixed",
      courses: details.map((c) => c.course_code),
      credits_required: 9,
    },
  ],
  course_details: details,
};
const skin = { link: "link", chip: "chip" } as Skin;

for (const [statement, expected] of [
  ["I've completed ITSE1370 and MATH 1314.", "completed"],
  ["I'm taking ITSE 1370", "in_progress"],
  ["I haven't completed ITSE 1370", "not_completed"],
  ["I didn't pass ITSE 1370", "not_completed"],
  ["I withdrew from ITSE 1370", "not_completed"],
  ["I will have completed ITSE 1370 by May", "planned"],
  ["I transferred ITSE 1370 from another college", "transfer_pending"],
] as const)
  test(`course history: ${statement}`, () =>
    assert.equal(
      studentCourseHistory([statement])["ITSE 1370"]?.status,
      expected,
    ));

test("questions and someone else's history never grant completion", () => {
  assert.deepEqual(
    studentCourseHistory([
      "Have I completed ITSE 1370?",
      "My friend passed ITSE 1370",
    ]),
    {},
  );
});
test("later corrections and different statuses in one message are retained", () => {
  const history = studentCourseHistory([
    "I completed ITSE 1370",
    "Actually I didn't complete ITSE 1370",
    "I passed MATH 1314 and failed ITSE 2370",
  ]);
  assert.equal(history["ITSE 1370"].status, "not_completed");
  assert.equal(history["MATH 1314"].status, "completed");
  assert.equal(history["ITSE 2370"].status, "not_completed");
  assert.equal(
    studentCourseHistory(["I took ITSE 1370 but failed it"])["ITSE 1370"]
      .status,
    "not_completed",
  );
});
test("a verified introductory title resolves, an ambiguous title does not", () => {
  assert.equal(
    studentCourseHistory(["I passed intro to Python"], details)["ITSE 1370"]
      .status,
    "completed",
  );
  assert.deepEqual(
    studentCourseHistory(
      ["I passed intro to Python"],
      [...details, course("COSC 1436", details[0].title!)],
    ),
    {},
  );
});
test("completed credits are subtracted once; in-progress credits remain unfinished", () => {
  const result = assessPlan(plan, [
    "I completed ITSE 1370 twice. I'm taking ITSE 2370",
  ]);
  assert.equal(result.remaining_credits, 6);
  assert.deepEqual(result.remaining_required_courses, ["MATH 1314"]);
  assert.deepEqual(result.completed_required_courses, ["ITSE 1370"]);
  assert.deepEqual(result.in_progress_required_courses, ["ITSE 2370"]);
});
test("semester-scoped credits do not use the full-program total", () => {
  const result = assessPlan(
    { ...plan, total_credits: 120, requested_semesters: [1] },
    ["I passed ITSE 1370"],
  );
  assert.equal(result.published_credits, 9);
  assert.equal(result.remaining_credits, 6);
});
test("missing course credits and elective placeholders block an exact remaining total", () => {
  assert.equal(
    assessPlan({ ...plan, course_details: details.slice(1) }, [])
      .remaining_credits,
    null,
  );
  assert.equal(
    assessPlan(
      {
        ...plan,
        groups: [
          {
            name: "Semester 1",
            slot_kind: "fixed",
            courses: ["Elective - ITNW Course (3 Credit Hours)"],
          },
        ],
      },
      [],
    ).remaining_credits,
    null,
  );
});
test("simple choose-one electives count only the required credits", () => {
  const elective = {
    ...plan,
    total_credits: 6,
    groups: [
      { name: "Required", slot_kind: "fixed", courses: ["ITSE 1370"] },
      {
        name: "Elective",
        slot_kind: "choose",
        options_exhaustive: true,
        credits_required: 3,
        courses: ["ITSE 2370", "MATH 1314"],
      },
    ],
  };
  const result = assessPlan(elective, ["I passed ITSE 2370 and MATH 1314"]);
  assert.equal(result.remaining_credits, 3);
  assert.equal(result.elective_allocations[0].completed_credits, 3);
  assert.equal(result.unallocated_completed_courses.length, 1);
});
test("an elective reused by two requirements is never double-counted", () => {
  const group = {
    name: "Elective",
    slot_kind: "choose",
    options_exhaustive: true,
    credits_required: 3,
    courses: ["ITSE 2370", "MATH 1314"],
  };
  const result = assessPlan(
    {
      ...plan,
      total_credits: 6,
      groups: [group, { ...group, name: "Other elective" }],
    },
    ["I passed MATH 1314"],
  );
  assert.equal(result.remaining_credits, null);
  assert.ok(
    result.elective_allocations.every((g) => g.completed_credits === 0),
  );
});
test("unrecognized course history blocks a misleading remaining total", () => {
  assert.equal(
    assessPlan(plan, ["I completed beginner programming"]).remaining_credits,
    null,
  );
});
test("explicit removal from completed history takes effect", () => {
  const history = studentCourseHistory([
    "I passed ITSE 1370",
    "Don't count ITSE 1370 as completed",
  ]);
  assert.equal(history["ITSE 1370"].status, "not_completed");
});
test("OR choices in a nominally fixed semester are not both mandatory", () => {
  const alternative = {
    ...plan,
    groups: [
      {
        name: "Semester 4",
        slot_kind: "fixed",
        courses: ["INEW 2332", "ITSC 1364"],
        rule: "INEW 2332 - Project (3 Credit Hours) OR ITSC 1364 - Practicum (3 Credit Hours).",
      },
    ],
  };
  assert.deepEqual(
    comparePlans(alternative, alternative).shared_required_courses,
    [],
  );
  assert.equal(assessPlan(alternative, []).remaining_credits, null);
});
test("comparison is exact set arithmetic and excludes a third program", () => {
  const other = {
    ...plan,
    groups: [
      {
        name: "Semester 1",
        slot_kind: "fixed",
        courses: ["ITSE 1370", "ENGL 1301"],
      },
    ],
  };
  const result = comparePlans(plan, other);
  assert.deepEqual(result.shared_required_courses, ["ITSE 1370"]);
  assert.deepEqual(result.only_second_required_courses, ["ENGL 1301"]);
  assert.equal(result.shared_required_credits, 3);
  assert.equal(
    comparePlans(plan, { ...other, catalog_year: "2025-2026" })
      .shared_required_credits,
    null,
  );
});
test("recommendations, readiness requirements and absent information stay distinct", () => {
  assert.equal(
    assessRequisites(details[1].requisites_raw, {}).status,
    "recommendation_only",
  );
  assert.equal(
    assessRequisites(
      "Prerequisites: Required: College level ready in Reading and Writing.",
      {},
    ).status,
    "review_required",
  );
  assert.equal(assessRequisites(null, {}).status, "unknown");
  assert.equal(
    assessRequisites("Prerequisites: None.", {}).status,
    "none_stated",
  );
});
test("completed and in-progress courses leave the suggested list but remain in the checklist", () => {
  const output = {
    ...plan,
    found: true,
    planning: assessPlan(plan, ["I completed ITSE 1370. I'm taking ITSE 2370"]),
  };
  const html = renderToStaticMarkup(
    createElement(CourseResults, {
      name: "get_program_requirements",
      output,
      skin,
    }),
  );
  assert.ok(html.includes("ITSE 1370</strong>: completed"));
  assert.ok(html.includes("Add MATH 1314 to my notes"));
  assert.ok(!html.includes("Add ITSE 1370 to my notes"));
  assert.ok(!html.includes("Add ITSE 2370 to my notes"));
});
test("expertise search distinguishes AND/OR and does not infer LLM from NLP", () => {
  const spans = [
    "Taught Principles in Machine Learning",
    "Published research in natural language processing.",
  ];
  assert.deepEqual(matchFacultyEvidence(spans, ["ML", "LLM"], "any")?.topics, [
    "machine learning",
  ]);
  assert.equal(matchFacultyEvidence(spans, ["ML", "LLM"], "all"), null);
  assert.equal(
    matchFacultyEvidence(
      ["Enrollment grew in the LLM degree in law."],
      ["LLM"],
      "any",
    ),
    null,
  );
  assert.ok(
    matchFacultyEvidence(
      ["Developed generative AI systems using LLMs."],
      ["LLM"],
      "any",
    ),
  );
  assert.ok(matchFacultyEvidence(["C++ systems engineering"], ["C++"], "any"));
  assert.equal(
    matchFacultyEvidence(["JavaScript applications"], ["Java"], "any"),
    null,
  );
});
test("large faculty lists disclose the total, coverage, sources and Show more", () => {
  const output = {
    found: true,
    indexed_cv_records: 2709,
    results: Array.from({ length: 80 }, (_, i) => ({
      name: `Professor ${i}`,
      topics: ["Python"],
      evidence: ["Taught Python"],
      source_url:
        "https://dallascollege.campusconcourse.com/view_cv_information_for_course?course_id=123",
    })),
  };
  const html = renderToStaticMarkup(
    createElement(InstructorResults, {
      name: "search_faculty_expertise",
      output,
      skin,
    }),
  );
  assert.ok(
    html.includes("80 matching faculty profiles") &&
      html.includes("50 of 80 shown") &&
      html.includes("2709"),
  );
});

test("large faculty summaries preserve the total without suggesting a partial name list", () => {
  const output = {
    found: true,
    topics: ["mathematics"],
    match: "any" as const,
    total_matches: 292,
    complete: true,
    indexed_cv_records: 2709,
    oldest_source: "2026-07-01",
    newest_source: "2026-08-01",
    coverage_note: "Saved evidence only",
    keyword_variants: [],
    results: Array.from({ length: 292 }, (_, i) => ({
      name: `Professor ${i}`,
      topics: ["mathematics"],
      evidence: ["Taught mathematics"],
      source_url: `https://example.edu/${i}`,
      source_urls: [`https://example.edu/${i}`],
      source_checked_at: "2026-07-01",
    })),
  };
  const summary = modelOutput(output);
  assert.equal(summary.total_matches, 292);
  assert.equal(summary.results, undefined);
  assert.equal(output.results.length, 292);
  assert.ok(summary.display_note.includes("all 292"));
});

test("not-yet and nearly completed courses never reduce unfinished credits", () => {
  for (const text of [
    "I have not yet completed ITSE 1370",
    "I haven't yet passed ITSE 1370",
    "I nearly completed ITSE 1370",
    "I'm not taking ITSE 1370",
  ]) {
    assert.equal(
      studentCourseHistory([text])["ITSE 1370"].status,
      "not_completed",
      text,
    );
  }
});

test("a later computing use of an acronym is not hidden by an earlier unrelated use", () => {
  const result = matchFacultyEvidence(
    [
      "LLM in law. " +
        "Earlier legal study. ".repeat(20) +
        "Built LLM models for generative AI.",
    ],
    ["large language models"],
    "any",
  );
  assert.ok(result);
});

test("mixed student statements do not apply one status to every course", () => {
  for (const [statement, first, second] of [
    ["I completed ITSE 1370, not MATH 1314", "completed", "not_completed"],
    [
      "I passed ITSE 1370 and didn't pass MATH 1314",
      "completed",
      "not_completed",
    ],
    ["I passed ITSE 1370 and am taking MATH 1314", "completed", "in_progress"],
    [
      "ITSE 1370 is completed and MATH 1314 is in progress",
      "completed",
      "in_progress",
    ],
  ]) {
    const history = studentCourseHistory([statement]);
    assert.equal(history["ITSE 1370"]?.status, first, statement);
    assert.equal(history["MATH 1314"]?.status, second, statement);
  }
});

test("uncertain completion never earns credits and supersedes earlier certainty", () => {
  for (const statement of [
    "I'm not sure whether I passed ITSE 1370",
    "I don't think I completed ITSE 1370",
    "I may have passed ITSE 1370",
    "I think I passed ITSE 1370",
    "I don't remember whether I passed ITSE 1370",
    "I passed either ITSE 1370 or MATH 1314",
  ]) {
    const result = assessPlan(plan, ["I passed ITSE 1370", statement]);
    assert.ok(
      !result.completed_required_courses.includes("ITSE 1370"),
      statement,
    );
    assert.equal(result.remaining_credits, null, statement);
  }
});

test("future requirements and repeated elective options cannot earn duplicate credits", () => {
  assert.equal(
    studentCourseHistory(["I need to have completed ITSE 1370 by May"])[
      "ITSE 1370"
    ].status,
    "planned",
  );
  const result = assessPlan(
    {
      ...plan,
      total_credits: 6,
      groups: [
        {
          name: "Elective",
          slot_kind: "choose",
          options_exhaustive: true,
          credits_required: 6,
          courses: ["ITSE 1370", "ITSE 1370"],
        },
      ],
    },
    ["I passed ITSE 1370"],
  );
  assert.equal(result.remaining_credits, null);
});

test("a partially recognized course history blocks exact remaining credits", () => {
  const result = assessPlan(plan, [
    "I completed ITSE 1370 and beginner programming",
  ]);
  assert.equal(result.remaining_credits, null);
  assert.ok(result.completed_required_courses.includes("ITSE 1370"));
});

test("unapproved transfer corrections do not preserve completed credit", () => {
  const result = assessPlan(plan, [
    "I completed ITSE 1370",
    "My transfer of ITSE 1370 was not accepted",
  ]);
  assert.equal(result.history["ITSE 1370"]?.status, "transfer_pending");
  assert.ok(!result.completed_required_courses.includes("ITSE 1370"));
});

test("mixed future and comma-separated statuses stay attached to their own courses", () => {
  for (const [statement, expected] of [
    ["I completed ITSE 1370 and will take MATH 1314", "planned"],
    ["I completed ITSE 1370, MATH 1314 is in progress", "in_progress"],
  ]) {
    const history = studentCourseHistory([statement]);
    assert.equal(history["ITSE 1370"]?.status, "completed", statement);
    assert.equal(history["MATH 1314"]?.status, expected, statement);
  }
});

test("hypothetical outcomes and postfix questions do not rewrite a student's history", () => {
  for (const question of [
    "If I failed ITSE 1370, what would I take?",
    "Suppose I completed ITSE 1370, what next?",
    "ITSE 1370 completed?",
  ]) {
    assert.deepEqual(studentCourseHistory([question]), {}, question);
    assert.equal(
      studentCourseHistory(["I passed ITSE 1370", question])["ITSE 1370"]
        ?.status,
      "completed",
      question,
    );
  }
});

test("whole-program planning retains prerequisite and support requirements", () => {
  const withPreparation = {
    ...plan,
    groups: [
      {
        name: "Prerequisites",
        slot_kind: "fixed",
        courses: ["ITSE 1370"],
        credits_required: 3,
      },
      {
        name: "Required Support Courses",
        slot_kind: "fixed",
        courses: ["MATH 1314"],
        credits_required: 3,
      },
      {
        name: "Semester 1",
        slot_kind: "fixed",
        courses: ["ITSE 2370"],
        credits_required: 3,
      },
      {
        name: "Elective List",
        slot_kind: "fixed",
        courses: ["ENGL 1301"],
        credits_required: 3,
      },
    ],
  };
  const result = assessPlan(withPreparation, ["I passed ITSE 1370"]);
  assert.equal(result.remaining_credits, 6);
  assert.deepEqual(result.completed_required_courses, ["ITSE 1370"]);
  assert.deepEqual(result.remaining_required_courses, [
    "ITSE 2370",
    "MATH 1314",
  ]);
});

test("nested requisite labels preserve concurrent enrollment and recommendations", () => {
  const result = assessRequisites(
    "Prerequisites: Recommended: ITSE 1370. Corequisites/Concurrent: Required: MATH 1314.",
    {},
  );
  assert.deepEqual(result.required, []);
  assert.deepEqual(result.recommended, ["Recommended: ITSE 1370."]);
  assert.deepEqual(result.corequisites, [
    "Corequisites/Concurrent: Required: MATH 1314.",
  ]);
  const recommended = assessRequisites(
    "Corequisite: Recommended: MATH 1314.",
    {},
  );
  assert.equal(recommended.status, "recommendation_only");
});

test("named full checklists do not become semester filters from prerequisite context", () => {
  assert.deepEqual(
    requestedSemesters(
      "Show the full Medical Assisting Certificate course checklist, including the prerequisite courses before Semester 1.",
    ),
    [],
  );
  assert.deepEqual(
    requestedSemesters(
      "Show the full first-semester course plan for Medical Assisting Certificate.",
    ),
    [1],
  );
});

test("faculty enumeration preserves sources, distinct people and deterministic source dates", () => {
  const original = {
    name: "Alex Example",
    source_url: "https://example.edu/cv/1",
    identity: ["BS Computing"],
    evidence: ["Taught machine learning"],
    scraped_at: "2026-07-01",
  };
  const later = {
    ...original,
    source_url: "https://example.edu/cv/2",
    evidence: ["Research in large language models"],
    scraped_at: "2026-08-01",
  };
  const otherPerson = {
    ...original,
    identity: ["BS Mathematics"],
    source_url: "https://example.edu/cv/3",
  };
  const rows = [original, later, otherPerson];
  const profiles = facultyProfiles(rows, ["ML", "LLM"], "any");
  assert.equal(profiles.length, 2);
  assert.deepEqual(
    profiles,
    facultyProfiles([...rows].reverse(), ["ML", "LLM"], "any"),
  );
  const both = facultyProfiles(rows, ["ML", "LLM"], "all");
  assert.equal(both.length, 1);
  assert.deepEqual(both[0].source_urls, [
    original.source_url,
    later.source_url,
  ]);
  assert.equal(both[0].source_checked_at, original.scraped_at);
  assert.equal(both[0].evidence.length, 2);
  assert.equal(
    facultyProfiles(
      [original, { ...later, identity: [] }],
      ["ML", "LLM"],
      "all",
    ).length,
    0,
  );
});

test("mixed completion verbs retain each course's own status", () => {
  for (const [statement, first, second] of [
    ["I failed ITSE 1370 and finished MATH 1314", "not_completed", "completed"],
    [
      "I passed ITSE 1370 and transferred MATH 1314",
      "completed",
      "transfer_pending",
    ],
    [
      "I withdrew from ITSE 1370, enrolled in MATH 1314",
      "not_completed",
      "in_progress",
    ],
  ]) {
    const history = studentCourseHistory([statement]);
    assert.equal(history["ITSE 1370"]?.status, first, statement);
    assert.equal(history["MATH 1314"]?.status, second, statement);
  }
});

test("unknown courses at either end of a reported list block exact credit arithmetic", () => {
  for (const statement of [
    "I passed beginner programming and ITSE 1370",
    "I passed beginner programming, ITSE 1370 and MATH 1314",
    "I passed ITSE 1370 and beginner programming",
  ]) {
    const result = assessPlan(plan, [statement]);
    assert.equal(result.remaining_credits, null, statement);
    assert.ok(result.completed_required_courses.includes("ITSE 1370"));
    assert.equal(result.needs_history_clarification, true);
  }
});

test("an unstated catalog edition cannot establish shared credit equivalence", () => {
  for (const catalog_year of [undefined, null, ""]) {
    const result = comparePlans(
      { ...plan, catalog_year },
      { ...plan, catalog_year },
    );
    assert.deepEqual(result.shared_required_courses, [
      "ITSE 1370",
      "ITSE 2370",
      "MATH 1314",
    ]);
    assert.equal(result.shared_required_credits, null);
  }
});

test("unmatched course history asks for clarification visibly, outside collapsed details", () => {
  const html = renderToStaticMarkup(
    createElement(CourseResults, {
      name: "get_program_requirements",
      skin,
      output: {
        ...plan,
        found: true,
        planning: assessPlan(plan, [
          "I passed beginner programming and ITSE 1370",
        ]),
      },
    }),
  );
  assert.ok(html.includes("Please clarify your course history:"));
  assert.ok(
    html.indexOf("Please clarify your course history:") <
      html.indexOf("Choices and credit checks"),
  );
});

test("675 mixed-status phrasings preserve course ownership across conjunctions", () => {
  const phrases = [
    ["completed", "completed"],
    ["finished", "completed"],
    ["passed", "completed"],
    ["took", "completed"],
    ["have taken", "completed"],
    ["failed", "not_completed"],
    ["withdrew from", "not_completed"],
    ["dropped", "not_completed"],
    ["am taking", "in_progress"],
    ["am currently enrolled in", "in_progress"],
    ["will take", "planned"],
    ["plan to take", "planned"],
    ["transferred", "transfer_pending"],
    ["haven't completed", "not_completed"],
    ["did not pass", "not_completed"],
  ];
  for (const [first, expectedFirst] of phrases)
    for (const [second, expectedSecond] of phrases)
      for (const conjunction of [" and ", ", ", " but "]) {
        const statement = `I ${first} ITSE 1370${conjunction}${second} MATH 1314`;
        const history = studentCourseHistory([statement]);
        assert.equal(history["ITSE 1370"]?.status, expectedFirst, statement);
        assert.equal(history["MATH 1314"]?.status, expectedSecond, statement);
      }
});
