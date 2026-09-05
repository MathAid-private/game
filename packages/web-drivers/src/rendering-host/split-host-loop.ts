/**
 * @fileoverview
 * @summary `SplitHostLoop` — decoupled physics and render scheduling.
 *
 * @description
 * `SplitHostLoop` splits the single `IGameRenderingHost` scheduling contract into
 * two independent loops running at different rates on the same JS thread:
 *
 * - **Physics loop** — driven by `MessageChannel`, which posts tasks to
 *   the macrotask queue with no vsync gate. Fires as fast as the event
 *   loop allows, constrained only by the fixed-timestep accumulator's
 *   `fps` setting. Because `DeltaAccumulator` only calls `update()` when
 *   `delta >= 1`, the actual simulation rate is still exactly `fps` Hz;
 *   the loop simply wakes more often to check.
 *
 * - **Render loop** — driven by `requestAnimationFrame`, locked to the
 *   display refresh rate (60 / 120 / 144 Hz). `render()` is called once
 *   per display frame with the current `alpha` interpolation value,
 *   producing smooth visuals regardless of the physics rate.
 *
 * **Why `MessageChannel` instead of `setTimeout(fn, 0)`?**
 * `setTimeout` has a minimum clamping delay of ~4ms in all browsers
 * (imposed by the HTML spec after 5 nested calls). `MessageChannel`
 * posts a task with no minimum delay, giving sub-millisecond wakeup
 * latency — effectively "as fast as the event loop drains".
 *
 * **Thread model** — both loops run on the main JS thread. There is no
 * true parallelism. The benefit over a single rAF loop is that physics
 * ticks are not gated on the display sync, so a 60fps physics simulation
 * running on a 30Hz display (or a throttled background tab) still
 * accumulates and processes frames correctly rather than falling behind.
 *
 * **Shared state** — `IGameRenderingHost` exposes a single `schedule/cancel/now`
 * contract used by `DeltaAccumulator.tick`. `SplitHostLoop` satisfies
 * this by treating `schedule` as the physics scheduler and exposing
 * `scheduleRender` separately for the render path. `GameEnvironment` must be
 * configured to use both — see `SplitGame` below.
 *
 * **`SharedArrayBuffer` is NOT required** here because both loops share
 * the same JS heap. `SharedArrayBuffer` would only be needed when physics
 * runs in a `Worker` thread. A comment marks the future extension point.
 *
 * @example
 * // Drop-in replacement for BrowserHostLoop
 * const host = new SplitHostLoop();
 * await game.run({ gameLoop: new MyGame(), io: [canvas], host });
 *
 * @see {@linkcode BrowserHostLoop} — single-loop baseline
 * @see {@linkcode FixedStepHostLoop} — deterministic test host
 *
 * @author MathAid
 */

import type {
  IGameDevice,
  IGameLogic,
  IGameReadable,
  IGameRenderingHost,
  IGameWritable,
  IRunOptions,
} from '@games/loop';
import { DeltaAccumulator, GameEnvironment, nanoTime } from '@games/loop';

// ── DeltaAccumulator ─────────────────────────────────────────────

/**
 * @summary Fixed-timestep accumulator that drives `IGameLoop`.
 *
 * @description
 * On each call to `tick` (driven by the physics scheduler):
 * 1. Advances `GamePerformance` by elapsed wall time.
 * 2. Calls `IGameLoop.update` for each whole frame accumulated.
 * 3. When NOT using `SplitHostLoop`, calls `IGameLoop.render` once
 *    with the fractional delta as `alpha`.
 * 4. Attempts to close the FPS measurement window.
 *
 * When the host is a `SplitHostLoop`, render is handled by the host's
 * rAF callback — `tick` skips the `render()` call to avoid double rendering.
 *
 * @template GL - The concrete `IGameLoop` implementation.
 * @implements {IDeltaAccumulator<GL>}
 * @author MathAid
 */
export class SplitHostDeltaAccumulator<GL extends IGameLogic> extends DeltaAccumulator<GL> {
  /**
   * When `true`, `tick` skips calling `render()` — the `SplitHostLoop`
   * rAF path handles it instead.
   */
  #splitRender = false;

  constructor(fps: number, startNano: number, gameLoop: GL, capacity?: number) {
    super(fps, startNano, gameLoop, capacity);
  }

  /**
   * @summary Signal that render is handled externally (by `SplitHostLoop`).
   *
   * @description
   * Called by `GameEnvironment.run` when it detects a `SplitHostLoop`. After this,
   * `tick` drives only `update()` calls; `render()` fires from rAF.
   */
  enableSplitRender(): void {
    this.#splitRender = true;
  }

  override tick(nowNano: number, drivers: Record<string, IGameDevice<GL>> = {}): void {
    this.performance.tick(nowNano);

    while (this.canUpdate()) {
      this.gameLoop.update({
        performance: this.performance,
        inputs: drivers as Record<string, IGameReadable<GL, unknown>>,
      });
      this.performance.updateFrame();
    }

    // In split mode, render is driven by the rAF loop inside SplitHostLoop.
    // In single-loop mode, render runs here after all update steps.
    if (!this.#splitRender) {
      this.gameLoop.render({
        performance: this.performance,
        outputs: drivers as Record<string, IGameWritable<GL, unknown>>,
        alpha: this.performance.delta,
      });
    }

    this.performance.tryConsumeFrame();
  }

  canUpdate(): boolean {
    return this.performance.delta >= 1;
  }
}
// ── Internal handle types ─────────────────────────────────────────

/**
 * @summary Internal handle returned by `SplitHostLoop.schedule`.
 *
 * @description
 * Bundles both loop handles so `cancel` can stop both schedulers
 * from a single call, matching the `IGameRenderingHost.cancel(handle)` contract.
 */
export interface SplitHandle {
  /** `MessageChannel` instance driving the physics loop. */
  readonly channel: MessageChannel;
  /** `requestAnimationFrame` handle for the render loop. */
  readonly rafId: { current: number };
  /** Whether this handle has been cancelled. */
  cancelled: boolean;
}

// ── SplitHostLoop ─────────────────────────────────────────────────

/**
 * @summary Host loop that separates physics scheduling from render scheduling.
 *
 * @description
 * Implements `IGameRenderingHost` by running two independent schedulers:
 *
 * 1. A `MessageChannel` loop that calls the physics callback as fast as
 *    the browser event loop drains (no vsync, no 4ms `setTimeout` clamp).
 * 2. A `requestAnimationFrame` loop that calls the render callback once
 *    per display frame.
 *
 * The physics callback is the one supplied to `schedule(callback)` — this
 * is what `DeltaAccumulator.tick` calls, which drives `update()`. The
 * render callback is registered separately via `onRender` and receives
 * `alpha` as its sole argument, computed from the accumulator's delta at
 * the moment the rAF fires.
 *
 * **Integration with `GameEnvironment`** — `GameEnvironment` calls `host.schedule(loop)` where
 * `loop` is the accumulator tick. `SplitHostLoop` runs that tick on the
 * MessageChannel loop. The rAF loop fires `onRender` independently. This
 * means `GameEnvironment`'s existing `loop` closure handles `update()` calls, and
 * `SplitHostLoop` adds the parallel render path on top.
 *
 * @implements {IGameRenderingHost}
 *
 * @example
 * const host = new SplitHostLoop();
 *
 * // Register a render callback (called every display frame)
 * host.onRender = (alpha) => {
 *   gameLoop.render({ outputs: registry, alpha });
 * };
 *
 * await game.run({ gameLoop, io, host });
 *
 * @note
 * `SplitHostLoop` does not use `SharedArrayBuffer`. State is shared via
 * the JS heap since both loops run on the same thread. A future
 * `WorkerSplitHostLoop` variant would use `SharedArrayBuffer` + `Atomics`
 * to pass the alpha value from a physics Worker to the main-thread render.
 *
 * @author MathAid
 */
export class SplitHostLoop implements IGameRenderingHost {
  /**
   * @summary Called once per display frame by the rAF loop.
   *
   * @description
   * Set this before calling `game.run()`. Receives the sub-frame
   * interpolation factor `alpha` in `[0, 1)`, computed as the
   * accumulator's current delta at the moment rAF fires.
   *
   * When `null`, the rAF loop still runs but produces no render output.
   * This lets the physics loop run freely even before a renderer is attached.
   *
   * @param alpha - Sub-frame interpolation factor; `0` = on a physics
   *   boundary, approaching `1` = one full frame ahead.
   */
  onRender: ((alpha: number) => void) | null = null;

  /**
   * @summary Getter for the current accumulator delta, set by `GameEnvironment`.
   *
   * @description
   * `SplitHostLoop` needs to read `delta` from the accumulator at rAF
   * time to compute `alpha` for `onRender`. `GameEnvironment` assigns this after
   * constructing the accumulator, before the first tick.
   *
   * A getter rather than a direct value because the delta changes on
   * every physics tick; the rAF loop must sample it at render time.
   */
  getDelta: (() => number) | null = null;

  // ── IGameRenderingHost ──────────────────────────────────────────────────

  /**
   * @summary Start both the physics loop and the render loop.
   *
   * @description
   * - Creates a `MessageChannel` and starts self-posting to drive the
   *   physics callback as fast as the event loop drains.
   * - Starts a `requestAnimationFrame` loop that calls `onRender` once
   *   per display frame with the current `alpha`.
   *
   * Returns a `SplitHandle` that `cancel` uses to stop both loops.
   *
   * @param callback - The physics tick callback (`DeltaAccumulator.tick`
   *   wrapped by `GameEnvironment`'s loop closure).
   * @returns An opaque `SplitHandle`.
   */
  schedule(callback: () => void): unknown {
    const handle: SplitHandle = {
      channel: new MessageChannel(),
      rafId: { current: 0 },
      cancelled: false,
    };

    // ── Physics loop (MessageChannel) ──────────────────────────
    const physicsLoop = () => {
      if (handle.cancelled) return;
      callback();
      // Re-post immediately — next macrotask, no minimum delay
      handle.channel.port2.postMessage(null);
    };
    handle.channel.port1.onmessage = physicsLoop;
    handle.channel.port2.postMessage(null); // prime the pump

    // ── Render loop (requestAnimationFrame) ────────────────────
    const renderLoop = () => {
      if (handle.cancelled) return;
      if (this.onRender !== null) {
        const alpha = this.getDelta?.() ?? 0;
        this.onRender(alpha);
      }
      handle.rafId.current = requestAnimationFrame(renderLoop);
    };
    handle.rafId.current = requestAnimationFrame(renderLoop);

    return handle;
  }

  /**
   * @summary Stop both the physics and render loops.
   *
   * @description
   * Sets the `cancelled` flag (stops the MessageChannel self-post),
   * closes the channel ports, and cancels the pending rAF handle.
   * Idempotent — safe to call multiple times.
   *
   * @param handle - The value returned by `schedule`.
   */
  cancel(handle: unknown): void {
    const h = handle as SplitHandle;
    if (!h || h.cancelled) return;
    h.cancelled = true;
    h.channel.port1.onmessage = null;
    h.channel.port1.close();
    h.channel.port2.close();
    cancelAnimationFrame(h.rafId.current);
  }

  /**
   * @summary Monotonic current time in nanoseconds.
   *
   * @description
   * Delegates to `nanoTime()` — `Math.trunc(performance.now() * 1e6)`.
   * Both loops use the same clock so physics timestamps and render
   * timestamps are directly comparable.
   */
  now(): number {
    return nanoTime();
  }
}

// ── SplitGame ─────────────────────────────────────────────────────
// GameEnvironment needs one addition to wire SplitHostLoop: after constructing
// the accumulator, assign getDelta and onRender on the host if it is
// a SplitHostLoop. The guard is a duck-type check — no import of GameEnvironment
// needed here, keeping the dependency arrow pointing one way.

/**
 * @summary Duck-type guard for `SplitHostLoop`.
 *
 * @description
 * Used by `GameEnvironment.run` to detect when the provided host is a
 * `SplitHostLoop` and wire up `getDelta` and `onRender` without
 * coupling `game-loop.ts` to this file via an import.
 *
 * Checks for the `onRender` and `getDelta` properties that
 * `SplitHostLoop` uniquely exposes.
 *
 * @param host - Any `IGameRenderingHost` implementation.
 * @returns `true` if `host` is a `SplitHostLoop`.
 *
 * @example
 * if (isSplitHostLoop(host)) {
 *   host.getDelta = () => accumulator.performance.delta;
 *   host.onRender = (alpha) => gameLoop.render({ outputs: registry, alpha });
 * }
 */
export function isSplitHostLoop(host: unknown): host is SplitHostLoop {
  return typeof host === 'object' && host !== null && 'onRender' in host && 'getDelta' in host;
}
/**
 * @summary Top-level game runner.
 *
 * @description
 * Owns the host handle, device registry, accumulator, and pause state.
 *
 * On `run`, after constructing the accumulator, `GameEnvironment` checks whether
 * the host is a `SplitHostLoop` via `isSplitHostLoop`. If so it:
 * 1. Calls `accumulator.enableSplitRender()` to suppress `render()`
 *    inside the physics tick.
 * 2. Assigns `host.getDelta` so the rAF loop can read the current alpha.
 * 3. Assigns `host.onRender` — the actual `gameLoop.render()` call —
 *    which fires once per display frame with a fresh alpha sample.
 *
 * This keeps the split-render wiring entirely inside `GameEnvironment`, leaving
 * `DeltaAccumulator`, `IGameLoop`, and `SplitHostLoop` unaware of
 * each other.
 *
 * @template GL - The concrete `IGameLoop` implementation.
 * @implements {IGame<GL>}
 * @author MathAid
 */
export class ModularGameEnvironment<GL extends IGameLogic> extends GameEnvironment<GL> {
  override get accumulator() {
    return super.accumulator as SplitHostDeltaAccumulator<GL>;
  }
  override async run({}: IRunOptions): Promise<void> {
    // ── SplitHostLoop wiring ────────────────────────────────────
    // Detected via duck-type guard — no import cycle.
    if (isSplitHostLoop(this.host)) {
      this.accumulator.enableSplitRender();

      // rAF loop reads delta at render time for accurate interpolation
      this.host.getDelta = () => this.accumulator!.performance.delta;

      // rAF loop calls render once per display frame
      this.host.onRender = (alpha: number) => {
        if (this.paused) return;
        this.accumulator.gameLoop.render({
          performance: this.accumulator.performance,
          outputs: (this.registry as Record<string, IGameWritable<GL, unknown>>) ?? {},
          alpha,
        });
      };
    }
  }
}
