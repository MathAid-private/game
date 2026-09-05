/**
 * @fileoverview
 * @summary Time and scheduling contracts — the environment-facing clock and frame pump.
 *
 * @description
 * This module defines the two capabilities every execution environment must provide to the
 * engine: a monotonic clock (`IClock`) and a frame scheduler (`IScheduler`). They are composed
 * in `IHostLoop` for convenience but remain separate contracts, so a deterministic test can
 * pair a manual clock with a manual scheduler while a browser pairs `performance.now()` with
 * `requestAnimationFrame`.
 *
 * The time unit throughout the engine is the nanosecond, carried by the `Timestamp` and
 * `Nanoseconds` aliases so a bare `number` is never silently reinterpreted across units.
 *
 * @author MathAid
 */

/**
 * @summary A point on the engine's monotonic timeline.
 *
 * @description
 * `Timestamp` is a non-negative, monotonically increasing count of nanoseconds since an
 * arbitrary, implementation-defined epoch. It is never a wall-clock date; two timestamps are
 * only meaningful relative to one another as a `Nanoseconds` difference.
 *
 * The alias exists so call sites name their unit instead of passing a bare `number`.
 *
 * @example
 * const start: Timestamp = clock.now();
 * const elapsed: Nanoseconds = clock.now() - start;
 *
 * @author MathAid
 */
export type Timestamp = number;

/**
 * @summary A duration measured in nanoseconds.
 *
 * @description
 * `Nanoseconds` is the engine's only time-difference unit. Frame intervals, step intervals, and
 * elapsed-time deltas are all expressed as `Nanoseconds` and converted to seconds only at the
 * boundary where a human-readable or API-specific value is required.
 *
 * @example
 * const frameNanos: Nanoseconds = SecondMetric.NANOSECONDS / fps;
 *
 * @author MathAid
 */
export type Nanoseconds = number;

/**
 * @summary A monotonic source of the current time.
 *
 * @description
 * `IClock` is the engine's only view of time. It answers one question — "what time is it now?"
 * — as a nanosecond `Timestamp`. It deliberately exposes no scheduling, no pausing, and no
 * wall-clock semantics: those belong to `IScheduler` and the game state respectively.
 *
 * A clock is a leaf adapter. The engine core consumes it; a platform implements it. In a
 * browser the implementation delegates to `performance.now()`; in a test it is a hand-advanced
 * counter, which is what makes simulation fully deterministic.
 *
 * @example
 * class ManualClock implements IClock {
 *   #time = 0;
 *   advanceNanos(ns: Nanoseconds): void { this.#time += ns; }
 *   now(): Timestamp { return this.#time; }
 * }
 *
 * @see {@link IScheduler}
 * @see {@link IHostLoop}
 * @author MathAid
 */
export interface IClock {
  /**
   * @summary Read the current monotonic time.
   * @return The current timestamp, in nanoseconds. Never decreases between successive calls.
   * @author MathAid
   */
  now(): Timestamp;
}

/**
 * @summary An opaque token identifying one scheduled step.
 *
 * @description
 * `IScheduleHandle` is returned by `IScheduler.schedule` and accepted back by
 * `IScheduler.cancel`. It is opaque by design: callers must not inspect or reconstruct it,
 * because its concrete shape depends on the platform (a `requestAnimationFrame` id, a
 * `MessageChannel` pair, a timer id). Treating it as opaque keeps scheduling pluggable.
 *
 * @see {@link IScheduler}
 * @author MathAid
 */
export interface IScheduleHandle {
  /** Opaque cancellation token, interpreted only by the scheduler that created it. */
  readonly token: unknown;
}

/**
 * @summary Pumps a callback at the platform's frame cadence.
 *
 * @description
 * `IScheduler` is the engine's only view of *when* work happens. `schedule` registers a step
 * callback that will be invoked once per frame, delivering the current `Timestamp` so the
 * callback never has to reach back into a clock. `cancel` stops a previously scheduled step.
 *
 * Separating `IScheduler` from `IClock` means the *rate* (scheduler) and the *time base*
 * (clock) vary independently: a test can run `schedule` synchronously on demand while the real
 * browser runs it on `requestAnimationFrame`, sharing the same engine core.
 *
 * @example
 * const RAFScheduler: IScheduler = {
 *   schedule: (step) => ({ id: Symbol(requestAnimationFrame((t) => step(t * 1e6))) }),
 *   cancel: (handle) => cancelAnimationFrame(Number(handle.id.description)),
 * };
 *
 * @see {@link IClock}
 * @see {@link IHostLoop}
 * @author MathAid
 */
export interface IScheduler {
  /**
   * @summary Register a step callback to run on each frame.
   * @param step - Called once per frame with the current timestamp, in nanoseconds.
   * @return An opaque handle used to cancel this schedule.
   * @author MathAid
   */
  schedule(step: (now: Timestamp) => void): IScheduleHandle;
  /**
   * @summary Stop a previously scheduled step.
   * @param handle - The value returned by `schedule`. A no-op if already cancelled or unknown.
   * @author MathAid
   */
  cancel(handle: IScheduleHandle): void;
}

/**
 * @summary A platform loop driver: a clock and a scheduler composed.
 *
 * @description
 * `IHostLoop` is the convenience bundle an environment hands to the engine — a time source plus
 * a frame pump. It is an interface-composition, not a class, so any object with `now`,
 * `schedule`, and `cancel` satisfies it. Splitting the two halves (rather than one fat "host")
 * is what lets a single engine run unmodified on a browser, a worker, a server, or a test rig.
 *
 * @example
 * const browser: IHostLoop = { now: nanoTime, schedule: rAF.schedule, cancel: rAF.cancel };
 *
 * @see {@link IClock}
 * @see {@link IScheduler}
 * @author MathAid
 */
export interface IHostLoop extends IClock, IScheduler {}
