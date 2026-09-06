# Extending the Engine Core — Simulation Strategies & Pause Ownership

> **Status:** Design reference — documents how to extend the engine's simulation core and its control-flow boundary.
> **Author:** MathAid

This document covers two extension points of the engine that are currently **fixed** in the
implementation but **open** by design: the simulation step strategy (how `dt` is derived and how
`game.step` is driven), and the pause boundary (who may *request* a pause versus who *owns* it).

---

## Part 1 — Simulation step strategies

### 1.1 The seam

The engine drives a game through a single contract:

```ts
interface ISimulationDriver<G extends IGame = IGame> {
  readonly clock: IFrameClock;
  readonly metrics: IPerformanceMetrics;
  readonly game: G;
  advance(now: number, input: IInputState): number; // advance wall time; run steps
  readonly canStep: boolean;
}
```

Only one implementation exists today — `FixedTimestepDriver` — but the interface is the intended
seam for any other "engine core". Every strategy below is an `ISimulationDriver` (or a small
variant of it) that decides **how `dt` is derived** from the nanosecond `now` samples and **how
`game.step()` is invoked**.

### 1.2 Strategy taxonomy

Strategies differ along three independent axes, which can be mixed:

1. **Step derivation** — how the per-step `dt` is produced from wall time.
2. **Presentation** — how the sub-frame remainder (`alpha`) is used to render.
3. **Cadence** — whether stepping is time-driven or event-driven.

| Strategy | Derivation | Deterministic? | Notes |
|---|---|---|---|
| **Fixed timestep** *(current `FixedTimestepDriver`)* | accumulate elapsed → whole steps of `1e9/fps` | ✅ yes | stable physics; bounded catch-up; needs interpolation |
| **Variable timestep** | one step per frame, `dt = elapsed` | ❌ no | simplest; frame-rate dependent; unstable at large `dt` |
| **Capped variable timestep** | one step per frame, `dt = min(elapsed, maxDt)` | ❌ no | avoids the worst spikes; still non-deterministic |
| **Adaptive timestep** | interval shrinks/grows to keep a target error bound | ~ | self-stabilising; complex; rarely needed for 2D games |
| **Fixed + interpolation** | fixed steps, render with `alpha ∈ [0,1)` | ✅ | what the current engine does |
| **Fixed + extrapolation** | fixed steps, render *ahead* of the latest state | ✅ | lower input latency; can overshoot visually |
| **Event-driven / turn-based** | `step()` only on discrete events, never on time | n/a | for puzzles/turn-based games; time does not advance the sim |
| **Split-rate** *(retired `SplitHostLoop`)* | physics fixed (MessageChannel), render on rAF | ✅ | a *scheduling* alternative, not a step strategy |

**Interpolation vs extrapolation** is the key presentation distinction: interpolation renders a
blend between the previous and current step (smooth but one step behind); extrapolation predicts
the next step (responsive but can visually overshoot). The current engine is interpolating.

### 1.3 Where the engine is fixed today

The concrete `Engine` is coupled to the fixed strategy in four places, and the contracts
themselves assume it:

```ts
// engine.ts (current)
readonly #simulation: FixedTimestepDriver<G>;                                   // concrete type
this.#simulation = new FixedTimestepDriver(game, config.fps, host.now(), ...);  // constructed inline
this.#simulation.advance(nowNanos, input);                                      // called directly
this.#present?.({ game, alpha: this.#simulation.clock.pending, renderer });     // alpha = pending steps
```

Deeper coupling:

- `ISimulationDriver.clock: IFrameClock` and `canStep` are fixed-timestep concepts
  (`stepInterval`, `pending`, `consume`). A variable driver has none of these.
- `IEngineConfig.fps` assumes a fixed rate.
- `ISimulationContext` has **no `dt`**, so a game cannot express "advance by this exact elapsed".

### 1.4 The refactor to make `Engine` driver-agnostic

**Step 1 — inject the driver.** Accept an `ISimulationDriver<G>` (or a factory) instead of
constructing `FixedTimestepDriver` inline:

```ts
constructor(game: G, config: IEngineConfig, host: IHostLoop, simulation: ISimulationDriver<G>, present?: PresentFrame<G, R>)
```

**Step 2 — put `dt` on the step context**, and widen `clock` to the base `IClock`:

```ts
interface ISimulationContext {
  readonly clock: IClock;          // was IFrameClock — fixed-specific fields move to the fixed driver
  readonly dt: Nanoseconds;        // NEW: elapsed time for this step (fixed = stepInterval, variable = elapsed)
  readonly metrics: IPerformanceMetrics;
  readonly input: IInputState;
}
```

**Step 3 — move fixed-specific state into the fixed driver.** `pending`, `canStep`, and
`stepInterval` belong to `FixedTimestepDriver`, not the base `ISimulationDriver`. The base
interface keeps only `advance(now, input)` + read-only `clock`/`metrics`/`game`.

**Step 4 — decouple `alpha` from `pending`.** Add a presentation accessor to the driver so the
engine asks *"what alpha do I present with?"* rather than reaching into `clock.pending`:

```ts
interface ISimulationDriver<G> {
  advance(now: number, input: IInputState): number;
  /** Sub-frame interpolation factor in [0,1) for presentation. */
  interpolation(): Alpha;
}
```

A fixed driver returns `pending`; a variable driver returns a normalised `dt` (or `0`).

**Step 5 — generalise config.** Make `fps` driver-specific (e.g. `IEngineConfig.simulation` carries
a per-strategy options object) rather than a top-level fixed rate.

With those five changes, `Engine.run()` is strategy-agnostic: adding a `VariableTimestepDriver`,
`CappedVariableTimestepDriver`, or `EventDrivenDriver` is just a new `ISimulationDriver`, with no
change to the engine, the game contract, or the host.

---

## Part 2 — Pause: requested from `IGame`, owned by the engine

### 2.1 Current state

Pause is **owned entirely by the engine** and is **not reachable from the game**:

```ts
// IEngine
readonly paused: boolean;

// Engine
set paused(value: boolean) {
  if (value === this.#paused) return;
  if (value) { this.#paused = true; this.#emitter.emit('paused'); }
  else { this.#simulation.clock.reset(this.#host.now()); this.#paused = false; this.#emitter.emit('resumed'); }
}
```

The game contract exposes no pause path — `step`/`present` return `void`, and the context carries
only `clock`/`metrics`/`input`:

```ts
interface ISimulationStep { step(context: ISimulationContext): void; }
```

So a game **cannot request a pause**: only external code (the host binding a key to
`engine.paused = !engine.paused`) can. This is the gap.

### 2.2 The governing principle

The engine must remain the **authority** (it owns the `paused` flag, emits `paused`/`resumed`, and
resets the clock to discard pause debt). The game should be able to **request** a pause. That
split — *request from the game, authority in the engine* — is what every proposal below preserves.

### 2.3 Proposals

**A. `step` returns a control signal (recommended).**

```ts
type StepResult = { kind: 'continue' } | { kind: 'pause' } | { kind: 'quit' };
interface ISimulationStep { step(context: ISimulationContext): StepResult; }
```

The engine inspects the result each step: `if (result.kind === 'pause') this.paused = true;`.
Pure (a value, no hidden state), typed, and trivially extensible to `quit`/`restart`/`fullscreen`.
Cost: changes `step`'s return type from `void`.

**B. `requestPause()` callback on the context.**

```ts
interface ISimulationContext { readonly requestPause(): void; /* ... */ }
```

The engine injects `requestPause = () => { this.paused = true; }`. Minimal and imperative; the game
calls it inline. Cost: the context becomes stateful (a mutable callback).

**C. A bundled control object on the context.**

```ts
interface ISimulationContext { readonly control: IGameControl; }
interface IGameControl { pause(): void; resume(): void; quit(): void; }
```

Same as B but groups the whole request set into one object. More surface, more extensible.

**D. Event-based request.**

The context exposes an emitter (or the engine subscribes to a game event), so the game emits a
`pause-requested` signal the engine handles. Maximally decoupled, but adds event wiring and is
less type-safe than A.

**E. Game-internal pause (scene/state), separate from engine pause.**

The game owns a *scene-level* `paused` state (its state machine idles in `step`), while the
engine-level `paused` stays orthogonal. This is a **different pause** — it does not stop the loop
or reset the clock, so the engine keeps burning frames. Useful as a game-logic concern, not a
substitute for engine pause.

**F. A richer `SimulationSignal` union (generalised control channel).**

A future-proof version of A returning a broader signal:

```ts
type SimulationSignal =
  | { kind: 'none' }
  | { kind: 'pause' }
  | { kind: 'resume' }
  | { kind: 'restart' }
  | { kind: 'request-fullscreen' };
```

### 2.4 Recommendation

Use **A** — `step` returning a control signal. It is the purest form of "request, not command":
the game hands back a typed value, the engine stays the single owner of `paused` and its lifecycle
events/clock reset. **B** is the smallest minimal change if you prefer not to alter `step`'s
signature. **E** is orthogonal and worth having *in addition* for game-logic states (menus,
game-over), not instead of engine pause.
