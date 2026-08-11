/**
 * A `Clock` is the only source of "now" in this package.
 *
 * Production code uses `systemClock`, which reads the real host clock. Tests and
 * evals inject a frozen clock so that "now" is deterministic. This is what
 * makes it possible to assert that a model *used* the tool result rather than
 * guessing a date from its training data.
 */
export type Clock = () => Date;

/** Reads the actual current system date and time. This is the production default. */
export const systemClock: Clock = () => new Date();
