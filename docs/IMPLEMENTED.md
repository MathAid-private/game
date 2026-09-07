# Implemented — what has been shipped

> **Author:** MathAid
> **Status:** Living log of completed work. Update after every landed change.

This document records everything that has been implemented and verified, as opposed to
[`PROPOSALS.md`](./PROPOSALS.md) (planned work) and [`SHELVED.md`](./SHELVED.md) (deferred work).

---

## 1. Engine core — `@games/loop`

**Contracts** (`src/types/`):

- `clock.type.ts` — `Timestamp`, `Nanoseconds`, `IClock`, `IScheduleHandle`, `IScheduler`, `IHostLoop`.
- `input.type.ts` — `InputAction`, `IInputState` (`isDown`/`wasPressed`/`wasReleased`), `IInputSource`.
- `simulation.type.ts` — `Alpha`, `IFrameClock`, `FrameMetric`, `IPerformanceMetrics`,
  `ISimulationContext`, `ISimulationStep`, `IPresentationContext`, `IPresentable`, `IGame<F>`,
  `ISimulationDriver`, `IFrameDriver`.
- `engine.type.ts` — `IEngineConfig`, `EngineEvents<R>`, `IEngine<G, R>`.
- `event.type.ts` — `IEventEmitter<M>`, `EventHandler`, `EventPayload`, `Unsubscribe`.

**Pure implementations** (`src/implementation/`):

- `EventEmitter` (typed, composition-based; error aggregation on `emit`).
- `ManualClock` (`IClock`), `ManualScheduler` (`IScheduler`).
- `FrameClock` (`IFrameClock`) — fixed-timestep accumulator.
- `PerformanceMetrics` (`IPerformanceMetrics`) — one-second step-count ring buffer.
- `FixedTimestepDriver` (`ISimulationDriver`) — bounded catch-up (`MAX_CATCHUP_STEPS`).
- `Engine` (`IEngine`) — composition root; lifecycle events, pause/resume with clock reset, input
  registry, swappable renderer, optional `PresentFrame` glue.
- `NullInputState`, `CompositeInputState` (`IInputState`).

**Browser adapters** (`src/host/`):

- `NanoClock` (`IClock` via `performance.now()`).
- `rAFScheduler` (`IScheduler` via `requestAnimationFrame`).
- `BrowserHostLoop` (`IHostLoop` composition).

**Utilities** (`src/libs/`, `src/const/`):

- `time.ts` — `nanoTime`, `toSeconds`/`toMilliseconds`/`toMicroseconds`/`toNanoseconds`.
- `timing.ts` — `getBrowserRefreshRate`, `toHertz`/`toKiloHertz`/`toMegaHertz`/`toGigaHertz`.
- `game.const.ts` — `SecondMetric`, `HertzMetric`, `DRAW_INTERVAL_NS`, `FPS_CACHE_CAPACITY`,
  `MAX_CATCHUP_STEPS`.

---

## 2. Math — `@games/math`

- `geometry/types.ts` — `Vec2`, `Point2D`, `Rect`, `Transform2D`, `Color`.
- `geometry/aabb.ts` — `rectsIntersect`, `pointInRect` (half-open edge convention).
- `bitwise/words.ts` — `pad`, `toBig`, `fromBig`, `and`, `or`, `xor`, `not`, `nand`, `nor`, `add`,
  `subtract`, `multiply`, `divide`, `remainder`, `compare`, `bitLength`, `ones`, `onesFrom`,
  `zeros`, `zerosFrom`, `abs`.
- `bitwise/uint8.ts`, `bitwise/convert.ts` — byte/word big-endian arithmetic.
- `random/rng.ts` — PRNG namespaces: `PCG`, `Mulberry` (mulberry32 + `mulberry32BigInt`),
  `Xoshiro` (xoshiro256**), `SFC64`, `Wyrand`, `Squares`.

---

## 3. Render — `@games/render`

- `command.ts` — `RenderCommand` union, `StrokeStyle`, `TextStyle`, `SpriteRef`.
- `frame.ts` — `IFrame`, `IFrameBuilder`.
- `renderer.ts` — `IRenderer`, `IRendererCapabilities`.
- `frame-builder.ts` — `FrameBuilder` (implements both `IFrameBuilder` and `IFrame`).
- `renderers/` — `Canvas2DRenderer` (command→Canvas2D translation), `NoopRenderer`,
  `RecordingRenderer` (assertion sink).

---

## 4. Input — `@games/input`

- `keyboard-source.ts` — `KeyboardSource` (action-mapped `KeyboardEvent.code` → `InputAction`,
  one-shot press/release edges, auto-repeat ignored).

---

## 5. Games — `@games/games`

- `Tetris` — 7-bag queue (seeded), 10×20 board, rotation, gravity, movement, soft/hard drop, line
  clears, game-over reset; declarative rendering.
- `Snake` — deque body, queued turns (no reversal), Xenzia wall wrap, food growth, self-collision
  game over, head→tail colour gradient.
- `SpaceInvaders` — flat entity list (5×11 invaders + bullets), marching formation with edge
  reversal/descent, AABB collision, score/lives/game-over.

Each is a pure `IGame<IFrameBuilder>` — deterministic for a seed, driven only by `step` context, and
rendering only via `present` commands.

---

## 6. App host — `apps/web`

- TypeScript Vite entry (`scripts/main.ts`) composing `BrowserHostLoop` + `Canvas2DRenderer` +
  `KeyboardSource` + one of the three games + `Engine`, with a `GAME` selector.

---

## 7. Documentation

- `README.md` (ASCII + Mermaid diagrams), `docs/PLAN.md`, `docs/ARCHITECTURE.md` (ASCII + Mermaid +
  PlantUML), `docs/JSDOC.md` (the MathAid js-doc standard), `docs/DISTRIBUTION.md`,
  `docs/PROPOSALS.md`.

---

## 8. Defects fixed

- **`bitLength` bug** (`words.ts`) — used `Math.clz32` in 32-bit space, returning negative values;
  rewritten as `|n|.toString(2).length`.
- **`@/` alias in `rng.ts`** — changed to a relative `../bitwise/words` import so library consumers
  resolve it without a bundler alias.
- **Canvas stretching** — `apps/web/styles/main.css` stretched the element to the viewport aspect
  ratio; now uses intrinsic `max-width`/`max-height` fit (see `PROPOSALS.md` §4).
- **`IFrameDriver` orphan** — identified as an unreferenced contract (documented; removal pending a
  decision on whether to wire it in).
- **Stale doc references** — comments referencing deleted legacy types (`IGamePerformance`,
  `DeltaAccumulator`, `GamePerformance`) corrected to `IEngine`/`Engine`.
- **Loop rescheduling after `stop()`** — an in-flight `MessageChannel` delivery could fire after
  `stop()`, and the loop unconditionally rescheduled, reviving the loop and hanging the process.
  Added a `#running` guard so the loop only reschedules while running.

---

## 9. Verification

- **Type-check:** all five packages + the app pass `tsc --noEmit` (exit 0).
- **Runtime (headless, deterministic):** the `Engine` loop (120 frames → 120 steps, `alpha ∈ [0,1)`),
  Canvas2D command translation, `KeyboardSource` edges, Tetris (determinism/rotation/hard-drop),
  Snake (wall-wrap/turn), Space Invaders (shooting/movement), and every PRNG (determinism + range).
- **Vitest suite:** `vitest.config.ts` + 9 test files across `loop`/`math`/`render`/`games`
  (written; run locally with `pnpm install && pnpm test`).

---

## 10. Engine evolution (`dev` branch)

Landed on the transient `dev` branch (see `PROPOSALS.md` for the step-by-step plans):

- **Generic schedule handle** (§6.2) — `IScheduleHandle<T>`, `IScheduler<T>`, `IHostLoop<T>` are now
  generic over the token type; `rAFScheduler` is `IScheduler<number>`, `ManualScheduler` is
  `IScheduler<null>`.
- **Driver-agnostic simulation** (§1) — `ISimulationContext.clock` widened to `IClock` and `dt`
  added; `ISimulationDriver` gained `interpolation()`/`reset()` and dropped `clock`/`canStep`;
  `FixedTimestepDriver` re-anchored internally. New `timestep-drivers.ts`:
  `VariableTimestepDriver`, `CappedVariableTimestepDriver`, `EventDrivenDriver`.
- **Control signals** (§4) — `StepSignal` (`'continue' | 'pause' | 'resume' | 'skip' | 'throttle'`)
  and `PresentSignal` (`'full' | 'reduced' | 'none'`) in `simulation.type.ts`; `step`/`present` may
  return them (a `void` return means `'continue'`/`'full'`). `ISimulationDriver.advance` now returns
  `StepResult { steps, signal }`; `FixedTimestepDriver` stops stepping on `'skip'`/`'pause'`.
  `Engine` interprets signals via `#stepScale`/`#renderScale` (throttle halves the step/render rate,
  `'none'` stops rendering) while remaining the single authority over pause.
- **Dual pause (§2)** — the engine keeps `IEngine.paused` as the loop-cadence authority, and the game
  keeps its own scene pause via `step`'s `'pause'`/`'resume'` signals. While paused the engine runs a
  throttled GUI loop (`GUI_INTERVAL_NS`, 10 Hz): a menu-navigation `step` (`dt: 0`) plus a
  `present`, so a pause menu stays interactive and can request `'resume'` — which returns authority
  to the engine and resets the clock.
- **Live metrics (§3)** — `LiveMetrics { fps, alpha, dtNanos, pendingSteps, elapsedNanos }` in
  `simulation.type.ts`; `ISimulationDriver` gained `lastDt`/`pendingSteps` accessors (all four
  drivers implement them). `Engine` exposes a `live` getter and emits a per-frame `metrics` event
  (`EngineEvents.metrics`) for zero-polling HUDs.
- **Host alternatives (§6.3)** — `host/manual-host-loop.ts` (`ManualHostLoop`, `IHostLoop<null>`),
  `host/message-channel-scheduler.ts` (`MessageChannelScheduler`, `IScheduler<MessageChannel>`),
  `host/node-host-loop.ts` (`NodeHostLoop`, `IHostLoop<MessageChannel>`), `host/replay-host-loop.ts`
  (`ReplayHostLoop`, `IHostLoop<number>`, synchronous `Timestamp[]` playback), and
  `host/worker-host-loop.ts` (`WorkerHostLoop`, a worker-oriented alias of `NodeHostLoop`).
- **Audio (§5.2)** — `IAudioSink` contract (`play`/`stop`/`setVolume`) in `types/audio.type.ts`;
  `NoopAudioSink`, `RecordingAudioSink`, and `WebAudioSink` (Web Audio API) in `src/audio/`.
  `ISimulationContext.audio` threads the sink to games declaratively; `ISimulationDriver.setAudio`
  and `IEngine.setAudio` bind it (with an `audioChanged` event).
- **Visual sprites (§5.3)** — `ISpriteRegistry` + `SpriteRegistry` (PNG/JPEG/GIF/WebP decoding) in
  `render/sprite-registry.ts`; `Canvas2DRenderer.setSprites` resolves `{ kind: 'sprite' }` through
  the registry and `drawImage`s it (magenta placeholder when unbound/unloaded).
- **App controls (§7)** — `apps/web/scripts/main.ts` now reads `AppSettings` from the URL query
  string (`game`, `fps`, `fpsHistory`, `width`, `height`, `host`, `simulator`, `inputName`) and
  composes the matching `IHostLoop` (`browser`/`node`/`manual`/`replay`) and `ISimulationDriver`
  (`fixed`/`variable`/`event-driven`). It renders a live metrics HUD (via the `metrics` event), a
  read-only key map, and re-`resize`s the canvas to the configured resolution; the game selector
  rewrites the query string and reloads.
- **Game states (§8)** — `games/new/scene.ts` defines `Scene` (`'playing' | 'paused' |
  'transitioning' | 'gameOver'`) and `IStatefulGame<F>` (an `IGame` plus a read-only `scene` and an
  optional recursive `transition`). `Tetris`, `Snake`, and `SpaceInvaders` now implement
  `IStatefulGame<IFrameBuilder>` and report their `scene`.
- **Tetris scoring + combo + metrics (§9.1–9.3)** — a pure, tested `scoreClear` in `tetris.ts`
  implements the four cumulative rules (single `+1`/`+0.05`, multi-line `L+1`/`+0.25`, full clean
  `L×2`/`+0.75`, deluxe cascade `+1,+2,…`/`+0.25` each). `Tetris` tracks score, a `[0,1]` combo
  meter (adds on clears, `−0.001` per fall tick, clamped), deluxe points, board-clear count, and
  their in-session highs, exposed via a read-only `metrics` getter.
- **Tetris pause menu (§9.4)** — `step`/`present` now route by scene and return `StepSignal`/
  `PresentSignal` (the pause toggle returns `'pause'`/`'resume'`; the menu presents `'reduced'`).
  The declarative menu edits speed, volume, and seed (`↑`/`↓` select, `←`/`→` change, `Esc`
  resume), shows colours/RNG/keymap read-only, and applies volume via `context.audio` and the seed
  by rebuilding the bag.
- **Snake pause menu (§10)** — `Snake` gains a `pause` action and a `paused` scene, with
  `step`/`present` returning `StepSignal`/`PresentSignal` like Tetris. Its menu toggles `mode`
  (`arcade` — constant speed | `level` — score-ramped speed), `sprites` (rect ↔ sprite rendering),
  snake/egg colour palettes, stage themes, and obstacles (a fixed centre block the snake dies on).
