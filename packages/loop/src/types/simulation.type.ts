/**
 * @fileoverview
 * @summary Simulation contracts — fixed-timestep stepping and the game contract.
 *
 * @description
 * This module separates two independent cadences the current code fuses into one: *simulation*
 * (fixed, deterministic steps) and *presentation* (per-display-frame output). `IFrameClock`
 * accumulates wall time into whole steps; `ISimulationDriver` runs `ISimulationStep.step` once
 * per whole step; `IGame` combines stepping with `IPresentable.present`, which describes a frame
 * as data. Presentation is driven elsewhere so physics and render rates can differ.
 *
 * The game contract is generic over its presentation output (`IGame<F>`), so the engine core
 * stays decoupled from any specific renderer: a 2D game binds `F` to a frame builder, while a
 * headless game uses the `unknown` default and never depends on a graphics package.
 *
 * @author MathAid
 */

import type { IClock, Nanoseconds } from './clock.type';
import type { IInputState } from './input.type';

/**
 * @summary A normalised sub-step remainder in the half-open interval [0, 1).
 *
 * @description
 * `Alpha` is the fraction of the next simulation step that has elapsed at presentation time. A
 * value of `0` means presentation happens exactly on a step boundary; a value approaching `1`
 * means the next step is about to fire. Games use it to interpolate between the previous and
 * current step states for smooth motion.
 *
 * @example
 * const drawX = lerp(prevX, currentX, alpha);
 *
 * @author MathAid
 */
export type Alpha = number;

/**
 * @summary A control signal a game's `step` returns to direct how the engine steps next.
 *
 * @description
 * `StepSignal` is the return channel by which a game influences the *loop cadence* without ever
 * touching the scheduler. Each value is a declarative request the engine interprets:
 *
 * - `'continue'` — step normally (the default; also what a `void` return means).
 * - `'pause'` — request the engine halt the loop (authority stays with the engine).
 * - `'resume'` — request the engine resume a halted loop.
 * - `'skip'` — stop stepping for the rest of this frame (a cut scene: no further world advance).
 * - `'throttle'` — halve the step rate going forward (frame dropping), until `'continue'` is
 *   returned again.
 *
 * Because the game only *requests* these, the engine remains the single authority over pause and
 * cadence — see {@link ISimulationStep} and `Engine`.
 *
 * @author MathAid
 */
export type StepSignal = 'continue' | 'pause' | 'resume' | 'skip' | 'throttle';

/**
 * @summary A control signal a game's `present` returns to direct how often the engine renders.
 *
 * @description
 * `PresentSignal` lets a game reduce rendering without touching the loop: a paused menu renders at
 * a lower rate (`'reduced'`), a hidden scene renders not at all (`'none'`), and normal play renders
 * every frame (`'full'`, the default and the meaning of a `void` return). The engine persists the
 * last signal and applies it as a render divisor, so `'reduced'`/`'none'` hold until the game
 * signals otherwise.
 *
 * @author MathAid
 */
export type PresentSignal = 'full' | 'reduced' | 'none';

/**
 * @summary The result of one `advance` call: the step count and the control signal to apply next.
 *
 * @description
 * `StepResult` pairs how many simulation steps actually ran with the `StepSignal` the engine
 * should act on. The `signal` is the *aggregate* of the steps run this frame — the last
 * non-`'continue'` signal, or `'continue'` when every step returned `'continue'`/`void`. `'skip'`
 * and `'pause'` stop the stepping loop early and are surfaced here so the engine can react.
 *
 * @see {@link ISimulationDriver}
 * @author MathAid
 */
export interface StepResult {
  /** Simulation steps actually run this frame. */
  readonly steps: number;
  /** The control signal to apply (the last non-continue signal, else `'continue'`). */
  readonly signal: StepSignal;
}

/**
 * @summary Accumulates wall time into whole, fixed-size simulation steps.
 *
 * @description
 * `IFrameClock` is the fixed-timestep core: it integrates elapsed wall time into a pending-step
 * accumulator and lets a driver `consume` one whole step at a time. It carries no events and no
 * metrics — only timing — so a consumer that needs "how many steps are owed" depends on this
 * narrow contract and nothing more.
 *
 * `advance` adds time; `consume` removes exactly one step; `reset` drops accumulated debt (used
 * on resume after a pause, so the pause is not replayed as a burst of catch-up).
 *
 * @example
 * clock.advance(now);
 * while (clock.pending >= 1) { game.step(context); clock.consume(); }
 *
 * @see {@link ISimulationDriver}
 * @author MathAid
 */
export interface IFrameClock {
  /** Nanoseconds per fixed simulation step, at the configured rate. */
  readonly stepInterval: number;
  /** Whole steps currently owed (≥ 0). */
  readonly pending: number;
  /**
   * @summary Add elapsed wall time to the accumulator.
   * @param now - Current monotonic timestamp, in nanoseconds.
   * @author MathAid
   */
  advance(now: number): void;
  /**
   * @summary Take exactly one whole step, decrementing `pending` by one.
   * @author MathAid
   */
  consume(): void;
  /**
   * @summary Discard accumulated debt and re-anchor to a fresh timestamp.
   * @param now - The timestamp to re-anchor against, in nanoseconds.
   * @author MathAid
   */
  reset(now: number): void;
}

/**
 * @summary One completed one-second measurement window.
 *
 * @description
 * `FrameMetric` records how many simulation steps ran inside a closed one-second window. It is
 * the unit of `IPerformanceMetrics.frameHistory`, written once per second and retained as a
 * fixed-capacity ring so recent performance is always inspectable.
 *
 * @see {@link IPerformanceMetrics}
 * @author MathAid
 */
export interface FrameMetric {
  /** Absolute timestamp when the window closed, in nanoseconds. */
  readonly timestamp: number;
  /** Simulation steps counted within the window. */
  readonly steps: number;
}

/**
 * @summary Read-only performance observability, separated from the clock.
 *
 * @description
 * `IPerformanceMetrics` exposes the engine's recent step history without exposing any timing
 * mechanics. It is consumed by HUD overlays, profilers, and debug surfaces, and is independent
 * of `IFrameClock` so an observer never needs (or gets) the ability to mutate timing.
 *
 * @example
 * const fps = metrics.frameHistory.at(-1)?.steps ?? 0;
 *
 * @see {@link FrameMetric}
 * @author MathAid
 */
export interface IPerformanceMetrics {
  /** Recent completed one-second windows, oldest first (may contain holes early on). */
  readonly frameHistory: readonly FrameMetric[];
  /** Timestamp of the most recent clock sample, in nanoseconds. */
  readonly lastTimestamp: number;
}

/**
 * @summary A per-frame snapshot of live engine metrics for a HUD or profiler.
 *
 * @description
 * `LiveMetrics` is a plain-data snapshot the engine computes once per frame (and emits as a
 * `metrics` event) so a host can render FPS, interpolation, and timing live without polling
 * internal state. `fps` is the step count of the most recently closed one-second window (so it is
 * `0` until the first full second completes); `pendingSteps` is the fixed accumulator's remainder
 * (equal to `alpha` for a fixed driver, `0` for non-fixed drivers).
 *
 * @see {@link IPerformanceMetrics}
 * @author MathAid
 */
export interface LiveMetrics {
  /** Steps in the most recently closed one-second window (`0` early on). */
  readonly fps: number;
  /** Current sub-frame interpolation factor in `[0, 1)`. */
  readonly alpha: Alpha;
  /** The dt applied to the most recent step, in nanoseconds. */
  readonly dtNanos: Nanoseconds;
  /** The accumulator remainder (fixed drivers); `0` otherwise. */
  readonly pendingSteps: number;
  /** Wall time elapsed since the engine started, in nanoseconds. */
  readonly elapsedNanos: Nanoseconds;
}

/**
 * @summary The context handed to a game during one simulation step.
 *
 * @description
 * `ISimulationContext` is everything a step may read: the frame clock, performance metrics, and
 * the frame's input snapshot. It is read-only and frame-scoped; a game must not retain it
 * beyond the step call. Passing one context object (rather than an opaque device record) keeps
 * the step signature stable as the engine grows.
 *
 * @see {@link ISimulationStep}
 * @author MathAid
 */
export interface ISimulationContext {
  /** The time source (monotonic `now()`). */
  readonly clock: IClock;
  /** Elapsed time for this step, in nanoseconds. */
  readonly dt: Nanoseconds;
  /** Read-only performance metrics. */
  readonly metrics: IPerformanceMetrics;
  /** The logical input snapshot for this frame. */
  readonly input: IInputState;
}

/**
 * @summary One fixed-timestep simulation step.
 *
 * @description
 * `ISimulationStep` is the simulation half of a game. `step` runs once per whole step owed and
 * advances the game's own state deterministically. It must not read wall time, call browser
 * APIs, or touch rendering — it only transforms state given its context, which is what makes the
 * simulation reproducible and testable.
 *
 * `step` may return a {@link StepSignal} to steer the loop cadence (pause, skip, throttle); a
 * `void` return is treated as `'continue'`.
 *
 * @example
 * class Physics implements ISimulationStep {
 *   step({ clock, input }: ISimulationContext): StepSignal | void {
 *     if (input.isDown('move-right')) this.x += 1;
 *     return this.x > WIN ? 'pause' : 'continue';
 *   }
 * }
 *
 * @see {@link ISimulationContext}
 * @see {@link StepSignal}
 * @see {@link IPresentable}
 * @author MathAid
 */
export interface ISimulationStep {
  /**
   * @summary Advance the game state by one fixed step.
   * @param context - Timing, metrics, and input for this step.
   * @return An optional control signal directing the next step(s); `void` means `'continue'`.
   * @author MathAid
   */
  step(context: ISimulationContext): StepSignal | void;
}

/**
 * @summary The context handed to a game during one presentation pass.
 *
 * @description
 * `IPresentationContext` carries the interpolation `alpha` and the frame output `F` into which
 * the game emits its draw intent. `F` is generic so the engine core imposes no renderer: a
 * renderer-bound game receives a frame builder, a headless game receives `unknown`. Presentation
 * is the *declarative* half — the game describes, it does not draw.
 *
 * @template F - The presentation output type (e.g. a frame builder). Defaults to `unknown`.
 *
 * @see {@link IPresentable}
 * @author MathAid
 */
export interface IPresentationContext<F = unknown> {
  /** Sub-step remainder in [0, 1) for interpolation. */
  readonly alpha: Alpha;
  /** The frame output the game describes. */
  readonly frame: F;
}

/**
 * @summary The presentation half of a game: describe one frame as data.
 *
 * @description
 * `IPresentable<F>` is called once per display frame (after all steps for that frame) and
 * receives an `IPresentationContext<F>`. The game emits render commands into `context.frame`;
 * it never draws to a concrete graphics API. This is the seam that makes render modes swappable:
 * the game output is identical regardless of which renderer ultimately consumes it.
 *
 * @template F - The presentation output type. Defaults to `unknown` for headless use.
 *
 * `present` may return a {@link PresentSignal} to request a lower render rate (`'reduced'`) or no
 * rendering (`'none'`); a `void` return is treated as `'full'`.
 *
 * @example
 * class View implements IPresentable<IFrameBuilder> {
 *   present({ frame, alpha }: IPresentationContext<IFrameBuilder>): PresentSignal {
 *     frame.clear();
 *     frame.rect(this.bounds, this.colour);
 *     return this.visible ? 'full' : 'none';
 *   }
 * }
 *
 * @see {@link IPresentationContext}
 * @see {@link PresentSignal}
 * @author MathAid
 */
export interface IPresentable<F = unknown> {
  /**
   * @summary Describe the current frame.
   * @param context - The interpolation factor and the frame output to describe.
   * @return An optional control signal directing rendering frequency; `void` means `'full'`.
   * @author MathAid
   */
  present(context: IPresentationContext<F>): PresentSignal | void;
}

/**
 * @summary A game: a deterministic simulation step plus a declarative presentation pass.
 *
 * @description
 * `IGame<F>` composes `ISimulationStep` and `IPresentable<F>`. It is the single contract a game
 * author implements and the single thing the engine core drives. Because the two halves are
 * separate interfaces invoked at separate cadences, a game's simulation is deterministic and its
 * presentation is renderer-agnostic.
 *
 * @template F - The presentation output type. Defaults to `unknown`.
 *
 * @example
 * class Tetris implements IGame<IFrameBuilder> {
 *   step(ctx: ISimulationContext): StepSignal | void { /* advance logic *\/ }
 *   present({ frame }: IPresentationContext<IFrameBuilder>): PresentSignal | void { /* describe board *\/ }
 * }
 *
 * @see {@link ISimulationStep}
 * @see {@link IPresentable}
 * @author MathAid
 */
export interface IGame<F = unknown> extends ISimulationStep, IPresentable<F> {}

/**
 * @summary Drives fixed-timestep stepping over a game, knowing nothing of rendering.
 *
 * @description
 * `ISimulationDriver<G>` is the timing-only half of the engine loop. `advance(now, input)`
 * integrates the new timestamp and runs `game.step()` once per whole step owed, passing the
 * frame's input snapshot into each step. It exposes `clock` and `metrics` read-only and the
 * `game` it drives, but never invokes presentation — the caller samples input and drives
 * presentation separately. This separation is what later lets a physics loop run at one rate
 * while rendering runs at another.
 *
 * @template G - The concrete game type; defaults to `IGame`.
 *
 * @example
 * driver.advance(host.now()); // runs 0..N game.step() calls
 *
 * @see {@link IFrameClock}
 * @see {@link IFrameDriver}
 * @author MathAid
 */
export interface ISimulationDriver<G extends IGame = IGame> {
  /** Read-only performance metrics. */
  readonly metrics: IPerformanceMetrics;
  /** The game being driven. */
  readonly game: G;
  /** The dt applied to the most recent step, in nanoseconds. */
  readonly lastDt: Nanoseconds;
  /** The fixed accumulator's remaining fraction (`0` for non-fixed drivers). */
  readonly pendingSteps: number;
  /**
   * @summary Advance the simulation by a wall-clock sample.
   * @param now - Current monotonic timestamp, in nanoseconds.
   * @param input - The input snapshot for this frame; shared by every step run.
   * @return The steps run plus the aggregate {@link StepSignal} for the caller to apply.
   * @author MathAid
   */
  advance(now: number, input: IInputState): StepResult;
  /**
   * @summary The sub-frame interpolation factor in `[0, 1)` for presentation.
   * @author MathAid
   */
  interpolation(): Alpha;
  /**
   * @summary Discard accumulated debt and re-anchor to a fresh timestamp.
   * @param now - The timestamp to re-anchor against, in nanoseconds.
   * @author MathAid
   */
  reset(now: number): void;
}

/**
 * @summary Runs one host frame: steps the simulation, then presents once.
 *
 * @description
 * `IFrameDriver` is the presentation half of the engine loop, typically implemented by the
 * engine composition root. `frame(now)` advances the simulation and then invokes the game's
 * `present` exactly once with the current `alpha`, handing the described frame to the active
 * renderer. It is a single method so the whole per-frame orchestration is one seam.
 *
 * @example
 * engineDriver.frame(host.now());
 *
 * @see {@link ISimulationDriver}
 * @author MathAid
 */
export interface IFrameDriver {
  /**
   * @summary Execute one complete frame.
   * @param now - Current monotonic timestamp, in nanoseconds.
   * @author MathAid
   */
  frame(now: number): void;
}
