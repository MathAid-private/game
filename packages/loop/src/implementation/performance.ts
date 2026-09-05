/**
 * @fileoverview
 * @summary The performance metrics accumulator — per-second step history.
 *
 * @description
 * This module provides `PerformanceMetrics`, the concrete `IPerformanceMetrics` that records how
 * many simulation steps run inside each rolling one-second window. It is pure and platform-free,
 * so a HUD, profiler, or test can read recent performance without coupling to any timing
 * mechanics or environment API.
 *
 * @author MathAid
 */

import { FPS_CACHE_CAPACITY, SecondMetric } from '../const';
import type { FrameMetric, IPerformanceMetrics, Timestamp } from '../types';

/**
 * @summary A fixed-capacity ring of one-second step counts.
 *
 * @description
 * `PerformanceMetrics` accumulates step counts and closes a `FrameMetric` window once a second
 * of wall time has elapsed, retaining the most recent `capacity` windows. It is written to by the
 * simulation driver each frame and read by anything that wants to display or log performance.
 * Early windows are simply absent (an empty history) rather than synthesised.
 *
 * @example
 * const metrics = new PerformanceMetrics(60);
 * metrics.record(stepsRun, nowNanos);          // called once per frame
 * const fps = metrics.frameHistory.at(-1)?.steps ?? 0;
 *
 * @see {@link IPerformanceMetrics}
 * @see {@link FrameMetric}
 * @author MathAid
 */
export class PerformanceMetrics implements IPerformanceMetrics {
  readonly #history: FrameMetric[] = [];
  readonly #capacity: number;
  #windowStart = 0;
  #steps = 0;
  #last = 0;

  /**
   * @summary Construct a metrics accumulator.
   * @param capacity - Number of one-second windows to retain. Defaults to `FPS_CACHE_CAPACITY`.
   * @author MathAid
   */
  constructor(capacity: number = FPS_CACHE_CAPACITY) {
    this.#capacity = capacity;
  }

  /**
   * @summary Recent completed one-second windows, oldest first.
   * @author MathAid
   */
  get frameHistory(): readonly FrameMetric[] {
    return this.#history;
  }

  /**
   * @summary Timestamp of the most recent sample, in nanoseconds.
   * @author MathAid
   */
  get lastTimestamp(): Timestamp {
    return this.#last;
  }

  /**
   * @summary Record steps run and close a window once a second has elapsed.
   * @param steps - Simulation steps run this frame.
   * @param nowNanos - Current monotonic timestamp, in nanoseconds.
   * @author MathAid
   */
  record(steps: number, nowNanos: Timestamp): void {
    if (this.#windowStart === 0) this.#windowStart = nowNanos;
    this.#steps += steps;
    this.#last = nowNanos;

    if (nowNanos - this.#windowStart >= SecondMetric.NANOSECONDS) {
      this.#history.push({ timestamp: nowNanos, steps: this.#steps });
      if (this.#history.length > this.#capacity) this.#history.shift();
      this.#steps = 0;
      this.#windowStart = nowNanos;
    }
  }
}
