# Implementation Proposals

> **Status:** Proposal backlog — concrete designs for extending the engine. None of these are implemented yet.
> **Author:** MathAid

---

## 1. Driver-agnostic Engine (simulation step strategies)

### 1.1 The seam

The engine drives a game through one contract:

```ts
interface ISimulationDriver<G extends IGame = IGame> {
  readonly clock: IFrameClock;
  readonly metrics: IPerformanceMetrics;
  readonly game: G;
  advance(now: number, input: IInputState): number;
  readonly canStep: boolean;
}
```

Only `FixedTimestepDriver` exists today, but this interface is the seam for any other "engine core".
Every strategy below decides **how `dt` is derived** from nanosecond `now` samples and **how
`game.step()` is invoked**.

### 1.2 Strategy taxonomy

Strategies differ along three independent, mixable axes: step derivation, presentation, cadence.

| Strategy | Derivation | Deterministic? | Notes |
|---|---|---|---|
| **Fixed timestep** *(current)* | accumulate elapsed → whole steps of `1e9/fps` | ✅ | stable; bounded catch-up; needs interpolation |
| **Variable timestep** | one step/frame, `dt = elapsed` | ❌ | simplest; frame-rate dependent |
| **Capped variable timestep** | `dt = min(elapsed, maxDt)` | ❌ | avoids worst spikes |
| **Adaptive timestep** | interval adjusts to an error bound | ~ | self-stabilising; complex |
| **Fixed + interpolation** | fixed steps, render `alpha ∈ [0,1)` | ✅ | what the engine does now |
| **Fixed + extrapolation** | fixed steps, render *ahead* | ✅ | lower latency; can overshoot |
| **Event-driven / turn-based** | `step()` on discrete events only | n/a | time never advances the sim |
| **Split-rate** *(retired `SplitHostLoop`)* | physics fixed, render on rAF | ✅ | scheduling, not step, strategy |

**Interpolation vs extrapolation** is the key presentation choice: interpolation blends previous↔current
(smooth, one step behind); extrapolation predicts ahead (responsive, can overshoot).

### 1.3 Current coupling

The concrete `Engine` hardcodes the fixed strategy in four places, and the contracts assume it:

```ts
readonly #simulation: FixedTimestepDriver<G>;                                   // concrete type
this.#simulation = new FixedTimestepDriver(game, config.fps, host.now(), ...);  // constructed inline
this.#simulation.advance(nowNanos, input);                                      // called directly
this.#present?.({ game, alpha: this.#simulation.clock.pending, renderer });     // alpha = pending steps
```

Deeper: `ISimulationDriver.clock: IFrameClock` and `canStep` are fixed concepts (`stepInterval`,
`pending`, `consume`); `IEngineConfig.fps` assumes a fixed rate; `ISimulationContext` has **no `dt`**.

### 1.4 Proposal: make `Engine` driver-agnostic

1. **Inject the driver** — accept `ISimulationDriver<G>` (or a factory) instead of constructing it inline.
2. **Put `dt` on the context** and widen `clock`:
   ```ts
   interface ISimulationContext {
     readonly clock: IClock;     // was IFrameClock
     readonly dt: Nanoseconds;   // NEW
     readonly metrics: IPerformanceMetrics;
     readonly input: IInputState;
   }
   ```
3. **Move fixed state into the fixed driver** — `pending`/`canStep`/`stepInterval` leave the base interface.
4. **Decouple `alpha` from `pending`** — the driver exposes `interpolation(): Alpha` instead of the engine reading `clock.pending`.
5. **Generalise config** — `fps` becomes a per-strategy option inside `IEngineConfig`.

Result: adding a `VariableTimestepDriver` / `CappedVariableTimestepDriver` / `EventDrivenDriver` is a
new `ISimulationDriver` with no change to engine, game, or host.

---

## 2. Pause — game-local scene + engine throttle

### 2.1 Requirements

A correct pause must let the game, on its own, do all three:

1. **Stall its presentation** — animations freeze; the world stops moving on screen.
2. **Stop input reaching the simulation** — gameplay input (move, shoot, rotate) must not reach the
   world/characters while paused.
3. **Draw a pause screen and navigate it** — a menu the player can interact with.

### 2.2 What the "overlay mode" phrasing gets wrong

- **"Overlay" implies a second rendering layer** stacked on top of the game. There is no such layer:
  the game's `present` already draws the *entire* frame. Drawing a pause screen is just a **branch in
  `present`** — when the game is in its `paused` scene, draw the pause screen (a dimmed snapshot of the
  world plus a menu) instead of the live world. No separate overlay object is needed.
- **"Only starts running when paused" is backwards** — `present` runs every frame. The pause screen is
  not a thing that "starts"; it is a state-dependent branch of the always-running `present`.
- **It conflates two orthogonal concerns**: the game's *scene* (playing vs paused vs menu) and the
  engine's *loop cadence* (full-rate fixed-timestep vs throttled GUI). These should be designed
  separately.
- **The "weaker repaint schedule" is an optimisation, not a requirement** — worth having, but it is
  independent of the core pause behaviour. Wiring it into the core design over-complicates it.

The requirements are actually satisfied by a **game-local state machine** (the earlier Option E),
refined as follows.

### 2.3 The refined proposal: scene + request + throttle

**Part A — the game owns a scene.** A game-local `Scene` state machine:

```ts
type Scene = 'playing' | 'paused' | 'menu' | 'gameOver';
```

- `step(context)` branches on the scene:
  - `playing` — advance the world; on a "pause" action → `scene = 'paused'` and emit `pauseRequested`.
  - `paused` — route input to the **menu** (up/down/select), never to the world; on "resume" →
    `scene = 'playing'` and emit `resumeRequested`.
- `present(context)` branches on the scene:
  - `playing` — draw the animated world.
  - `paused` — draw the pause screen (a dimmed, non-animating world + the menu).

This alone meets requirements 1–3 with **zero engine change** — it is purely game logic.

**Part B — the engine owns the cadence.** The game *requests* pause/resume through the event channel
(§2.4); the engine keeps authority over `paused`, its events, and the clock reset. When `paused`, the
engine switches from the fixed-timestep loop to a **throttled GUI loop** (§2.5) so it does not burn a
full 60 fixed steps per second on a static menu.

### 2.4 The request channel (event, option D)

`IGame` is an emitter of request events; the engine subscribes and owns the state (unchanged from the
earlier event proposal):

```ts
type GameRequestEvents = { pauseRequested: void; resumeRequested: void; quitRequested: void };
interface IGame<F = unknown> extends ISimulationStep, IPresentable<F>, IEventEmitter<GameRequestEvents> {}
```

The game emits `pauseRequested`/`resumeRequested` on scene transitions; the engine maps them to its
`paused` setter and subscribes in the constructor, unsubscribing on `stop()`.

### 2.5 The throttled paused loop

When `paused`, the engine stops running `advance(now, input)` (no fixed steps, no simulation debt) and
instead runs a reduced-rate GUI loop that still calls `present` (and one `step` for menu navigation):

```ts
const loop = (nowNanos: Timestamp) => {
  const input = this.#sampleInput();
  if (this.#paused) {
    // GUI mode: render/navigate at a low rate, never advance the simulation
    if (nowNanos - this.#lastGuiNanos >= GUI_INTERVAL_NS) {
      this.#lastGuiNanos = nowNanos;
      this.#game.step({ clock, dt: 0, metrics, input });   // menu navigation only
      this.#present?.({ game, alpha: 0, renderer });
    }
  } else {
    this.#simulation.advance(nowNanos, input);
    this.#present?.({ game, alpha: this.#simulation.clock.pending, renderer });
  }
  this.#handle = this.#host.schedule(loop);
};
```

Throttling options, cheapest first:

1. **Frame-skip** — keep the rAF loop but present only every N frames (e.g. every 12 ≈ 5 Hz).
2. **Timer swap** — cancel rAF on pause and drive a `setTimeout(…, 200)` loop for the GUI, re-entering rAF on resume.
3. **Dirty-flag** — repaint only when an input event changes the menu selection.

`GUI_INTERVAL_NS` is the "weaker repaint schedule": the pause screen is static, so 5–10 Hz is ample and
input lag is irrelevant there.

**Summary of the split:** the game owns *what is shown and what input does* (its scene); the engine owns
*how often the loop runs and whether the simulation advances* (its cadence). That is the clean division
the requirements point at, and it absorbs Option E into the engine's event/authority model rather than
leaving two disjoint pause states.

---

## 3. IHost & multi-threading

### 3.1 Where the responsibility lies

**Multi-threading is an `IHost` (host/transport) concern, not a simulation concern.** The simulation
layer (`ISimulationDriver` + `IGame`) is pure logic — `advance(now, input)` runs `game.step()`
deterministically — and must be **thread-agnostic**, never spawning threads. The *host* decides where the
loops run (one thread, a worker, several workers) and how state crosses the boundary. The one requirement
the host imposes back on the simulation is **portability**: the game state must be transferable
(structured-clonable or `SharedArrayBuffer`-shared). The engine already satisfies this for rendering —
`RenderCommand`/`IFrame` are plain serialisable data, so a worker can compute a frame and *transfer* it.

### 3.2 Proposal: multi-threaded `IHost` (web worker)

- **Main thread** — render only: `rAFScheduler` → `renderer.render(frame)` on `Canvas2DRenderer`
  (or an `OffscreenCanvas`); samples keyboard → `postMessage`s the `IInputState` to the worker.
- **Worker thread** — simulation: `FixedTimestepDriver` + `game.step`, then `game.present` →
  `FrameBuilder` → `postMessage` the `IFrame` back to the main thread.
- **Handoff** — the `IFrame` is transferred (not copied) because `RenderCommand` is structured-clonable.
  A `SharedArrayBuffer` holds the `alpha` if render interpolation must read it without a message round-trip.

```ts
// main.ts
const worker = new Worker(new URL('./simulation.worker.ts', import.meta.url));
worker.onmessage = ({ data }) => renderer.render(data);           // data: IFrame
worker.postMessage(input);                                        // IInputState

// simulation.worker.ts
const driver = new FixedTimestepDriver(game, fps, /* start */);
self.onmessage = ({ data: input }) => {
  driver.advance(performance.now() * 1e6, input);
  const frame = new FrameBuilder();
  game.present({ alpha: driver.clock.pending, frame });
  postMessage(frame);                                             // IFrame transfers to main
};
```

### 3.3 Proposal: multi-threaded `IHost` (Node `worker_threads`)

Identical shape using `worker_threads`: the `Worker` runs the simulation; the main thread orchestrates
(or renders to a terminal/headless surface). `postMessage` carries the `IFrame`; `SharedArrayBuffer` +
`Atomics` provide shared state when a zero-copy `alpha` is needed. The same `ISimulationDriver`/`IGame`
run unchanged in both environments — only the host differs.

### 3.4 Alternative `IHost` implementations

**`ManualHostLoop`** — the deterministic test host, composed from the existing adapters:

```ts
class ManualHostLoop implements IHostLoop {
  readonly clock = new ManualClock();
  readonly scheduler = new ManualScheduler();
  now(): Timestamp { return this.clock.now(); }
  schedule(step: (now: Timestamp) => void): IScheduleHandle { return this.scheduler.schedule(step); }
  cancel(handle: IScheduleHandle): void { this.scheduler.cancel(handle); }
  /** Drive exactly one frame at the given time. */
  tick(now: Timestamp): void { this.scheduler.tick(now); }
  /** Move the clock forward (before a `tick`). */
  advance(byNanos: Nanoseconds): void { this.clock.advance(byNanos); }
}
```

A test drives `advance(frameNanos); tick(clock.now())` in a loop — exactly the deterministic harness the
engine's tests use. Currently `ManualClock`/`ManualScheduler` are composed ad-hoc; this names the pair.

**`NodeHostLoop`** — headless/server simulation (no rAF in Node):

```ts
class NodeHostLoop implements IHostLoop {
  now(): Timestamp { return Math.trunc(performance.now() * 1e6); }
  schedule(step: (now: Timestamp) => void): IScheduleHandle {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => step(this.now());
    ch.port2.postMessage(null);
    return { token: ch };
  }
  cancel(handle: IScheduleHandle): void {
    (handle.token as MessageChannel).port1.onmessage = null;
    (handle.token as MessageChannel).port1.close();
  }
}
```

`MessageChannel` gives sub-millisecond wakeups (no `setTimeout` clamping), so the loop runs "as fast as
the event loop drains" — the fixed-timestep accumulator keeps the simulation at the configured `fps`.
Swap `MessageChannel` for `setInterval(…, intervalNanos)` if a throttled cadence is preferred.

**`WorkerHostLoop`** — the multi-threaded host from §3.2/§3.3. It is the same `IHostLoop` shape, but
`schedule`/`now` run on the worker side while `cancel`/frame handoff cross the `postMessage` boundary. It
is the point where the engine's simulation portability (§3.1) becomes a live worker.

**`ReplayHostLoop`** — deterministic playback for debugging/replay:

```ts
class ReplayHostLoop implements IHostLoop {
  constructor(readonly frames: readonly Timestamp[]) {}
  #i = 0;
  now(): Timestamp { return this.frames[this.#i] ?? this.frames.at(-1)!; }
  schedule(step: (now: Timestamp) => void): IScheduleHandle {
    step(this.now());
    this.#i = Math.min(this.#i + 1, this.frames.length - 1);
    return { token: null };
  }
  cancel(_h: IScheduleHandle): void {}
}
```

Feeding a recorded `Timestamp[]` reproduces a run bit-for-bit — the same determinism guarantee that makes
`ManualHostLoop` testable, applied to a captured session.

**`UnlockedHostLoop`** *(retired)* — the old "no vsync, run as fast as possible" host (a `MessageChannel`
pump like `NodeHostLoop`). It was retired because it adds a second scheduler for no benefit to three 2D
games; it remains the reference for a benchmark-oriented host.
