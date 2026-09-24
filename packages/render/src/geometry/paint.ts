/**
 * @fileoverview
 * @summary The paint vocabulary and its constructors.
 *
 * @description
 * Defines {@linkcode Paint} as the union of every fill and stroke source
 * the render pipeline understands. Today the union has one variant,
 * `'solid'`, which wraps a {@linkcode ColorValue}. Future gradient and
 * pattern variants extend the union without breaking callers.
 *
 * A paint is a description, not a color. A solid paint wraps a color. A
 * future gradient paint will wrap a {@linkcode Gradient} description. The
 * renderer decides how to rasterize the paint for its target surface.
 *
 * ```text
 *   Paint
 *   +-- solid    wraps a ColorValue
 *   +-- (future) gradient
 *   +-- (future) pattern
 * ```
 *
 * Every paint is pure data. No paint holds a reference to a canvas, a
 * context, or any backend resource.
 *
 * @example
 * Example 1: A solid red fill
 * ```ts
 * import { makeSolid } from './paint';
 * import { make, sRGB } from '../color';
 *
 * const red = makeSolid(make(sRGB, 1, 0, 0));
 * ```
 *
 * @example
 * Example 2: A translucent overlay
 * ```ts
 * import { makeSolid } from './paint';
 * import { make, sRGB } from '../color';
 *
 * const dim = makeSolid(make(sRGB, 0, 0, 0, 0.5));
 * ```
 *
 * @see {@linkcode StrokeStyle}
 * @see {@linkcode TextStyle}
 * @author MathAid
 */

import { type ColorValue } from '../color/convert';
import { type ColorSpaceDef } from '../color/space';

/**
 * @summary A paint source for fills and strokes.
 *
 * @description
 * The union has one variant today. A `'solid'` paint carries a single
 * {@linkcode ColorValue} in any color space. The renderer converts the
 * color to its native space at draw time.
 *
 * The union is open for extension. A future `'gradient'` variant will
 * carry a gradient description. A future `'pattern'` variant will carry a
 * pattern raster and a tile rule. Both will be additive.
 *
 * @example
 * Example 1: A solid paint
 * ```ts
 * const p: Paint = { kind: 'solid', color: make(sRGB, 1, 0, 0) };
 * ```
 *
 * @example
 * Example 2: A wide-gamut solid
 * ```ts
 * const wide: Paint = {
 *   kind: 'solid',
 *   color: make(Display_P3, 1, 0.5, 0),
 * };
 * ```
 *
 * @see {@linkcode makeSolid}
 * @author MathAid
 */
export type Paint = {
  readonly kind: 'solid';
  readonly color: ColorValue<ColorSpaceDef<string>>;
};

/**
 * @summary Construct a solid {@linkcode Paint}.
 *
 * @description
 * Wraps a {@linkcode ColorValue} in the paint union. The color keeps its
 * own space. The renderer converts it at draw time.
 *
 * @example
 * Example 1: A red fill
 * ```ts
 * import { make, sRGB } from '../color';
 * import { makeSolid } from './paint';
 *
 * const red = makeSolid(make(sRGB, 1, 0, 0));
 * ```
 *
 * @example
 * Example 2: A translucent black
 * ```ts
 * import { make, sRGB } from '../color';
 * import { makeSolid } from './paint';
 *
 * const dim = makeSolid(make(sRGB, 0, 0, 0, 0.5));
 * ```
 *
 * @param {ColorValue<ColorSpaceDef<string>>} color The fill or stroke color.
 * @returns {Paint} A new solid paint.
 * @author MathAid
 */
export function makeSolid(
  color: ColorValue<ColorSpaceDef<string>>,
): Paint {
  return { kind: 'solid', color };
}