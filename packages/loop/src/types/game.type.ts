/**
 * @fileoverview
 * @summary Type contracts for the `@games/loop` package.
 *
 * @description
 * Defines the public interfaces for the game loop subsystem:
 * host scheduling, timing, accumulation, and the top-level game
 * runner. All interfaces are environment-agnostic — no DOM, no Node,
 * no controller-package imports.
 *
 * Event maps are declared as companion types beside the interface they
 * belong to. Each event map key maps to the payload type its handlers
 * receive; `void` payloads emit with no argument.
 *
 * @see {@linkcode IEventEmitter}
 * @see {@linkcode EventEmitter}
 *
 * @author MathAid
 */

import type { IEventEmitter } from './event.type';

// ── Host loop abstraction ──────────────────────────────────────────
// The game core never calls RAF, setTimeout, or Date directly.
// The host provides these two primitives and the game uses them.
/**
 * @summary Abstracts the scheduling and clock primitives the game loop needs.
 *
 * @description
 * `IGameRenderingHost` is the seam between the game core and the platform.
 * The game loop never calls `requestAnimationFrame`, `setTimeout`, or
 * `performance.now()` directly — it receives an `IGameRenderingHost` at runtime
 * and calls only these two methods.
 *
 * This makes the loop testable with a `FixedStepHostLoop` that advances
 * time manually, and portable to Node, Workers, or any future runtime
 * that provides equivalent primitives.
 *
 * @example
 * // Test
 * const host = new FixedStepHostLoop();
 * host.advance(SecondMetric.NANOSECONDS / 60); // simulate one frame
 */
export interface IGameRenderingHost<Handle = unknown> {
  /**
   * @summary Schedule a callback for the next available tick.
   *
   * @description
   * Returns an opaque handle that can be passed to `cancel`.
   * In a browser this wraps `requestAnimationFrame`.
   * In tests it calls the callback synchronously and returns `0`.
   *
   * @param callback - Function to call on the next tick.
   * @returns Opaque cancellation handle.
   */
  schedule(callback: () => void): Handle;

  /**
   * @summary Cancel a previously scheduled callback.
   *
   * @param handle - The value returned by `schedule`.
   */
  cancel(handle: Handle): void;

  /**
   * @summary Monotonic current time in nanoseconds.
   *
   * @description
   * Never goes backwards. In a browser this wraps `performance.now()`
   * via `nanoTime()`. In tests it returns a manually-advanced counter.
   *
   * @returns Current time in nanoseconds.
   */
  now(): number;
}

export interface IUpdateOptions<GL extends IGameLogic> {
  inputs: Record<string, IGameReadable<GL>>;
  /** Skip simulation this frame (e.g. window lost focus). */
  skip?: boolean;
  performance: IGamePerformance;
}
export interface IRenderOptions<GL extends IGameLogic> {
  outputs: Record<string, IGameWritable<GL>>;
  alpha: number;
  performance: IGamePerformance;
}

export interface IGameRenderableLogic {
  render<GL extends IGameLogic>(data: IRenderOptions<GL>): boolean; // alpha = sub-frame remainder (0–1)
}
export interface IGameLoop {
  update<GL extends IGameLogic>(options: IUpdateOptions<GL>): boolean;
}
/**
 * @summary The user-implemented game logic contract.
 *
 * @description
 * Consumers implement this interface to define their game. The two
 * methods are called by `DeltaAccumulator` at the appropriate points
 * in the fixed-timestep loop:
 *
 * - `update` runs once per accumulated simulation frame. May run
 *   multiple times per host tick during catchup. Must not reference
 *   wall time or browser APIs.
 * - `render` runs once per host tick, after all `update` calls for
 *   that tick have completed. Receives `alpha` for interpolation.
 *
 * @example
 * class MyGame implements IGameLogic<CanvasDriver, CanvasDriver> {
 *   update({ inputs }: IUpdateOptions<CanvasDriver>) { ... }
 *   render({ outputs, alpha }: IRenderOptions<CanvasDriver>) { ... }
 * }
 */
export interface IGameLogic extends IGameRenderableLogic, IGameLoop {}

// ── Performance ───────────────────────────────────────────────────

/**
 * @summary A single completed FPS measurement window.
 *
 * @description
 * Written to the ring buffer on `IGamePerformance` each time a
 * one-second measurement window closes. `frames` is the number of
 * simulation steps completed in that second. `timestamp` is the
 * absolute nanosecond value of `IGamePerformance.current` at the
 * moment the window closed, usable as a timeline anchor.
 */
export interface IFrameData {
  /** Absolute nanosecond timestamp when this window ended. */
  timestamp: number;
  /** Simulation frames counted in the window. */
  frames: number;
}

/**
 * @summary Event map for `IGamePerformance`.
 *
 * @description
 * `tick` fires on every host tick — up to `fps` times per second.
 * Handlers must be cheap (no allocation, no I/O). Use `fps-reset`
 * for periodic HUD updates instead.
 *
 * `fps-reset` fires once per second when the measurement window
 * closes and the ring buffer slot is written. Safe for HUD/overlay
 * updates.
 *
 * @note
 * `tick` handlers run inside the hot path of the game loop.
 * A handler that takes > 0.1ms at 120fps consumes > 1% of total
 * frame budget. Prefer `fps-reset` for any non-trivial work.
 */
export type GamePerformanceEvents = {
  /**
   * Fires every host tick, immediately after the clock is advanced.
   * Payload is a snapshot of timing state at that moment.
   */
  tick: {
    /** Normalised accumulator value after this tick (may exceed 1 during catchup). */
    delta: number;
    /** Absolute nanosecond timestamp of this tick. */
    current: number;
    /** Raw nanoseconds elapsed since the previous tick. */
    elapsed: number;
  };
  /**
   * Fires once per second when the FPS measurement window resets.
   * Carries the completed window data written to the ring buffer.
   */
  'fps-reset': IFrameData;
};

/**
 * @summary Timing and performance state for the running game loop.
 *
 * @description
 * Maintained by `GamePerformance` and exposed read-only to consumers.
 * Extends `IEventEmitter<GamePerformanceEvents>` so subscribers can
 * react to tick and FPS events without polling.
 *
 * The `fps` array is a fixed-capacity ring buffer of the last N
 * completed one-second windows, where N is `FPS_CACHE_CAPACITY`.
 * Slots that have not yet been written contain `undefined` — check
 * before reading in early game lifecycle.
 */
export interface IGamePerformance extends IEventEmitter<GamePerformanceEvents> {
  /** Nanoseconds per simulation frame at the configured FPS. */
  readonly renderingInterval: number;
  /**
   * Current accumulator value. May exceed `1` during catchup after
   * a stall. Decremented by `1` for each simulation step consumed.
   */
  readonly delta: number;
  /** Nanosecond timestamp of the previous `tick` call. */
  readonly updatedAt: number;
  /** Nanosecond timestamp of the current `tick` call. */
  readonly current: number;
  /**
   * Ring buffer of completed FPS measurement windows.
   * Length is fixed at `FPS_CACHE_CAPACITY`. Entries are written
   * in order; the buffer wraps after `FPS_CACHE_CAPACITY` seconds.
   */
  readonly fps: readonly IFrameData[];
}

// ── Accumulator ───────────────────────────────────────────────────

/**
 * @summary Event map for `IDeltaAccumulator`.
 *
 * @description
 * `update` fires once per simulation step consumed from the accumulator.
 * `render` fires once per host tick after all steps are consumed.
 *
 * @note
 * `update` may fire multiple times per host tick during catchup.
 * Do not use it for per-frame visual work.
 */
export type DeltaAccumulatorEvents = {
  /**
   * Fires after each call to `IGameLogic.update`.
   * `step` is the zero-based index of this call within the current host tick.
   */
  update: { step: number };
  /**
   * Fires after `IGameLogic.render` returns for the current host tick.
   * `alpha` is the sub-frame remainder passed to the render call.
   */
  render: { alpha: number };
};

/**
 * @summary Drives the fixed-timestep simulation and delegates to `IGameLogic`.
 *
 * @description
 * On each call to `tick`, the accumulator:
 * 1. Advances `performance` by the elapsed wall time.
 * 2. Calls `IGameLogic.update` for each whole frame accumulated.
 * 3. Calls `IGameLogic.render` once with the fractional remainder as `alpha`.
 * 4. Attempts to reset the FPS measurement window.
 *
 * Extending `IEventEmitter<DeltaAccumulatorEvents>` allows external
 * systems (profilers, debug overlays) to observe the update/render
 * cadence without subclassing or patching.
 */
export interface IDeltaAccumulator<
  GL extends IGameLogic,
> extends IEventEmitter<DeltaAccumulatorEvents> {
  /** The user-implemented game loop. */
  gameLoop: GL;
  /** Read-only access to timing state and its own event stream. */
  readonly performance: IGamePerformance;
  /**
   * @summary Advance the simulation by one host tick.
   *
   * @param nowNano - Current time in nanoseconds from `IHostLoop.now()`.
   * @param drivers - Current device registry, keyed by device name.
   */
  tick(nowNano: number, drivers?: Record<string, IGameDevice<GL>>): void;
  /** Returns `true` when the accumulator holds at least one full frame. */
  canUpdate(): boolean;
}

// ── Game device ───────────────────────────────────────────────────

/**
 * @summary Lifecycle hooks for a device that connects to a running game.
 *
 * @description
 * Called by `Game` during `run` (connect) and `stop` (disconnect).
 * Both methods receive the `IGameEnvironment` context so the device can read
 * settings or subscribe to game events during setup.
 *
 * @template GL - The concrete game loop type.
 */
export interface IGamePluggable<GL extends IGameLogic> {
  connect(context: IGameEnvironment<GL>): Promise<boolean>;
  disconnect(context: IGameEnvironment<GL>): Promise<boolean>;
}
/**
 * @summary A device that produces data readable by the game loop.
 *
 * @description
 * `read()` is called by the accumulator once per host tick via
 * `getControls` and the result is passed to `IGameLogic.update`.
 * The return type `R` is the raw device data — parsing/mapping to
 * `IVirtualPadLayout` is the controller package's responsibility.
 *
 * @template R - Raw readable output type.
 */
export interface IGameReadable<GL extends IGameLogic, R = unknown> {
  read(context: GL): R;
}
/**
 * @summary A device that accepts data written by the game loop.
 *
 * @description
 * `write` is called by the game loop during `IGameLogic.render` to
 * obtain a rendering context (e.g. a `CanvasRenderingContext2D`).
 * `clearAll` resets the output surface between frames.
 *
 * @template W - Context type accepted by `write`.
 */
export interface IGameWritable<GL extends IGameLogic, W = unknown> {
  write(data: W, context: GL): unknown;
  clearAll(context: GL): void;
}
/**
 * @summary Union of pluggable, readable, and writable device capabilities.
 *
 * @description
 * A concrete device must implement `IGamePluggable` and at least one
 * of `IGameReadable` or `IGameWritable`. The `name` property is
 * assigned by `Game` during `#plugDevice` if not already set, and
 * serves as the registry key in `inputs`/`outputs` records.
 *
 * @template GL - The concrete game loop type.
 * @template R  - Readable output type.
 * @template W  - Writable context type.
 */
export type IGameDevice<GL extends IGameLogic, R = unknown, W = unknown> = IGamePluggable<GL> &
  (IGameReadable<GL, R> | IGameWritable<GL, W>);

// ── Game settings ─────────────────────────────────────────────────

/**
 * @summary Static configuration for a `Game` instance.
 *
 * @description
 * Serialisable data only — no functions, no device references.
 * Runtime dependencies (screen, controllers, host) are passed to
 * `run` rather than stored here.
 */
export interface IGameSetting {
  /** Target simulation steps per second. */
  fps: number;
  /** Request the browser fullscreen API on `run`. Optional. */
  fullscreen?: boolean;
  /**
   * Number of FPS measurement windows to retain in the ring buffer.
   * Defaults to `FPS_CACHE_CAPACITY` when not set.
   */
  fpsHistory?: number;
}

// ── Run options ───────────────────────────────────────────────────

/**
 * @summary Arguments passed to `IGame.run`.
 *
 * @description
 * Bundles all runtime dependencies — the game loop implementation,
 * the I/O device list, and the optional host loop override — into a
 * single options object. This keeps `run` to one parameter and makes
 * partial construction (e.g. omitting `host` to use the default) clean.
 *
 * @template GL - The concrete game loop type.
 */
export interface IRunOptions {}

// ── Game ──────────────────────────────────────────────────────────

/**
 * @summary Event map for `IGameEnvironment`.
 *
 * @description
 * Lifecycle events for the top-level game runner. All events are
 * `void` — they signal state transitions, not data. Device events
 * carry the device name so subscribers can react to specific devices.
 *
 * @template GL - The concrete game loop type.
 */
export type GameEvents<GL extends IGameLogic> = {
  /** Fires when the RAF loop begins, before the first tick. */
  start: void;
  /** Fires after the RAF loop is cancelled and all devices disconnected. */
  stop: void;
  /** Fires when `paused` transitions from `false` to `true`. */
  pause: void;
  /** Fires when `paused` transitions from `true` to `false`, after clock reset. */
  resume: void;
  /** Fires after a device is successfully connected and added to the registry. */
  'device-connected': { name: string; device: IGameDevice<GL> };
  /** Fires after a device is successfully disconnected and removed from the registry. */
  'device-disconnected': { name: string };
  /**
   * Fires when a device throws during `connect` or `disconnect`.
   * Does not prevent other devices from being processed.
   */
  error: { name: string; error: unknown };
};

/**
 * @summary Top-level game runner.
 *
 * @description
 * `IGameEnvironment` owns the host loop handle, the device registry, and the
 * `DeltaAccumulator`. It is the single entry point consumers interact
 * with after construction.
 *
 * Extends `IEventEmitter<GameEvents<GL>>` so external systems can
 * observe lifecycle transitions (pause/resume, device hot-plug,
 * errors) without subclassing or polling.
 *
 * @template GL - The concrete `IGameLogic` implementation.
 *
 * @example
 * const game = new GameEnvironment({ fps: 60 });
 *
 * const unsubPause  = game.on('pause',  () => audio.mute());
 * const unsubResume = game.on('resume', () => audio.unmute());
 * const unsubError  = game.on('error',  ({ name, error }) => logger.error(name, error));
 *
 * await game.run({ gameLoop: new MyGame(), io: [keyboard, canvas] });
 *
 * @example
 * // Observe device hot-plug
 * game.on('device-connected', ({ name }) => console.log(`${name} connected`));
 *
 * @see {@linkcode IRunOptions}
 * @see {@linkcode IDeltaAccumulator}
 */
export interface IGameEnvironment<GL extends IGameLogic> extends IEventEmitter<GameEvents<GL>> {
  /** Static configuration set at construction time. */
  readonly setting: IGameSetting;
  accumulator: IDeltaAccumulator<GL>;
  /**
   * Host scheduling and clock implementation.
   * Defaults to `BrowserHostLoop` when omitted.
   */
  host: IGameRenderingHost;
  /**
   * Controls whether the accumulator advances on each host tick.
   *
   * Setting to `true` emits `'pause'`. Setting back to `false`
   * resets the performance clock (discarding accumulated debt) and
   * emits `'resume'`. The host loop continues running in both states.
   */
  paused: boolean;

  /**
   * @summary Start the game loop.
   *
   * @description
   * Connects all devices in `io`, starts the host scheduler, and emits
   * `'start'`. Returns a `Promise` that resolves once the first tick
   * has been scheduled (not when the game ends — call `stop` to halt).
   *
   * @param options - Runtime dependencies: game loop, devices, host.
   */
  run(options: IRunOptions): Promise<void>;

  /**
   * @summary Stop the game loop.
   *
   * @description
   * Cancels the host scheduler, disconnects all devices, clears the
   * event emitter, and emits `'stop'` before clearing. Returns a
   * `Promise` that resolves after all device `disconnect` calls settle.
   * Throws `AggregateError` if any device fails to disconnect.
   */
  stop(): Promise<void>;

  /**
   * @summary Connect a single device and register it.
   *
   * @description
   * Awaits `device.connect(this)`. On success, assigns a name if the
   * device does not already have one, writes it to `#registry`, and
   * emits `'device-connected'`. On failure or thrown error, emits
   * `'error'` and does not add the device to the registry.
   */
  connect(device: IGameDevice<GL>, nameOrSlot: number | string): Promise<void>;
  /**
   * @summary Disconnect a single device and remove it from the registry.
   *
   * @description
   * Awaits `device.disconnect(this)`. On success, removes the device
   * from `#registry` and emits `'device-disconnected'`. On failure
   * or thrown error, emits `'error'` and still removes the registry
   * entry to prevent stale references.
   */
  disconnect(nameOrSlot: number | string): Promise<void>;
}
