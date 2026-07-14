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

type HandoffSet = { intro: string; prompts: string[] };

// --- placeholder fill -------------------------------------------------------
// {major}/{school}/{interest} resolve from the payload. {school} can only be a
// real institution name for the two named partners (UTD/UNT) — every bucket
// stores a category code, so it resolves to a plain phrase instead.
function majorLabel(p: OnboardingPayload): string {
  if (!p.major) return "your program";
  return PROGRAMS.find((prog) => prog.code === p.major)?.label ?? "your program";
}

function schoolLabel(p: OnboardingPayload): string {
  const t = p.target_institution;
  if (t === "UTD") return "UT Dallas";
  if (t === "UNT") return "UNT";
  // Visiting: any bucket home school is simply "your home college".
  if (p.transfer_direction === "transfer_back") return "your home college";
  // Outbound buckets (destinations):
  if (t === "TX_OTHER") return "a Texas university";
  if (t === "US_OTHER") return "your out-of-state school";
  if (t === "INTL") return "your school abroad";
  return "the school you transfer to";
}

const INTEREST_LABEL: Record<string, string> = {
  health: "health careers",
  tech: "technology",
  business: "business",
  arts: "arts and design",
  trades: "skilled trades",
};
function interestLabel(p: OnboardingPayload): string {
  return (p.interest_area && INTEREST_LABEL[p.interest_area]) || "a field you like";
}

function fill(text: string, p: OnboardingPayload): string {
  return text
    .replace(/\{major\}/g, majorLabel(p))
    .replace(/\{school\}/g, schoolLabel(p))
    .replace(/\{interest\}/g, interestLabel(p));
}

// --- the personalized sets --------------------------------------------------
// Kept short on purpose: the intro is one line ending in ". You could ask:" that
// leads straight into 2–3 terse chips. The program name is NOT repeated here (it's
// already in the recap above); the chips fit the student's situation, not their
// exact major, so they stay short and scannable.
const SETS: Record<string, HandoffSet> = {
  first_major: {
    intro: "Next, we'll plan your first semester. You could ask:",
    prompts: ["What do I take first?", "Which classes are online?", "What will it cost?"],
  },
  first_undecided: {
    intro: "Next, we'll find good first classes. You could ask:",
    prompts: ["What do I take before I pick a major?", "What counts toward most degrees?", "Certificate or degree?"],
  },
  grad_major: {
    intro: "Next, we'll see what's left to finish. You could ask:",
    prompts: ["What's left to graduate?", "How many credits to go?", "Which requirements are online?"],
  },
  transfer_out_partner: {
    intro: "Next, we'll plan your transfer to {school}. You could ask:",
    prompts: ["Which classes transfer to {school}?", "What should I take first?", "What might not transfer?"],
  },
  transfer_out_texas: {
    intro: "Next, we'll plan your Texas transfer. You could ask:",
    prompts: ["Which classes transfer in Texas?", "What core classes should I take?", "What might not transfer?"],
  },
  transfer_out_other: {
    intro: "Next, we'll plan a transfer-friendly path. You could ask:",
    prompts: ["Which classes transfer widely?", "What core classes are safe?", "How do I check what they accept?"],
  },
  transfer_back: {
    intro: "Next, we'll find a class that counts back home. You could ask:",
    prompts: ["Which class matches what I need?", "Is it online?", "What does it cost?"],
  },
  transfer_inbound: {
    intro: "Next, we'll see where your past credits fit. You could ask:",
    prompts: ["What does my program require?", "How do I get credits reviewed?", "What should I take here?"],
  },
  transfer_unknown: {
    intro: "Next, we'll keep your transfer options open. You could ask:",
    prompts: ["Which classes transfer widely?", "What should I take first?", "How do I check what they accept?"],
  },
  sched_online_evening: {
    intro: "Next, we'll fit classes to your time. You could ask:",
    prompts: ["Which classes are online?", "Which are in the evening?", "What fits around work?"],
  },
  sched_online: {
    intro: "Next, we'll find online classes. You could ask:",
    prompts: ["Which classes are online?", "Is my class online this term?", "Which requirements are online?"],
  },
  sched_evening: {
    intro: "Next, we'll find evening classes. You could ask:",
    prompts: ["Which classes meet at night?", "Is my class in the evening?", "Which requirements are at night?"],
  },
  sched_default: {
    intro: "Next, we'll build a schedule that fits. You could ask:",
    prompts: ["Which classes are online?", "Which are evening or weekend?", "What fits a full-time job?"],
  },
  major_interest: {
    intro: "Next, we'll explore {interest} programs. You could ask:",
    prompts: ["What {interest} programs are there?", "What would I study?", "Which class should I try first?"],
  },
  major_undecided: {
    intro: "Next, we'll explore your options. You could ask:",
    prompts: ["What programs are there?", "What should I take first?", "Certificate or degree?"],
  },
  oneoff_job: {
    intro: "Next, we'll find the class you need. You could ask:",
    prompts: ["Which class do I need?", "What does it cost?", "Who confirms it counts?"],
  },
  oneoff_prereq: {
    intro: "Next, we'll find your prerequisite class. You could ask:",
    prompts: ["Which class covers it?", "Is it online?", "What does it cost?"],
  },
  oneoff_enrich: {
    intro: "Next, we'll find a class you'll enjoy. You could ask:",
    prompts: ["What can I take for fun?", "Any prerequisites?", "What does it cost?"],
  },
  dual_credit: {
    intro: "Next, we'll look at your dual-credit path. You could ask:",
    prompts: ["How do my classes count?", "Will they transfer?", "Which finish a degree?"],
  },
  // Incoming international student getting set up to move — resource-style, like
  // the quick-actions row, not course planning.
  settle_in: {
    intro: "Next, we'll help you get set up in Dallas. You could ask:",
    prompts: ["How do I find housing?", "How do I get around?", "When is orientation?"],
  },
};

// Pick the set that matches the student's answers.
function selectSet(p: OnboardingPayload): HandoffSet {
  if (p.student_type === "dual_credit") return SETS.dual_credit;

  switch (p.goal) {
    case "first_semester_plan":
      return p.major ? SETS.first_major : SETS.first_undecided;

    case "graduation_check":
      // Unsure of the program → explore rather than audit a program they can't name.
      return p.major ? SETS.grad_major : SETS.major_undecided;

    case "transfer_check": {
      const dir = p.transfer_direction;
      const t = p.target_institution;
      if (dir === "outbound") {
        if (t === "UTD" || t === "UNT") return SETS.transfer_out_partner;
        if (t === "TX_OTHER") return SETS.transfer_out_texas;
        return SETS.transfer_out_other; // US_OTHER, INTL, null
      }
      if (dir === "transfer_back") return SETS.transfer_back;
      if (dir === "inbound") return SETS.transfer_inbound;
      return SETS.transfer_unknown;
    }

    case "schedule_fit": {
      const online = p.modality_pref === "online";
      const evening = Array.isArray(p.dayparts_pref) && p.dayparts_pref.includes("evening");
      if (online && evening) return SETS.sched_online_evening;
      if (online) return SETS.sched_online;
      if (evening) return SETS.sched_evening;
      return SETS.sched_default;
    }

    case "figure_out_major":
      return p.interest_area ? SETS.major_interest : SETS.major_undecided;

    case "settle_in":
      return SETS.settle_in;

    case "nondegree_oneoff":
      if (p.oneoff_purpose === "job_licensure") return SETS.oneoff_job;
      if (p.oneoff_purpose === "enrichment") return SETS.oneoff_enrich;
      return SETS.oneoff_prereq;

    default:
      return SETS.first_undecided;
  }
}

// One forward line — what the chat picks up next, tailored to the answers.
export function handoffIntro(p: OnboardingPayload): string {
  return fill(selectSet(p).intro, p);
}

// The starter prompts previewed at the hand-off, tailored to the answers.
export function starterPromptsFor(p: OnboardingPayload): string[] {
  return selectSet(p).prompts.map((prompt) => fill(prompt, p));
}

// Authority routing — only the deciding institution can confirm transfer credit or
// evaluate prior credit. Routed, never asserted. Returns 0 or 1 line.
export function authorityNotes(p: OnboardingPayload): string[] {
  if (
    p.transfer_direction === "outbound" ||
    p.transfer_direction === "transfer_back"
  ) {
    return [`Only ${schoolLabel(p)} can confirm what counts. We'll help you ask.`];
  }
  if (p.transfer_direction === "inbound") {
    return ["Admissions evaluates past credits. We'll point you there."];
  }
  return [];
}

// Stage 3: the human Success Coach verifies the plan the chat drafts. Every path
// ends here — the one promise this tool can honestly make.
export function coachVerifyLine(p: OnboardingPayload): string {
  // Settling in isn't a plan to approve — the coach is who they meet on arrival.
  if (p.goal === "settle_in") {
    return "Koa helps you get ready to arrive. Your Success Coach takes it from there.";
  }
  return "Koa helps you plan. A Success Coach makes it official.";
}
