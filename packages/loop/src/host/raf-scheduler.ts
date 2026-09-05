/**
 * @fileoverview
 * @summary The browser scheduler — an `IScheduler` backed by `requestAnimationFrame`.
 *
 * @description
 * This module provides `RAFScheduler`, the production `IScheduler` that pumps a frame callback
 * once per display refresh via `requestAnimationFrame`. Each callback is delivered the frame's
 * timestamp in nanoseconds, so consumers never reach back into a clock. It is the
 * environment-specific counterpart to `ManualScheduler`.
 *
 * @author MathAid
 */

import type { IScheduleHandle, IScheduler, Timestamp } from '../types';

/**
 * @summary An `IScheduler` driving a frame callback on the display refresh.
 *
 * @description
 * `RAFScheduler` registers a step via `requestAnimationFrame`, converting the browser's
 * millisecond timestamp to the engine's nanosecond `Timestamp` and delivering it to the
 * callback. `cancel` stops a pending frame using the opaque rAF id stored in the handle's token.
 * It is stateless beyond the browser's own frame queue, so any number of schedulers may coexist.
 *
 * @example
 * const scheduler = new RAFScheduler();
 * const handle = scheduler.schedule((now) => engine.frame(now));
 * scheduler.cancel(handle);
 *
 * @see {@link IScheduler}
 * @author MathAid
 */
export class RAFScheduler implements IScheduler {
  /**
   * @summary Register a step to run on the next display frame.
   * @param step - Called once with the frame timestamp, in nanoseconds.
   * @return A handle whose token is the rAF id.
   * @author MathAid
   */
  schedule(step: (now: Timestamp) => void): IScheduleHandle {
    const id = requestAnimationFrame((timeMs: number) => step(timeMs * 1e6));
    return { token: id };
  }

  /**
   * @summary Cancel a pending frame.
   * @param handle - The value returned by `schedule`.
   * @author MathAid
   */
  cancel(handle: IScheduleHandle): void {
    if (typeof handle.token === 'number') cancelAnimationFrame(handle.token);
  }
}
