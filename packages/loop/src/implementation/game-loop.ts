/**
 * @fileoverview
 * @summary Concrete implementations of `IGamePerformance`, `IDeltaAccumulator`, and `IGameEnvironment`.
 *
 * @description
 * This module contains the three classes that form the runtime game loop:
 *
 * - `GamePerformance` — fixed-timestep clock with an FPS ring buffer.
 *   Emits `'tick'` every host tick and `'fps-reset'` once per second.
 *
 * - `DeltaAccumulator` — drives `IGameLogic.update` and `.render` from
 *   the accumulated delta. Emits `'update'` per simulation step and
 *   `'render'` per host tick.
 *
 * - `GameEnvironment` — owns the host handle, device registry, accumulator, and
 *   pause state. Emits the full `GameEvents` map across its lifecycle.
 *
 * Each class composes an `EventEmitter` as a private field and binds
 * `on`/`off`/`emit` to it, keeping the inheritance chain free.
 *
 * @see {@linkcode EventEmitter}
 * @see {@linkcode IGamePerformance}
 * @see {@linkcode IDeltaAccumulator}
 * @see {@linkcode IGameEnvironment}
 *
 * @author MathAid
 */
import { FPS_CACHE_CAPACITY, SecondMetric } from '../const';
import type {
  DeltaAccumulatorEvents,
  GameEvents,
  GamePerformanceEvents,
  IDeltaAccumulator,
  IFrameData,
  IGameDevice,
  IGameEnvironment,
  IGameLogic,
  IGamePerformance,
  IGameReadable,
  IGameRenderingHost,
  IGameSetting,
  IGameWritable,
  IRunOptions,
} from '../types/game.type';
import { EventEmitter } from './event-emitter';

// ── GamePerformance ───────────────────────────────────────────────

/**
 * @summary Fixed-timestep clock with per-second FPS history.
 *
 * @description
 * Maintains the delta accumulator, a raw nanosecond frame timer for
 * FPS measurement, and a fixed-capacity ring buffer of completed
 * one-second windows.
 *
 * Emits two events (via a private `EventEmitter` field):
 * - `'tick'`      — every call to `tick()`, carrying delta/current/elapsed.
 * - `'fps-reset'` — once per second when `tryResetFrame` closes a window.
 *
 * @implements {IGamePerformance}
 *
 * @note
 * `'tick'` handlers run on the hot path. Keep them allocation-free.
 * Use `'fps-reset'` for HUD or overlay updates instead.
 *
 * @example
 * const perf = new GamePerformance(60, nanoTime());
 * perf.on('fps-reset', ({ frames }) => console.log(`FPS: ${frames}`));
 *
 * @author MathAid
 */
export class GamePerformance implements IGamePerformance {
  // ── Clock state ──────────────────────────────────────────────
  readonly #renderingInterval: number;
  #delta = 0;
  #updatedAt: number;
  #current = 0;

  // ── FPS ring buffer ──────────────────────────────────────────
  readonly #fps: IFrameData[];
  #frameTimer = 0;
  #frames = 0;
  #frameIndex = 0;
  readonly #capacity: number;

  // ── Events ───────────────────────────────────────────────────
  readonly #emitter = new EventEmitter<GamePerformanceEvents>();

  /**
   * @param fps        - Target simulation frames per second.
   * @param startNano  - Nanosecond timestamp at construction (from `IGameRenderingHost.now()`).
   * @param capacity   - Ring buffer capacity. Defaults to `FPS_CACHE_CAPACITY`.
   */
  constructor(fps: number, startNano: number, capacity = FPS_CACHE_CAPACITY) {
    this.#renderingInterval = SecondMetric.NANOSECONDS / fps;
    this.#updatedAt = startNano;
    this.#capacity = capacity;
    this.#fps = new Array<IFrameData>(capacity);
  }

  // ── IGamePerformance (read-only state) ───────────────────────

  get renderingInterval() {
    return this.#renderingInterval;
  }
  get delta() {
    return this.#delta;
  }
  get updatedAt() {
    return this.#updatedAt;
  }
  get current() {
    return this.#current;
  }
  get fps(): readonly IFrameData[] {
    return this.#fps;
  }

  // ── IEventEmitter<GamePerformanceEvents> ─────────────────────

  on = this.#emitter.on.bind(this.#emitter) as IGamePerformance['on'];
  off = this.#emitter.off.bind(this.#emitter) as IGamePerformance['off'];
  emit = this.#emitter.emit.bind(this.#emitter) as IGamePerformance['emit'];

  // ── Clock operations (called by DeltaAccumulator) ────────────

  /**
   * @summary Advance the clock by one host tick.
   *
   * @description
   * Computes `elapsed` since the last tick, adds the normalised value
   * to `#delta`, accumulates `elapsed` into `#frameTimer`, and emits
   * `'tick'` with a timing snapshot.
   *
   * @param nowNano - Current nanosecond timestamp from `IGameRenderingHost.now()`.
   */
  tick(nowNano: number): void {
    this.#current = nowNano;
    const elapsed = nowNano - this.#updatedAt;
    this.#delta += elapsed / this.#renderingInterval;
    this.#frameTimer += elapsed;
    this.#updatedAt = nowNano;

    this.#emitter.emit('tick', {
      delta: this.#delta,
      current: this.#current,
      elapsed,
    });
  }

  /**
   * @summary Updated one simulation frame from the accumulator.
   *
   * @description
   * Called by `DeltaAccumulator` once per `IGameLogic.update` call.
   * Decrements `#delta` by exactly 1 and increments the raw frame
   * count for the current FPS window.
   */
  updateFrame(): void {
    this.#delta -= 1;
    this.#frames++;
  }

  /**
   * @summary Close the FPS window if one second has elapsed.
   *
   * @description
   * Returns `false` immediately when less than one second of raw
   * nanoseconds has accumulated. When the threshold is met, writes
   * the completed window to the ring buffer, advances the ring index,
   * resets both counters, and emits `'fps-reset'`.
   *
   * @returns `true` if the window was closed, `false` otherwise.
   */
  tryConsumeFrame(): boolean {
    if (this.#frameTimer < SecondMetric.NANOSECONDS) return false;

    const data: IFrameData = {
      frames: this.#frames,
      timestamp: this.#current,
    };
    this.#fps[this.#frameIndex] = data;
    this.#frameIndex = (this.#frameIndex + 1) % this.#capacity;
    this.#frameTimer = 0;
    this.#frames = 0;

    this.#emitter.emit('fps-reset', data);
    return true;
  }

  /**
   * @summary Discard accumulated delta and re-anchor the clock.
   *
   * @description
   * Called by `GameEnvironment` when resuming from pause. Resets `#delta` to
   * zero so the frame debt accumulated during the pause is discarded,
   * and sets `#updatedAt` to `nowNano` so the next elapsed calculation
   * is relative to the resume moment rather than the pause moment.
   *
   * @param nowNano - Current nanosecond timestamp at resume time.
   */
  resetClock(nowNano: number): void {
    this.#updatedAt = nowNano;
    this.#delta = 0;
  }

  /**
   * @summary Remove all event handlers.
   *
   * @description
   * Called by `GameEnvironment.stop()` during teardown. Prevents stale closures
   * from holding references after the loop ends.
   */
  clearListeners(): void {
    this.#emitter.clear();
  }
}

// ── DeltaAccumulator ─────────────────────────────────────────────

/**
 * @summary Fixed-timestep accumulator that drives `IGameLogic`.
 *
 * @description
 * On each call to `tick`:
 * 1. Forwards `nowNano` to `GamePerformance.tick` (emits `'tick'`).
 * 2. Samples controls once via the supplied driver registry.
 * 3. Calls `IGameLogic.update` for each whole frame accumulated,
 *    emitting `'update'` after each call.
 * 4. Calls `IGameLogic.render` once with `alpha` = remaining delta,
 *    emitting `'render'` after the call.
 * 5. Attempts to close the FPS window.
 *
 * Emits `'update'` and `'render'` events so external profilers or
 * debug overlays can observe the simulation cadence without patching.
 *
 * @template GL - The concrete `IGameLogic` type.
 *
 * @implements {IDeltaAccumulator<GL>}
 *
 * @example
 * const acc = new DeltaAccumulator(60, nanoTime(), myGameLoop);
 * acc.on('render', ({ alpha }) => overlay.setAlpha(alpha));
 *
 * @author MathAid
 */
export class DeltaAccumulator<GL extends IGameLogic> implements IDeltaAccumulator<GL> {
  readonly #performance: GamePerformance;
  readonly #gameLoop: GL;
  readonly #emitter = new EventEmitter<DeltaAccumulatorEvents>();

  /**
   * @param fps       - Target simulation steps per second.
   * @param startNano - Start timestamp in nanoseconds.
   * @param gameLoop  - The user-supplied `IGameLogic` implementation.
   * @param capacity  - FPS ring buffer capacity (forwarded to `GamePerformance`).
   */
  constructor(fps: number, startNano: number, gameLoop: GL, capacity?: number) {
    this.#performance = new GamePerformance(fps, startNano, capacity);
    this.#gameLoop = gameLoop;
  }

  get gameLoop() {
    return this.#gameLoop;
  }
  get performance() {
    return this.#performance;
  }

  // ── IEventEmitter<DeltaAccumulatorEvents> ────────────────────

  on = this.#emitter.on.bind(this.#emitter) as IDeltaAccumulator<GL>['on'];
  off = this.#emitter.off.bind(this.#emitter) as IDeltaAccumulator<GL>['off'];
  emit = this.#emitter.emit.bind(this.#emitter) as IDeltaAccumulator<GL>['emit'];

  // ── IDeltaAccumulator ────────────────────────────────────────

  /**
   * @summary Advance by one host tick.
   *
   * @description
   * Runs the full fixed-timestep update/render cycle for this tick.
   * The driver registry is passed as-is to `IGameLogic.update` — no
   * parsing or mapping happens here; that is the controller layer's job.
   *
   * @param nowNano - Current nanosecond timestamp.
   * @param drivers - Current device registry snapshot.
   */
  tick(nowNano: number, drivers: Record<string, IGameDevice<GL>> = {}): void {
    this.#performance.tick(nowNano);

    let step = 0;
    while (this.canUpdate()) {
      this.#gameLoop.update({
        inputs: drivers as Record<string, IGameReadable<GL, unknown>>,
        performance: this.performance,
      });
      this.#performance.updateFrame();
      this.#emitter.emit('update', { step });
      step++;
    }

    const alpha = this.#performance.delta;
    this.#gameLoop.render({
      outputs: drivers as Record<string, IGameWritable<GL, unknown>>,
      alpha,
      performance: this.performance,
    });
    this.#emitter.emit('render', { alpha });

    this.#performance.tryConsumeFrame();
  }

  /**
   * @summary True when the accumulator holds at least one full frame.
   */
  canUpdate(): boolean {
    return this.#performance.delta >= 1;
  }

  /**
   * @summary Remove all event handlers from this accumulator and its performance clock.
   *
   * @description Called by `GameEnvironment.stop()` during teardown.
   */
  clearListeners(): void {
    this.#emitter.clear();
    this.#performance.clearListeners();
  }
}

// game devices should be connected using a method present at this class called connect()
// Additionally, add a disconnect() too
/**
 * @summary Top-level game runner.
 *
 * @description
 * `GameEnvironment` owns:
 * - The `IGameRenderingHost` handle and scheduling.
 * - The `DeltaAccumulator` (and its `GamePerformance`).
 * - The device registry (`Record<string, IGameDevice<GL>>`).
 * - Pause state with correct clock reset on resume.
 *
 * Lifecycle events are emitted via a private `EventEmitter`:
 * `'start'`, `'stop'`, `'pause'`, `'resume'`,
 * `'device-connected'`, `'device-disconnected'`, `'error'`.
 *
 * @template GL - The concrete `IGameLogic` implementation.
 *
 * @implements {IGameEnvironment<GL>}
 *
 * @example
 * const game = new GameEnvironment({ fps: 120 });
 *
 * game.on('pause',  () => bgm.pause());
 * game.on('resume', () => bgm.play());
 * game.on('error',  ({ name, error }) => logger.error(name, error));
 *
 * game.on('device-connected', ({ name }) =>
 *   console.log(`${name} ready`));
 *
 * await game.run({ gameLoop: new MyGame(), io: [keyboard, canvas] });
 *
 * @author MathAid
 */
export class GameEnvironment<GL extends IGameLogic> implements IGameEnvironment<GL> {
  readonly setting: IGameSetting;
  #paused = false;
  #handle: unknown = null;
  #host!: IGameRenderingHost;
  #accumulator: DeltaAccumulator<GL> | null = null;
  #registry: Record<string, IGameDevice<GL>> | null = null;

  readonly #emitter = new EventEmitter<GameEvents<GL>>();

  constructor(setting: IGameSetting, gameLoop: GL, host: IGameRenderingHost) {
    this.setting = setting;
    this.#host = host;
    // this.#devices = io;
    this.#registry = {};
    this.#accumulator = new DeltaAccumulator<GL>(
      this.setting.fps,
      host.now(),
      gameLoop,
      this.setting.fpsHistory ?? FPS_CACHE_CAPACITY,
    );
  }

  get accumulator() {
    return this.#accumulator!;
  }
  get registry() {
    return this.#registry;
  }

  set host(value: IGameRenderingHost) {
    this.#host = value;
  }

  // ── IEventEmitter<GameEvents<GL>> ────────────────────────────

  on = this.#emitter.on.bind(this.#emitter) as IGameEnvironment<GL>['on'];
  off = this.#emitter.off.bind(this.#emitter) as IGameEnvironment<GL>['off'];
  emit = this.#emitter.emit.bind(this.#emitter) as IGameEnvironment<GL>['emit'];

  // ── Pause ────────────────────────────────────────────────────

  get paused(): boolean {
    return this.#paused;
  }

  /**
   * @description
   * Transitioning `false → true` emits `'pause'`.
   * Transitioning `true → false` resets the accumulator clock
   * (discards frame debt accumulated during the pause) then emits
   * `'resume'`. No-op when the value does not change.
   */
  set paused(value: boolean) {
    if (value === this.#paused) return;

    if (value) {
      this.#paused = true;
      this.#emitter.emit('pause');
    } else {
      this.#accumulator?.performance.resetClock(this.#host.now());
      this.#paused = false;
      this.#emitter.emit('resume');
    }
  }

  // ── Device management ────────────────────────────────────────

  async connect(device: IGameDevice<GL>, nameOrSlot: number | string) {
    const name = String(nameOrSlot);
    try {
      const ok = await device.connect(this);
      if (!ok) {
        this.#emitter.emit('error', {
          name,
          error: new Error(`Device "${name}" connect() returned false`),
        });
        return;
      }
      this.#registry![name] = device;
      this.#emitter.emit('device-connected', { name, device });
    } catch (error) {
      this.#emitter.emit('error', { name, error });
    }
  }

  async disconnect(nameOrSlot: number | string): Promise<void> {
    const name = String(nameOrSlot);
    try {
      const device = this.#registry![name];
      const ok = await device.disconnect(this);
      delete this.#registry![name];
      if (ok) {
        this.#emitter.emit('device-disconnected', { name });
      } else {
        this.#emitter.emit('error', {
          name,
          error: new Error(`Device "${name}" disconnect() returned false`),
        });
      }
    } catch (error) {
      delete this.#registry![name];
      this.#emitter.emit('error', { name, error });
    }
  }

  // ── IGameEnvironment ────────────────────────────────────────────────────

  /**
   * @summary Start the game loop.
   *
   * @description
   * 1. Initialises `#host`, `#registry`, and `#accumulator`.
   * 2. Connects all devices in parallel via `#plugDevice`.
   * 3. Schedules the first host tick.
   * 4. Emits `'start'`.
   *
   * The host loop schedules at the *end* of each callback body so
   * `#handle` always holds the most recently issued ticket — the one
   * that `stop()` must cancel to halt the loop cleanly.
   *
   * @param options - `{ gameLoop, host }`
   */
  async run({}: IRunOptions): Promise<void> {
    const loop = (() => {
      if (!this.#paused) {
        this.#accumulator!.tick(this.#host.now(), this.#registry ?? undefined);
      }
      // schedule AFTER the body — #handle always holds the
      // most recently issued ticket, which is the one to cancel
      this.#handle = this.#host.schedule(loop);
    }).bind(this);

    this.#handle = this.#host.schedule(loop);
    this.#emitter.emit('start');
  }

  /**
   * @summary Halt the game loop and release all resources.
   *
   * @description
   * 1. Cancels the pending host tick via `#handle`.
   * 2. Disconnects all registered devices in parallel via `#unplugDevice`.
   *    Device errors are emitted as `'error'` events — they do not prevent
   *    other devices from disconnecting.
   * 3. Clears all event listeners on the accumulator, its performance
   *    clock, and finally this game instance.
   * 4. Emits `'stop'` before the emitter is cleared so any `'stop'`
   *    handlers still fire.
   * 5. Nulls all runtime state.
   */
  async stop(): Promise<void> {
    if (this.#handle === null) return;
    this.#host.cancel(this.#handle);
    this.#handle = null;

    const errors: unknown[] = [];
    await Promise.all(
      Object.keys(this.#registry || {}).map(async (name) => {
        try {
          const device = this.#registry![name];
          if (await device.disconnect(this)) {
            delete this.#registry![name];
          }
        } catch (err) {
          errors.push(err);
        }
      }, this),
    );

    // Emit 'stop' before clearing so handlers still run
    this.#emitter.emit('stop');

    this.#accumulator?.clearListeners();
    this.#accumulator = null;
    this.#registry = null;

    // Clear game-level listeners last
    this.#emitter.clear();

    if (errors.length) throw new AggregateError(errors, 'Some devices failed to disconnect');
  }
}

// ── Provided implementations ───────────────────────────────────────

/**
 * @summary Deterministic host loop for unit and integration tests.
 *
 * @description
 * Time never advances automatically. Call `advance(ns)` to move the
 * clock forward by a precise number of nanoseconds before each
 * simulated tick. `schedule` calls the callback synchronously and
 * immediately, so tests can drive the loop in a tight `for` loop
 * without async machinery.
 *
 * @example
 * const host = new FixedStepHostLoop();
 * const frameNs = SecondMetric.NANOSECONDS / 60;
 *
 * for (let i = 0; i < 180; i++) {   // simulate 3 seconds at 60fps
 *   host.advance(frameNs);
 *   // accumulator.tick(host.now(), drivers) called by the loop
 * }
 */
export class FixedStepHostLoop implements IGameRenderingHost {
  #time = 0;

  /** Advance the clock by `ns` nanoseconds. */
  advance(ns: number) {
    this.#time += ns;
  }

  /** Calls `cb` synchronously. Returns `0` as a dummy handle. */
  schedule(cb: () => void): number {
    cb();
    return 0;
  }

  /** No-op — synchronous calls cannot be cancelled. */
  cancel(_h: unknown): void {}

  now(): number {
    return this.#time;
  }
}
