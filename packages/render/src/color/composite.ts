/**
 * @fileoverview Alpha compositing.
 *
 * @summary
 * Provides `over`, `under`, `premultiply`, `unpremultiply`, and
 * `withAlpha`. These implement the Porter-Duff source-over rule.
 *
 * @description
 * Compositing blends two colors with alpha. The source goes on top. The
 * destination goes underneath. The result replaces the destination.
 *
 * The module uses straight (non-premultiplied) alpha for its public
 * inputs and outputs. Premultiplied helpers are provided for GPU
 * uploads and for image filters.
 *
 * The source-over rule is:
 *
 * ```text
 *   out_a = src_a + dst_a * (1 - src_a)
 *   out_c = (src_c * src_a + dst_c * dst_a * (1 - src_a)) / out_a
 * ```
 *
 * When `out_a` is 0, the color channels are undefined. The function
 * returns the destination unchanged in that case.
 *
 * @see {@link https://keithp.com/~keithp/porterduff/p253-porter.pdf} Porter-Duff 1984
 *
 * @author MathAid
 */

import { type ColorValue, convert, make } from './convert';
import { type ColorSpaceDef } from './space';

// -----------------------------------------------------------------
//  Source over
// -----------------------------------------------------------------

/**
 * @summary
 * Composite a source color over a destination color.
 *
 * @description
 * The function converts the source to the destination's space. It then
 * applies the Porter-Duff source-over rule. The result is in the
 * destination space.
 *
 * The result fully covers the destination when the source alpha is 1.
 * The result is the destination when the source alpha is 0.
 *
 * @template Src - The source color space type.
 * @template Dst - The destination color space type.
 *
 * @param src - The source color. Goes on top.
 * @param dst - The destination color. Goes underneath.
 * @returns A new `ColorValue<Dst>`.
 *
 * @example
 * const red = make(sRGB, 1, 0, 0, 1);
 * const blue = make(sRGB, 0, 0, 1, 1);
 * over(red, blue);  // sRGB(1, 0, 0, 1). Red covers blue.
 *
 * @example
 * const halfRed = make(sRGB, 1, 0, 0, 0.5);
 * const blue = make(sRGB, 0, 0, 1, 1);
 * over(halfRed, blue);  // a blend of red and blue
 */
export function over<Src extends ColorSpaceDef<string>, Dst extends ColorSpaceDef<string>>(
  src: ColorValue<Src>,
  dst: ColorValue<Dst>,
): ColorValue<Dst> {
  const s = convert(src, dst._space);
  const sa = s.a;
  const da = dst.a;
  const outA = sa + da * (1 - sa);
  if (outA === 0) return dst;
  const inv = 1 / outA;
  return make(
    dst._space,
    (s.r * sa + dst.r * da * (1 - sa)) * inv,
    (s.g * sa + dst.g * da * (1 - sa)) * inv,
    (s.b * sa + dst.b * da * (1 - sa)) * inv,
    outA,
  );
}

/**
 * @summary
 * Composite a source color under a destination color.
 *
 * @description
 * The function is the same as `over(dst, src)` with the arguments
 * swapped. The destination goes on top. The source goes underneath. The
 * result is in the source's space.
 *
 * @template Src - The source color space type.
 * @template Dst - The destination color space type.
 *
 * @param src - The source color. Goes underneath.
 * @param dst - The destination color. Goes on top.
 * @returns A new `ColorValue<Src>`.
 *
 * @example
 * const red = make(sRGB, 1, 0, 0, 1);
 * const halfBlue = make(sRGB, 0, 0, 1, 0.5);
 * under(red, halfBlue);  // blue covers red at half alpha
 */
export function under<Src extends ColorSpaceDef<string>, Dst extends ColorSpaceDef<string>>(
  src: ColorValue<Src>,
  dst: ColorValue<Dst>,
): ColorValue<Src> {
  return over(dst, src) as unknown as ColorValue<Src>;
}

// -----------------------------------------------------------------
//  Premultiply
// -----------------------------------------------------------------

/**
 * @summary
 * Premultiply the color channels of a color by its alpha.
 *
 * @description
 * The function multiplies `r`, `g`, and `b` by `a`. The alpha channel
 * is unchanged. The result is in the same space as the input.
 *
 * Premultiplied colors are common in image formats and in GPU texture
 * uploads. The format avoids a multiply per pixel during blending.
 *
 * @template S - The color space type.
 *
 * @param color - The source color. Must be straight, not premultiplied.
 * @returns A new `ColorValue<S>` with premultiplied channels.
 *
 * @example
 * premultiply(make(sRGB, 1, 0, 0, 0.5));  // sRGB(0.5, 0, 0, 0.5)
 */
export function premultiply<S extends ColorSpaceDef<string>>(color: ColorValue<S>): ColorValue<S> {
  const a = color.a;
  return make(color._space, color.r * a, color.g * a, color.b * a, a);
}

/**
 * @summary
 * Undo premultiplication on the color channels of a color.
 *
 * @description
 * The function divides `r`, `g`, and `b` by `a`. The alpha channel is
 * unchanged. When alpha is 0, the function returns the input unchanged.
 * The color channels of a fully transparent premultiplied color are
 * undefined and stay undefined.
 *
 * @template S - The color space type.
 *
 * @param color - The source color. Must be premultiplied.
 * @returns A new `ColorValue<S>` with straight channels.
 *
 * @example
 * unpremultiply(make(sRGB, 0.5, 0, 0, 0.5));  // sRGB(1, 0, 0, 0.5)
 * unpremultiply(make(sRGB, 0, 0, 0, 0));      // unchanged
 */
export function unpremultiply<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
): ColorValue<S> {
  const a = color.a;
  if (a === 0) return color;
  const inv = 1 / a;
  return make(color._space, color.r * inv, color.g * inv, color.b * inv, a);
}
