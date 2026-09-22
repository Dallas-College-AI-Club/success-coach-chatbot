import { INTEREST_GUIDE } from "@/features/onboarding/interests";
import { PROGRAMS } from "@/features/onboarding/programs";
import { interestQuestion } from "@/features/onboarding/questions";
import type {
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

const TUITION: StarterQuestion = {
  label: "What might my classes cost?",
  prompt:
    "What Dallas College tuition rates per credit hour are in your records, and what information would you need to estimate my tuition?",
};
const TUTORING: StarterQuestion = {
  label: "Where can I get free tutoring?",
  prompt:
    "What do your records say about free tutoring at Dallas College, and which source link can I use for more information?",
};
const COACH: StarterQuestion = {
  label: "How can I reach a Success Coach?",
  prompt:
    "Look up academic advising in your records and give the listed email, phone number and appointment resource for contacting a Dallas College Success Coach.",
};

// Catalog names end in "A.A.S."/"Certificate", so a sentence built from them
// must not double the final period.
const listOf = (items: string[]) =>
  items.length > 1
    ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`
    : items.join("");
const sentence = (text: string) => text.replace(/\.\.$/, ".");

// "only semester 1" is what scopes the lookup to the first-semester group;
// the full plan must not mention a semester number at all.
function coursePlan(name: string, first = false): StarterQuestion {
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

function coursePrerequisites(name: string): StarterQuestion {
  return {
    label: "What do I need before starting?",
    note: `What are the required prerequisites and recommended preparation for semester 1 of ${name}?`,
    prompt: `What prerequisites and recommended preparation does the catalog list for the first-semester courses in ${name}? Keep required prerequisites separate from recommendations.`,
  };
}

function scheduleQuestion(
  p: OnboardingPayload,
  program: string,
): StarterQuestion {
  const preferences = [
    ...(p.modality_pref === "online" ? ["online"] : []),
    ...(p.dayparts_pref?.includes("evening") ? ["evening"] : []),
    ...(p.dayparts_pref?.includes("weekend") ? ["weekend"] : []),
  ];
  const preference = preferences.join(" and ");
  return {
    label: preference
      ? `Any ${preference} sections for a first class?`
      : "When does a starting course meet?",
    note: `When does a first-semester course in ${program} meet${preference ? `, and are there ${preference} options` : ""}?`,
    prompt: `Look up the published first-semester course plan for ${program}, then check the saved current-term schedule for one required course from that semester. Use the schedule cards to show all sections for that course with dates, days, times, instructors and sources.${preference ? ` I prefer ${preference} classes. Explain which listed sections have evidence matching that preference; do not substitute a closest time for a matching time.` : ""} Reply with a brief summary, without repeating the section list. Missing meeting times are unknown. Label the saved schedule date; do not claim live availability or that this checks every course in the program.`,
  };
}

function courseQuestion(
  purpose: OnboardingPayload["oneoff_purpose"],
): StarterQuestion {
  return {
    label:
      purpose === "prerequisite"
        ? "Check what I need before taking a course"
        : purpose === "job_licensure"
          ? "Look up the course my job requires"
          : "Explore a course I’m interested in",
    prompt:
      "Help me look up a Dallas College course. Ask me for its course code or title, then use the catalog to check its description, credits and stated prerequisites. Do not select an example course for me or decide professional-license eligibility.",
  };
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
const PICK_AREA: StarterQuestion = {
  label: "Help me pick an area to explore",
  note: "Which area should I explore first?",
  prompt: `I'm still deciding what to study and don't have an area in mind yet. Ask me which of these areas interests me most, as a numbered list I can answer with just the number: ${INTEREST_OPTIONS.map((o, i) => `${i + 1}. ${o.label}`).join("; ")}. After I answer, offer that area's example programs as a second numbered list and ask which one to look up first; do not look anything up before I choose. ${sentence(`The examples are ${INTEREST_OPTIONS.map(
    (o) =>
      `${o.label}: ${listOf(INTEREST_GUIDE[o.contribs.interest_area!].examplePrograms)}`,
  ).join("; ")}`)}`,
};

function interestHandoff(area: InterestArea | null): Handoff {
  if (!area) {
    return {
      intro:
        "Pick an area to explore first, and we'll look at real programs. You could ask:",
      questions: [PICK_AREA, COACH, TUITION],
    };
  }
  const interest = interestLabel(area);
  const { examplePrograms } = INTEREST_GUIDE[area];
  const [first, second] = examplePrograms;
  return {
    intro: `Explore a few example programs for ${interest} — examples to look at, not a choice made for you. You could ask:`,
    questions: [
      {
        // The parenthetical ("welding, HVAC, auto") is for the picker, not a chip.
        label: `Example programs for ${interest.replace(/\s*\(.*\)$/, "")}`,
        note: `Which Dallas College programs are examples for ${interest}?`,
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
        "Explore course facts, free tutoring and advising contacts. You could ask:",
      questions: [courseQuestion("prerequisite"), TUTORING, COACH],
    };
  }
  if (p.goal === "settle_in") {
    return {
      intro:
        "Explore the student support information in our records. You could ask:",
      questions: [
        {
          label: "What housing assistance is available?",
          prompt:
            "What do your records say about Dallas College housing rental assistance, and which source link has more information?",
        },
        {
          label: "How does the free DART GoPass work?",
          prompt:
            "What do your records say about the free Dallas College DART GoPass benefit, and where can I read more?",
        },
        TUTORING,
      ],
    };
  }
  if (p.goal === "nondegree_oneoff") {
    return {
      intro:
        "Check a course you have in mind, its cost and where to get guidance. You could ask:",
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
      intro:
        "Gather course facts for a transfer review. The receiving institution decides which credits count. You could ask:",
      questions: [
        program ? coursePlan(program) : courseQuestion("prerequisite"),
        {
          label: "Get course details for a transfer review",
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
    return {
      intro:
        "Review the published course plan before an official graduation review. You could ask:",
      questions: [
        coursePlan(program),
        {
          label: "Help me check which courses I still need",
          note: `Which courses do I still need for ${program}, given my completed, current and transfer courses?`,
          prompt: `Show the published course checklist for ${program}. Ask which courses I have completed, am taking, or need reviewed as transfer credit before calculating what remains. Keep my reported history separate from an official graduation audit.`,
        },
        COACH,
      ],
    };
  }
  // Planning a semester: the plan, what comes first, then either when it meets
  // (a schedule goal or preference) or what to have ready.
  const schedule =
    p.goal === "schedule_fit" || p.modality_pref || p.dayparts_pref?.length;
  return {
    intro:
      "Start with your published course plan, then what you'd take first. You could ask:",
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
