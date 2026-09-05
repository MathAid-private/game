/**
 * @fileoverview
 * @summary The composed browser host loop — a `NanoClock` plus an `rAFScheduler`.
 *
 * @description
 * This module provides `BrowserHostLoop`, the ready-made `IHostLoop` for a browser: a monotonic
 * `performance.now()` clock paired with a `requestAnimationFrame` scheduler. It is the object a
 * browser host passes to the engine, and it is an interface-composition of two adapters rather
 * than a monolith.
 *
 * @author MathAid
 */

import type { IHostLoop, IScheduleHandle, Timestamp } from '../types';
import { NanoClock } from './nano-clock';
import { rAFScheduler } from './raf-scheduler';

/**
 * @summary The browser's clock + scheduler, composed for the engine.
 *
 * @description
 * `BrowserHostLoop` satisfies `IHostLoop` by delegating `now` to a `NanoClock` and
 * `schedule`/`cancel` to an `rAFScheduler`. It is a plain composition of the two adapters, so a
 * host that needs a custom clock or scheduler can substitute either half independently. It is the
 * drop-in browser counterpart to a manual clock + manual scheduler pair used in tests.
 *
 * @example
 * const engine = new Engine(tetris, { fps: 60 }, new BrowserHostLoop(), present);
 *
 * @see {@link IHostLoop}
 * @see {@link NanoClock}
 * @see {@link rAFScheduler}
 * @author MathAid
 */
export class BrowserHostLoop implements IHostLoop {
  readonly #clock = new NanoClock();
  readonly #scheduler = new rAFScheduler();

  /**
   * @summary Read the current monotonic time.
   * @return The current timestamp, in nanoseconds.
   * @author MathAid
   */
  now(): Timestamp {
    return this.#clock.now();
  }

  /**
   * @summary Register a step to run on the next display frame.
   * @param step - Called once with the frame timestamp, in nanoseconds.
   * @return A handle used to cancel this schedule.
   * @author MathAid
   */
  schedule(step: (now: Timestamp) => void): IScheduleHandle {
    return this.#scheduler.schedule(step);
  }

  /**
   * @summary Cancel a pending frame.
   * @param handle - The value returned by `schedule`.
   * @author MathAid
   */
  cancel(handle: IScheduleHandle): void {
    this.#scheduler.cancel(handle);
  }
}
