/**
 * @fileoverview
 * @summary The fixed-timestep simulation driver — invokes a game's step at a fixed cadence.
 *
 * @description
 * This module provides `FixedTimestepDriver`, the concrete `ISimulationDriver` that owns a
 * `FrameClock` and `PerformanceMetrics` and runs `game.step()` once per whole step owed. It is
 * pure and platform-free: it is driven by timestamps and input snapshots supplied from outside,
 * so it never touches a scheduler, a clock, or a renderer — those are the caller's concerns.
 *
 * @author MathAid
 */

import { FPS_CACHE_CAPACITY, MAX_CATCHUP_STEPS, SecondMetric } from '../const';
import type {
  Alpha,
  IClock,
  IGame,
  IInputState,
  ISimulationDriver,
  Nanoseconds,
  StepResult,
  StepSignal,
  Timestamp,
} from '../types';
import { FrameClock } from './frame-clock';
import { PerformanceMetrics } from './performance';

/**
 * @summary Drives a game's fixed-timestep stepping, decoupled from time and rendering.
 *
 * @description
 * `FixedTimestepDriver<G>` integrates each `advance` call's timestamp into its `FrameClock` and
 * then runs `game.step(context)` once per whole step owed, passing the frame's input snapshot and
 * the fixed `dt` (the step interval) into every step. Step count is bounded by `maxSteps` so a long
 * stall cannot spiral into an unbounded catch-up loop; debt beyond the bound is discarded rather
 * than replayed.
 *
 * `interpolation()` returns the sub-frame remainder (the accumulator's `pending`), which the engine
 * uses as the presentation `alpha`. The driver never invokes `present` — the caller drives
 * presentation separately.
 *
 * @template G - The concrete game type; defaults to `IGame`.
 *
 * @example
 * const driver = new FixedTimestepDriver(tetris, 60, host.now());
 * const steps = driver.advance(host.now(), inputState);
 * const alpha = driver.interpolation();
 *
 * @see {@link ISimulationDriver}
 * @see {@link FrameClock}
 * @author MathAid
 */
export class FixedTimestepDriver<G extends IGame = IGame> implements ISimulationDriver<G> {
  readonly #clock: FrameClock;
  readonly #timeClock: IClock;
  readonly #metrics: PerformanceMetrics;
  readonly #game: G;
  readonly #maxSteps: number;
  #lastNow: Timestamp;

  /**
   * @summary Construct a driver for a game at a fixed rate.
   * @param game - The game to step.
   * @param fps - Target simulation steps per second.
   * @param startNanos - Initial timestamp to anchor the clock against, in nanoseconds.
   * @param maxSteps - Maximum steps per `advance` call. Defaults to `MAX_CATCHUP_STEPS`.
   * @param historyCapacity - Number of one-second metric windows to retain. Defaults to
   *   `FPS_CACHE_CAPACITY`.
   * @author MathAid
   */
  constructor(
    game: G,
    fps: number,
    startNanos: Timestamp,
    maxSteps = MAX_CATCHUP_STEPS,
    historyCapacity = FPS_CACHE_CAPACITY,
  ) {
    this.#game = game;
    this.#clock = new FrameClock(SecondMetric.NANOSECONDS / fps, startNanos);
    this.#lastNow = startNanos;
    this.#timeClock = { now: () => this.#lastNow };
    this.#metrics = new PerformanceMetrics(historyCapacity);
    this.#maxSteps = maxSteps;
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
   * @summary The dt applied to every step — the fixed step interval.
   * @author MathAid
   */
  get lastDt(): Nanoseconds {
    return this.#clock.stepInterval;
  }

  /**
   * @summary The accumulator's remaining fraction (also the presentation `alpha`).
   * @author MathAid
   */
  get pendingSteps(): number {
    return this.#clock.pending;
  }

  /**
   * @summary The sub-frame interpolation factor in `[0, 1)`.
   *
   * @description
   * Returns the accumulator's `pending` remainder after whole steps are consumed — the fraction of
   * the next fixed step that has elapsed.
   *
   * @return The interpolation `alpha`.
   * @author MathAid
   */
  interpolation(): Alpha {
    return this.#clock.pending;
  }

  /**
   * @summary Discard accumulated debt and re-anchor the accumulator.
   * @param nowNanos - The timestamp to re-anchor against, in nanoseconds.
   * @author MathAid
   */
  reset(nowNanos: Timestamp): void {
    this.#lastNow = nowNanos;
    this.#clock.reset(nowNanos);
  }

  /**
   * @summary Advance the simulation by a wall-clock sample.
   * @param nowNanos - Current monotonic timestamp, in nanoseconds.
   * @param input - The input snapshot for this frame; shared by every step run.
   * @return The steps actually run (bounded by `maxSteps`) and the aggregate control signal.
   * @author MathAid
   */
  advance(nowNanos: Timestamp, input: IInputState): StepResult {
    this.#lastNow = nowNanos;
    this.#clock.advance(nowNanos);

    let steps = 0;
    let signal: StepSignal = 'continue';
    while (this.#clock.pending >= 1 && steps < this.#maxSteps) {
      const stepSignal = this.#game.step({
        clock: this.#timeClock,
        dt: this.#clock.stepInterval,
        metrics: this.#metrics,
        input,
      });
      this.#clock.consume();
      steps++;

      // Surface any control signal; `skip` and `pause` also stop stepping this frame.
      if (stepSignal !== undefined && stepSignal !== 'continue') {
        signal = stepSignal;
        if (stepSignal === 'skip' || stepSignal === 'pause') break;
      }
    }

    // Discard any debt beyond the catch-up bound so a long stall does not replay.
    if (this.#clock.pending >= 1) this.#clock.reset(nowNanos);

    this.#metrics.record(steps, nowNanos);
    return { steps, signal };
  }
}
