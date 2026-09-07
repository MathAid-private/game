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

import { FPS_CACHE_CAPACITY, MAX_CATCHUP_STEPS, SecondMetric } from '../const';
import type {
  Alpha,
  IAudioSink,
  IClock,
  IGame,
  IInputState,
  ISimulationDriver,
  Nanoseconds,
  StepResult,
  StepSignal,
  Timestamp,
} from '../types';
import { NoopAudioSink } from '../audio/noop-audio-sink';
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
  #lastDt = 0;
  #audio: IAudioSink = NoopAudioSink.INSTANCE;

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
   * @summary The dt applied to the most recent step.
   * @author MathAid
   */
  get lastDt(): Nanoseconds {
    return this.#lastDt;
  }

  /**
   * @summary Always `0` — a variable driver has no fixed accumulator.
   * @author MathAid
   */
  get pendingSteps(): number {
    return 0;
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
   * @summary Bind the audio sink supplied to each step's context.
   * @param sink - The sink game sound requests are forwarded to.
   * @author MathAid
   */
  setAudio(sink: IAudioSink): void {
    this.#audio = sink;
  }

  /**
   * @summary Advance the simulation by one real-time frame.
   * @param nowNanos - Current monotonic timestamp, in nanoseconds.
   * @param input - The input snapshot for this frame.
   * @return One step plus the step's control signal.
   * @author MathAid
   */
  advance(nowNanos: Timestamp, input: IInputState): StepResult {
    const dt = nowNanos - this.#lastNow;
    this.#lastNow = nowNanos;
    this.#lastDt = dt;
    const signal = this.#game.step({
      clock: this.#timeClock,
      dt,
      metrics: this.#metrics,
      input,
      audio: this.#audio,
    });
    this.#metrics.record(1, nowNanos);
    return { steps: 1, signal: signal ?? 'continue' };
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
  #lastDt = 0;
  #audio: IAudioSink = NoopAudioSink.INSTANCE;

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
   * @summary The (clamped) dt applied to the most recent step.
   * @author MathAid
   */
  get lastDt(): Nanoseconds {
    return this.#lastDt;
  }

  /**
   * @summary Always `0` — a variable driver has no fixed accumulator.
   * @author MathAid
   */
  get pendingSteps(): number {
    return 0;
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
   * @summary Bind the audio sink supplied to each step's context.
   * @param sink - The sink game sound requests are forwarded to.
   * @author MathAid
   */
  setAudio(sink: IAudioSink): void {
    this.#audio = sink;
  }

  /**
   * @summary Advance the simulation by one frame, with `dt` clamped to `maxDt`.
   * @param nowNanos - Current monotonic timestamp, in nanoseconds.
   * @param input - The input snapshot for this frame.
   * @return One step plus the step's control signal.
   * @author MathAid
   */
  advance(nowNanos: Timestamp, input: IInputState): StepResult {
    let dt = nowNanos - this.#lastNow;
    if (dt > this.#maxDt) dt = this.#maxDt;
    this.#lastNow = nowNanos;
    this.#lastDt = dt;
    const signal = this.#game.step({
      clock: this.#timeClock,
      dt,
      metrics: this.#metrics,
      input,
      audio: this.#audio,
    });
    this.#metrics.record(1, nowNanos);
    return { steps: 1, signal: signal ?? 'continue' };
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
  #audio: IAudioSink = NoopAudioSink.INSTANCE;

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
   * @summary Always `0` — an event step carries no time delta.
   * @author MathAid
   */
  get lastDt(): Nanoseconds {
    return 0;
  }

  /**
   * @summary Always `0` — event-driven stepping has no accumulator.
   * @author MathAid
   */
  get pendingSteps(): number {
    return 0;
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
   * @summary Bind the audio sink supplied to each step's context.
   * @param sink - The sink game sound requests are forwarded to.
   * @author MathAid
   */
  setAudio(sink: IAudioSink): void {
    this.#audio = sink;
  }

  /**
   * @summary A time-driven no-op — re-anchors the clock and runs zero steps.
   * @param nowNanos - Current monotonic timestamp, in nanoseconds.
   * @param input - The input snapshot (unused — no step runs).
   * @return Zero steps with a `'continue'` signal — time never advances the simulation.
   * @author MathAid
   */
  advance(nowNanos: Timestamp, _input: IInputState): StepResult {
    this.#lastNow = nowNanos;
    this.#metrics.record(0, nowNanos);
    return { steps: 0, signal: 'continue' };
  }

  /**
   * @summary Run exactly one simulation step on an explicit event.
   * @param input - The input snapshot for this step.
   * @return One step plus the step's control signal.
   * @author MathAid
   */
  step(input: IInputState): StepResult {
    const signal = this.#game.step({
      clock: this.#timeClock,
      dt: 0,
      metrics: this.#metrics,
      input,
      audio: this.#audio,
    });
    this.#metrics.record(1, this.#lastNow);
    return { steps: 1, signal: signal ?? 'continue' };
  }
}

/**
 * @summary Weight of the newest frame-time sample in the exponential moving average.
 * @author MathAid
 */
const EMA_SMOOTHING = 0.1;
/**
 * @summary Lower bound of the adaptive interval as a factor of the target interval.
 * @author MathAid
 */
const MIN_INTERVAL_FACTOR = 0.25;
/**
 * @summary Upper bound of the adaptive interval as a factor of the target interval.
 * @author MathAid
 */
const MAX_INTERVAL_FACTOR = 4;

/**
 * @summary A self-stabilising variable-timestep driver whose interval tracks the frame time.
 *
 * @description
 * `AdaptiveTimestepDriver` is a variable-timestep strategy that keeps its step interval tracking
 * an exponential moving average of the measured frame time, clamped to `[target/4, target×4]`.
 * When frames slow down the interval grows (fewer, coarser steps); when they speed up it shrinks
 * (finer steps) — so the simulation self-stabilises toward real time without the spike blow-ups of
 * a raw variable timestep. Debt beyond the upper bound is discarded rather than replayed.
 * `interpolation()` is `0` (state is already at the latest time).
 *
 * @template G - The concrete game type; defaults to `IGame`.
 *
 * @example
 * const driver = new AdaptiveTimestepDriver(game, 60, host.now());
 *
 * @see {@link ISimulationDriver}
 * @author MathAid
 */
export class AdaptiveTimestepDriver<G extends IGame = IGame> implements ISimulationDriver<G> {
  readonly #metrics: PerformanceMetrics;
  readonly #game: G;
  readonly #timeClock: IClock;
  readonly #target: number;
  #interval: number;
  #ema = 0;
  #accumulator = 0;
  #lastNow: Timestamp;
  #lastDt = 0;
  #audio: IAudioSink = NoopAudioSink.INSTANCE;

  /**
   * @summary Construct an adaptive driver.
   * @param game - The game to step.
   * @param fps - The target simulation rate (the interval's anchor).
   * @param startNanos - Initial timestamp to anchor against, in nanoseconds.
   * @param historyCapacity - Number of one-second metric windows to retain. Defaults to
   *   `FPS_CACHE_CAPACITY`.
   * @author MathAid
   */
  constructor(game: G, fps: number, startNanos: Timestamp, historyCapacity = FPS_CACHE_CAPACITY) {
    this.#game = game;
    this.#target = SecondMetric.NANOSECONDS / fps;
    this.#interval = this.#target;
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
   * @summary The (adaptive) dt applied to the most recent step.
   * @author MathAid
   */
  get lastDt(): Nanoseconds {
    return this.#lastDt;
  }

  /**
   * @summary Always `0` — the adaptive accumulator is exposed via `lastDt` instead.
   * @author MathAid
   */
  get pendingSteps(): number {
    return 0;
  }

  /**
   * @summary The sub-frame interpolation factor — always `0`.
   * @author MathAid
   */
  interpolation(): Alpha {
    return 0;
  }

  /**
   * @summary Re-anchor the clock and reset the accumulator and interval to the target.
   * @param nowNanos - The timestamp to re-anchor against, in nanoseconds.
   * @author MathAid
   */
  reset(nowNanos: Timestamp): void {
    this.#lastNow = nowNanos;
    this.#accumulator = 0;
    this.#ema = 0;
    this.#interval = this.#target;
  }

  /**
   * @summary Bind the audio sink supplied to each step's context.
   * @param sink - The sink game sound requests are forwarded to.
   * @author MathAid
   */
  setAudio(sink: IAudioSink): void {
    this.#audio = sink;
  }

  /**
   * @summary Advance the simulation, tracking the frame time to adapt the step interval.
   * @param nowNanos - Current monotonic timestamp, in nanoseconds.
   * @param input - The input snapshot for this frame.
   * @return The steps run plus the aggregate control signal.
   * @author MathAid
   */
  advance(nowNanos: Timestamp, input: IInputState): StepResult {
    const elapsed = nowNanos - this.#lastNow;
    this.#lastNow = nowNanos;

    // The interval tracks the smoothed frame time, clamped around the target rate.
    this.#ema = this.#ema === 0 ? elapsed : this.#ema * (1 - EMA_SMOOTHING) + elapsed * EMA_SMOOTHING;
    this.#interval = Math.min(
      this.#target * MAX_INTERVAL_FACTOR,
      Math.max(this.#target * MIN_INTERVAL_FACTOR, this.#ema),
    );

    this.#accumulator += elapsed;
    let steps = 0;
    let signal: StepSignal = 'continue';
    while (this.#accumulator >= this.#interval && steps < MAX_CATCHUP_STEPS) {
      this.#lastDt = this.#interval;
      const stepSignal = this.#game.step({
        clock: this.#timeClock,
        dt: this.#interval,
        metrics: this.#metrics,
        input,
        audio: this.#audio,
      });
      this.#accumulator -= this.#interval;
      steps++;
      if (stepSignal !== undefined && stepSignal !== 'continue') {
        signal = stepSignal;
        if (stepSignal === 'skip' || stepSignal === 'pause') break;
      }
    }

    // Discard debt beyond the upper bound so a stall cannot replay as a burst.
    if (this.#accumulator > this.#target * MAX_INTERVAL_FACTOR) this.#accumulator = 0;

    this.#metrics.record(steps, nowNanos);
    return { steps, signal };
  }
}
