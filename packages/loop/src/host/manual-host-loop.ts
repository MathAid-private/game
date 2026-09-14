/**
 * @fileoverview
 * @summary The composed manual host loop — a `ManualClock` plus a `ManualScheduler`.
 *
 * @description
 * This module provides `ManualHostLoop`, a ready-made `IHostLoop` that pairs a hand-advanced
 * `ManualClock` with a hand-pumped `ManualScheduler`. It is the test/tooling counterpart to
 * `BrowserHostLoop`: identical engine-facing surface, but time and frames advance only when the
 * caller drives them, making a whole run fully deterministic.
 *
 * @author MathAid
 */

import type { IHostLoop, IScheduleHandle, Timestamp } from '../types';
import { ManualClock } from '../implementation/clock';
import { ManualScheduler } from '../implementation/scheduler';

/**
 * @summary A deterministically-driven host loop for tests and tooling.
 *
 * @description
 * `ManualHostLoop` satisfies `IHostLoop<null>` by composing a `ManualClock` and a
 * `ManualScheduler`, exposing both halves so a test can advance time (`clock.advance`) and pump
 * frames (`scheduler.tick`) exactly as the scenario requires. Nothing runs on its own: the caller
 * is the event loop. This is the same pairing the engine test rig uses, packaged as a reusable
 * class.
 *
 * @example
 * const host = new ManualHostLoop();
 * const engine = new Engine(game, { fps: 60 }, host);
 * host.clock.advance(SecondMetric.NANOSECONDS / 60);
 * host.scheduler.tick(host.clock.now()); // one frame
 *
 * @see {@link IHostLoop}
 * @see {@link ManualClock}
 * @see {@link ManualScheduler}
 * @author MathAid
 */
export class ManualHostLoop implements IHostLoop<null> {
  /** The hand-advanced time source. */
  readonly clock = new ManualClock();
  /** The hand-pumped frame scheduler. */
  readonly scheduler = new ManualScheduler();

  /**
   * @summary Read the current manually-advanced time.
   * @return The current timestamp, in nanoseconds.
   * @author MathAid
   */
  now(): Timestamp {
    return this.clock.now();
  }

  /**
   * @summary Register a step to run on the next manual `tick`.
   * @param step - Called once per `tick` with the supplied timestamp.
   * @return A handle used to cancel this schedule.
   * @author MathAid
   */
  schedule(step: (now: Timestamp) => void): IScheduleHandle<null> {
    return this.scheduler.schedule(step);
  }

  /**
   * @summary Cancel a pending frame.
   * @param handle - The value returned by `schedule`.
   * @author MathAid
   */
  cancel(handle: IScheduleHandle<null>): void {
    this.scheduler.cancel(handle);
  }
}
