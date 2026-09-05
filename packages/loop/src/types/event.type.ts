/**
 * @fileoverview
 * @summary Event emitter contract for the game loop package.
 *
 * @description
 * A minimal, environment-agnostic publish/subscribe interface used by
 * `IEngine` and the engine's components to expose
 * lifecycle and timing signals without coupling to `EventTarget`,
 * `EventEmitter`, or any platform-specific API.
 *
 * The event map generic `M` constrains every key to a payload type,
 * giving full type inference on `on`, `off`, and `emit` call sites
 * with no casting required.
 *
 * @example
 * // Defining an event map
 * type MyEvents = {
 *   'tick': { delta: number };
 *   'stop': void;
 * };
 *
 * // Consuming
 * const unsub = emitter.on('tick', ({ delta }) => console.log(delta));
 * unsub(); // clean up without holding a handler reference
 *
 * @author MathAid
 */

// ── Utility ───────────────────────────────────────────────────────

/**
 * @summary Payload type for a single event key.
 *
 * @description
 * Resolves the payload type for key `K` in event map `M`.
 * When the payload is `void`, handlers receive no argument.
 * Used to keep `on`/`emit` signatures consistent across void
 * and non-void events without overloads.
 */
export type EventPayload<M, K extends keyof M> = M[K] extends void ? [] : [data: M[K]];

/**
 * @summary A handler function for a typed event.
 *
 * @description
 * Receives the payload declared in the event map for key `K`.
 * For `void` events the handler takes no arguments.
 *
 * @template M - The event map the handler belongs to.
 * @template K - The specific event key.
 */
export type EventHandler<M, K extends keyof M> = (...args: EventPayload<M, K>) => void;

/**
 * @summary A function that removes a previously registered event handler.
 *
 * @description
 * Returned by `IEventEmitter.on`. Calling it is equivalent to calling
 * `off` with the original key and handler, but does not require the
 * caller to retain a reference to the handler itself.
 *
 * The function is idempotent — calling it more than once has no effect.
 */
export type Unsubscribe = () => void;

// ── Interface ─────────────────────────────────────────────────────

/**
 * @summary Environment-agnostic typed event emitter.
 *
 * @description
 * Implemented by `IEngine` (composing `EventEmitter`) and other emitters
 * to expose lifecycle and timing signals. The generic `M` is an object
 * type whose keys are event names and whose values are payload types.
 * `void` payloads emit with no argument.
 *
 * Implementations must satisfy three contracts:
 * - `on` registers a handler and returns an idempotent unsubscribe fn.
 * - `off` is a no-op when the handler was never registered or already removed.
 * - `emit` is synchronous — all handlers for the event run before it returns.
 *
 * @template M - Event map: `{ [eventName]: payloadType }`.
 *
 * @example
 * const unsub = game.on('pause', () => audio.mute());
 * // later:
 * unsub();
 *
 * @example
 * // void event — handler takes no args
 * perf.on('fps-reset', () => overlay.update(perf.fps));
 *
 * @example
 * // non-void event — handler receives typed payload
 * perf.on('tick', ({ delta, current }) => profiler.record(delta));
 *
 * @author MathAid
 */
export interface IEventEmitter<M extends Record<string, unknown>> {
  /**
   * @summary Register a handler for a typed event.
   *
   * @description
   * The handler is called synchronously each time `emit(event, ...)` is
   * invoked. Registering the same handler for the same event twice has
   * no effect — the handler fires exactly once per emission regardless.
   *
   * @param event - The event key to subscribe to.
   * @param handler - The function to call when the event fires.
   * @returns An idempotent unsubscribe function.
   *
   * @see {@linkcode Unsubscribe}
   */
  on<K extends keyof M>(event: K, handler: EventHandler<M, K>): Unsubscribe;

  /**
   * @summary Remove a previously registered handler.
   *
   * @description
   * No-op when the handler was never registered or has already been
   * removed. Safe to call multiple times.
   *
   * @param event - The event key the handler was registered under.
   * @param handler - The exact handler reference passed to `on`.
   */
  off<K extends keyof M>(event: K, handler: EventHandler<M, K>): void;

  /**
   * @summary Fire all handlers registered for an event.
   *
   * @description
   * Synchronous — all registered handlers run before `emit` returns.
   * Handlers that throw do not prevent other handlers from running;
   * the error is re-thrown after all handlers have been called.
   *
   * @param event - The event key to fire.
   * @param args - The payload, or nothing for `void` events.
   */
  emit<K extends keyof M>(event: K, ...args: EventPayload<M, K>): void;
}
