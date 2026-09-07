# Implementation Proposals

> **Author:** MathAid
> **Status:** The forward work log. Each proposal below is a **detailed, step-by-step implementation
> process**. Work that is already done lives in [`IMPLEMENTED.md`](./IMPLEMENTED.md); work that is
> deliberately deferred lives in [`SHELVED.md`](./SHELVED.md).

Proposals are grouped: engine, app host, then games.

---

## 1. Engine — simulation step strategies

### 1.1 Goal

Allow `Engine` to drive any stepping strategy, not just the fixed timestep. **Constraint:** only
strategies that are *simulation stepping* belong here; strategies that do extra *scheduling* (e.g.
`SplitHostLoop`) are shelved → [`SHELVED.md`](./SHELVED.md).

### 1.2 Strategies to implement

| Driver | `dt` derivation | Notes |
|---|---|---|
| `FixedTimestepDriver` | accumulate → whole steps of `1e9/fps` | **done** (`IMPLEMENTED.md`) |
| `VariableTimestepDriver` | `dt = elapsed` per frame | non-deterministic, simplest |
| `CappedVariableTimestepDriver` | `dt = min(elapsed, maxDt)` | avoids spike blow-ups |
| `AdaptiveTimestepDriver` | interval adjusts to an error bound | self-stabilising |
| `EventDrivenDriver` | steps only on discrete events | for turn-based/puzzle logic |

Presentation variants (interpolation vs extrapolation) are a render-side concern, addressed in §1.4.

### 1.3 Step-by-step

1. **Widen the base contract.** Move fixed-specific state out of `ISimulationDriver` so only
   `advance(now, input)` and read-only views remain. `pending`, `canStep`, `stepInterval` move into
   `FixedTimestepDriver`.
2. **Add `dt` to the step context.**
   ```ts
   interface ISimulationContext {
     readonly clock: IClock;        // was IFrameClock
     readonly dt: Nanoseconds;      // NEW: this step's elapsed time
     readonly metrics: IPerformanceMetrics;
     readonly input: IInputState;
   }
   ```
3. **Add a presentation accessor** so the engine asks the driver for `alpha` instead of reading
   `clock.pending`:
   ```ts
   interface ISimulationDriver<G extends IGame = IGame> {
     advance(now: number, input: IInputState): number;
     interpolation(): Alpha;
   }
   ```
4. **Inject the driver** into `Engine` (constructor param or factory) instead of constructing
   `FixedTimestepDriver` inline.
5. **Implement each driver.** For a variable driver, step once per frame with `dt = elapsed`; for a
   capped one, clamp `dt`; for adaptive, adjust the interval toward a target error; for event-driven,
   only call `step` when an external event signals it.
6. **Generalise `IEngineConfig`.** Move `fps` into a per-strategy `simulation` options object.
7. **Test.** Drive each driver with `ManualClock`/`ManualScheduler` and assert the expected step
   count and `dt` values (determinism for fixed, `dt` propagation for variable).

**Acceptance:** `Engine.run()` accepts any `ISimulationDriver`; swapping drivers requires no change to
games, host, or renderer.

### 1.4 Presentation: interpolation vs extrapolation

Keep the current interpolation (`alpha` in `[0,1)`). Add an optional **extrapolation** mode where the
renderer draws the *predicted* next state (lower latency). This is a renderer/glue concern, not a
driver concern; document it as a flag on the presentation context rather than a new driver.

---

## 2. Engine — dual pause interfaces (`IGame` + `IEngine`)

### 2.1 Goal

Two complementary pause mechanisms that serve **different purposes**, both retained:

- **`IEngine.paused`** (existing, keep) — the *engine-level* halt: stops the fixed-timestep stepping,
  discards pause debt on resume, emits `paused`/`resumed`. It is about the **loop cadence**.
- **`IGame` pause** (new) — the *game-level* state: the game stops advancing its own world and (if it
  wants) draws a pause menu. It is about the **game's scene**, independent of the loop.

The game may *request* engine pause, but the two remain distinct.

### 2.2 Step-by-step

1. **Keep `IEngine.paused` as-is** (setter + `paused`/`resumed` events + clock reset).
2. **Give `IGame` a pause signal.** Two equivalent shapes (choose one, or both):
   - **Event** (matches the engine's emitter pattern): `IGame extends IEventEmitter<GameRequestEvents>`
     with `pauseRequested`/`resumeRequested`; the game emits on its own scene transitions.
   - **Return value** (pure, no shared emitter): `step()` returns a `StepSignal` (see §4) that carries
     `{ kind: 'pause' }`.
3. **The game halts `step` itself.** When in its `paused` scene, `step` routes input to the pause menu
   (never the world) and does not advance simulation; `present` draws the pause screen.
4. **Optionally draw the pause menu.** If `IGame` exposes a `present` that is *always* called (even
   while the engine is paused), the game can render its own pause UI. This is the "may include an
   interface for drawing the pause menu" option — see §2.3.
5. **Wire the request to the engine.** The engine subscribes to the game's request and sets its own
   `paused` (authority stays with the engine).

### 2.3 The "draw the pause menu" option

If the pause menu must be interactive, the engine's paused loop must still call `present` (and a
lightweight `step`) at a reduced rate — the **throttled GUI loop**:

```ts
const loop = (nowNanos) => {
  const input = this.#sampleInput();
  if (this.#paused && nowNanos - this.#lastGuiNanos >= GUI_INTERVAL_NS) {
    this.#lastGuiNanos = nowNanos;
    this.#game.step({ clock, dt: 0n, metrics, input }); // menu navigation only
    this.#present?.({ game, alpha: 0, renderer });
  } else if (!this.#paused) {
    this.#simulation.advance(nowNanos, input);
    this.#present?.({ game, alpha: this.#simulation.clock.pending, renderer });
  }
  this.#handle = this.#host.schedule(loop);
};
```

`GUI_INTERVAL_NS` is the "weaker repaint schedule": ~5–10 Hz is ample for a static menu.

**Acceptance:** the game can pause itself (stall world, ignore gameplay input, navigate a menu) while
the engine remains the single authority over `paused` and its clock reset.

---

## 3. Engine — live metrics

### 3.1 Goal

Expose current-frame metrics (FPS, `alpha`, `dt`, steps) so the host can render them live.

### 3.2 Step-by-step

1. **Define a `LiveMetrics` snapshot.**
   ```ts
   interface LiveMetrics {
     readonly fps: number;          // steps in the last closed second
     readonly alpha: number;        // current interpolation factor
     readonly dtNanos: number;      // last step interval
     readonly pendingSteps: number; // accumulator remainder
     readonly elapsedNanos: number; // since start
   }
   ```
2. **The engine computes it each frame.** The `Engine` already owns `metrics` (`IPerformanceMetrics`
   ring) and `clock`; add a `readonly live: LiveMetrics` getter (or a per-frame `metrics` event).
3. **Emit a `metrics` event** (recommended for zero-polling HUDs): add `metrics: LiveMetrics` to
   `EngineEvents`, emitted once per frame (throttle to `fps-reset` cadence if allocation matters).
4. **Host consumes it.** The app subscribes to `metrics` and renders a HUD (see §8 app controls).

**Acceptance:** a HUD can show FPS/alpha/dt/step count that updates in real time while the game plays.

---

## 4. Engine — `step`/`present` return values (control signals)

### 4.1 Goal

Let `IGame.step` and `IGame.present` return values that dictate how the engine/simulation/renderer
invoke them — e.g. reduced stepping (frame dropping), skipped simulation (cut scene), or reduced
rendering (non-in-game GUI). This integrates with the pause proposal (§2): a cut scene requests a
throttle; a pause menu requests `present`-only.

### 4.2 Step-by-step

1. **Define signal unions.**
   ```ts
   type StepSignal = 'continue' | 'pause' | 'resume' | 'skip' | 'throttle';
   type PresentSignal = 'full' | 'reduced' | 'none';
   ```
2. **Change the contracts.**
   ```ts
   interface ISimulationStep { step(context: ISimulationContext): StepSignal; }
   interface IPresentable<F = unknown> { present(context: IPresentationContext<F>): PresentSignal; }
   ```
   (Keep a default so games returning `void` still type-check — or migrate the three games to return
   `'continue'`/`'full'`.)
3. **Engine interprets `StepSignal`.**
   - `continue` — run normally.
   - `pause`/`resume` — set `this.paused` (authority stays with the engine).
   - `skip` — stop stepping this frame (cut scene: no input, no world advance).
   - `throttle` — halve the step rate (frame dropping).
4. **Engine/renderer interpret `PresentSignal`.**
   - `full` — render normally.
   - `reduced` — render at a lower rate (skip N frames).
   - `none` — skip rendering entirely.
5. **Persist throttle state** in the engine (e.g. a `#stepScale`, `#renderScale`) so `throttle`/`reduced`
   persist across frames until the game signals otherwise.
6. **Test.** Assert that a game returning `'skip'` stops stepping, `'throttle'` halves steps, and
   `'none'` stops the renderer being called.

**Acceptance:** cut scenes and in-game GUI can drop frames/simulation without the game touching the
loop, and pause reuses the same channel.

---

## 5. Engine — audio & visual sprites

### 5.1 Goal

Add audio playback and image sprites (png/gif/jpeg — no 3D).

### 5.2 Audio — step-by-step

1. **Define `IAudioSink`.**
   ```ts
   interface IAudioSink {
     play(name: string, opts?: { volume?: number; loop?: boolean }): void;
     stop(name: string): void;
     setVolume(volume: number): void;
   }
   ```
2. **Implement `WebAudioSink`** over the Web Audio API (an `AudioContext` + a registry of loaded
   buffers). Load assets on `connect`; play/stop via buffer sources.
3. **Attach to `IEngine`** as `setAudio(sink)` (mirroring `setRenderer`), and add `audio` to
   `EngineEvents` (`audioStarted`/`audioStopped` if needed).
4. **Games request audio** via a declarative channel (a `playSound('name')` call in `step`, or a
   returned audio command) — never touching the Web Audio API directly.
5. **Noop/Recording sinks** for tests, mirroring the renderers.

### 5.3 Visual sprites — step-by-step

1. **Define `SpriteRegistry`.** Maps `SpriteRef.id` → an `ImageBitmap`/`HTMLImageElement` (png/gif/jpeg).
   ```ts
   interface ISpriteRegistry {
     load(id: string, source: string): Promise<void>;
     get(id: string): ImageBitmap | undefined;
   }
   ```
2. **`Canvas2DRenderer` draws sprites.** Resolve `RenderCommand { kind: 'sprite' }` through the
   registry and `drawImage` at the transform (replacing the current magenta placeholder). Respect
   `capabilities.images` (Noop/Recording report `false`).
3. **Wire the registry** into the renderer (`renderer.setSprites(registry)`) or the engine.
4. **Games declare sprite ids** in their `present` (`frame.sprite({ id: 'invader-a' }, transform)`).
5. **Test.** `RecordingRenderer` still records `sprite` commands; `Canvas2DRenderer` with a mocked
   registry draws the image at the right transform.

**Acceptance:** a game can play sounds and draw png/gif/jpeg sprites without touching Web Audio or
canvas image APIs.

---

## 6. Engine — host alternatives & generic `IScheduleHandle`

### 6.1 Goal

Ship the host alternatives and type the schedule handle's token.

### 6.2 Step-by-step

1. **Make the handle generic.**
   ```ts
   interface IScheduleHandle<T = unknown> {
     readonly token: T;
   }
   interface IScheduler<T = unknown> {
     schedule(step: (now: Timestamp) => void): IScheduleHandle<T>;
     cancel(handle: IScheduleHandle<T>): void;
   }
   ```
   Then `rAFScheduler` becomes `IScheduler<number>`, `NodeHostLoop` is `IScheduler<MessageChannel>`,
   `ManualScheduler` is `IScheduler<null>` — no more untyped `unknown`.
2. **Update existing schedulers** (`ManualScheduler`, `rAFScheduler`) to the generic signatures.
3. **Implement the hosts** (details in `IMPLEMENTED.md` §6 / the §3 of the previous revision):
   - `ManualHostLoop` (`ManualClock` + `ManualScheduler`) — test.
   - `NodeHostLoop` (`performance.now` + `MessageChannel`) — headless/server.
   - `WorkerHostLoop` — multi-threaded (web worker / `worker_threads`).
   - `ReplayHostLoop` — deterministic `Timestamp[]` playback.
4. **Test** each host against a `FixedTimestepDriver` for the expected step count.

**Acceptance:** every `IHostLoop` is generic over its token type, and each host runs the same engine
unchanged.

---

## 7. App — controls (`apps/web/scripts/main.ts`)

### 7.1 Goal

A control surface for the browser app: game selection, live metrics, host/simulator switching,
resolution, key-map readout, FPS/history, and input name.

### 7.2 Step-by-step

1. **Model the settings.**
   ```ts
   interface AppSettings {
     game: 'tetris' | 'snake' | 'invaders';
     fps: number;
     fpsHistory: number;
     width: number;
     height: number;
     host: 'browser' | 'manual' | 'node' | 'replay';
     simulator: 'fixed' | 'variable' | 'event-driven';
     inputName: string;
   }
   ```
2. **Source the settings** from URL query params (`?game=snake&fps=120&width=640…`) so a refresh
   reconfigures the app without code edits. Fall back to defaults.
3. **Wire `host` and `simulator`** through the `selectGame`/engine construction — instantiate the
   chosen `IHostLoop` and `ISimulationDriver` (§1, §6) instead of hard-coding `BrowserHostLoop` +
   `FixedTimestepDriver`.
4. **Apply resolution** — pass `settings.width`/`settings.height` to `renderer.resize` (and, once §5
   DPI work lands, scale by `devicePixelRatio`).
5. **Render a metrics HUD** — subscribe to the engine `metrics` event (§3) and draw FPS/alpha/dt/step
   count into a `<pre>`/canvas overlay.
6. **Read-only key map** — render the current game's `bindings` map (action → codes) from
   `selectGame` into a panel.
7. **Input name** — pass `settings.inputName` to `engine.attachInput(keyboard, settings.inputName)`.
8. **Expose controls** as a small settings panel (or keep it query-param only for now; a DOM form is a
   later nicety).

**Acceptance:** the same page can run any game at any resolution/FPS/host/simulator with a live HUD and
a visible (read-only) key map.

---

## 8. Games — state abstraction on `IGame`

### 8.1 Goal

A composable state model on top of `IGame`: **Game** (pure simulation + render + audio),
**Pause menu** (halts/slows physics and/or rendering, conditional repaint), and **Level transitions**
(recursive — a transition can wrap a game, a pause menu, or another transition).

### 8.2 Step-by-step

1. **Define a `GameState`/`Scene` contract** (directly on `IGame` or a sub-interface).
   ```ts
   type Scene = 'playing' | 'paused' | 'transitioning' | 'gameOver';
   interface IGame<F = unknown> extends ISimulationStep, IPresentable<F> {
     readonly scene: Scene;
     readonly transition?: IGame<F>;  // recursive: the next/deferred game
   }
   ```
2. **Route `step`/`present` by scene** in each game: `playing` → world; `paused` → menu input + static
   UI; `transitioning` → advance a transition timeline and swap to `transition` when done.
3. **Make transitions recursive** — a `transition` may itself have a `transition`, enabling
   `game → gameOver → nextLevel → …` chains.
4. **Bi-directional communication** — the game emits `pauseRequested`/`transitionRequested` (or returns
   a `StepSignal`), and the engine replies by throttling (§2, §4); this is the concrete form of the
   "bi-directional" note.
5. **Conditional repaint** — a paused/transition scene returns `PresentSignal = 'reduced'` (§4) so the
   engine drops frames.

**Acceptance:** any game can express `playing → paused → gameOver → (recursive) transition` without the
engine knowing the specific scenes.

---

## 9. Games — Tetris: scoring, combo, pause menu, metrics

### 9.1 Scoring rules (cumulative — bullets can stack in one lock)

1. **Line cleared:** `+1` point per line, `+0.05` combo.
2. **Multi-line lock:** `+1` stacking on the base for each line — e.g. an `I` clearing 4 rows scores
   `4 + 1 = 5`, `+0.25` combo.
3. **Deluxe clear (cascade):** clearing continues after lock, delaying spawn; each successive clearing
   adds an *incrementing* stacking bonus (`+1`, `+2`, `+3`, …), `+0.25` combo each.
4. **Full clean:** `3+` lines and an empty board → `×2` on the base (3 rows → `3 × 2 = 6`), `+0.75`
   combo.

### 9.2 Combo meter

- Range `[0, 1]`, clamped at both ends.
- **Add** on line clears per §9.1.
- **Subtract** `0.001` per tetromino fall tick.

### 9.3 Metrics

- Deluxe points — current, all-time high.
- Total points — current, all-time high.
- Combo meter.
- Board clear count — current, all-time high.

### 9.4 Pause menu

Configure tetromino colours, choose RNG, seed, game speed, volume, and the key map (read + write).

### 9.5 Step-by-step

1. **Add a `score`/`combo`/`deluxe` model** to `Tetris` (plain fields, persisted across a session).
2. **Hook scoring into `#lock`/`#clearLines`** — compute `lines`, detect multi-line, cascade (deluxe),
   and full-clean, then apply the cumulative formula and update the combo meter (clamped).
3. **Decay the combo** in `step` (subtract `0.001` per fall tick).
4. **Expose metrics** via a read-only `Tetris.metrics` object (or a `metrics` event) for the HUD (§7).
5. **Add a `pause` scene** (§8) with a settings model: colours, RNG choice (`Mulberry`/`PCG`/…), seed,
   speed, volume, key map. Persist settings through a `Settings` object the game owns.
6. **Apply settings** on resume (rebuild the bag with the chosen RNG+seed, remap keys, set speed).
7. **Render** score/combo/board-clear in `present` (and the pause menu when paused).

**Acceptance:** all four scoring rules stack correctly, the combo meter is clamped and decays per
tick, and the pause menu edits colours/RNG/seed/speed/volume/keys that take effect on resume.

---

## 10. Games — Snake: pause menu

### 10.1 Goal

A Snake pause menu with sprite toggling, stage configuration, colour configuration, and mode
selection. (Core Snake rules remain TBD.)

### 10.2 Step-by-step

1. **Add a `pause` scene** (§8) to `Snake`.
2. **Settings model:**
   - `sprites` — toggle between rect rendering and sprite rendering (§5).
   - `stage` — background colour, border colour, obstacle placement (a list of `Cell`s).
   - `snakeColor` / `eggColor` — per-segment and food colours.
   - `mode` — `'arcade'` (endless, speed ramps) | `'level'` (a defined sequence of stages).
3. **Apply on resume** — rebuild the board colours, place obstacles, switch colour scheme, and select
   the movement/level logic by mode.
4. **Render** the pause menu (and the stage colours) in `present`.

**Acceptance:** toggling sprites, colours, obstacles, and mode from the pause menu takes effect on
resume, and the mode switch changes game behaviour.

---

## 11. Games — Space Invaders

**TBD** — no rules specified yet. The existing entity/collision model (`IMPLEMENTED.md` §5) is the
foundation; rules and a pause menu will be spec'd when requirements are provided.

---

## 12. Cross-cutting: HiDPI / responsive buffer

(Remaining from the now-fixed stretching issue — `IMPLEMENTED.md` §8.) Scale the drawing buffer by
`devicePixelRatio` and the 2D context by `dpr` so the 440×520 logical canvas renders crisply on 2×/3×
displays. Depends on the renderer's `resize` (currently fixed resolution).

**Step-by-step:** (1) `Canvas2DRenderer.resize` multiplies `canvas.width/height` by `dpr` and calls
`ctx.scale(dpr, dpr)`; (2) `main.ts` passes the logical resolution and the renderer computes the
physical size; (3) CSS keeps the intrinsic `max-width/max-height` fit (§ of `IMPLEMENTED.md`).
