/**
 * @fileoverview
 * @summary Stroke and text styles for the render pipeline.
 *
 * @description
 * Defines {@linkcode StrokeStyle} and {@linkcode TextStyle}. Both are
 * plain, immutable data. They decorate a draw command without binding to
 * any backend. The renderer reads the fields and applies them.
 *
 * A style is not a shape and not a paint. A stroke style references a
 * {@linkcode Paint} for its color. A text style references a paint for
 * its fill. The separation lets the same style apply to many shapes.
 *
 * ```text
 *   StrokeStyle
 *     +-- paint          the line color (a Paint)
 *     +-- width          the line thickness
 *     +-- cap            how ends are drawn
 *     +-- join           how corners are drawn
 *     +-- miterLimit     the miter cut-off
 *     +-- dash           the dash pattern
 *     +-- dashOffset     the phase into the dash pattern
 * ```
 *
 * Every field is optional except the paint. The renderer fills in the
 * defaults. The defaults match the Canvas2D defaults so a stroke looks
 * the same on every backend.
 *
 * @example
 * Example 1: A thin white border
 * ```ts
 * import { makeSolid } from './paint';
 * import { make, sRGB } from '../color';
 *
 * const border: StrokeStyle = { paint: makeSolid(make(sRGB, 1, 1, 1)) };
 * ```
 *
 * @example
 * Example 2: A dashed outline
 * ```ts
 * const dashed: StrokeStyle = {
 *   paint: makeSolid(make(sRGB, 1, 0, 0)),
 *   width: 2,
 *   dash: [4, 4],
 * };
 * ```
 *
 * @see {@linkcode Paint}
 * @author MathAid
 */

import { type Paint } from './paint';

/**
 * @summary An outline style for stroked shapes.
 *
 * @description
 * The `paint` field is required. It gives the stroke its color. The
 * remaining fields are optional and take Canvas2D defaults when omitted.
 *
 * The `cap` field controls how open ends of a segment are drawn. The
 * `join` field controls how a corner between two segments is drawn. The
 * `miterLimit` only applies when `join` is `'miter'`.
 *
 * The `dash` field is a list of on and off lengths in logical pixels. The
 * pattern repeats along the path. The `dashOffset` shifts the phase into
 * the pattern.
 *
 * ```text
 *   cap:   butt      round      square
 *          |          ( )        |  |
 *
 *   join:  miter     round      bevel
 *          /\        /\         /\
 *         /  \      (  )       /  \
 * ```
 *
 * @example
 * Example 1: The defaults
 * ```ts
 * const s: StrokeStyle = { paint: makeSolid(make(sRGB, 1, 1, 1)) };
 * ```
 *
 * @example
 * Example 2: A thick, rounded outline
 * ```ts
 * const thick: StrokeStyle = {
 *   paint: makeSolid(make(sRGB, 1, 0, 0)),
 *   width: 4,
 *   cap: 'round',
 *   join: 'round',
 * };
 * ```
 *
 * @see {@linkcode Paint}
 * @author MathAid
 */
export interface StrokeStyle {
  /** The stroke color. */
  readonly paint: Paint;
  /** The line thickness in logical pixels. Defaults to `1`. */
  readonly width?: number;
  /** How open ends are drawn. Defaults to `'butt'`. */
  readonly cap?: 'butt' | 'round' | 'square';
  /** How corners are drawn. Defaults to `'miter'`. */
  readonly join?: 'miter' | 'round' | 'bevel';
  /** The miter cut-off. Defaults to `10`. */
  readonly miterLimit?: number;
  /** The dash pattern in logical pixels. Defaults to no dashing. */
  readonly dash?: readonly number[];
  /** The phase into the dash pattern. Defaults to `0`. */
  readonly dashOffset?: number;
}

/**
 * @summary A text drawing style.
 *
 * @description
 * Every field is optional. A text command carries a full
 * {@linkcode TextStyle} so a renderer never has to guess a default. The
 * renderer falls back to a built-in default when a field is missing.
 *
 * The `align` field positions the text horizontally relative to the
 * anchor point. The `baseline` field positions it vertically. The two
 * together determine where the string sits around the anchor.
 *
 * ```text
 *   baseline:  top
 *              middle
 *              bottom
 *              alphabetic  (the default)
 *
 *   align:     left
 *              center
 *              right
 * ```
 *
 * @example
 * Example 1: A heads-up label
 * ```ts
 * const hud: TextStyle = { size: 12, align: 'left', baseline: 'top' };
 * ```
 *
 * @example
 * Example 2: Centered score
 * ```ts
 * const score: TextStyle = {
 *   paint: makeSolid(make(sRGB, 1, 1, 1)),
 *   size: 32,
 *   align: 'center',
 *   baseline: 'middle',
 * };
 * ```
 *
 * @see {@linkcode Paint}
 * @author MathAid
 */
export interface TextStyle {
  /** The fill color. Defaults to the current fill state. */
  readonly paint?: Paint;
  /** The point size in logical pixels. Defaults to `12`. */
  readonly size?: number;
  /** The font family. Defaults to `'monospace'`. */
  readonly family?: string;
  /** The horizontal alignment. Defaults to `'left'`. */
  readonly align?: 'left' | 'center' | 'right';
  /** The vertical baseline. Defaults to `'top'`. */
  readonly baseline?: 'top' | 'middle' | 'bottom' | 'alphabetic';
}