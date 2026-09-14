/**
 * @fileoverview
 * @summary The composed headless host loop — a monotonic clock plus a `MessageChannel` scheduler.
 *
 * @description
 * This module provides `NodeHostLoop`, the ready-made `IHostLoop` for a headless (server) process:
 * a `performance.now()` clock paired with a `MessageChannelScheduler`. It has no DOM dependency,
 * so it drives the same engine unchanged in Node.js or any environment that provides
 * `performance` and `MessageChannel` but not `requestAnimationFrame`.
 *
 * @author MathAid
 */

import type { IHostLoop, IScheduleHandle, Timestamp } from '../types';
import { NanoClock } from './nano-clock';
import { MessageChannelScheduler } from './message-channel-scheduler';

/**
 * @summary The headless clock + scheduler, composed for the engine.
 *
 * @description
 * `NodeHostLoop` satisfies `IHostLoop<MessageChannel>` by delegating `now` to a `NanoClock`
 * (`performance.now()`) and `schedule`/`cancel` to a `MessageChannelScheduler`. It is the
 * headless counterpart to `BrowserHostLoop`: no `requestAnimationFrame`, but the same engine core
 * runs unmodified. Because `performance` and `MessageChannel` also exist inside workers, this host
 * doubles as the worker-context loop (see {@link WorkerHostLoop}).
 *
 * @example
 * const engine = new Engine(tetris, { fps: 60 }, new NodeHostLoop());
 *
 * @see {@link IHostLoop}
 * @see {@link NanoClock}
 * @see {@link MessageChannelScheduler}
 * @author MathAid
 */
export class NodeHostLoop implements IHostLoop<MessageChannel> {
  readonly #clock = new NanoClock();
  readonly #scheduler = new MessageChannelScheduler();

  /**
   * @summary Read the current monotonic time.
   * @return The current timestamp, in nanoseconds.
   * @author MathAid
   */
  now(): Timestamp {
    return this.#clock.now();
  }

  /**
   * @summary Register a step to run on the next channel task.
   * @param step - Called once with the frame timestamp, in nanoseconds.
   * @return A handle used to cancel this schedule.
   * @author MathAid
   */
  schedule(step: (now: Timestamp) => void): IScheduleHandle<MessageChannel> {
    return this.#scheduler.schedule(step);
  }

  /**
   * @summary Cancel a pending frame.
   * @param handle - The value returned by `schedule`.
   * @author MathAid
   */
  cancel(handle: IScheduleHandle<MessageChannel>): void {
    this.#scheduler.cancel(handle);
  }
}
