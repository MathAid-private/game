/**
 * @fileoverview
 * @summary The browser clock — a monotonic `IClock` backed by `performance.now()`.
 *
 * @description
 * This module provides `NanoClock`, the production `IClock` for browser environments. It
 * delegates to the engine's nanosecond conversion of `performance.now()`, exposing the same
 * monotonic timeline as the manual test clock but driven by real wall time. It is the
 * environment-specific counterpart to `ManualClock`.
 *
 * @author MathAid
 */

import { nanoTime } from '../libs/time';
import type { IClock, Timestamp } from '../types';

/**
 * @summary An `IClock` reading the browser's monotonic `performance.now()` clock.
 *
 * @description
 * `NanoClock` answers `now()` with a nanosecond timestamp from `performance.now()`, a monotonic
 * clock that never goes backwards and is unaffected by wall-clock changes. It carries no state
 * and no scheduling, so it is trivially interchangeable with `ManualClock` in the same engine.
 *
 * @example
 * const clock = new NanoClock();
 * const now = clock.now(); // nanoseconds since navigation start
 *
 * @see {@link IClock}
 * @author MathAid
 */
export class NanoClock implements IClock {
  /**
   * @summary Read the current monotonic time.
   * @return The current timestamp, in nanoseconds.
   * @author MathAid
   */
  now(): Timestamp {
    return nanoTime();
  }
}
