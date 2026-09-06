/**
 * @fileoverview
 * @summary Time-unit conversion helpers and the monotonic nanosecond clock.
 *
 * @description
 * This module provides the engine's time utilities: `nanoTime` (the monotonic nanosecond clock)
 * and the unit-conversion functions `toSeconds`, `toMilliseconds`, `toMicroseconds`, and
 * `toNanoseconds`. They are the single place time units are translated, so call sites never
 * hand-multiply by `1000` or `1e6`, and a bare `number` is never silently reinterpreted across
 * units — the metric is always an explicit `SecondMetric`.
 *
 * @author MathAid
 */

import { SecondMetric } from '../const';

/**
 * @summary The engine's monotonic clock, in nanoseconds.
 *
 * @description
 * `nanoTime` reads the browser's `performance.now()` — a monotonic, millisecond-resolution clock
 * that never goes backwards across a session — and returns it as whole nanoseconds. It is the
 * value the engine's `Timestamp`s are anchored against. The result is truncated to an integer so
 * it matches the engine's integral nanosecond `Timestamp`/`Nanoseconds` convention.
 *
 * @return The current monotonic time, in nanoseconds.
 *
 * @example
 * const now = nanoTime(); // nanoseconds since navigation start
 *
 * @see {@link toNanoseconds}
 * @author MathAid
 */
export function nanoTime(): number {
  return Math.trunc(toNanoseconds(performance.now(), SecondMetric.MILLISECONDS));
}

/**
 * @summary Convert a value from one time metric to nanoseconds.
 *
 * @description
 * `toNanoseconds` converts a `value` expressed in `metric` into nanoseconds by normalising to
 * seconds first (via `toSeconds`) and scaling up. It is the conversion the engine's `Timestamp`
 * and `Nanoseconds` values rely on, and the inverse of the millisecond source in `nanoTime`.
 *
 * @param value - The magnitude to convert.
 * @param metric - The unit `value` is expressed in. Defaults to `SecondMetric.SECONDS`.
 * @return The equivalent magnitude in nanoseconds.
 *
 * @example
 * toNanoseconds(1, SecondMetric.SECONDS);      // 1_000_000_000
 * toNanoseconds(16, SecondMetric.MILLISECONDS); // 16_000_000
 *
 * @see {@link toSeconds}
 * @author MathAid
 */
export function toNanoseconds(value: number, metric: SecondMetric = SecondMetric.SECONDS): number {
  return toSeconds(value, metric) * SecondMetric.NANOSECONDS;
}

/**
 * @summary Convert a value from one time metric to microseconds.
 *
 * @description
 * `toMicroseconds` converts a `value` expressed in `metric` into microseconds. Like the other
 * conversions it normalises through `toSeconds`, so all unit translations share one path.
 *
 * @param value - The magnitude to convert.
 * @param metric - The unit `value` is expressed in. Defaults to `SecondMetric.SECONDS`.
 * @return The equivalent magnitude in microseconds.
 *
 * @example
 * toMicroseconds(1, SecondMetric.SECONDS); // 1_000_000
 *
 * @see {@link toSeconds}
 * @author MathAid
 */
export function toMicroseconds(value: number, metric: SecondMetric = SecondMetric.SECONDS): number {
  return toSeconds(value, metric) * SecondMetric.MICROSECONDS;
}

/**
 * @summary Convert a value from one time metric to milliseconds.
 *
 * @description
 * `toMilliseconds` converts a `value` expressed in `metric` into milliseconds. It is the natural
 * bridge from the engine's nanosecond world to browser APIs (timers, `performance.now()`) that
 * speak milliseconds.
 *
 * @param value - The magnitude to convert.
 * @param metric - The unit `value` is expressed in. Defaults to `SecondMetric.SECONDS`.
 * @return The equivalent magnitude in milliseconds.
 *
 * @example
 * toMilliseconds(2, SecondMetric.SECONDS); // 2_000
 *
 * @see {@link toSeconds}
 * @author MathAid
 */
export function toMilliseconds(value: number, metric: SecondMetric = SecondMetric.SECONDS): number {
  return toSeconds(value, metric) * SecondMetric.MILLISECONDS;
}

/**
 * @summary Normalise a value from one time metric to seconds.
 *
 * @description
 * `toSeconds` divides `value` by its `metric`'s scale, yielding seconds. It is the single
 * normalisation step every other conversion delegates to. Each `SecondMetric` member is the
 * number of that unit per second, so dividing by it converts to seconds.
 *
 * @param value - The magnitude to convert.
 * @param metric - The unit `value` is expressed in.
 * @return The equivalent magnitude in seconds.
 *
 * @example
 * toSeconds(2_000, SecondMetric.MILLISECONDS); // 2
 *
 * @note
 * An unrecognised `metric` falls through the switch and returns `0` rather than throwing, so
 * callers should always pass a real `SecondMetric` member.
 *
 * @author MathAid
 */
export function toSeconds(value: number, metric: SecondMetric): number {
  switch (metric) {
    default:
      return 0;
    case SecondMetric.SECONDS:
    case SecondMetric.MILLISECONDS:
    case SecondMetric.MICROSECONDS:
    case SecondMetric.NANOSECONDS:
      return value / metric;
  }
}
