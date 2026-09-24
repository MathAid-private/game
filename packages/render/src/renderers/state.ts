/**
 * @fileoverview
 * @summary The renderer state slots that a state stack saves and restores.
 *
 * @description
 * Defines {@linkcode RendererState}, the plain object that every
 * renderer tracks between commands. The state has four slots. The
 * `transform` slot holds the current {@linkcode Mat2D}. The `fill`,
 * `stroke`, and `background` slots hold the current paint or style, or
 * `null` when the slot is disabled.
 *
 * The state is backend-agnostic. A renderer that has its own state
 * stack, such as Canvas2D, keeps the shared state in sync with the
 * backend's state. A renderer that has no stack, such as a future
 * WebGPU renderer, uses the shared state as its only source of truth.
 *
 * ```text
 *   RendererState
 *     +-- transform    Mat2D           the current matrix
 *     +-- fill         Paint | null    the current fill paint
 *     +-- stroke       StrokeStyle | null
 *     +-- background   Paint | null    applied once before drawing
 * ```
 *
 * The state is immutable. {@linkcode initialState} produces the default.
 * The state stack produces new state objects when a slot changes.
 *
 * @see {@linkcode RendererStateStack}
 * @author MathAid
 */

import { type Paint } from '../geometry/paint';
import { type StrokeStyle } from '../geometry/style';
import { type Mat2D, identity } from '../geometry/transform';

/**
 * @summary The four slots a renderer tracks between commands.
 *
 * @description
 * The state is a plain object. Every slot is `readonly`. A renderer
 * replaces the whole object when a slot changes. This makes state
 * snapshots cheap and avoids accidental mutation.
 *
 * @example
 * Example 1: The initial state
 * ```ts
 * import { initialState } from './state';
 * const s = initialState();
 * // s.transform is the identity
 * // s.fill, s.stroke, s.background are all null
 * ```
 *
 * @example
 * Example 2: A modified state
 * ```ts
 * const s: RendererState = {
 *   transform: [2, 0, 0, 2, 0, 0],
 *   fill: makeSolid(make(sRGB, 1, 0, 0)),
 *   stroke: null,
 *   background: null,
 * };
 * ```
 *
 * @see {@linkcode RendererStateStack}
 * @author MathAid
 */
export interface RendererState {
  /** The current transform. */
  readonly transform: Mat2D;
  /** The current fill paint, or `null` when the slot is disabled. */
  readonly fill: Paint | null;
  /** The current stroke style, or `null` when the slot is disabled. */
  readonly stroke: StrokeStyle | null;
  /** The current background paint, or `null` when the slot is disabled. */
  readonly background: Paint | null;
}

/**
 * @summary The default state before any command is processed.
 *
 * @description
 * The transform is the identity. The fill, stroke, and background slots
 * are `null`. A renderer calls this at the start of every frame or when
 * its state stack is reset.
 *
 * @example
 * Example 1: Reset a renderer
 * ```ts
 * stack.reset();
 * expect(stack.current).toEqual(initialState());
 * ```
 *
 * @example
 * Example 2: Compare against the default
 * ```ts
 * const fresh = initialState();
 * const after = stack.current;
 * ```
 *
 * @returns {RendererState} A new state object with default values.
 * @author MathAid
 */
export function initialState(): RendererState {
  return {
    transform: identity(),
    fill: null,
    stroke: null,
    background: null,
  };
}
