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
 * @example
 * class Physics implements ISimulationStep {
 *   step({ clock, input }: ISimulationContext): void {
 *     if (input.isDown('move-right')) this.x += 1;
 *   }
 * }
 *
 * @see {@link ISimulationContext}
 * @see {@link IPresentable}
 * @author MathAid
 */
export interface ISimulationStep {
  /**
   * @summary Advance the game state by one fixed step.
   * @param context - Timing, metrics, and input for this step.
   * @author MathAid
   */
  step(context: ISimulationContext): void;
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
 * @example
 * class View implements IPresentable<IFrameBuilder> {
 *   present({ frame, alpha }: IPresentationContext<IFrameBuilder>): void {
 *     frame.clear();
 *     frame.rect(this.bounds, this.colour);
 *   }
 * }
 *
 * @see {@link IPresentationContext}
 * @author MathAid
 */
export interface IPresentable<F = unknown> {
  /**
   * @summary Describe the current frame.
   * @param context - The interpolation factor and the frame output to describe.
   * @author MathAid
   */
  present(context: IPresentationContext<F>): void;
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
 *   step(ctx: ISimulationContext): void { /* advance logic *\/ }
 *   present({ frame }: IPresentationContext<IFrameBuilder>): void { /* describe board *\/ }
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
  /**
   * @summary Advance the simulation by a wall-clock sample.
   * @param now - Current monotonic timestamp, in nanoseconds.
   * @param input - The input snapshot for this frame; shared by every step run.
   * @return The number of steps run.
   * @author MathAid
   */
  advance(now: number, input: IInputState): number;
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
