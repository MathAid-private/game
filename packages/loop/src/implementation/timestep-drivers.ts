/**
 * @fileoverview
 * @summary Non-fixed simulation drivers — variable, capped-variable, and event-driven stepping.
 *
 * @description
 * This module provides the alternative `ISimulationDriver` strategies that complement
 * `FixedTimestepDriver`: a variable-timestep driver (one step per frame with the real `dt`), a
 * capped-variable driver (same, but `dt` clamped to a maximum), and an event-driven driver (steps
 * only on explicit events, never on time). Each is pure and platform-free, driven by timestamps and
 * input snapshots supplied from outside.
 *
 * @author MathAid
 */

import { FPS_CACHE_CAPACITY } from '../const';
import type { Alpha, IClock, IGame, IInputState, ISimulationDriver, Timestamp } from '../types';
import { PerformanceMetrics } from './performance';

/**
 * @summary A driver that steps the game once per frame with the real elapsed `dt`.
 *
 * @description
 * `VariableTimestepDriver` passes the actual wall-time delta of each frame into `game.step`, so the
 * simulation advances in real time rather than at a fixed cadence. It is the simplest strategy and
 * is non-deterministic — results depend on the frame rate. `interpolation()` returns `0` because the
 * state is already at the latest time; there is no sub-step remainder to blend.
 *
 * @template G - The concrete game type; defaults to `IGame`.
 *
 * @example
 * const driver = new VariableTimestepDriver(game, host.now());
 * driver.advance(host.now(), input);
 *
 * @see {@link ISimulationDriver}
 * @author MathAid
 */
export class VariableTimestepDriver<G extends IGame = IGame> implements ISimulationDriver<G> {
  readonly #metrics: PerformanceMetrics;
  readonly #game: G;
  readonly #timeClock: IClock;
  #lastNow: Timestamp;

  /**
   * @summary Construct a variable-timestep driver.
   * @param game - The game to step.
   * @param startNanos - Initial timestamp to anchor against, in nanoseconds.
   * @param historyCapacity - Number of one-second metric windows to retain. Defaults to
   *   `FPS_CACHE_CAPACITY`.
   * @author MathAid
   */
  constructor(game: G, startNanos: Timestamp, historyCapacity = FPS_CACHE_CAPACITY) {
    this.#game = game;
    this.#lastNow = startNanos;
    this.#timeClock = { now: () => this.#lastNow };
    this.#metrics = new PerformanceMetrics(historyCapacity);
  }

  /**
   * @summary Read-only performance metrics.
   * @author MathAid
   */
  get metrics(): PerformanceMetrics {
    return this.#metrics;
  }

  /**
   * @summary The game being driven.
   * @author MathAid
   */
  get game(): G {
    return this.#game;
  }

  /**
   * @summary The sub-frame interpolation factor — always `0` for variable timestep.
   * @author MathAid
   */
  interpolation(): Alpha {
    return 0;
  }

  /**
   * @summary Re-anchor the clock so the next `dt` is measured from `now`.
   * @param nowNanos - The timestamp to re-anchor against, in nanoseconds.
   * @author MathAid
   */
  reset(nowNanos: Timestamp): void {
    this.#lastNow = nowNanos;
  }

  /**
   * @summary Advance the simulation by one real-time frame.
   * @param nowNanos - Current monotonic timestamp, in nanoseconds.
   * @param input - The input snapshot for this frame.
   * @return `1` — exactly one step runs per frame.
   * @author MathAid
   */
  advance(nowNanos: Timestamp, input: IInputState): number {
    const dt = nowNanos - this.#lastNow;
    this.#lastNow = nowNanos;
    this.#game.step({ clock: this.#timeClock, dt, metrics: this.#metrics, input });
    this.#metrics.record(1, nowNanos);
    return 1;
  }
}

/**
 * @summary A variable-timestep driver with `dt` clamped to a maximum.
 *
 * @description
 * `CappedVariableTimestepDriver` behaves like `VariableTimestepDriver` but caps `dt` at `maxDt`, so
 * a single long frame (a stall, a background tab) cannot produce a huge physics step. It is still
 * non-deterministic, but avoids the worst variable-timestep instabilities.
 *
 * @template G - The concrete game type; defaults to `IGame`.
 *
 * @example
 * const driver = new CappedVariableTimestepDriver(game, host.now(), /* maxDtNanos *\/ 33_333_333);
 *
 * @see {@link VariableTimestepDriver}
 * @author MathAid
 */
export class CappedVariableTimestepDriver<G extends IGame = IGame>
  implements ISimulationDriver<G>
{
  readonly #metrics: PerformanceMetrics;
  readonly #game: G;
  readonly #timeClock: IClock;
  readonly #maxDt: number;
  #lastNow: Timestamp;

  /**
   * @summary Construct a capped-variable-timestep driver.
   * @param game - The game to step.
   * @param startNanos - Initial timestamp to anchor against, in nanoseconds.
   * @param maxDtNanos - The maximum `dt` passed to a step, in nanoseconds.
   * @param historyCapacity - Number of one-second metric windows to retain. Defaults to
   *   `FPS_CACHE_CAPACITY`.
   * @author MathAid
   */
  constructor(
    game: G,
    startNanos: Timestamp,
    maxDtNanos: number,
    historyCapacity = FPS_CACHE_CAPACITY,
  ) {
    this.#game = game;
    this.#lastNow = startNanos;
    this.#maxDt = maxDtNanos;
    this.#timeClock = { now: () => this.#lastNow };
    this.#metrics = new PerformanceMetrics(historyCapacity);
  }

  /**
   * @summary Read-only performance metrics.
   * @author MathAid
   */
  get metrics(): PerformanceMetrics {
    return this.#metrics;
  }

  /**
   * @summary The game being driven.
   * @author MathAid
   */
  get game(): G {
    return this.#game;
  }

  /**
   * @summary The sub-frame interpolation factor — always `0`.
   * @author MathAid
   */
  interpolation(): Alpha {
    return 0;
  }

  /**
   * @summary Re-anchor the clock so the next `dt` is measured from `now`.
   * @param nowNanos - The timestamp to re-anchor against, in nanoseconds.
   * @author MathAid
   */
  reset(nowNanos: Timestamp): void {
    this.#lastNow = nowNanos;
  }

  /**
   * @summary Advance the simulation by one frame, with `dt` clamped to `maxDt`.
   * @param nowNanos - Current monotonic timestamp, in nanoseconds.
   * @param input - The input snapshot for this frame.
   * @return `1` — exactly one step runs per frame.
   * @author MathAid
   */
  advance(nowNanos: Timestamp, input: IInputState): number {
    let dt = nowNanos - this.#lastNow;
    if (dt > this.#maxDt) dt = this.#maxDt;
    this.#lastNow = nowNanos;
    this.#game.step({ clock: this.#timeClock, dt, metrics: this.#metrics, input });
    this.#metrics.record(1, nowNanos);
    return 1;
  }
}

/**
 * @summary A driver that steps only on explicit events, never on wall time.
 *
 * @description
 * `EventDrivenDriver` is for turn-based or input-gated logic: `advance` only re-anchors the clock
 * and runs **zero** steps, while the explicit `step(input)` method runs exactly one `game.step` on a
 * discrete event. `dt` is `0` for each event step, because time does not advance the simulation.
 *
 * @template G - The concrete game type; defaults to `IGame`.
 *
 * @example
 * const driver = new EventDrivenDriver(game, host.now());
 * driver.advance(host.now(), input);   // 0 steps (time-driven no-op)
 * driver.step(input);                  // 1 step (explicit event)
 *
 * @see {@link ISimulationDriver}
 * @author MathAid
 */
export class EventDrivenDriver<G extends IGame = IGame> implements ISimulationDriver<G> {
  readonly #metrics: PerformanceMetrics;
  readonly #game: G;
  readonly #timeClock: IClock;
  #lastNow: Timestamp;

  /**
   * @summary Construct an event-driven driver.
   * @param game - The game to step.
   * @param startNanos - Initial timestamp to anchor against, in nanoseconds.
   * @param historyCapacity - Number of one-second metric windows to retain. Defaults to
   *   `FPS_CACHE_CAPACITY`.
   * @author MathAid
   */
  constructor(game: G, startNanos: Timestamp, historyCapacity = FPS_CACHE_CAPACITY) {
    this.#game = game;
    this.#lastNow = startNanos;
    this.#timeClock = { now: () => this.#lastNow };
    this.#metrics = new PerformanceMetrics(historyCapacity);
  }

  /**
   * @summary Read-only performance metrics.
   * @author MathAid
   */
  get metrics(): PerformanceMetrics {
    return this.#metrics;
  }

  /**
   * @summary The game being driven.
   * @author MathAid
   */
  get game(): G {
    return this.#game;
  }

  /**
   * @summary The sub-frame interpolation factor — always `0`.
   * @author MathAid
   */
  interpolation(): Alpha {
    return 0;
  }

  /**
   * @summary Re-anchor the clock; event-driven stepping has no debt to discard.
   * @param nowNanos - The timestamp to re-anchor against, in nanoseconds.
   * @author MathAid
   */
  reset(nowNanos: Timestamp): void {
    this.#lastNow = nowNanos;
  }

  /**
   * @summary A time-driven no-op — re-anchors the clock and runs zero steps.
   * @param nowNanos - Current monotonic timestamp, in nanoseconds.
   * @param input - The input snapshot (unused — no step runs).
   * @return `0` — time never advances the simulation.
   * @author MathAid
   */
  advance(nowNanos: Timestamp, _input: IInputState): number {
    this.#lastNow = nowNanos;
    this.#metrics.record(0, nowNanos);
    return 0;
  }

  /**
   * @summary Run exactly one simulation step on an explicit event.
   * @param input - The input snapshot for this step.
   * @return `1`.
   * @author MathAid
   */
  step(input: IInputState): number {
    this.#game.step({ clock: this.#timeClock, dt: 0, metrics: this.#metrics, input });
    this.#metrics.record(1, this.#lastNow);
    return 1;
  }
}
