/**
 * @fileoverview Mutable color value type and converters.
 *
 * @summary
 * Provides `MutableColor<S>` and the `toMutable` and `toImmutable`
 * converters. The mutable type is the same shape as `ColorValue<S>` but
 * its color channels are writable.
 *
 * @description
 * `ColorValue<S>` is read-only. Every edit allocates a new object. That
 * is the safe default. It is also a cost in hot loops such as particle
 * updates and per-frame tint changes.
 *
 * `MutableColor<S>` drops the `readonly` modifier on `r`, `g`, `b`, and
 * `a`. The `_space` field stays read-only. The space tag must not
 * change. That is the whole point of the type.
 *
 * Use this type only in code that profiles show a cost. Keep the
 * immutable path as the default. See the roadmap for the reasoning.
 *
 * ```text
 *   ColorValue<S>          MutableColor<S>
 *   ------------           ---------------
 *   readonly r: number     r: number
 *   readonly g: number     g: number
 *   readonly b: number     b: number
 *   readonly a: number     a: number
 *   readonly _space: S     readonly _space: S
 * ```
 *
 * @example
 * import { make, sRGB } from './index.js';
 * import { toMutable, toImmutable } from './mutable.js';
 *
 * const red = make(sRGB, 1, 0, 0);
 * const m = toMutable(red);
 * m.g = 0.5;                      // Allowed. The type is mutable.
 * const back = toImmutable(m);
 *
 * @author MathAid
 */

import { type ColorValue } from './convert';
import { type ColorSpaceDef } from './space';

// -----------------------------------------------------------------
//  Type
// -----------------------------------------------------------------

/**
 * @summary
 * A mutable color value in a specific logical color space `S`.
 *
 * @description
 * The shape matches `ColorValue<S>` except that the four color channels
 * are writable. The `_space` field stays read-only. Do not reassign it.
 *
 * The name says "mutable" but only the value is mutable. The space is
 * still fixed at construction time. A red in sRGB stays a red in sRGB.
 * Changing the space requires a `convert` call.
 *
 * @template S - The color space type. A `ColorSpaceDef<string>`.
 *
 * @example
 * import { toMutable, type MutableColor } from './mutable.js';
 * import { make, sRGB } from './index.js';
 *
 * const m: MutableColor<typeof sRGB> = toMutable(make(sRGB, 1, 0, 0));
 * m.r = 0.5;
 * m.g = 0.25;
 */
export interface MutableColor<S extends ColorSpaceDef<string>> {
  /** First channel. R, L, or X. Writable. */
  r: number;
  /** Second channel. G, a, or Y. Writable. */
  g: number;
  /** Third channel. B, b, or Z. Writable. */
  b: number;
  /** Alpha. Always linear, 0 to 1. Writable. */
  a: number;
  /** The space object. Read-only. Do not reassign. */
  readonly _space: S;
}

// -----------------------------------------------------------------
//  Converters
// -----------------------------------------------------------------

/**
 * @summary
 * Copy a `ColorValue<S>` into a new `MutableColor<S>`.
 *
 * @description
 * The function copies the four channel values into a fresh object. The
 * input is not aliased. Later edits to the result do not change the
 * input.
 *
 * @template S - The color space type.
 *
 * @param color - The source `ColorValue<S>`.
 * @returns A new `MutableColor<S>` with the same values.
 *
 * @example
 * const src = make(sRGB, 0.5, 0.5, 0.5);
 * const m = toMutable(src);
 * m.r = 1;
 * // src.r is still 0.5
 */
export function toMutable<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
): MutableColor<S> {
  return { r: color.r, g: color.g, b: color.b, a: color.a, _space: color._space };
}

/**
 * @summary
 * Take a snapshot of a `MutableColor<S>` as a `ColorValue<S>`.
 *
 * @description
 * The function copies the four channel values into a fresh immutable
 * object. The input is not aliased. Later edits to the input do not
 * change the snapshot.
 *
 * @template S - The color space type.
 *
 * @param color - The source `MutableColor<S>`.
 * @returns A new `ColorValue<S>` with the same values at this moment.
 *
 * @example
 * const m = toMutable(make(sRGB, 0.5, 0.5, 0.5));
 * const snap = toImmutable(m);
 * m.r = 1;
 * // snap.r is still 0.5
 */
export function toImmutable<S extends ColorSpaceDef<string>>(
  color: MutableColor<S>,
): ColorValue<S> {
  return { r: color.r, g: color.g, b: color.b, a: color.a, _space: color._space };
}