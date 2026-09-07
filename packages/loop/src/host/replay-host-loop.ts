/**
 * @fileoverview
 * @summary A deterministic timestamp-playback host loop for replaying recorded frames.
 *
 * @description
 * This module provides `ReplayHostLoop`, an `IHostLoop` that plays back a fixed, pre-recorded
 * sequence of nanosecond timestamps. Each `schedule` delivers the next timestamp synchronously,
 * so the engine replays the exact frame times it was given — no wall clock, no timer, fully
 * deterministic. It is the tool for verifying that a recorded frame sequence reproduces the same
 * simulation steps (a "replay" harness).
 *
 * @author MathAid
 */

import type { IHostLoop, IScheduleHandle, Timestamp } from '../types';

/**
 * @summary A host loop that replays a fixed timestamp sequence.
 *
 * @description
 * `ReplayHostLoop` satisfies `IHostLoop<number>` over a `readonly Timestamp[]`. `schedule`
 * delivers the next unplayed timestamp to the step callback synchronously, advancing an internal
 * cursor; once the sequence is exhausted (or `cancel` is called) it stops delivering. `now()`
 * returns the most recently delivered timestamp (or `0` before the first frame), so the engine's
 * clock and driver agree on the replay timeline.
 *
 * Because delivery is synchronous, driving an engine against a replay runs the whole sequence in
 * one `run()` call — which is exactly the point: a deterministic, side-effect-free playback.
 *
 * @example
 * const host = new ReplayHostLoop([1_000_000, 2_000_000, 3_000_000]);
 * const engine = new Engine(game, { fps: 60 }, host);
 *
 * @see {@link IHostLoop}
 * @author MathAid
 */
export class ReplayHostLoop implements IHostLoop<number> {
  readonly #timestamps: readonly Timestamp[];
  #index = 0;
  #token = 0;
  #cancelled = false;

  /**
   * @summary Construct a replay host over a fixed timestamp sequence.
   * @param timestamps - The monotonic nanosecond timestamps to play back, in order.
   * @author MathAid
   */
  constructor(timestamps: readonly Timestamp[]) {
    this.#timestamps = timestamps;
  }

  /**
   * @summary Read the most recently delivered timestamp (or `0` before the first).
   * @return The current replay timestamp, in nanoseconds.
   * @author MathAid
   */
  now(): Timestamp {
    return this.#index === 0 ? 0 : this.#timestamps[this.#index - 1];
  }

  /**
   * @summary Deliver the next timestamp synchronously, then return a handle.
   * @param step - Called once with the next timestamp (or not at all when exhausted/cancelled).
   * @return A handle identifying this delivery.
   * @author MathAid
   */
  schedule(step: (now: Timestamp) => void): IScheduleHandle<number> {
    const token = ++this.#token;
    if (!this.#cancelled && this.#index < this.#timestamps.length) {
      const now = this.#timestamps[this.#index++];
      step(now);
    }
    return { token };
  }

  /**
   * @summary Stop playback.
   * @param _handle - The value returned by `schedule` (unused — playback is cursor-based).
   * @author MathAid
   */
  cancel(_handle: IScheduleHandle<number>): void {
    this.#cancelled = true;
  }
}
