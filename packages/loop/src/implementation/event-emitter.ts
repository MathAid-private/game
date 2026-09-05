/**
 * @fileoverview
 * @summary Concrete implementation of `IEventEmitter`.
 *
 * @description
 * `EventEmitter<M>` is a zero-dependency, environment-agnostic typed
 * event bus. It uses a `Map` keyed by event name, with each value
 * being a `Set` of handler functions. `Set` membership gives O(1)
 * deduplication and O(1) removal without index bookkeeping.
 *
 * Intended as a private field on `GamePerformance`, `DeltaAccumulator`,
 * and `Game` — not as a superclass. Classes compose the emitter and
 * delegate `on`/`off`/`emit` to it, keeping their own inheritance
 * chain free.
 *
 * Error isolation: if a handler throws, the remaining handlers for
 * that emission still run. All thrown values are collected and
 * re-thrown as an `AggregateError` after the emission completes.
 * This matches the behaviour described on `IEventEmitter.emit`.
 *
 * @example
 * type MyEvents = { tick: { delta: number }; stop: void };
 *
 * class MyClass implements IEventEmitter<MyEvents> {
 *   readonly #emitter = new EventEmitter<MyEvents>();
 *   on  = this.#emitter.on.bind(this.#emitter);
 *   off = this.#emitter.off.bind(this.#emitter);
 *   emit = this.#emitter.emit.bind(this.#emitter);
 * }
 *
 * @throws {AggregateError} When one or more handlers throw during `emit`.
 *
 * @author MathAid
 */

import type { EventHandler, EventPayload, IEventEmitter, Unsubscribe } from '../types/event.type';

export class EventEmitter<M extends Record<string, unknown>> implements IEventEmitter<M> {
  /**
   * One Set of handlers per event key. Allocated lazily — no Set is
   * created until the first `on` call for that key.
   */
  readonly #handlers = new Map<keyof M, Set<EventHandler<M, keyof M>>>();

  // ── Private helpers ────────────────────────────────────────────

  /**
   * @summary Return the handler set for a key, creating it if absent.
   *
   * @description
   * Lazy initialisation keeps construction cost near zero when many
   * events are declared but only a subset are ever subscribed to.
   */
  #bucket<K extends keyof M>(event: K): Set<EventHandler<M, K>> {
    let bucket = this.#handlers.get(event);
    if (!bucket) {
      bucket = new Set();
      this.#handlers.set(event, bucket);
    }
    return bucket as Set<EventHandler<M, K>>;
  }

  // ── IEventEmitter ──────────────────────────────────────────────

  /**
   * @summary Register a handler for a typed event.
   *
   * @description
   * Adding the same handler reference a second time for the same event
   * is a no-op — `Set` deduplication ensures the handler fires exactly
   * once per emission regardless of how many times `on` is called with it.
   *
   * @param event - Event key to subscribe to.
   * @param handler - Handler to call on emission.
   * @returns Idempotent unsubscribe function. Safe to call multiple times.
   *
   * @example
   * const unsub = emitter.on('tick', ({ delta }) => console.log(delta));
   * unsub(); // removes the handler
   * unsub(); // no-op
   */
  on<K extends keyof M>(event: K, handler: EventHandler<M, K>): Unsubscribe {
    this.#bucket(event).add(handler);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.off(event, handler);
    };
  }

  /**
   * @summary Remove a previously registered handler.
   *
   * @description
   * No-op when the handler is not in the set. Does not throw.
   *
   * @param event - Event key the handler was registered under.
   * @param handler - The exact function reference passed to `on`.
   */
  off<K extends keyof M>(event: K, handler: EventHandler<M, K>): void {
    this.#handlers.get(event)?.delete(handler as EventHandler<M, keyof M>);
  }

  /**
   * @summary Fire all handlers registered for an event.
   *
   * @description
   * Iterates over a snapshot of the handler set at call time so that
   * handlers which call `off` mid-emission do not affect the current
   * iteration. Errors are collected and re-thrown together after all
   * handlers have run.
   *
   * @param event - Event key to fire.
   * @param args - Payload, or nothing for `void` events.
   *
   * @throws {AggregateError} If one or more handlers throw.
   *
   * @note
   * Emission is synchronous. Do not register async handlers — their
   * rejections will be unhandled. Wrap async work in a void IIFE or
   * schedule it with `queueMicrotask` inside the handler if needed.
   */
  emit<K extends keyof M>(event: K, ...args: EventPayload<M, K>): void {
    const bucket = this.#handlers.get(event);
    if (!bucket?.size) return;

    // Snapshot before iteration — safe against on/off calls inside handlers
    const snapshot = [...bucket] as EventHandler<M, K>[];
    const errors: unknown[] = [];

    for (const handler of snapshot) {
      try {
        (handler as (...a: EventPayload<M, K>) => void)(...args);
      } catch (err) {
        errors.push(err);
      }
    }

    if (errors.length === 1) throw errors[0];
    if (errors.length > 1)
      throw new AggregateError(errors, `${String(event)}: ${errors.length} handler(s) threw`);
  }

  // ── Introspection (not on IEventEmitter — internal/test use) ──

  /**
   * @summary Number of handlers currently registered for a given event.
   *
   * @description
   * Intended for testing and debugging. Not part of `IEventEmitter` —
   * production code should not depend on this.
   *
   * @param event - Event key to query.
   * @returns Handler count, or `0` if no handlers are registered.
   */
  listenerCount<K extends keyof M>(event: K): number {
    return this.#handlers.get(event)?.size ?? 0;
  }

  /**
   * @summary Remove all handlers for all events.
   *
   * @description
   * Used during `Game.stop()` to prevent stale closures from holding
   * references after teardown. Clears every bucket entirely.
   */
  clear(): void {
    this.#handlers.clear();
  }
}
