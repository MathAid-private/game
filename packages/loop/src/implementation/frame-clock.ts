/**
 * @fileoverview
 * @summary The fixed-timestep frame clock — pure accumulator of wall time into simulation steps.
 *
 * @description
 * This module provides `FrameClock`, the concrete `IFrameClock` that integrates elapsed wall
 * time into a pending-step accumulator. It is pure and platform-free: it holds only numbers and
 * mutates them deterministically, which is what makes the fixed-timestep simulation reproducible
 * and testable.
 *
 * @author MathAid
 */

import type { IFrameClock, Nanoseconds, Timestamp } from '../types';

/**
 * @summary Accumulates wall time into whole, fixed-size simulation steps.
 *
 * @description
 * `FrameClock` is the timing heart of a fixed-timestep loop. `advance` adds the elapsed
 * nanoseconds since the previous sample to a pending-step accumulator scaled by the configured
 * step interval; `consume` takes exactly one whole step; `reset` discards debt and re-anchors to
 * a fresh timestamp (used on resume after a pause). It exposes `stepInterval` and `pending`
 * read-only so a driver can decide how many steps to run.
 *
 * The clock holds no events and no metrics — only timing — so it stays a single-purpose,
 * trivially-testable object that higher layers compose.
 *
 * @example
 * const clock = new FrameClock(SecondMetric.NANOSECONDS / 60, now);
 * clock.advance(now + frameNanos);
 * while (clock.pending >= 1) { clock.consume(); }
 *
 * @see {@link IFrameClock}
 * @author MathAid
 */
export class FrameClock implements IFrameClock {
  readonly #stepInterval: Nanoseconds;
  #pending = 0;
  #last: Timestamp;

  /**
   * @summary Construct a frame clock for a fixed step rate.
   * @param stepIntervalNanos - Nanoseconds per simulation step (e.g. `1e9 / fps`).
   * @param startNanos - The initial timestamp to anchor against.
   * @author MathAid
   */
  constructor(stepIntervalNanos: Nanoseconds, startNanos: Timestamp) {
    this.#stepInterval = stepIntervalNanos;
    this.#last = startNanos;
  }

  /**
   * @summary Nanoseconds per fixed simulation step.
   * @author MathAid
   */
  get stepInterval(): Nanoseconds {
    return this.#stepInterval;
  }

  /**
   * @summary Whole steps currently owed (≥ 0).
   * @author MathAid
   */
  get pending(): number {
    return this.#pending;
  }

  /**
   * @summary Add elapsed wall time to the accumulator.
   * @param nowNanos - Current monotonic timestamp, in nanoseconds.
   * @author MathAid
   */
  advance(nowNanos: Timestamp): void {
    this.#pending += (nowNanos - this.#last) / this.#stepInterval;
    this.#last = nowNanos;
  }

  /**
   * @summary Take exactly one whole step, decrementing `pending` by one.
   * @author MathAid
   */
  consume(): void {
    this.#pending -= 1;
  }

  /**
   * @summary Discard accumulated debt and re-anchor to a fresh timestamp.
   * @param nowNanos - The timestamp to re-anchor against, in nanoseconds.
   * @author MathAid
   */
  reset(nowNanos: Timestamp): void {
    this.#pending = 0;
    this.#last = nowNanos;
  }
}
