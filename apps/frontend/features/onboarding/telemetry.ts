// Instrumentation stubs for the onboarding funnel.
//
// At this stage events go nowhere — the transport (an anonymous, UUID-tagged
// analytics layer) is a separate task. Names and the two governed funnel states
// below match the telemetry vocabulary so the wiring is a drop-in later. Kept
// as thin wrappers so call sites read as intent.

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

// Deliberately silent. This used to console.log the event, its detail and the
// anonymous client id — which ships to production, so a browser with DevTools
// open printed the student's answers and their id. The transport that replaces
// it reads the id from the store itself (useStudentSession.getState()), which
// is populated from the flow's first effect, so the funnel is still tagged from
// `page_load` on.
export function emit(
  _event: OnboardingEvent,
  _detail?: Record<string, unknown>,
): void {
  void _event;
  void _detail;
}
