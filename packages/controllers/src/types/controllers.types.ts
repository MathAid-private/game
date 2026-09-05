/**
 * @fileoverview
 * @summary Type contracts for the event-driven input controller architecture.
 *
 * @description
 * Defines the subscription model layered on top of `IGameReadable`. A
 * controller driver reads raw `VPadData` on every tick. An
 * `IInputController` wraps that driver and adds pattern-match
 * subscriptions: consumers register `(mask, pattern, mode, handler)`
 * tuples and `dispatch()` evaluates them against the live state each
 * tick, firing handlers whose patterns match.
 *
 * **Why `IInputController<D>` CAN extend `IEventEmitter<InputControllerEvents<D>>`**
 *
 * The compatibility question reduces to: do any method names on
 * `IEventEmitter` conflict with any method names on `IGameReadable`,
 * `IInputController`, or `IDispatchable`? They do not:
 *
 * | Interface           | Methods                          |
 * |---------------------|----------------------------------|
 * | `IGameReadable`     | `read()`                         |
 * | `IEventEmitter`     | `on()`, `off()`, `emit()`        |
 * | `IInputController`  | `subscribe()`, `unsubscribe()`   |
 * | `IDispatchable`     | `dispatch()`                     |
 *
 * No name collides. TypeScript structural compatibility is satisfied
 * because there is no variance conflict (the generics are in covariant
 * output positions only on `read`). Therefore `IInputController<D>`
 * extends `IEventEmitter<InputControllerEvents<D>>` without compromise.
 *
 * **Event map derivation** — `InputControllerEvents<D>` is parameterised
 * solely on `D` (the `VPadData` subtype), so `IInputController<D>` needs
 * no additional generic for the event map. The full type of every event
 * payload is deterministic from `D` alone.
 *
 * **Subscription key** — subscriptions are keyed by a string encoding of
 * `(mask, pattern, mode)` so the dispatch loop can do O(1) lookup for
 * exact-match patterns without iterating all subscriptions. The key
 * format is vendor-specific (bigint serialises differently from
 * `number[]`) and is supplied by the concrete class via `#toKey`.
 *
 * @see {@linkcode IEventEmitter}
 * @see {@linkcode InputDispatcher}
 * @see {@linkcode VPadData}
 *
 * @author MathAid
 */
import type { IEventEmitter, IGameLogic, IGamePluggable, IGameReadable } from '@games/loop';

/**
 * @summary Represents a set of virtual controller's button feedback
 * data.
 *
 * @description A low resolution of key events, represented as a 54 bit
 * integer, from a connected game controller.
 *
 * Each valid button may be represented by a single bit (on/off) or may
 * be represented by unsigned bits (such as 8, 0-255) value in this 54
 * bit data to show magnitude for complex controls.
 *
 * If the interpretation is unsigned 8-bits, then this means that only 6
 * buttons are representable leaving an extra 6 bits for representing
 * the last button otherwise this is sufficient for on/off triggers
 */
export type SimpleVPadData = number;
/**
 * @summary Represents a set of virtual controller's button feedback
 * data.
 *
 * @description A high resolution of key events, represented as sets of
 * 54 bit integers (showing a single, continuous unsigned bits), from a
 * connected game controller.
 *
 * All buttons in the {@linkcode IVirtualPadLayout} are representable by
 * this data
 *
 * Note that for accuracy, see the driver vendor's docs as the accuracy of the
 * input may vary between vendors
 */
export type ComposedVPadData = number[];
/**
 * @summary Represents a set of virtual controller's button feedback
 * data.
 *
 * @description A high resolution of key events, represented as an unsigned
 * `bigint`, from a connected game controller.
 *
 * All buttons in the {@linkcode IVirtualPadLayout} are representable by
 * this data
 *
 * Note that for accuracy, see the driver vendor's docs as the accuracy of the
 * input may vary between vendors
 */
export type AdvancedVPadData = bigint;
/**
 * @summary Represents a set of virtual controller's button feedback
 * data.
 *
 * @description The highest resolution of key events, represented as an
 * unsigned `bigint`, from a connected game controller.
 *
 * All buttons in the {@linkcode IVirtualPadLayout} are representable by
 * this data
 *
 * All buttons in the {@linkcode IVirtualPadLayout} are representable by
 * this data
 *
 * Note that for accuracy, see the driver vendor's docs as the accuracy of the
 * input may vary between vendors
 */
export type HighResVPadData = Uint8Array;
/**
 * Represents a set of virtual controller's button feedback data.
 *
 * The actual delineation of the bits between the states depends entirely
 * on the driver vendor
 */
export type VPadData = SimpleVPadData | ComposedVPadData | AdvancedVPadData | HighResVPadData;
/**
 * Simple representation of the state of a game controller's key.
 *
 * This easily represents clickable keys where magnitude is negligible
 */
export type DigitalVKeyData = boolean;
/**
 * Represents of the state of a game controller's key as a magnitude (0.0-1.0)
 * of the it's current event
 *
 * This is used to represent keys with events where magnitude is necessary
 * e.g, the rotation on an analogue stick, the pressure on a touch pad
 */
export type AnalogVKeyData = number;
/**
 * Bits of game data encoded into a javascript object
 */
export interface IVirtualPadLayout {
  // D-Pad Buttons
  /** The up button */
  up?: DigitalVKeyData | AnalogVKeyData;
  /** The down button */
  down?: DigitalVKeyData | AnalogVKeyData;
  /** The left button */
  left?: DigitalVKeyData | AnalogVKeyData;
  /** The right button */
  right?: DigitalVKeyData | AnalogVKeyData;

  // Face Buttons
  /** The △ (ps) or Y (xbox) or X (nintendo) button */
  north?: DigitalVKeyData | AnalogVKeyData;
  /** The ✖ (ps) or A (xbox) or B (nintendo) button */
  south?: DigitalVKeyData | AnalogVKeyData;
  /** The ☐ (ps) or X (xbox) or Y (nintendo) button */
  east?: DigitalVKeyData | AnalogVKeyData;
  /** The 〇 (ps) or B (xbox) or A (nintendo) button */
  west?: DigitalVKeyData | AnalogVKeyData;

  // Analogue
  /** The rotation (in radians) of the left analogue stick */
  lsr?: AnalogVKeyData;
  /** The depression (in radians), when tilted, of the left analogue stick */
  lsa?: AnalogVKeyData;
  /** The rotation (in radians) of the right analogue stick */
  rsr?: AnalogVKeyData;
  /** The depression (in radians), when tilted, of the right analogue stick */
  rsa?: AnalogVKeyData;
  /** The clickable mid section of the left analogue stick */
  lsb?: DigitalVKeyData | AnalogVKeyData;
  /** The clickable mid section of the right analogue stick */
  rsb?: DigitalVKeyData | AnalogVKeyData;

  // Shoulder & Trigger
  /** left shoulder/bumper */
  lb?: DigitalVKeyData | AnalogVKeyData;
  /** right shoulder/bumper */
  rb?: DigitalVKeyData | AnalogVKeyData;
  /** left trigger */
  lt?: DigitalVKeyData | AnalogVKeyData;
  /** right trigger */
  rt?: DigitalVKeyData | AnalogVKeyData;

  // Menu
  start?: DigitalVKeyData | AnalogVKeyData;
  select?: DigitalVKeyData | AnalogVKeyData;
  home?: DigitalVKeyData | AnalogVKeyData;

  // Mouse Pad
  x?: AnalogVKeyData;
  y?: AnalogVKeyData;
  // A pointing device existing in a virtual 3d space such as a virtual
  // reality stick
  z?: AnalogVKeyData;

  // Haptic feedback
  hapticNorth?: AnalogVKeyData;
  hapticSouth?: AnalogVKeyData;
  hapticEast?: AnalogVKeyData;
  hapticWest?: AnalogVKeyData;
  hapticCenter?: AnalogVKeyData;
  hapticNe?: AnalogVKeyData;
  hapticSe?: AnalogVKeyData;
  hapticNw?: AnalogVKeyData;
  hapticSw?: AnalogVKeyData;
}
/**
 * A parser converts raw VPadData from one specific driver into IVirtualPadLayout.
 * Implementations are vendor-specific — a keyboard parser differs from a gamepad parser.
 */
export interface IControllerMapper<D extends VPadData = VPadData> {
  /**
   * @param data a sequence of 8 bits where each interval
   * represents the magnitude of the interaction depending
   * on the actual button type
   */
  (data?: D): IVirtualPadLayout;
}

/**
 * A vendor driver owns one physical input source and emits raw VPadData.
 * It knows nothing about IVirtualPadLayout — that mapping is the parser's job.
 */
export interface IControllerDriver<
  GL extends IGameLogic = IGameLogic,
  D extends VPadData = VPadData,
>
  extends IGamePluggable<GL>, IGameReadable<GL, D> {}

/**
 * A vendor bundles a driver with its parser and exposes a single sampling call.
 * This is what Game receives as getControls().
 */
export interface IControllerVendor<
  GL extends IGameLogic = IGameLogic,
  D extends VPadData = VPadData,
> {
  readonly driver: IControllerDriver<GL, D>;
  readonly parser: IControllerMapper<D>;
}

// ── Trigger modes ─────────────────────────────────────────────────

/**
 * @summary Condition under which a subscription's handler fires.
 *
 * @description
 * - `'held'`     — fires on every `dispatch()` call while the condition
 *                  `(state & mask) === pattern` is true. Suitable for
 *                  "move while key held" logic.
 * - `'pressed'`  — fires once when the pattern transitions from unmet
 *                  to met (rising edge). Suitable for "jump on press".
 * - `'released'` — fires once when the pattern transitions from met to
 *                  unmet (falling edge). Suitable for "charge release".
 * - `'changed'`  — fires once when any bit in `mask` changes state,
 *                  regardless of `pattern`. Suitable for "any input" detection.
 *
 * @example
 * // Fire every tick while W is held
 * controller.subscribe(W_MASK, W_MASK, 'held', onMove);
 *
 * // Fire exactly once when jump button is first pressed
 * controller.subscribe(SOUTH_MASK, SOUTH_MASK, 'pressed', onJump);
 */
export type TriggerMode = 'held' | 'pressed' | 'released' | 'changed';

// ── Event payloads ────────────────────────────────────────────────

/**
 * @summary Payload delivered to every `IInputController` event handler.
 *
 * @description
 * Carries the full context of the input event at the moment it fired:
 * the exact pattern that matched, the full raw state at dispatch time,
 * and the nanosecond timestamp from `IHostLoop.now()`.
 *
 * `rising` and `falling` carry the bits that changed direction this
 * tick — useful for handlers registered on `'changed'` that need to
 * know which specific bits flipped.
 *
 * @template D - The `VPadData` subtype of the emitting controller.
 */
export interface InputEvent<D extends VPadData> {
  /** The mask used to select bits for this subscription. */
  readonly mask: D;
  /** The required bit pattern for this subscription. */
  readonly pattern: D;
  /** The trigger mode that caused this event to fire. */
  readonly mode: TriggerMode;
  /** Full raw device state at the moment `dispatch()` was called. */
  readonly state: D;
  /** Bits that transitioned from 0 → 1 this tick (within `mask`). */
  readonly rising: D;
  /** Bits that transitioned from 1 → 0 this tick (within `mask`). */
  readonly falling: D;
  /** Nanosecond timestamp at dispatch time (`IHostLoop.now()`). */
  readonly timestamp: number;
}

// ── Event map ─────────────────────────────────────────────────────

/**
 * @summary Event map for `IInputController<D>`.
 *
 * @description
 * Four events cover the full set of input transition semantics:
 *
 * - `'input'`   — emitted on every `dispatch()` for every subscription
 *                 whose condition is currently met. High frequency.
 * - `'press'`   — emitted when a subscription's pattern is met for the
 *                 first time this tick (rising edge only).
 * - `'release'` — emitted when a subscription's pattern was met last
 *                 tick but is no longer met this tick (falling edge).
 * - `'change'`  — emitted when any masked bit changes state this tick,
 *                 regardless of whether the full pattern is met.
 *
 * All four carry an `InputEvent<D>` payload — the handler receives the
 * full context including mask, pattern, current state, rising/falling bits,
 * and timestamp.
 *
 * The `IEventEmitter` generic is `InputControllerEvents<D>`, derived
 * entirely from `D`. No second generic is needed on `IInputController`.
 *
 * @template D - The `VPadData` subtype of the emitting controller.
 */
export type InputControllerEvents<D extends VPadData> = {
  /** Fires every dispatch while `(state & mask) === pattern`. */
  input: InputEvent<D>;
  /** Fires on rising edge — pattern became met this tick. */
  press: InputEvent<D>;
  /** Fires on falling edge — pattern stopped being met this tick. */
  release: InputEvent<D>;
  /** Fires when any bit in `mask` changed, regardless of pattern match. */
  change: InputEvent<D>;
};

// ── Subscription record ───────────────────────────────────────────

/**
 * @summary A single registered input subscription.
 *
 * @description
 * Stored in the dispatcher's internal map. The `key` field is the
 * string encoding of `(mask, pattern, mode)` used for O(1) lookup.
 * `wasActive` tracks whether the pattern was met on the previous tick,
 * enabling edge detection without an external flag per subscription.
 *
 * @template D - The `VPadData` subtype.
 */
export interface InputSubscription<D extends VPadData> {
  readonly key: string;
  readonly mask: D;
  readonly pattern: D;
  readonly mode: TriggerMode;
  readonly handler: (event: InputEvent<D>) => void;
  /** `true` if `(prevState & mask) === pattern` on the last `dispatch`. */
  wasActive: boolean;
}

// ── IDispatchable ─────────────────────────────────────────────────

/**
 * @summary A device that can evaluate subscriptions against its current state.
 *
 * @description
 * Implemented by `InputDispatcher`. `dispatch()` is called by
 * `DeltaAccumulator` once per simulation step — it reads the raw state
 * via `read()`, evaluates every registered subscription, and fires
 * matching handlers.
 *
 * Separated from `IInputController` so that `DeltaAccumulator` can
 * detect dispatchable devices via `'dispatch' in device` without
 * needing to import the full controller interface.
 */
export interface IDispatchable<GL extends IGameLogic> {
  /**
   * @summary Evaluate all subscriptions against the current raw state.
   *
   * @description
   * Called once per simulation step by `DeltaAccumulator`. Reads the
   * current raw state, computes rising and falling edges relative to
   * the previous tick's state, then fires handlers for each matching
   * subscription according to its `TriggerMode`.
   *
   * @param timestamp - Current nanosecond timestamp from `IHostLoop.now()`.
   */
  dispatch(timestamp: number, gl?: GL): void;
}

// ── IInputController ──────────────────────────────────────────────

/**
 * @summary Event-driven controller that wraps an `IGameReadable` driver.
 *
 * @description
 * `IInputController<D>` extends both `IGameReadable<D>` and
 * `IEventEmitter<InputControllerEvents<D>>`. This is structurally sound
 * because the three interfaces contribute completely disjoint method names
 * (`read` / `on, off, emit` / `subscribe, unsubscribe`), so TypeScript
 * sees no conflict.
 *
 * The event map is `InputControllerEvents<D>` — fully derived from `D` —
 * so no second generic parameter is required. A consumer declares:
 *
 * ```ts
 * const kb: IInputController<AdvancedVPadData> = new InputDispatcher(driver);
 * ```
 *
 * and gets typed `subscribe`, `on`, `off`, `emit`, and `read` all from
 * that single declaration.
 *
 * **Subscription vs. event** — `subscribe` is the high-level API:
 * the consumer specifies *what pattern to watch for* and receives a
 * typed `InputEvent<D>`. `on('press', handler)` is the lower-level
 * broadcast: *any* press event from *any* subscription fires it, carrying
 * the same `InputEvent<D>` payload. Both APIs coexist and compose.
 *
 * @template D - `VPadData` subtype. Constrains mask/pattern types and
 *   the event map simultaneously.
 *
 * @example
 * const kb = new InputDispatcher(keyboardDriver, advancedBindings);
 *
 * // High-level: subscribe to a specific pattern
 * const unsub = kb.subscribe(
 *   W_MASK, W_MASK, 'pressed',
 *   ({ timestamp }) => console.log('W pressed at', timestamp),
 * );
 *
 * // Low-level: observe all press events
 * kb.on('press', ({ mask, pattern }) =>
 *   console.log('any press:', mask, pattern));
 *
 * // In the game loop (called by DeltaAccumulator):
 * kb.dispatch(host.now());
 *
 * // Cleanup
 * unsub();
 *
 * @see {@linkcode InputDispatcher}
 * @see {@linkcode IDispatchable}
 * @see {@linkcode TriggerMode}
 *
 * @author MathAid
 */
export interface IInputController<D extends VPadData, GL extends IGameLogic>
  extends IGameReadable<IGameLogic, D>, IEventEmitter<InputControllerEvents<D>>, IDispatchable<GL> {
  /**
   * @summary Register a pattern-match subscription.
   *
   * @description
   * Fires `handler` when `(state & mask) === pattern` according to
   * `mode`. The returned function removes the subscription; it is
   * idempotent and safe to call multiple times.
   *
   * Registering the same `(mask, pattern, mode, handler)` tuple twice
   * is a no-op — the handler fires exactly once per matching dispatch.
   *
   * @param mask    - Selects which bits to observe. Bits outside the
   *   mask are ignored for this subscription's pattern match.
   * @param pattern - Required bit state of the masked bits. When
   *   `pattern === mask`, all selected bits must be set. When
   *   `pattern === zero`, all selected bits must be clear.
   * @param mode    - When to fire: `'held'`, `'pressed'`, `'released'`,
   *   or `'changed'`.
   * @param handler - Called with a full `InputEvent<D>` payload.
   * @returns Idempotent unsubscribe function.
   *
   * @throws {TypeError} If `mask` and `pattern` are not the same
   *   `VPadData` subtype as this controller's `D`.
   *
   * @example
   * // Fire once when the south face button is first pressed
   * const unsub = controller.subscribe(
   *   SOUTH_MASK, SOUTH_MASK, 'pressed', onJump,
   * );
   *
   * @example
   * // Fire every tick while left and right triggers are both held
   * controller.subscribe(LT_MASK | RT_MASK, LT_MASK | RT_MASK, 'held', onDualWield);
   */
  subscribe(
    mask: D,
    pattern: D,
    mode: TriggerMode,
    handler: (event: InputEvent<D>) => void,
  ): () => void;

  /**
   * @summary Remove a subscription by its exact registration parameters.
   *
   * @description
   * Finds the subscription whose `(mask, pattern, mode, handler)` tuple
   * matches exactly and removes it. No-op if no match is found.
   *
   * Prefer using the unsubscribe function returned by `subscribe` — it
   * avoids the need to retain handler references.
   *
   * @param mask    - Same value passed to `subscribe`.
   * @param pattern - Same value passed to `subscribe`.
   * @param mode    - Same value passed to `subscribe`.
   * @param handler - Same function reference passed to `subscribe`.
   */
  unsubscribe(
    mask: D,
    pattern: D,
    mode: TriggerMode,
    handler: (event: InputEvent<D>) => void,
  ): void;
}
