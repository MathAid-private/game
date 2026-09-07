/**
 * @fileoverview
 * @summary A `MessageChannel`-backed scheduler for environments without `requestAnimationFrame`.
 *
 * @description
 * This module provides `MessageChannelScheduler`, an `IScheduler` that pumps a frame callback via
 * a `MessageChannel`. Each `schedule` call posts one message that delivers the current nanosecond
 * timestamp and invokes the step on the next macrotask, so the event loop yields between frames —
 * the closest headless analogue to `requestAnimationFrame`. `MessageChannel` and `performance`
 * exist in Node.js, browsers, and workers, so the same scheduler drives a server loop or a worker
 * loop.
 *
 * @author MathAid
 */

import { nanoTime } from '../libs/time';
import type { IScheduleHandle, IScheduler, Timestamp } from '../types';

/**
 * @summary An `IScheduler` delivering one frame per message-channel task.
 *
 * @description
 * `MessageChannelScheduler` is one-shot per `schedule`: it creates a fresh `MessageChannel`,
 * registers a `message` listener that invokes the step with `nanoTime()`, and posts a kickoff
 * message. The caller (the engine) re-schedules each frame, so the cadence is caller-driven while
 * each delivery still yields to the event loop. The handle's token is the whole `MessageChannel`,
 * and `cancel` closes both ports, which discards any queued delivery.
 *
 * @example
 * const scheduler = new MessageChannelScheduler();
 * const handle = scheduler.schedule((now) => engine.frame(now));
 * scheduler.cancel(handle);
 *
 * @see {@link IScheduler}
 * @author MathAid
 */
export class MessageChannelScheduler implements IScheduler<MessageChannel> {
  /**
   * @summary Register a step to run on the next channel task.
   * @param step - Called once with the current timestamp, in nanoseconds.
   * @return A handle whose token is the backing `MessageChannel`.
   * @author MathAid
   */
  schedule(step: (now: Timestamp) => void): IScheduleHandle<MessageChannel> {
    const channel = new MessageChannel();
    channel.port2.onmessage = () => step(nanoTime());
    channel.port1.postMessage(null);
    return { token: channel };
  }

  /**
   * @summary Cancel a pending delivery by closing the channel.
   * @param handle - The value returned by `schedule`.
   * @author MathAid
   */
  cancel(handle: IScheduleHandle<MessageChannel>): void {
    handle.token.port1.close();
    handle.token.port2.close();
  }
}
