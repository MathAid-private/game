/**
 * @fileoverview
 * @summary Engine contract — the composition root that wires time, simulation, input, and rendering.
 *
 * @description
 * This module defines `IEngine`, the single top-level entry point a host constructs and drives.
 * It composes the orthogonal concerns defined elsewhere — `IFrameClock` / `IPerformanceMetrics`
 * (read-only views), `IInputSource` (attached), and a renderer (set, not attached as a device) —
 * and emits lifecycle events. Internals such as the scheduler and the accumulator stay private:
 * only narrow views are exposed.
 *
 * The renderer type `R` is a generic parameter so the engine core stays decoupled from any
 * rendering package; a host binds it to a concrete renderer when it composes the engine.
 *
 * @author MathAid
 */

import type { IEventEmitter } from './event.type';
import type { IInputSource } from './input.type';
import type { IFrameClock, IGame, IPerformanceMetrics } from './simulation.type';

/**
 * @summary Static, serialisable configuration for an engine instance.
 *
 * @description
 * `IEngineConfig` holds every value a host can set before the engine runs: the simulation rate,
 * how many performance windows to retain, an optional fixed resolution, and whether to request
 * fullscreen. It is plain data — no functions and no runtime references — so it is trivially
 * serialisable and the engine's runtime dependencies stay out of it.
 *
 * @example
 * const config: IEngineConfig = { fps: 60, resolution: { width: 480, height: 640 } };
 *
 * @author MathAid
 */
export interface IEngineConfig {
  /** Target simulation steps per second. */
  readonly fps: number;
  /** Number of one-second windows to retain in `IPerformanceMetrics`. */
  readonly fpsHistory?: number;
  /** Request browser fullscreen when the engine runs. */
  readonly fullscreen?: boolean;
  /** Fixed logical resolution in device-independent pixels. */
  readonly resolution?: { readonly width: number; readonly height: number };
}

/**
 * @summary Lifecycle event map emitted by an engine.
 *
 * @description
 * `EngineEvents` signals engine state transitions. State changes carry no payload; the
 * input-attach and renderer-change events carry their subject so a subscriber can react to a
 * specific input source or render mode. Names are past-tense and domain-neutral, so the same
 * map reads correctly for any game and any environment.
 *
 * @template R - The renderer type; defaults to `unknown`.
 *
 * @see {@link IEngine}
 * @author MathAid
 */
export type EngineEvents<R = unknown> = {
  /** The loop has started. */
  readonly started: void;
  /** The loop has stopped and resources are released. */
  readonly stopped: void;
  /** The engine transitioned from running to paused. */
  readonly paused: void;
  /** The engine transitioned from paused to running, after clock reset. */
  readonly resumed: void;
  /** An input source was attached. */
  readonly inputAttached: { readonly id: string; readonly source: IInputSource };
  /** An input source was detached. */
  readonly inputDetached: { readonly id: string };
  /** The active render mode changed. */
  readonly rendererChanged: { readonly renderer: R };
};

/**
 * @summary The engine composition root.
 *
 * @description
 * `IEngine<G, R>` is the single entry point a host constructs and drives. It owns the simulation
 * driver and the frame driver, exposes read-only `clock` and `metrics`, attaches input sources
 * and a renderer through distinct seams, and reports its lifecycle through `IEventEmitter`.
 *
 * The design keeps the renderer a first-class, swappable dependency (`setRenderer`) rather than
 * a device, and keeps input (`attachInput`) separate from rendering, so neither constrains the
 * other and render modes can be swapped at runtime.
 *
 * @template G - The game type; defaults to `IGame`.
 * @template R - The renderer type; defaults to `unknown` (bound by the host).
 *
 * @example
 * const engine = new Engine(game, config, hostLoop);
 * engine.attachInput(keyboard, 'keyboard-0');
 * engine.setRenderer(canvasRenderer);
 * await engine.run();
 *
 * @see {@link IEngineConfig}
 * @see {@link EngineEvents}
 * @author MathAid
 */
export interface IEngine<G extends IGame = IGame, R = unknown> extends IEventEmitter<
  EngineEvents<R>
> {
  /** Static configuration set at construction. */
  readonly configuration: IEngineConfig;
  /** The game this engine drives. */
  readonly game: G;
  /** Read-only timing view (pending steps, step interval). */
  readonly clock: IFrameClock;
  /** Read-only performance metrics. */
  readonly metrics: IPerformanceMetrics;
  /** Whether the loop is currently paused. */
  readonly paused: boolean;
  /**
   * @summary Attach an input source.
   * @param source - The source that produces input snapshots.
   * @param id - A stable, unique identifier for this source.
   * @return Resolves once the source is attached and registered.
   * @throws {Error} If `id` is already attached.
   * @author MathAid
   */
  attachInput(source: IInputSource, id: string): Promise<void>;
  /**
   * @summary Detach a previously attached input source.
   * @param id - The identifier given at attach time.
   * @return Resolves once the source is detached and unregistered.
   * @author MathAid
   */
  detachInput(id: string): Promise<void>;
  /**
   * @summary Set the active render mode.
   * @param renderer - The renderer that will consume described frames.
   * @author MathAid
   */
  setRenderer(renderer: R): void;
  /**
   * @summary Start the loop.
   * @return Resolves once the first frame is scheduled (not when the engine stops).
   * @author MathAid
   */
  run(): Promise<void>;
  /**
   * @summary Stop the loop and release all resources.
   * @return Resolves after the loop is cancelled and adapters are detached.
   * @author MathAid
   */
  stop(): Promise<void>;
}
