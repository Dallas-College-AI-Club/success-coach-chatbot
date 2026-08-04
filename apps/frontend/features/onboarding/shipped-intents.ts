// The single source of truth for "what this app can currently do".
//
// The capability list ("What can this app do?") reads from here. A parallel
// `shipped` flag on each follow-up question (questions.ts, filtered in
// use-onboarding.ts) stages the flow the same way. Because both surfaces render
// only shipped entries, neither can advertise a capability that is not built.
// The intent vocabulary mirrors the degree-planning user stories; the client
// keeps this list until it is served from the shared registry.

export interface ShippedIntent {
  id: string;
  /** One example question a student could ask. */
  example: string;
  shipped: boolean;
}

// `shipped` is the staging switch: an intent appears only when `shipped` is
// true. While the answering layer is built every intent is marked shipped, so
// the full list shows; setting `shipped: false` hides an intent until it ships.
// Phrased as honest, high-value things a student can actually get from Major:
// catalog-grounded facts (requirements, sequence, schedule) and routing (transfer
// confirmation, the coach, help paying). Deliberately excludes anything only a
// human or the institution can decide — Major never promises transfer, aid, or a
// timeline, and never "figures out your major" for you.
export const INTENTS: ShippedIntent[] = [
  { id: "degree_requirements", example: "What does my degree or certificate require?", shipped: true },
  { id: "fastest_sequence", example: "What's the smartest order to take my classes so I finish sooner?", shipped: true },
  { id: "schedule_fit", example: "Which of my required classes are online, at night, or on weekends?", shipped: true },
  { id: "transfer_planning", example: "Which credits usually transfer, and how do I get an official answer?", shipped: true },
  { id: "coach_prep", example: "How do I get ready for my Success Coach meeting?", shipped: true },
  { id: "paying_for_degree", example: "Who can help me pay for my degree (grants, aid, Student Care Network)?", shipped: true },
];

export const shippedIntents = (): ShippedIntent[] => INTENTS.filter((i) => i.shipped);
