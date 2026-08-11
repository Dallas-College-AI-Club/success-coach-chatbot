/**
 * A `Clock` is the only source of "now" in this package.
 *
 * Production code uses `systemClock`, which reads the real host clock. The
 * seam exists so a test or eval can inject a frozen clock and assert that a
 * model *used* the tool result rather than guessing a date from its training
 * data. (Fixed/ticking implementations lived here with no callers; write one
 * at the call site when a suite needs it.)
 */
export type Clock = () => Date;

/** Reads the actual current system date and time. This is the production default. */
export const systemClock: Clock = () => new Date();
