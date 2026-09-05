/**
 * @fileoverview
 * @summary A manually-pumped scheduler for deterministic tests.
 *
 * @description
 * This module provides `ManualScheduler`, a hand-driven `IScheduler` that stores the frame
 * callback and fires it only when the test calls `tick`. It is the test-time counterpart to a
 * browser `requestAnimationFrame` scheduler: same contract, no platform, no timer.
 *
 * @author MathAid
 */

import type { IScheduleHandle, IScheduler, Timestamp } from '../types';

/**
 * @summary An `IScheduler` whose frame callback runs only on explicit `tick` calls.
 *
 * @description
 * `ManualScheduler` decouples "which work happens each frame" from "when frames happen". It
 * registers a step callback via `schedule` and invokes it exactly once per `tick(now)` call,
 * delivering the supplied timestamp. Tests drive a whole engine deterministically by pairing it
 * with a `ManualClock` and ticking once per frame.
 *
 * @example
 * const scheduler = new ManualScheduler();
 * scheduler.schedule((now) => engine.frame(now));
 * scheduler.tick(clock.now()); // exactly one frame
 *
 * @see {@link IScheduler}
 * @author MathAid
 */
export class ManualScheduler implements IScheduler {
  #step: ((now: Timestamp) => void) | null = null;

  /**
   * @summary Register the frame callback.
   * @param step - The callback to run once per `tick`.
   * @return A handle identifying this registration.
   * @author MathAid
   */
  schedule(step: (now: Timestamp) => void): IScheduleHandle {
    this.#step = step;
    return { id: Symbol('manual-scheduler') };
  }

  /**
   * @summary Stop firing the registered callback.
   * @param handle - The value returned by `schedule`. A no-op if none is registered.
   * @author MathAid
   */
  cancel(_handle: IScheduleHandle): void {
    this.#step = null;
  }

  /**
   * @summary Manually fire one frame.
   * @param now - The timestamp to deliver to the frame callback, in nanoseconds.
   * @author MathAid
   */
  tick(now: Timestamp): void {
    this.#step?.(now);
  }
}
