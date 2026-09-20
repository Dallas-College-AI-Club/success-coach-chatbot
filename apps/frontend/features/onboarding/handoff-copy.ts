import { PROGRAMS } from "@/features/onboarding/programs";
import type { OnboardingPayload } from "@/features/onboarding/types";

// The onboarding wizard does not END in a recap — it opens INTO the AI planning
// chat, which crafts a plan on verified Dallas College catalog data, and a human
// Success Coach verifies that plan afterward (the strategy's three-stage model:
// onboarding → AI planning chat → coach verify).
//
// This module supplies the hand-off copy, PERSONALIZED from the answers the
// student already gave: the intro line and the starter-prompt preview are chosen
// to fit their goal and sub-answers (a one-off job/license student never sees
// "classes for my major"). It states no academic outcome; anything only an
// institution can decide is routed, not guessed (interview point 8; governance
// GP-0005; the strategy's credit-portability invariant "the receiving school
// decides"). Prompt sets and the honesty review are documented in
// ENGAGEMENT_ONBOARDING_STRATEGY.md §9.4.

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
  /** Complete question sent on click; never relies on an unstated "it". */
  prompt: string;
}

type Handoff = { intro: string; questions: StarterQuestion[] };

export const TUITION: StarterQuestion = {
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
const COURSE_EXAMPLE: StarterQuestion = {
  label: "What does ENGL 1301 cover?",
  prompt:
    "What are the catalog title, credits, description and stated requirements for ENGL 1301?",
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
    prompt: `Show the published course plan for ${name}${first ? ", only semester 1" : ""}, grouped by semester or requirement, with course codes and credits.`,
  };
}

function coursePrerequisites(name: string): StarterQuestion {
  return {
    label: "What do I need before starting?",
    prompt: `What prerequisites and recommended preparation does the catalog list for the first-semester courses in ${name}? Keep required prerequisites separate from recommendations.`,
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
    : COURSE_EXAMPLE;
  const prerequisites = program ? coursePrerequisites(program) : TUTORING;
  if (p.student_type === "dual_credit") {
    return {
      intro:
        "Explore course facts, free tutoring and advising contacts. You could ask:",
      questions: [COURSE_EXAMPLE, TUTORING, COACH],
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
        "Check tuition information, tutoring and advising contacts. You could ask:",
      questions: [TUITION, TUTORING, COACH],
    };
  }
  if (p.goal === "transfer_check") {
    return {
      intro:
        "Look up Dallas College course facts and costs before checking transfer credit. You could ask:",
      questions: [plan, prerequisites, TUITION],
    };
  }
  if (p.goal === "schedule_fit") {
    return {
      intro:
        "Check course requirements, prerequisites and tuition. Course plans do not confirm this term's meeting times. You could ask:",
      questions: [plan, prerequisites, TUITION],
    };
  }
  if (p.goal === "graduation_check") {
    return {
      intro:
        "Review the published course plan before an official graduation review. You could ask:",
      questions: [plan, prerequisites, COACH],
    };
  }
  if (p.goal === "figure_out_major" || !program) {
    const example = p.interest_area
      ? INTEREST_PROGRAMS[p.interest_area]
      : undefined;
    return {
      intro: example
        ? `Explore ${example} as one example, then discuss your options. You could ask:`
        : "Explore a course and learn where to get guidance. You could ask:",
      questions: [
        example ? coursePlan(example, true) : COURSE_EXAMPLE,
        example ? coursePrerequisites(example) : COACH,
        TUTORING,
      ],
    };
  }
  return {
    intro:
      "Explore your published course plan and student support. You could ask:",
    questions: [plan, prerequisites, TUITION],
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
