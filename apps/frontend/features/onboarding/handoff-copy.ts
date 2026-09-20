import { PROGRAMS } from "@/features/onboarding/programs";
import type { OnboardingPayload } from "@/features/onboarding/types";

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
const PROGRAM_QUESTION: StarterQuestion = {
  label: "Help me find my program's course plan",
  prompt:
    "Help me find the published course plan for my Dallas College program. First ask which program I am considering; do not choose a program or example course for me.",
};

function coursePlan(
  name: string,
  example = false,
  first = false,
): StarterQuestion {
  return {
    label: example
      ? "What would I study in this example program?"
      : first
        ? "Which classes would I start with?"
        : "Review my program's course checklist",
    note: first
      ? `Which courses are in semester 1 of ${name}?`
      : example
        ? `What would I study in ${name} (example program)?`
        : `Which courses are required for ${name}?`,
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
      ? `Does a starting course have ${preference} options?`
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
          ? "Find the course details for my job requirement"
          : "Explore a course I’m interested in",
    prompt:
      "Help me look up a Dallas College course. Ask me for its course code or title, then use the catalog to check its description, credits and stated prerequisites. Do not select an example course for me or decide professional-license eligibility.",
  };
}

// Named examples make exploration answerable with existing catalog lookups.
// They are examples, never silently assigned as the student's selected program.
const INTEREST_PROGRAMS: Record<string, string> = {
  health: "Medical Assisting Certificate",
  tech: "Python Developer Certificate",
  business: "Accounting Assistant Certificate",
  arts: "Digital Art and Design A.A.S.",
  trades: "Welding Applications Certificate",
};

function selectHandoff(p: OnboardingPayload): Handoff {
  const program = PROGRAMS.find((entry) => entry.code === p.major)?.label;
  const plan = program
    ? coursePlan(
        program,
        false,
        p.goal === "first_semester_plan" || p.goal === "schedule_fit",
      )
    : PROGRAM_QUESTION;
  const prerequisites = program ? coursePrerequisites(program) : TUTORING;
  if (p.student_type === "dual_credit") {
    return {
      intro:
        "Explore course facts, free tutoring and advising contacts. You could ask:",
      questions: [
        program ? plan : courseQuestion("prerequisite"),
        TUTORING,
        COACH,
      ],
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
    const school = schoolLabel(p);
    const transferringIn = p.transfer_direction === "inbound";
    return {
      intro:
        "Gather course facts for a transfer review. The receiving institution decides which credits count. You could ask:",
      questions: [
        program ? plan : courseQuestion("prerequisite"),
        {
          label: "Get course details for a transfer review",
          note: `Which Dallas College course details should I collect for a transfer review ${transferringIn ? "into Dallas College" : `at ${school}`}?`,
          prompt: `I ${transferringIn ? "want to bring previous credits into Dallas College" : `want to take Dallas College credits to ${school}`}. Help me collect Dallas College catalog descriptions, credits and prerequisites for a transfer review. Ask which Dallas College course codes I want to compare; do not assume a course equivalence or accepted credit.`,
        },
        COACH,
      ],
    };
  }
  if (p.goal === "schedule_fit") {
    return {
      intro:
        "Start with the published course plan, then check saved class sections against your preferences. You could ask:",
      questions: [
        plan,
        program ? scheduleQuestion(p, program) : courseQuestion(null),
        prerequisites,
      ],
    };
  }
  if (p.goal === "graduation_check") {
    return {
      intro:
        "Review the published course plan before an official graduation review. You could ask:",
      questions: [
        {
          label: "Help me check which courses I still need",
          note: program
            ? `Which courses do I still need for ${program}, given my completed, current and transfer courses?`
            : "Which courses do I still need to graduate?",
          prompt: program
            ? `Show the published course checklist for ${program}. Ask which courses I have completed, am taking, or need reviewed as transfer credit before calculating what remains. Keep my reported history separate from an official graduation audit.`
            : "Help me review what I still need to graduate. First ask which Dallas College program I am in and which courses I have completed; do not assume a program or an official graduation result.",
        },
        plan,
        COACH,
      ],
    };
  }
  if (p.goal === "figure_out_major" || !program) {
    const example = p.interest_area
      ? INTEREST_PROGRAMS[p.interest_area]
      : undefined;
    return {
      intro: example
        ? `Explore ${example} as one example, then discuss your options. You could ask:`
        : "Find a program to explore and learn where to get guidance. You could ask:",
      questions: [
        example ? coursePlan(example, true) : PROGRAM_QUESTION,
        example ? coursePrerequisites(example) : COACH,
        TUTORING,
      ],
    };
  }
  return {
    intro:
      "Explore your published course plan and student support. You could ask:",
    questions: [
      plan,
      prerequisites,
      p.modality_pref || p.dayparts_pref?.length
        ? scheduleQuestion(p, program)
        : TUITION,
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
