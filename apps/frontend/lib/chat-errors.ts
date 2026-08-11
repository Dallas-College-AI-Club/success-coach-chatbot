// Student-facing chat error messages, shared by the route (which maps raw
// provider errors onto them via the stream's onError) and the chat UI (which
// displays an error's message ONLY when it equals one of these — anything
// else renders as the generic line, so raw provider internals never reach a
// student). No server imports: safe for client bundles.

/** OpenRouter free-tier daily cap (~50 requests). Resets daily. */
export const FREE_LIMIT_MESSAGE =
  "Major has answered all the questions it can today — the free daily limit is used up. Please try again tomorrow.";

/** Transient 429s: per-minute throttles and shared free-pool congestion.
 *  Distinct from the daily cap — telling a student to "try again tomorrow"
 *  for a 60-second throttle loses them for the day (2026-08-11 audit: both
 *  live stream failures were this case, surfaced as a generic error). */
export const TRANSIENT_LIMIT_MESSAGE =
  "Major is briefly over capacity. Give it a minute and ask again.";

export const GENERIC_CHAT_ERROR = "Something went wrong reaching Major.";

export const SAFE_CHAT_ERRORS: ReadonlySet<string> = new Set([
  FREE_LIMIT_MESSAGE,
  TRANSIENT_LIMIT_MESSAGE,
]);
