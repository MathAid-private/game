/**
 * @fileoverview
 * @summary Shared engine constants — time and frequency scales, plus loop-tuning values.
 *
 * @description
 * This module holds the engine's unit scales (`SecondMetric`, `HertzMetric`) and the constants that
 * tune the loop and its observability (`DRAW_INTERVAL_NS`, `FPS_CACHE_CAPACITY`,
 * `MAX_CATCHUP_STEPS`). Keeping them in one place means the nanosecond convention and the
 * catch-up/FPS policies are defined once and referenced everywhere.
 *
 * @author MathAid
 */

/**
 * @summary The time unit scale: each member is the number of that unit per second.
 *
 * @description
 * `SecondMetric` is the denominator the time utilities in `libs/time.ts` divide by to normalise a
 * value to seconds. Because a member is "units per second" (e.g. `MILLISECONDS = 1000`), converting
 * *to* seconds divides by the member. The engine's time values (`Timestamp`, `Nanoseconds`) are
 * expressed in `NANOSECONDS`.
 *
 * @example
 * toSeconds(2000, SecondMetric.MILLISECONDS); // 2
 *
 * @note
 * This is the opposite convention to `HertzMetric`, whose members are "hertz per unit".
 *
 * @see {@link HertzMetric}
 * @author MathAid
 */
export enum SecondMetric {
  /** Seconds per second. */
  SECONDS = 1,
  /** Milliseconds per second. */
  MILLISECONDS = 1_000,
  /** Microseconds per second. */
  MICROSECONDS = 1_000_000,
  /** Nanoseconds per second. */
  NANOSECONDS = 1_000_000_000,
}

/**
 * @summary Nanoseconds per frame at a given frames-per-second rate.
 *
 * @description
 * `DRAW_INTERVAL_NS` converts a target `fps` into the nanosecond step interval the fixed-timestep
 * clock uses (`SecondMetric.NANOSECONDS / fps`). It is the single place the fps→interval conversion
 * is expressed, so the loop and any callers agree on the step size.
 *
 * @param fps - The target simulation rate, in frames per second.
 * @return The fixed step interval, in nanoseconds.
 *
 * @example
 * DRAW_INTERVAL_NS(60); // 16_666_666.666…
 *
 * @author MathAid
 */
export const DRAW_INTERVAL_NS = (fps: number) => SecondMetric.NANOSECONDS / fps;

/**
 * @summary The number of one-second performance windows the engine retains.
 *
 * @description
 * `FPS_CACHE_CAPACITY` is the default capacity of the performance-metrics ring buffer — how many
 * completed one-second step counts are kept for inspection. It is the default passed to
 * `PerformanceMetrics` when `IEngineConfig.fpsHistory` is not set.
 *
 * @author MathAid
 */
export const FPS_CACHE_CAPACITY = 60;

/**
 * @summary Upper bound on simulation catch-up steps run in a single host frame.
 *
 * @description
 * `MAX_CATCHUP_STEPS` caps how many fixed steps `FixedTimestepDriver.advance` may run per frame.
 * After a long stall it discards debt beyond this bound rather than replaying a burst, so a single
 * long pause cannot block the thread.
 *
 * @author MathAid
 */
export const MAX_CATCHUP_STEPS = 5;

/**
 * @summary The frequency unit scale: each member is the number of hertz per that unit.
 *
 * @description
 * `HertzMetric` is the multiplier the frequency utilities in `libs/timing.ts` use to normalise a
 * value to hertz. Because a member is "hertz per unit" (e.g. `KILOHERTZ = 1000` hertz per kilohertz),
 * converting *to* hertz multiplies by the member. This is the inverse of `SecondMetric`.
 *
 * @example
 * toHertz(2, HertzMetric.KILOHERTZ); // 2_000
 *
 * @see {@link SecondMetric}
 * @author MathAid
 */
export enum HertzMetric {
  /** Hertz per hertz. */
  HERTZ = 1,
  /** Hertz per kilohertz. */
  KILOHERTZ = 1_000,
  /** Hertz per megahertz. */
  MEGAHERTZ = 1_000_000,
  /** Hertz per gigahertz. */
  GIGAHERTZ = 1_000_000_000,
}
