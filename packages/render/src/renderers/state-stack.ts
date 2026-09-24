/**
 * @fileoverview
 * @summary The shared renderer state stack.
 *
 * @description
 * Defines {@linkcode RendererStateStack}, the data structure that every
 * renderer uses to track the current state and to save and restore it
 * across `push` and `pop` commands.
 *
 * The stack holds a list of {@linkcode RendererState} snapshots. The
 * `current` field is the top of the stack. A `push` copies the current
 * state and appends it. A `pop` removes the top and restores the
 * previous state. A `pop` on an empty stack is a no-op.
 *
 * ```text
 *   push()         pop()
 *     |              |
 *     v              v
 *   +----+         +----+
 *   | s3 |         | s2 |
 *   +----+         +----+
 *   | s2 |         | s1 |
 *   +----+         +----+
 *   | s1 |         | s0 |   <- current
 *   +----+         +----+
 *   | s0 |
 *   +----+
 * ```
 *
 * The stack is backend-agnostic. A renderer that has its own state stack
 * uses the shared stack to know what to save and restore. A renderer
 * that has no stack uses the shared stack as its only source of truth.
 *
 * @see {@linkcode RendererState}
 * @author MathAid
 */

import { type Paint } from '../geometry/paint';
import { type StrokeStyle } from '../geometry/style';
import { type Mat2D } from '../geometry/transform';
import { type RendererState, initialState } from './state';

/**
 * @summary The shared state stack every renderer consumes.
 *
 * @description
 * {@linkcode RendererStateStack} holds the current
 * {@linkcode RendererState} and a snapshot list for `push` and `pop`.
 * Each mutator returns the new state so callers can chain. The stack
 * itself is a plain class with no backend dependency.
 *
 * The class exposes one method per state command. A renderer dispatches
 * each state command to the matching method. The dispatcher lives in
 * the renderer, not in the stack, so the stack stays free of command
 * union knowledge.
 *
 * @example
 * Example 1: Track state changes
 * ```ts
 * const stack = new RendererStateStack();
 * stack.setFill(makeSolid(make(sRGB, 1, 0, 0)));
 * stack.setTransform([1, 0, 0, 1, 10, 20]);
 * const s = stack.current;
 * // s.fill is the red solid
 * // s.transform is [1, 0, 0, 1, 10, 20]
 * ```
 *
 * @example
 * Example 2: Save and restore across push and pop
 * ```ts
 * const stack = new RendererStateStack();
 * stack.setFill(makeSolid(make(sRGB, 1, 0, 0)));
 * stack.push();
 * stack.setFill(makeSolid(make(sRGB, 0, 0, 1)));
 * // current fill is blue
 * stack.pop();
 * // current fill is red again
 * ```
 *
 * @example
 * Example 3: Reset at the start of every frame
 * ```ts
 * stack.reset();
 * // current equals initialState()
 * ```
 *
 * @see {@linkcode RendererState}
 * @author MathAid
 */
export class RendererStateStack {
  #current: RendererState = initialState();
  readonly #snapshots: RendererState[] = [];

  /**
   * @summary The current state.
   * @returns {RendererState} The top of the stack.
   * @author MathAid
   */
  get current(): RendererState {
    return this.#current;
  }

  /**
   * @summary The number of snapshots on the stack.
   *
   * @description
   * The count reflects only the snapshots, not the current state. A
   * fresh stack returns `0`. A stack after three pushes and no pops
   * returns `3`.
   *
   * @returns {number} The depth.
   * @author MathAid
   */
  get depth(): number {
    return this.#snapshots.length;
  }

  /**
   * @summary Push a copy of the current state onto the stack.
   *
   * @description
   * The current state is copied and appended. Subsequent state changes
   * do not affect the snapshot. A `pop` restores it.
   *
   * @returns {void}
   * @author MathAid
   */
  push(): void {
    this.#snapshots.push(this.#current);
  }

  /**
   * @summary Pop the last snapshot and restore it.
   *
   * @description
   * When the stack is empty, the call is a no-op. The current state is
   * unchanged.
   *
   * @returns {void}
   * @author MathAid
   */
  pop(): void {
    const previous = this.#snapshots.pop();
    if (previous === undefined) return;
    this.#current = previous;
  }

  /**
   * @summary Reset the stack to the initial state.
   *
   * @description
   * Discards every snapshot and resets the current state. A renderer
   * calls this at the start of every frame.
   *
   * @returns {void}
   * @author MathAid
   */
  reset(): void {
    this.#snapshots.length = 0;
    this.#current = initialState();
  }

  /**
   * @summary Replace the current transform.
   *
   * @description
   * Replaces the `transform` slot. The previous transform is discarded.
   *
   * @param {Mat2D} m The new transform.
   * @returns {void}
   * @author MathAid
   */
  setTransform(m: Mat2D): void {
    this.#current = { ...this.#current, transform: m };
  }

  /**
   * @summary Set or clear the current fill paint.
   *
   * @description
   * Sets the `fill` slot. A `null` argument disables the fill.
   *
   * @param {Paint | null} paint The new fill.
   * @returns {void}
   * @author MathAid
   */
  setFill(paint: Paint | null): void {
    this.#current = { ...this.#current, fill: paint };
  }

  /**
   * @summary Set or clear the current stroke style.
   *
   * @description
   * Sets the `stroke` slot. A `null` argument disables the stroke.
   *
   * @param {StrokeStyle | null} stroke The new stroke.
   * @returns {void}
   * @author MathAid
   */
  setStroke(stroke: StrokeStyle | null): void {
    this.#current = { ...this.#current, stroke };
  }

  /**
   * @summary Set or clear the current background paint.
   *
   * @description
   * Sets the `background` slot. A `null` argument disables the
   * background.
   *
   * @param {Paint | null} paint The new background.
   * @returns {void}
   * @author MathAid
   */
  setBackground(paint: Paint | null): void {
    this.#current = { ...this.#current, background: paint };
  }
}
