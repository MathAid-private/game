/**
 * @fileoverview
 * @summary Concrete `IInputController` implementation for all `VPadData` variants.
 *
 * @description
 * `InputDispatcher<D>` wraps any `IGameReadable<D>` driver and adds the
 * full event-driven subscription model defined by `IInputController<D>`.
 *
 * **What it does per `dispatch()` call:**
 * 1. Reads current raw state from the underlying driver via `read()`.
 * 2. Computes rising and falling edges relative to the previous tick.
 * 3. Evaluates every registered subscription against the state:
 *    - `'held'`    — fires if `(state & mask) === pattern`.
 *    - `'pressed'` — fires if pattern is met NOW but was NOT last tick.
 *    - `'released'`— fires if pattern WAS met last tick but is NOT now.
 *    - `'changed'` — fires if any bit within `mask` changed this tick.
 * 4. For every matched subscription, emits the appropriate named event
 *    on the `EventEmitter` (`'input'`, `'press'`, `'release'`, `'change'`)
 *    AND calls the subscription's own handler directly.
 *
 * **Subscription storage** — subscriptions are stored in a
 * `Map<string, Set<InputSubscription<D>>>`. The map key encodes
 * `(mask, pattern, mode)` via the abstract `#toKey` method so that
 * the dispatch loop can reach exact-pattern buckets in O(1) for the
 * common case. All subscriptions are still evaluated because different
 * modes share the same mask/pattern but have different trigger conditions.
 *
 * **`EventEmitter` composition** — `InputDispatcher` holds a private
 * `EventEmitter<InputControllerEvents<D>>` and binds `on`/`off`/`emit`
 * to it, keeping the class hierarchy flat. This is the same pattern
 * used by `GamePerformance`, `DeltaAccumulator`, and `Game`.
 *
 * **Concrete subclasses** — `AdvancedInputDispatcher` and
 * `SimpleInputDispatcher` provide the `#toKey`, `#and`, `#xor`, and
 * `#zero` primitives required by the generic dispatch logic for
 * `bigint` and `number` operands respectively. `ComposedInputDispatcher`
 * and `HighResInputDispatcher` follow the same pattern for `number[]`
 * and `Uint8Array` using the `bitwise-words` and `bitwise-u8` libraries.
 *
 * @see {@linkcode IInputController}
 * @see {@linkcode InputControllerEvents}
 * @see {@linkcode EventEmitter}
 *
 * @author MathAid
 */

import type { IGameLogic, IGameReadable } from '@games/loop';
import { EventEmitter } from '@games/loop';
import { uint8 as u8Ops, word as wordsOps } from '@games/math';
import type {
  AdvancedVPadData,
  ComposedVPadData,
  HighResVPadData,
  IInputController,
  InputControllerEvents,
  InputEvent,
  InputSubscription,
  SimpleVPadData,
  TriggerMode,
  VPadData,
} from '../types/controllers.types';

// ── Abstract base ─────────────────────────────────────────────────

/**
 * @summary Abstract base for all `InputDispatcher` variants.
 *
 * @description
 * Contains the complete dispatch, subscription, and event-emission logic.
 * Subclasses provide only the four primitive operations that differ
 * between `VPadData` subtypes:
 *
 * - `_and(a, b): D`  — bitwise AND
 * - `_xor(a, b): D`  — bitwise XOR
 * - `_zero(): D`     — the zero value for type `D`
 * - `_eq(a, b): boolean` — structural equality
 * - `_toKey(v: D): string` — serialise a `D` value for use in map keys
 *
 * These are protected methods (prefixed `_`) rather than abstract
 * private methods because TypeScript does not permit abstract private
 * members.
 *
 * @template D - `VPadData` subtype.
 */
abstract class InputDispatcherBase<
  D extends VPadData,
  GL extends IGameLogic,
> implements IInputController<D, GL> {
  // ── Driver ───────────────────────────────────────────────────
  readonly #driver: IGameReadable<GL, D>;

  // ── Event emitter ────────────────────────────────────────────
  readonly #emitter = new EventEmitter<InputControllerEvents<D>>();
  readonly on: IInputController<D, GL>['on'] = this.#emitter.on.bind(this.#emitter);
  readonly off: IInputController<D, GL>['off'] = this.#emitter.off.bind(this.#emitter);
  readonly emit: IInputController<D, GL>['emit'] = this.#emitter.emit.bind(this.#emitter);

  // ── Subscription storage ─────────────────────────────────────
  // Key: `${_toKey(mask)}:${_toKey(pattern)}:${mode}`
  // Value: Set of subscriptions sharing that key
  readonly #subs = new Map<string, Set<InputSubscription<D>>>();

  // ── State tracking ───────────────────────────────────────────
  #prevState: D;

  constructor(driver: IGameReadable<GL, D>) {
    this.#driver = driver;
    this.#prevState = this._zero();
  }

  // ── Subclass primitives (must override) ──────────────────────

  /** Bitwise AND of two `D` values. */
  protected abstract _and(a: D, b: D): D;
  /** Bitwise XOR of two `D` values. */
  protected abstract _xor(a: D, b: D): D;
  /** The zero value for type `D` (all bits clear). */
  protected abstract _zero(): D;
  /** Structural equality for type `D`. */
  protected abstract _eq(a: D, b: D): boolean;
  /** Serialise a `D` value to a string for use in map keys. */
  protected abstract _toKey(v: D): string;

  // ── IGameReadable ────────────────────────────────────────────

  /**
   * @summary Return the current raw state from the underlying driver.
   *
   * @description
   * Pass-through to `driver.read()`. The game loop calls this via
   * the `IGameReadable` interface to sample the controller state.
   * `dispatch` uses the same value internally — `read()` is called
   * once per `dispatch()` and the result is reused for all evaluations.
   */
  read(logic: GL): D {
    return this.#driver.read(logic);
  }

  // ── IDispatchable ────────────────────────────────────────────

  /**
   * @summary Evaluate all subscriptions against the current raw state.
   *
   * @description
   * Called once per simulation step by `DeltaAccumulator`. The sequence:
   *
   * 1. Sample `state = driver.read()`.
   * 2. Compute `changed = prevState XOR state` (bits that flipped).
   * 3. Compute `rising  = changed AND state`    (bits that went 0 → 1).
   * 4. Compute `falling = changed AND prevState` (bits that went 1 → 0).
   * 5. For each subscription bucket, evaluate according to `mode`:
   *    - `'held'`    → `(state & mask) === pattern`
   *    - `'pressed'` → pattern NOW met AND NOT met previously
   *    - `'released'`→ pattern WAS met AND NOT met now
   *    - `'changed'` → `(changed & mask) !== zero`
   * 6. For each matched subscription, build an `InputEvent<D>` and call
   *    both the subscription's own handler AND `emit` on the named event.
   * 7. Store `state` as `prevState` for next tick.
   *
   * @param timestamp - Current nanosecond timestamp from `IHostLoop.now()`.
   */
  dispatch(timestamp: number, gameLoop: GL): void {
    const state = this.#driver.read(gameLoop);
    const changed = this._xor(state, this.#prevState);
    const rising = this._and(changed, state);
    const falling = this._and(changed, this.#prevState);
    const zero = this._zero();

    for (const bucket of this.#subs.values()) {
      for (const sub of bucket) {
        const { mask, pattern, mode, handler } = sub;

        const maskedState = this._and(state, mask);
        const maskedChanged = this._and(changed, mask);
        const nowActive = this._eq(maskedState, pattern);
        const wasActive = sub.wasActive;

        let fire = false;

        switch (mode) {
          case 'held':
            fire = nowActive;
            break;
          case 'pressed':
            fire = nowActive && !wasActive;
            break;
          case 'released':
            fire = !nowActive && wasActive;
            break;
          case 'changed':
            fire = !this._eq(maskedChanged, zero);
            break;
        }

        sub.wasActive = nowActive;

        if (!fire) continue;

        const event: InputEvent<D> = {
          mask,
          pattern,
          mode,
          state,
          rising,
          falling,
          timestamp,
        };

        // Call the subscription's own handler
        handler(event);

        // Broadcast on the named event channel
        const eventName = this.#modeToEvent(mode);
        this.#emitter.emit(eventName, event);
      }
    }

    this.#prevState = state;
  }

  // ── IInputController ────────────────────────────────────────

  /**
   * @summary Register a pattern-match subscription.
   *
   * @description
   * Builds a string key from `(mask, pattern, mode)` and inserts the
   * subscription into the corresponding `Set`. Duplicate registrations
   * (same handler reference for the same tuple) are silently ignored via
   * a handler-reference check inside the bucket.
   *
   * @returns Idempotent unsubscribe function.
   */
  subscribe(
    mask: D,
    pattern: D,
    mode: TriggerMode,
    handler: (event: InputEvent<D>) => void,
  ): () => void {
    const key = this.#subKey(mask, pattern, mode);
    let bucket = this.#subs.get(key);
    if (!bucket) {
      bucket = new Set();
      this.#subs.set(key, bucket);
    }

    // Deduplicate by handler reference
    for (const existing of bucket) {
      if (existing.handler === handler) {
        // Return an unsubscribe fn even for duplicates — idempotent
        return () => this.unsubscribe(mask, pattern, mode, handler);
      }
    }

    const sub: InputSubscription<D> = {
      key,
      mask,
      pattern,
      mode,
      handler,
      wasActive: false,
    };
    bucket.add(sub);

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.unsubscribe(mask, pattern, mode, handler);
    };
  }

  /**
   * @summary Remove a subscription by exact tuple match.
   *
   * @description
   * Finds and removes the subscription whose handler reference matches.
   * Cleans up the empty bucket from the map to avoid memory leaks.
   * No-op if no matching subscription exists.
   */
  unsubscribe(
    mask: D,
    pattern: D,
    mode: TriggerMode,
    handler: (event: InputEvent<D>) => void,
  ): void {
    const key = this.#subKey(mask, pattern, mode);
    const bucket = this.#subs.get(key);
    if (!bucket) return;

    for (const sub of bucket) {
      if (sub.handler === handler) {
        bucket.delete(sub);
        break;
      }
    }
    if (bucket.size === 0) this.#subs.delete(key);
  }

  /**
   * @summary Remove all subscriptions and clear the event emitter.
   *
   * @description
   * Called during teardown (e.g. device disconnect) to release all
   * handler closures. Not part of `IInputController` — call explicitly
   * from the concrete driver's `disconnect` implementation.
   */
  clearAll(): void {
    this.#subs.clear();
    this.#emitter.clear();
  }

  // ── Private helpers ──────────────────────────────────────────

  #subKey(mask: D, pattern: D, mode: TriggerMode): string {
    return `${this._toKey(mask)}:${this._toKey(pattern)}:${mode}`;
  }

  #modeToEvent(mode: TriggerMode): keyof InputControllerEvents<D> {
    switch (mode) {
      case 'held':
        return 'input';
      case 'pressed':
        return 'press';
      case 'released':
        return 'release';
      case 'changed':
        return 'change';
    }
  }
}

// ── Concrete variants ─────────────────────────────────────────────

/**
 * @summary `InputDispatcher` for `AdvancedVPadData` (`bigint`).
 *
 * @description
 * Covers the full keyboard layout and any device that maps to a `bigint`
 * bitmask. Bitwise operations are native `bigint` operators. The key
 * format is the decimal string representation of the `bigint` value —
 * compact and unique.
 *
 * @example
 * const dispatcher = new AdvancedInputDispatcher(keyboardDriver);
 *
 * dispatcher.subscribe(
 *   KeyW | KeyS, KeyW, 'pressed',
 *   ({ timestamp }) => console.log('W pressed', timestamp),
 * );
 *
 * // In DeltaAccumulator.tick:
 * dispatcher.dispatch(host.now());
 *
 * @author MathAid
 */
export class AdvancedInputDispatcher<GL extends IGameLogic> extends InputDispatcherBase<
  AdvancedVPadData,
  GL
> {
  protected _and(a: bigint, b: bigint): bigint {
    return a & b;
  }
  protected _xor(a: bigint, b: bigint): bigint {
    return a ^ b;
  }
  protected _zero(): bigint {
    return 0n;
  }
  protected _eq(a: bigint, b: bigint): boolean {
    return a === b;
  }
  protected _toKey(v: bigint): string {
    return v.toString();
  }
}

/**
 * @summary `InputDispatcher` for `SimpleVPadData` (`number`, 32-bit).
 *
 * @description
 * Uses JavaScript's native 32-bit bitwise operators. `>>> 0` ensures
 * unsigned interpretation throughout. Key format is the unsigned decimal
 * string of the 32-bit value.
 *
 * @author MathAid
 */
export class SimpleInputDispatcher<GL extends IGameLogic> extends InputDispatcherBase<
  SimpleVPadData,
  GL
> {
  protected _and(a: number, b: number): number {
    return (a & b) >>> 0;
  }
  protected _xor(a: number, b: number): number {
    return (a ^ b) >>> 0;
  }
  protected _zero(): number {
    return 0;
  }
  protected _eq(a: number, b: number): boolean {
    return a >>> 0 === b >>> 0;
  }
  protected _toKey(v: number): string {
    return (v >>> 0).toString();
  }
}

/**
 * @summary `InputDispatcher` for `ComposedVPadData` (`number[]`, 32-bit words).
 *
 * @description
 * Uses the `bitwise-words` library for AND and XOR. Equality is
 * element-wise after zero-padding both sides. Key is the comma-joined
 * decimal string of each unsigned word.
 *
 * @author MathAid
 */
export class ComposedInputDispatcher<GL extends IGameLogic> extends InputDispatcherBase<
  ComposedVPadData,
  GL
> {
  protected _and(a: number[], b: number[]): number[] {
    return wordsOps.and(a, b);
  }
  protected _xor(a: number[], b: number[]): number[] {
    return wordsOps.xor(a, b);
  }
  protected _zero(): number[] {
    return [0];
  }
  protected _eq(a: number[], b: number[]): boolean {
    return wordsOps.compare(a, b) === 0;
  }
  protected _toKey(v: number[]): string {
    return v.map((w) => (w >>> 0).toString()).join(',');
  }
}

/**
 * @summary `InputDispatcher` for `HighResVPadData` (`Uint8Array`).
 *
 * @description
 * Uses the `bitwise-u8` library for AND and XOR. Equality is element-wise
 * after zero-padding. Key is the comma-joined decimal string of each byte.
 *
 * @author MathAid
 */
export class HighResInputDispatcher<GL extends IGameLogic> extends InputDispatcherBase<
  HighResVPadData,
  GL
> {
  protected _and(a: Uint8Array, b: Uint8Array): Uint8Array {
    return u8Ops.and(a, b);
  }
  protected _xor(a: Uint8Array, b: Uint8Array): Uint8Array {
    return u8Ops.xor(a, b);
  }
  protected _zero(): Uint8Array {
    return new Uint8Array(1);
  }
  protected _eq(a: Uint8Array, b: Uint8Array): boolean {
    return u8Ops.compare(a, b) === 0;
  }
  protected _toKey(v: Uint8Array): string {
    return Array.from(v).join(',');
  }
}
