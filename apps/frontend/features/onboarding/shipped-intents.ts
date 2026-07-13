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
export const INTENTS: ShippedIntent[] = [
  { id: "program_requirements", example: "What classes do I need for my major?", shipped: true },
  { id: "figure_out_major", example: "Help me figure out my major", shipped: true },
  { id: "prereq_lookup", example: "What are the prerequisites for a class?", shipped: true },
  { id: "first_semester_plan", example: "Plan my first semester", shipped: true },
  { id: "transfer_question", example: "Will my credits transfer?", shipped: true },
  { id: "section_search", example: "Which classes can I take online?", shipped: true },
];

export const shippedIntents = (): ShippedIntent[] => INTENTS.filter((i) => i.shipped);
