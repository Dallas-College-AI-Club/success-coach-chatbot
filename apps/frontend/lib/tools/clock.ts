/**
 * A `Clock` is the only source of "now" in this package.
 *
 * Production code uses `systemClock`, which reads the real host clock. Tests and
 * evals inject `fixedClock(...)` so that "now" is deterministic. This is what
 * makes it possible to assert that a model *used* the tool result rather than
 * guessing a date from its training data.
 */
export type Clock = () => Date;

/** Reads the actual current system date and time. This is the production default. */
export const systemClock: Clock = () => new Date();

/**
 * A clock frozen at a single instant.
 *
 * @param instant - A `Date`, an ISO 8601 string, or epoch milliseconds.
 */
export function fixedClock(instant: Date | string | number): Clock {
  const frozen = instant instanceof Date ? new Date(instant.getTime()) : new Date(instant);
  if (Number.isNaN(frozen.getTime())) {
    throw new RangeError(`fixedClock: invalid instant ${JSON.stringify(instant)}`);
  }
  // Return a fresh Date each call so callers cannot mutate the frozen instant.
  return () => new Date(frozen.getTime());
}

/**
 * A clock that advances by a fixed step on every read. Useful for testing code
 * that measures elapsed time.
 */
export function tickingClock(start: Date | string | number, stepMs: number): Clock {
  const base = fixedClock(start)();
  let ticks = 0;
  return () => new Date(base.getTime() + stepMs * ticks++);
}
