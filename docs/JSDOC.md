# js-doc Standard

> **Status:** Normative — every public declaration in the engine **must** follow this standard.
> **Author:** MathAid
> **Applies to:** all TypeScript/JavaScript source in `packages/**` and `apps/**`.

This document is the single source of truth for documentation comments. It is applied per file
and per declaration. The standard is designed so that a reader can answer three questions about
any symbol without opening its implementation: **what it is**, **why it exists**, and **how to
use it** — in that order.

---

## 1. Tag inventory

| Tag | Required | Placement | Purpose |
|---|---|---|---|
| `@fileoverview` | yes (files) | first lines of a file | purpose of the whole file + overview of its contents |
| `@summary` | yes | header of every declaration | one-line description |
| `@description` | yes | body of every declaration | the main documentation block |
| `@example` | yes (≥1) | within `@description` | how-to / recipes |
| `@template` | optional | body or footer | generic type parameter(s) and their purpose |
| `@param` | optional | footer | parameter purpose, valid types/values, edge cases |
| `@default` | optional | footer | default value of an optional property |
| `@return` / `@returns` | optional | footer | return purpose, valid types/values, edge cases |
| `@throws` | optional | footer | error type(s) that can be thrown |
| `@see` | optional | footer | links to related internal/external code or docs |
| `@note` | optional | footer | usage notices / caveats |
| `@author` | always | footer | authorship — always `MathAid` |

---

## 2. File header

The **first lines** of every file are a `@fileoverview` block. It describes the file's purpose
and gives an overview of what it contains (the declarations exported, and how they relate).

```ts
/**
 * @fileoverview
 * @summary The renderer contract and its concrete render modes.
 *
 * @description
 * This module defines `IRenderer` — the environment-agnostic contract every
 * render mode implements — together with `IFrame`, `IFrameBuilder`, and the
 * `RenderCommand` union that frames are made of. It also ships the first two
 * concrete modes: `Canvas2DRenderer` and `NoopRenderer` (headless/test).
 *
 * @author MathAid
 */
```

---

## 3. Declaration structure

Every class, interface, type, function, method, const, and enum follows this exact order:

1. **`@summary`** — the one-line header.
2. **`@description`** — the main body, containing three concepts in order (do **not** write the
   literal words "What", "Why", or "How" — carry the concept, not the label):
   - **Definition as one entity** — the declaration together with its fields, params, args, and
     return types, in the context of its container (class / module / namespace member / the
     convention it follows).
   - **Purpose in scope** — what the declaration is for within its broader system, and how it is
     used alongside the appropriate other code.
   - **How-to / recipes** — one or more `@example` blocks.
3. **Footer** — the optional tags: `@template`, `@param`, `@default`, `@return`, `@throws`,
   `@see`, `@note`, and always `@author`.

---

## 4. Worked examples

### 4.1 Interface

```ts
/**
 * @summary A render mode: translates abstract frames into a concrete graphics API.
 *
 * @description
 * `IRenderer` is the seam between the engine and any drawing backend. It consumes an
 * ordered `IFrame` of `RenderCommand`s produced by a game's `present()` and is the sole
 * place a concrete API (Canvas2D, WebGL, a terminal, a headless recorder) appears.
 *
 * The engine holds one active renderer via `IEngine.setRenderer`. Because games never
 * see the renderer — they only emit commands — a render mode can be added, removed, or
 * swapped at runtime without touching game or engine-core code. A renderer is therefore
 * the unit of rendering extensibility: every render mode is an `IRenderer` implementation.
 *
 * A renderer reports its surface via `capabilities` so callers can adapt (a terminal has
 * no colour or image support). `resize` is called when the backing surface changes size,
 * before the next `render`.
 *
 * @example
 * const renderer = new Canvas2DRenderer(canvas.getContext('2d')!);
 * engine.setRenderer(renderer);
 *
 * @example
 * // Headless: assert commands without drawing anything.
 * const recorder = new RecordingRenderer();
 * engine.setRenderer(recorder);
 * engine.frame(nowNanos);
 * assert.deepEqual(recorder.lastFrame.commands, expected);
 *
 * @author MathAid
 */
interface IRenderer {
  /** Capabilities of the backing surface (colour, text, images, depth). */
  readonly capabilities: IRendererCapabilities;
  /**
   * @summary Draw an entire frame to the backing surface.
   * @param frame - The completed command list produced by the game this frame.
   * @return Nothing; the frame is consumed synchronously.
   * @author MathAid
   */
  render(frame: IFrame): void;
  /**
   * @summary Resize the backing surface.
   * @param width - Logical width in device-independent pixels.
   * @param height - Logical height in device-independent pixels.
   * @author MathAid
   */
  resize(width: number, height: number): void;
}
```

### 4.2 Function with generics, params, return, throws

```ts
/**
 * @summary Advance the fixed-timestep simulation by a wall-clock sample.
 *
 * @description
 * `advance` integrates the elapsed wall time since the previous sample into the frame
 * clock's pending-step accumulator, then runs `game.step()` once for each whole step owed.
 * It is the timing-only half of the engine loop: it knows nothing of rendering or input,
 * which keeps the simulation cadence independent of the presentation cadence.
 *
 * The step count is bounded so a long stall (a throttled tab, a debugger pause) cannot
 * spiral into an unbounded catch-up loop; excess debt is discarded rather than replayed.
 *
 * @template G - The concrete game type, which must implement `ISimulationStep`.
 *
 * @param nowNanos - Monotonic timestamp in nanoseconds from `IClock.now()`.
 * @param maxSteps - Upper bound on steps run in one call. Defaults to `MAX_CATCHUP_STEPS`.
 *   A value ≤ 0 is clamped to 1 to guarantee at least one step when debt is owed.
 *
 * @return The number of simulation steps actually run (0 when no whole step is owed).
 *
 * @throws {RangeError} If `nowNanos` is negative or earlier than the previous sample.
 *
 * @example
 * const steps = driver.advance(host.now()); // runs 0..N game.step() calls
 *
 * @see {@link IFrameClock}
 * @note This method is on the hot path — keep `game.step()` allocation-free.
 *
 * @author MathAid
 */
function advance<G extends ISimulationStep>(nowNanos: number, maxSteps = MAX_CATCHUP_STEPS): number {
```

### 4.3 Discriminated union

```ts
/**
 * @summary One draw operation, abstracted from any graphics API.
 *
 * @description
 * `RenderCommand` is a closed, discriminated union keyed by `kind`. A game builds an
 * ordered list of these during `present()`; an `IRenderer` translates each one to its
 * backing API. Because the union is the *only* vocabulary a renderer must understand,
 * extending rendering means adding a variant here (once) and handling it in each renderer.
 *
 * Stateful commands (`push`/`pop`) scope subsequent commands to a saved/restored context,
 * mirroring a canvas state stack without naming any specific API.
 *
 * @example
 * const clear: RenderCommand = { kind: 'clear', color: { r: 0, g: 0, b: 0, a: 1 } };
 * const cell: RenderCommand = { kind: 'rect', rect, fill: color };
 *
 * @author MathAid
 */
type RenderCommand =
  | { kind: 'clear'; color?: Color }
  | { kind: 'rect'; rect: Rect; fill?: Color; stroke?: StrokeStyle }
  | { kind: 'sprite'; sprite: SpriteRef; transform: Transform2D }
  | { kind: 'text'; text: string; position: Point2D; style: TextStyle }
  | { kind: 'push' }
  | { kind: 'pop' };
```

### 4.4 Const / object

```ts
/**
 * @summary Upper bound on fixed-step catch-up per host frame.
 *
 * @description
 * The maximum number of `game.step()` calls `advance()` may run in one frame. It caps
 * catch-up after a stall so a single long pause cannot block the thread; any debt beyond
 * this bound is discarded. Sized to cover a typical multi-frame drop at 60 Hz without
 * visible teleporting.
 *
 * @author MathAid
 */
const MAX_CATCHUP_STEPS = 5;
```

---

## 5. Rules & anti-patterns

- **Never** write the literal words "The What", "The Why", or "The How" — express the concept
  in its own paragraph. The reader should not need a label to know which is which.
- **`@author` is always `MathAid`** — on every declaration that carries a footer.
- **Units are explicit** — time values are suffixed (`nowNanos`, `stepIntervalNanos`); do not
  leave a bare `number` meaning "nanoseconds, probably".
- **Edge cases are documented** on `@param` and `@return` (clamping, zero divisors, negative
  inputs, saturation) — not left for the reader to discover.
- **One declaration, one purpose** — if a symbol needs two summaries, it is two symbols.
- **Examples are runnable** — `@example` snippets should be self-contained and correct, not
  aspirational pseudo-code.

---

## 6. Relationship to TypeScript

The comments are JSDoc-compatible and TypeDoc-friendly. The `@fileoverview` + `@summary` +
`@description` structure is deliberately independent of any generator, so the documentation
remains correct whether or not API-doc tooling is enabled. `@see` links may use
`{@linkcode Symbol}` and `{@link Symbol}` JSDoc inline tags.
