import { useStudentSession } from "@/features/onboarding/onboarding-store";

// Console-only instrumentation stubs for the onboarding funnel.
//
// At this stage events are logged, not sent — the transport (an anonymous,
// UUID-tagged analytics layer) is a separate task. Names and the two governed
// funnel states below match the telemetry vocabulary so the wiring is a
// drop-in later. Kept as thin wrappers so call sites read as intent.

export type OnboardingEvent =
  | "page_load"
  | "cta_tap"
  | "onboarding_started" // fired when the wizard opens ("shown")
  | "question_answered"
  | "onboarding_skipped" // Skip-all
  | "onboarding_completed"
  | "onboarding_resumed" // returning student jumped to their saved summary
  | "audience_link_tap"
  | "capability_opened";

export function emit(event: OnboardingEvent, detail?: Record<string, unknown>): void {
  // Every event carries the anonymous client id (#50) so the transport, when it
  // exists, can group a student's sessions with no PII involved. `null` only
  // until the store rehydrates, which `useHydrateSession()` does synchronously
  // from the flow's first effect — so the funnel is tagged from `page_load` on.
  const studentId = useStudentSession.getState().studentId;
  console.log("[onboarding]", event, { studentId, ...detail });
}
