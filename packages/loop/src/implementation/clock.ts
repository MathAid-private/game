/**
 * @fileoverview
 * @summary A manually-advanced clock for deterministic tests and tooling.
 *
 * @description
 * This module provides `ManualClock`, a hand-driven `IClock` implementation with no platform
 * dependency. Time advances only when the test calls `advance`, so a simulation driven against
 * it is fully deterministic: the same sequence of advances produces the same sequence of steps.
 * It is the test-time counterpart to a browser clock backed by `performance.now()`.
 *
 * @author MathAid
 */

import type { IClock, Nanoseconds, Timestamp } from '../types';

/**
 * @summary An `IClock` whose time advances only when explicitly told to.
 *
 * @description
 * `ManualClock` is the deterministic time source used in tests and headless tools. Its `now()`
 * returns the current, hand-advanced timestamp; `advance` moves it forward by a nanosecond
 * delta. Because nothing else can move the clock, a game loop paired with this clock is fully
 * reproducible, which is what makes engine behaviour unit-testable.
 *
 * It is used alongside a `ManualScheduler` to drive frames step by step in a test loop, or
 * behind a real scheduler when only the time base needs to be controlled.
 *
 * @example
 * const clock = new ManualClock();
 * clock.advance(SecondMetric.NANOSECONDS / 60); // one 60 Hz frame
 * const now = clock.now();
 *
 * @see {@link IClock}
 * @author MathAid
 */
export class ManualClock implements IClock {
  #time: number = 0;

  /**
   * @summary Read the current manually-advanced time.
   * @return The current timestamp, in nanoseconds since the clock's zero point.
   * @author MathAid
   */
  now(): Timestamp {
    return this.#time;
  }

  /**
   * @summary Move the clock forward.
   * @param byNanos - The nanosecond delta to add. Negative values move time backward and are
   *   discouraged — callers should advance monotonically.
   * @author MathAid
   */
  advance(byNanos: Nanoseconds): void {
    this.#time += byNanos;
  }
}
