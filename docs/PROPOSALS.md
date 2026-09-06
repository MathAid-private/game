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

## 2. Pause — event-based request (option D)

### 2.1 The gap

Pause is owned by the engine (`IEngine.paused` + the `paused`/`resumed` events + clock reset) and is
**not reachable from `IGame`** — `step`/`present` return `void` and the context has no pause channel.
Only external code can set `engine.paused`.

### 2.2 Chosen design

The game **emits a request event**; the engine **subscribes and owns the state**. This mirrors the
engine's own `IEventEmitter` pattern, so the `IGame`↔`IEngine` relationship is symmetric: both are
emitters, and the game's request events are the mirror image of the engine's state events.

### 2.3 Proposal: game-emitted request events

**Step 1 — define the request events the game may emit:**

```ts
type GameRequestEvents = {
  pauseRequested: void;
  resumeRequested: void;
  quitRequested: void;
};
```

**Step 2 — `IGame` is also an emitter of requests:**

```ts
interface IGame<F = unknown> extends ISimulationStep, IPresentable<F>, IEventEmitter<GameRequestEvents> {}
```

**Step 3 — the game composes an emitter and emits requests from `step`:**

```ts
class Tetris implements IGame<IFrameBuilder> {
  readonly #emitter = new EventEmitter<GameRequestEvents>();
  on  = this.#emitter.on.bind(this.#emitter) as IGame<IFrameBuilder>['on'];
  off = this.#emitter.off.bind(this.#emitter) as IGame<IFrameBuilder>['off'];
  emit = this.#emitter.emit.bind(this.#emitter) as IGame<IFrameBuilder>['emit'];

  step(context: ISimulationContext): void {
    if (context.input.wasPressed(TETRIS_ACTIONS.pause)) this.emit('pauseRequested');
    // ...
  }
}
```

**Step 4 — the engine subscribes and keeps authority:**

```ts
// Engine constructor
game.on('pauseRequested', () => { this.paused = true; });
game.on('resumeRequested', () => { this.paused = false; });
game.on('quitRequested', () => { void this.stop(); });

// Engine.stop() must unsubscribe to avoid stale closures
this.#unsubs.forEach((unsub) => unsub());
```

**Naming encodes the split** — the game emits `*Requested` (a request); the engine owns `paused` and
emits `paused`/`resumed` (the state). The game never touches `paused` directly.

**Trade-offs:**

- ✅ Natural and symmetric — both `IGame` and `IEngine` are emitters; the game stays decoupled from the engine.
- ✅ Request vs authority is explicit in the naming.
- ✅ Extensible — `quitRequested`, `restartRequested`, `requestFullscreenRequested` slot in as new events.
- ⚠️ Requires each game to compose an `EventEmitter` (small boilerplate, same pattern the engine already uses).
- ⚠️ **Resume asymmetry** — while paused the engine stops calling `step`/`present`, so the game cannot emit
  `resumeRequested` on its own. To let the game resume, the engine must still sample input (or call a
  lightweight `step`) while paused; otherwise resume remains a host-side action (`engine.paused = false`).

---

## 3. IHost & multi-threading

### 3.1 Where the responsibility lies

**Multi-threading is an `IHost` (host/transport) concern, not a simulation concern.** The simulation
layer (`ISimulationDriver` + `IGame`) is pure logic — `advance(now, input)` runs `game.step()`
deterministically — and must be **thread-agnostic**, never spawning threads. The *host* decides where the
loops run (one thread, a worker, several workers) and how state crosses the boundary. This is the same
decoupling already applied to time and rendering: the simulation stays pure; the host is the adapter.

The one requirement the host imposes back on the simulation is **portability**: the game state must be
transferable (structured-clonable or `SharedArrayBuffer`-shared). The engine already satisfies this for
rendering — `RenderCommand`/`IFrame` are plain serialisable data, so a worker can compute a frame and
*transfer* it to the main thread.

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

### 3.4 Other `IHost` implementations

| Host | Clock + Scheduler | Use |
|---|---|---|
| **`BrowserHostLoop`** *(current)* | `NanoClock` (`performance.now`) + `rAFScheduler` (`requestAnimationFrame`) | the browser demo |
| **`ManualHostLoop`** | `ManualClock` + `ManualScheduler` | deterministic tests (currently composed ad-hoc, not a named `IHostLoop`) |
| **`NodeHostLoop`** | `performance.now()` + `setImmediate`/`MessageChannel` | headless/server simulation |
| **`WorkerHostLoop`** | worker clock + worker `MessageChannel` | multi-threaded simulation (§3.2/§3.3) |
| **`ReplayHostLoop`** | a recorded `Timestamp[]` replayed in order | deterministic replay / debugging |
| **`UnlockedHostLoop`** *(retired)* | `performance.now` + `MessageChannel` (no vsync) | run-as-fast-as-possible benchmarks |
