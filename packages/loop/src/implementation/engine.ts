/**
 * @fileoverview
 * @summary The engine — the composition root wiring clock, simulation, input, and presentation.
 *
 * @description
 * This module provides `Engine`, the concrete `IEngine` that owns a `FixedTimestepDriver`, a
 * host loop, an input registry, a swappable renderer, and pause/lifecycle state. It is the single
 * object a host constructs and drives, and it is where the orthogonal concerns defined elsewhere
 * are finally composed.
 *
 * Presentation is deliberately *not* hard-wired: the engine steps the simulation and then
 * delegates "describe and draw a frame" to an optional `PresentFrame` callback, keeping the core
 * renderer-agnostic. A headless engine (no callback) runs simulation only — ideal for tests.
 *
 * @author MathAid
 */

import { FPS_CACHE_CAPACITY, MAX_CATCHUP_STEPS } from '../const';
import type {
  Alpha,
  EngineEvents,
  IEngine,
  IEngineConfig,
  IGame,
  IHostLoop,
  IInputSource,
  IInputState,
  IScheduleHandle,
} from '../types';
import { EventEmitter } from './event-emitter';
import { CompositeInputState, NullInputState } from './input';
import { FixedTimestepDriver } from './simulation-driver';

/**
 * @summary The render-aware glue that describes and draws one frame.
 *
 * @description
 * `PresentFrame` is the callback the engine invokes once per frame, after stepping, with the
 * game, the interpolation `alpha`, and the current renderer. It is the seam where a concrete
 * render layer builds a frame (via an `IFrameBuilder`) and hands it to the renderer. Supplying it
 * is optional: without it the engine is headless and runs simulation only.
 *
 * @template G - The game type.
 * @template R - The renderer type.
 *
 * @example
 * const present: PresentFrame<MyGame, IRenderer> = ({ game, alpha, renderer }) => {
 *   const builder = new FrameBuilder();
 *   game.present({ alpha, frame: builder });
 *   renderer?.render(builder.build());
 * };
 *
 * @see {@link Engine}
 * @author MathAid
 */
export type PresentFrame<G extends IGame = IGame, R = unknown> = (context: {
  readonly game: G;
  readonly alpha: Alpha;
  readonly renderer: R | null;
}) => void;

/**
 * @summary The engine composition root.
 *
 * @description
 * `Engine<G, R>` owns the fixed-timestep driver, the host loop, the input registry, and the
 * active renderer, and emits lifecycle events. Each scheduled frame it: samples all attached
 * input sources, advances the simulation, and (when a presenter is configured) delegates
 * presentation. Pausing skips stepping and, on resume, resets the clock so the pause is not
 * replayed as a catch-up burst.
 *
 * The renderer is set through `setRenderer` and is a first-class, swappable dependency — a
 * render mode is just an `R` handed in at runtime. Input is attached separately through
 * `attachInput`, so neither constrains the other.
 *
 * @template G - The game type; defaults to `IGame`.
 * @template R - The renderer type; defaults to `unknown`.
 *
 * @example
 * const engine = new Engine(tetris, { fps: 60 }, browserHost, present);
 * engine.attachInput(keyboard, 'keyboard-0');
 * engine.setRenderer(canvasRenderer);
 * await engine.run();
 *
 * @see {@link IEngine}
 * @see {@link PresentFrame}
 * @author MathAid
 */
export class Engine<G extends IGame = IGame, R = unknown> implements IEngine<G, R> {
  readonly #emitter = new EventEmitter<EngineEvents<R>>();
  readonly #config: IEngineConfig;
  readonly #game: G;
  readonly #host: IHostLoop;
  readonly #simulation: FixedTimestepDriver<G>;
  readonly #present: PresentFrame<G, R> | null;
  readonly #inputs = new Map<string, IInputSource>();
  #renderer: R | null = null;
  #paused = false;
  #handle: IScheduleHandle | null = null;

  on = this.#emitter.on.bind(this.#emitter) as IEngine<G, R>['on'];
  off = this.#emitter.off.bind(this.#emitter) as IEngine<G, R>['off'];
  emit = this.#emitter.emit.bind(this.#emitter) as IEngine<G, R>['emit'];

  /**
   * @summary Construct an engine over a game, configuration, and host loop.
   * @param game - The game to drive.
   * @param config - Static engine configuration.
   * @param host - The clock + scheduler the loop runs on.
   * @param present - Optional render glue called once per frame; omit for headless use.
   * @author MathAid
   */
  constructor(game: G, config: IEngineConfig, host: IHostLoop, present?: PresentFrame<G, R>) {
    this.#game = game;
    this.#config = config;
    this.#host = host;
    this.#present = present ?? null;
    this.#simulation = new FixedTimestepDriver(
      game,
      config.fps,
      host.now(),
      MAX_CATCHUP_STEPS,
      config.fpsHistory ?? FPS_CACHE_CAPACITY,
    );
  }

  /**
   * @summary Static configuration set at construction.
   * @author MathAid
   */
  get configuration(): IEngineConfig {
    return this.#config;
  }

  /**
   * @summary The game this engine drives.
   * @author MathAid
   */
  get game(): G {
    return this.#game;
  }

  /**
   * @summary Read-only timing view (pending steps, step interval).
   * @author MathAid
   */
  get clock() {
    return this.#simulation.clock;
  }

  /**
   * @summary Read-only performance metrics.
   * @author MathAid
   */
  get metrics() {
    return this.#simulation.metrics;
  }

  /**
   * @summary Whether the loop is currently paused.
   * @author MathAid
   */
  get paused(): boolean {
    return this.#paused;
  }

  /**
   * @summary Pause or resume the loop.
   * @param value - `true` to pause; `false` to resume.
   * @author MathAid
   */
  set paused(value: boolean) {
    if (value === this.#paused) return;
    if (value) {
      this.#paused = true;
      this.#emitter.emit('paused');
    } else {
      this.#simulation.clock.reset(this.#host.now());
      this.#paused = false;
      this.#emitter.emit('resumed');
    }
  }

  /**
   * @summary Attach an input source.
   * @param source - The source that produces input snapshots.
   * @param id - A stable, unique identifier for this source.
   * @return Resolves once the source is attached.
   * @throws {Error} If `id` is already attached.
   * @author MathAid
   */
  async attachInput(source: IInputSource, id: string): Promise<void> {
    if (this.#inputs.has(id)) throw new Error(`Input source "${id}" is already attached`);
    this.#inputs.set(id, source);
    this.#emitter.emit('inputAttached', { id, source });
  }

  /**
   * @summary Detach a previously attached input source.
   * @param id - The identifier given at attach time.
   * @return Resolves once the source is detached; a no-op if unknown.
   * @author MathAid
   */
  async detachInput(id: string): Promise<void> {
    if (!this.#inputs.delete(id)) return;
    this.#emitter.emit('inputDetached', { id });
  }

  /**
   * @summary Set the active render mode.
   * @param renderer - The renderer that will consume described frames.
   * @author MathAid
   */
  setRenderer(renderer: R): void {
    this.#renderer = renderer;
    this.#emitter.emit('rendererChanged', { renderer });
  }

  /**
   * @summary Start the loop.
   * @return Resolves once the first frame is scheduled (not when the engine stops).
   * @author MathAid
   */
  async run(): Promise<void> {
    const loop = () => {
      if (!this.#paused) {
        const nowNanos = this.#host.now();
        const input = this.#sampleInput();
        this.#simulation.advance(nowNanos, input);
        this.#present?.({
          game: this.#game,
          alpha: this.#simulation.clock.pending,
          renderer: this.#renderer,
        });
      }
      this.#handle = this.#host.schedule(loop);
    };

    this.#handle = this.#host.schedule(loop);
    this.#emitter.emit('started');
  }

  /**
   * @summary Stop the loop and release resources.
   * @return Resolves after the loop is cancelled and listeners cleared.
   * @author MathAid
   */
  async stop(): Promise<void> {
    if (this.#handle === null) return;
    this.#host.cancel(this.#handle);
    this.#handle = null;
    this.#emitter.emit('stopped');
    this.#emitter.clear();
  }

  /**
   * @summary Sample every attached source into one logical input snapshot.
   * @return The merged snapshot, or `NullInputState` when none are attached.
   * @author MathAid
   */
  #sampleInput(): IInputState {
    if (this.#inputs.size === 0) return NullInputState.INSTANCE;
    const states = Array.from(this.#inputs.values(), (source) => source.sample());
    return states.length === 1 ? states[0] : new CompositeInputState(states);
  }
}
