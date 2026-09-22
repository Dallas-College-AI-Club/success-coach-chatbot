import { INTEREST_GUIDE } from "@/features/onboarding/interests";
import { PROGRAMS } from "@/features/onboarding/programs";
import {
  goalQuestion,
  interestQuestion,
  settleInOption,
} from "@/features/onboarding/questions";
import type {
  GoalValue,
  InterestArea,
  OnboardingPayload,
} from "@/features/onboarding/types";

// One source for onboarding previews and the chat's initial questions. Prompts
// carry the student's choices explicitly; official decisions stay with the coach.

// --- placeholder fill -------------------------------------------------------
// {major}/{school}/{interest} resolve from the payload. {school} is a real
// institution name for the named partner universities — every region bucket
// stores a category code, so it resolves to a plain phrase instead.
export function majorLabel(p: OnboardingPayload): string {
  if (!p.major) return "your program";
  return (
    PROGRAMS.find((prog) => prog.code === p.major)?.label ?? "your program"
  );
}

export function schoolLabel(p: OnboardingPayload): string {
  const t = p.target_institution;
  if (t === "UTD") return "UT Dallas";
  if (t === "UNT") return "UNT Denton";
  if (t === "UNT_DALLAS") return "UNT Dallas";
  if (t === "UTA") return "UT Arlington";
  if (t === "TWU") return "Texas Woman's University";
  if (t === "TTU") return "Texas Tech";
  if (t === "TXST") return "Texas State";
  if (t === "TARLETON") return "Tarleton State";
  if (t === "ETAMU") return "East Texas A&M";
  if (t === "PVAMU") return "Prairie View A&M";
  if (t === "TAMU_CS") return "Texas A&M";
  if (t === "SMU") return "SMU";
  // Visiting: any bucket home school is simply "your home college".
  if (p.transfer_direction === "transfer_back") return "your home college";
  // Outbound buckets (destinations):
  if (t === "TX_OTHER") return "a Texas university";
  if (t === "US_OTHER") return "your out-of-state school";
  if (t === "INTL") return "your school abroad";
  return "the school you transfer to";
}

export interface StarterQuestion {
  label: string;
  /** Concise print question with context; otherwise use the button label. */
  note?: string;
  /** Complete question sent on click; never relies on an unstated "it". */
  prompt: string;
}

type Handoff = { intro: string; questions: StarterQuestion[] };

export const TUITION: StarterQuestion = {
  label: "What might my classes cost?",
  prompt:
    "What Dallas College tuition rates per credit hour are in your records, and what information would you need to estimate my tuition?",
};
export const TUTORING: StarterQuestion = {
  label: "Where can I get free tutoring?",
  prompt:
    "What do your records say about free tutoring at Dallas College, and which source link can I use for more information?",
};
export const COACH: StarterQuestion = {
  label: "How can I reach a Success Coach?",
  prompt:
    "Look up academic advising in your records and give the listed email, phone number and appointment resource for contacting a Dallas College Success Coach.",
};
// The rest of the student-resource corpus, as chips. Each one was run through
// search_knowledge against the live records (2026-09-22) and returns its own
// resource row at catalog scope. A food-pantry chip is deliberately ABSENT:
// the pantries live inside the housing row, and "food pantry on campus"
// retrieves CHEF cooking courses instead — the one probe that failed.
export const HOUSING: StarterQuestion = {
  label: "What housing assistance is available?",
  prompt:
    "What do your records say about Dallas College housing rental assistance, and which source link has more information?",
};
export const DART: StarterQuestion = {
  label: "How does the free DART GoPass work?",
  prompt:
    "What do your records say about the free Dallas College DART GoPass benefit, and where can I read more?",
};
export const AID: StarterQuestion = {
  label: "How do I apply for financial aid?",
  note: "How do I apply for financial aid, and who do I contact?",
  prompt:
    "What do your records say about how to apply for financial aid at Dallas College, and who do I contact about it? Give the listed contacts; do not estimate or predict any award.",
};
export const DEADLINE: StarterQuestion = {
  label: "When can I still drop a class?",
  note: "What is the last day to withdraw from a Fall 2026 class with a W?",
  prompt:
    "What is the last day to withdraw from a Fall 2026 Dallas College class with a W, according to your records? Give the dates the records list and say which term they belong to.",
};

/** A chip is dropped when its label runs past this, so labels shorten the NAME
 *  inside them; the prompt always carries the whole name. */
export const MAX_LABEL = 40;
export function fitLabel(
  build: (name: string) => string,
  name: string,
): string {
  const label = build(name);
  if (label.length <= MAX_LABEL) return label;
  return build(`${name.slice(0, Math.max(1, name.length - (label.length - MAX_LABEL) - 1))}…`);
}

// Catalog names end in "A.A.S."/"Certificate", so a sentence built from them
// must not double the final period.
export const listOf = (items: string[]) =>
  items.length > 1
    ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`
    : items.join("");
const sentence = (text: string) => text.replace(/\.\.$/, ".");

// "only semester 1" is what scopes the lookup to the first-semester group;
// the full plan must not mention a semester number at all.
// Exported so features/chat/follow-ups.ts offers the same lookup after a
// comparison instead of writing a second copy of this wording.
export function coursePlan(name: string, first = false): StarterQuestion {
  return {
    label: first
      ? "Which classes would I start with?"
      : "What courses do I need for this program?",
    note: first
      ? `Which courses are in semester 1 of ${name}?`
      : `Which courses are required for ${name}?`,
    // NOT sentence(): features/chat/sheet-questions.ts parses this exact
    // wording back into the note for the printed sheet, and collapsing the
    // period after "A.A.S." makes that repair drop it.
    prompt: `Look up the published course plan for ${name}${first ? ", only semester 1" : ""}. The course cards already show the requested checklist and its credits. Reply in at most two sentences introducing those cards, without writing a course list or semester-by-semester breakdown. Keep the published credit total exact; unresolved elective choices do not change that total.`,
  };
}

// The two graduation steps after the checklist. Exported because the chat's
// follow-up engine has to offer the SAME two once the checklist is on screen —
// a chip is deduped by its label, so a second copy of this wording here would
// let the student be asked the same question twice.
export function courseHistoryCheck(name: string): StarterQuestion {
  return {
    label: "Which of these have I finished?",
    note: `Which ${name} courses have I completed, and which are left?`,
    prompt: `Show the published course checklist for ${name} and ask me which of those courses I have completed, am taking now, or have sent for transfer review, before working out what is left. My answers are student-reported, not a transcript or an official graduation audit.`,
  };
}

export function remainingCredits(name: string): StarterQuestion {
  return {
    label: "How many credits do I have left?",
    note: `How many required credits remain in ${name}?`,
    prompt: `Using the ${name} checklist and the courses I have reported as completed, how many required credit hours remain and which required courses are left? If I have not reported any history yet, say so and ask me for it instead of guessing. My reported history is not a transcript or an official graduation audit.`,
  };
}

/** The routing goal behind a profile's goal LABEL. The chat only ever holds
 *  the student's own words for why they came, and matching those by hand
 *  would drift from the option list the moment a label is reworded. */
export function goalFromLabel(label?: string): GoalValue | null {
  if (!label) return null;
  return (
    [...(goalQuestion.options ?? []), settleInOption].find(
      (o) => o.label === label,
    )?.contribs.goal ?? null
  );
}

function coursePrerequisites(name: string): StarterQuestion {
  return {
    label: "What do I need before starting?",
    note: `What are the required prerequisites and recommended preparation for semester 1 of ${name}?`,
    prompt: `What prerequisites and recommended preparation does the catalog list for the first-semester courses in ${name}? Keep required prerequisites separate from recommendations.`,
  };
}

/** The one schedule preference onboarding captures, in the student's words. */
export function preferenceOf(p: OnboardingPayload): string {
  return [
    ...(p.modality_pref === "online" ? ["online"] : []),
    ...(p.dayparts_pref?.includes("evening") ? ["evening"] : []),
    ...(p.dayparts_pref?.includes("weekend") ? ["weekend"] : []),
  ].join(" and ");
}

function scheduleQuestion(
  p: OnboardingPayload,
  program: string,
): StarterQuestion {
  const preference = preferenceOf(p);
  // One preference fits a chip and reads as the student's own question. Two or
  // three ("online and evening and weekend") ran to 50 characters, past the
  // cap — so the label asks the general question and the prompt, which has no
  // length limit, still carries every preference.
  const single = preference && !preference.includes(" and ");
  return {
    label: single
      ? `Any ${preference} sections for a first class?`
      : preference
        ? "Which sections fit my schedule?"
        : "When does a starting course meet?",
    note: `When does a first-semester course in ${program} meet${preference ? `, and are there ${preference} options` : ""}?`,
    // One course cannot answer "does this program fit my evenings", and the
    // student's first-semester courses are not all offered at every daypart.
    // So the prompt is explicit about the miss case: say so and check one
    // more, rather than presenting the nearest time as a match.
    prompt: `Look up the published first-semester course plan for ${program}, then check the saved current-term schedule for one required course from that semester. Use the schedule cards to show all sections for that course with dates, days, times, instructors and sources.${preference ? ` I prefer ${preference} classes. Explain which listed sections have evidence matching that preference; do not substitute a closest time for a matching time. If none of that course's sections match, say so plainly and check one more required course from that semester before you answer.` : ""} Reply with a brief summary, without repeating the section list. Missing meeting times are unknown. Label the saved schedule date; do not claim live availability or that this checks every course in the program.`,
  };
}

// Labels are questions a student would say out loud, not instructions to the
// tool. "visiting" is the transient student taking one class here to carry
// home; they are not working toward anything at Dallas College.
function courseQuestion(
  purpose: OnboardingPayload["oneoff_purpose"] | "visiting",
): StarterQuestion {
  return {
    label:
      purpose === "prerequisite"
        ? "What do I need before taking a class?"
        : purpose === "job_licensure"
          ? "Can you look up the class my job needs?"
          : purpose === "visiting"
            ? "Can you look up a class for me?"
            : "What would I learn in a class here?",
    note: "Which Dallas College course should I look up?",
    prompt:
      "Help me look up a Dallas College course. Ask me for its course code or title, then use the catalog to check its description, credits and stated prerequisites. Do not select an example course for me or decide professional-license eligibility.",
  };
}

// The outbound and visiting chips name the school, because "a transfer review"
// is abstract and the school is the whole point. A region bucket resolves to a
// phrase ("a Texas university"), not a name, so it keeps the plain question.
function transferLabel(p: OnboardingPayload): string {
  const school = schoolLabel(p);
  const named = `What should I send to ${school}?`;
  return !/^(?:a|your|the) /.test(school) && named.length <= MAX_LABEL
    ? named
    : "What should I collect for a review?";
}

// --- undecided path ---------------------------------------------------------
// Interest first: real programs to explore before any planning. Every example
// is looked up live, so the answers stay catalog-grounded, and the prompts say
// "example" so the model never treats one as the student's choice.
const INTEREST_OPTIONS = (interestQuestion.options ?? []).filter(
  (o) => o.contribs.interest_area,
);

function interestLabel(area: InterestArea): string {
  return (
    INTEREST_OPTIONS.find((o) => o.contribs.interest_area === area)?.label ??
    area
  );
}

// No area yet: the first turn asks for one as a numbered list (the system
// prompt maps a bare number back to it) and carries the verified examples,
// so the follow-up stays grounded without a search.
export const PICK_AREA: StarterQuestion = {
  label: "Help me pick an area to explore",
  note: "Which area should I explore first?",
  prompt: `I'm still deciding what to study and don't have an area in mind yet. Ask me which of these areas interests me most, as a numbered list I can answer with just the number: ${INTEREST_OPTIONS.map((o, i) => `${i + 1}. ${o.label}`).join("; ")}. After I answer, offer that area's example programs as a second numbered list and ask which one to look up first; do not look anything up before I choose. ${sentence(`The examples are ${INTEREST_OPTIONS.map(
    (o) =>
      `${o.label}: ${listOf(INTEREST_GUIDE[o.contribs.interest_area!].examplePrograms)}`,
  ).join("; ")}`)}`,
};

/** A visitor who skipped onboarding told us nothing, so the chat has no
 *  starters of its own. An empty chip row is still a dead end: the opening
 *  offers the two doors onboarding would have offered, then the coach. The
 *  program chip must NOT suggest a program — the model has no list, and an
 *  invented one is exactly the failure the grounding rule exists for. */
export const FIND_PROGRAM: StarterQuestion = {
  label: "Help me find my program's plan",
  note: "Which Dallas College program should I look up?",
  prompt:
    "I want to see the published course plan for a Dallas College degree or certificate. Ask me to name the program I have in mind. Do not suggest a program and do not look anything up until I answer.",
};
export const COLD_VISIT_QUESTIONS: StarterQuestion[] = [
  FIND_PROGRAM,
  PICK_AREA,
  COACH,
];

// The parenthetical ("welding, HVAC, auto") is for the picker, not for prose.
const plainInterest = (label: string) => label.replace(/\s*\(.*\)$/, "");

function interestHandoff(area: InterestArea | null): Handoff {
  if (!area) {
    return {
      intro:
        "No area picked yet — that's the thing to narrow down first, and then we'll look at real programs. You could ask:",
      questions: [PICK_AREA, COACH, TUITION],
    };
  }
  const interest = interestLabel(area);
  const { examplePrograms } = INTEREST_GUIDE[area];
  const [first, second] = examplePrograms;
  return {
    intro: `${plainInterest(interest)}, then. Here are real programs in it to look at — examples, not a choice made for you. You could ask:`,
    questions: [
      {
        label: `Example programs for ${plainInterest(interest)}`,
        note: `Which Dallas College programs are examples for ${plainInterest(interest)}?`,
        prompt: `I'm still deciding what to study; the area that interests me most is ${interest}. Look up the published course plan for each of these example programs, only semester 1: ${sentence(`${listOf(examplePrograms)}.`)} In one sentence each, give the catalog's award type and total credit hours. These are examples, not my choice; do not treat any of them as my program. The course cards already show the starting courses, so do not list courses in prose.`,
      },
      {
        label: `What's in ${first}?`,
        note: `What would I study in ${first} (example program)?`,
        // "What would I study" needs substance, not a pointer at the cards:
        // name the subjects from the returned titles, still without listing.
        prompt: `Look up the published course plan for ${first}, an example program I have not chosen. Reply in two or three sentences: the award type, the published total credit hours, and what the coursework actually covers, described from the course titles the tool returned. The course cards already show every course, so do not write a course list or a semester-by-semester breakdown. Keep the published credit total exact; unresolved elective choices do not change that total.`,
      },
      {
        label: "Compare two of these programs",
        note: `How do ${first} and ${second} compare?`,
        prompt: sentence(`Compare ${first} and ${second}, two example programs I have not chosen. Use the computed shared and different required courses; the interface shows each list. Reply in two or three sentences on what they share and how they differ, without predicting jobs or salaries.`),
      },
    ],
  };
}

function selectHandoff(p: OnboardingPayload): Handoff {
  const program = PROGRAMS.find((entry) => entry.code === p.major)?.label;
  if (p.student_type === "dual_credit") {
    return {
      intro:
        "A college class while you're still in high school — let's look at one, and the free help around it. You could ask:",
      questions: [courseQuestion("prerequisite"), TUTORING, COACH],
    };
  }
  if (p.goal === "settle_in") {
    return {
      intro:
        "Getting here comes before picking classes. Our records cover housing help, getting around and free tutoring. You could ask:",
      questions: [HOUSING, DART, TUTORING],
    };
  }
  if (p.goal === "nondegree_oneoff") {
    return {
      intro:
        p.oneoff_purpose === "prerequisite"
          ? "One class to get you ready for the program you want — let's find it and what it asks for. You could ask:"
          : p.oneoff_purpose === "job_licensure"
            ? "A class your job or licence asks for — let's find it and what it costs. You could ask:"
            : "One class, because you want to learn it — let's find it and what it costs. You could ask:",
      questions: [courseQuestion(p.oneoff_purpose), TUITION, COACH],
    };
  }
  if (p.goal === "transfer_check") {
    // A visiting student never picks a program; anyone else without one is
    // undecided and starts from their interests.
    if (!program && p.transfer_direction !== "transfer_back")
      return interestHandoff(p.interest_area);
    const school = schoolLabel(p);
    const transferringIn = p.transfer_direction === "inbound";
    // The program is its own sentence: "credits for my program, X, to Y" put
    // two prepositional phrases between the verb and its object.
    const context = program ? sentence(`I am working toward ${program}.`) + " " : "";
    return {
      intro: transferringIn
        ? "You already have credit, and Dallas College Admissions decides what counts. Let's gather the course facts for that review. You could ask:"
        : p.transfer_direction === "transfer_back"
          ? `One class here to count at ${school} — let's get the Dallas College course facts they'll want. You could ask:`
          : `Heading to ${school} later. Only they can confirm what counts, so let's collect the Dallas College course facts to send. You could ask:`,
      questions: [
        program ? coursePlan(program) : courseQuestion("visiting"),
        {
          label: transferringIn
            ? "What will Admissions need to see?"
            : transferLabel(p),
          note: `Which Dallas College course details should I collect for a transfer review ${transferringIn ? "into Dallas College" : `at ${school}`}?`,
          prompt: `${context}I ${transferringIn ? "want to bring previous credits into Dallas College" : `want to take Dallas College credits to ${school}`}. Help me collect Dallas College catalog descriptions, credits and prerequisites for a transfer review. Ask which Dallas College course codes I want to compare; do not assume a course equivalence or accepted credit.`,
        },
        COACH,
      ],
    };
  }
  if (p.goal === "figure_out_major" || !program)
    return interestHandoff(p.interest_area);
  if (p.goal === "graduation_check") {
    // Straight to the checklist, then what the student has finished, then what
    // is left. Every prompt repeats that their history is self-reported: the
    // planning object is only ever as good as what they typed.
    return {
      intro: `Let's put the ${program} checklist on screen and work out what's left. What you tell me is student-reported, not a transcript. You could ask:`,
      questions: [
        { ...coursePlan(program), label: "What's on my checklist?" },
        courseHistoryCheck(program),
        remainingCredits(program),
      ],
    };
  }
  // Planning a semester: the plan, what comes first, then either when it meets
  // (a schedule goal or preference) or what to have ready.
  const schedule =
    p.goal === "schedule_fit" || p.modality_pref || p.dayparts_pref?.length;
  const preference = preferenceOf(p);
  return {
    intro: preference
      ? `${program}, around ${preference} classes. The full plan first, then what you'd take in your first semester. You could ask:`
      : `${program} it is. The full plan first, then what you'd take in your first semester. You could ask:`,
    questions: [
      coursePlan(program),
      coursePlan(program, true),
      schedule ? scheduleQuestion(p, program) : coursePrerequisites(program),
    ],
  };
}

export function handoffIntro(p: OnboardingPayload): string {
  return selectHandoff(p).intro;
}

export function starterQuestionsFor(p: OnboardingPayload): StarterQuestion[] {
  return selectHandoff(p).questions;
}

// Keep onboarding previews and existing flow checks using the same labels.
export function starterPromptsFor(p: OnboardingPayload): string[] {
  return starterQuestionsFor(p).map((q) => q.label);
}

// Authority routing — only the deciding institution can confirm transfer credit or
// evaluate prior credit. Routed, never asserted. Returns 0 or 1 line.
export function authorityNotes(p: OnboardingPayload): string[] {
  if (
    p.transfer_direction === "outbound" ||
    p.transfer_direction === "transfer_back"
  ) {
    return [
      `Only ${schoolLabel(p)} can confirm what counts. We'll help you ask.`,
    ];
  }
  if (p.transfer_direction === "inbound") {
    return ["Admissions decides what counts. We'll point you there."];
  }
  return [];
}

// Stage 3: the human Success Coach verifies the plan the chat drafts. Every path
// ends here — the one promise this tool can honestly make.
export function coachVerifyLine(p: OnboardingPayload): string {
  // Settling in isn't a plan to approve — the coach is who they meet on arrival.
  if (p.goal === "settle_in") {
    return "Major helps you get ready to arrive. Your Success Coach takes it from there.";
  }
  return "Major helps you plan. A Success Coach makes it official.";
}
