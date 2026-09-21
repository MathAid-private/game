/**
 * @fileoverview Color operations.
 *
 * @summary
 * Provides `lighten`, `darken`, `saturate`, `desaturate`, `rotateHue`,
 * `invert`, `grayscale`, and `complement`. Each operation is pure.
 *
 * @description
 * The module works in OKLCh. OKLCh is a perceptually uniform space.
 * Edits to L and C do not shift hue. Edits to H do not shift lightness.
 * This gives predictable results for UI and for game logic.
 *
 * ```text
 *   Lightness (L)  0 is black, 1 is white
 *   Chroma (C)     0 is gray, higher is more saturated
 *   Hue (H)        0 to 360 degrees
 * ```
 *
 * `invert` and `grayscale` return the source space. They are
 * channel-wise operations. `lighten`, `darken`, `saturate`,
 * `desaturate`, `rotateHue`, and `complement` return OKLCh. The caller
 * can convert back to the source space if needed.
 *
 * @author MathAid
 */

import { type ColorValue, convert, make } from './convert';
import { type ColorSpaceDef, OKLCh } from './space';

// -----------------------------------------------------------------
//  Internals
// -----------------------------------------------------------------

/**
 * @summary
 * Clamp a number to the 0 to 1 range.
 *
 * @param v - The input value.
 * @returns The clamped value.
 */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * @summary
 * Wrap a hue angle in degrees to the 0 to 360 range.
 *
 * @param h - The hue angle. May be negative or above 360.
 * @returns The wrapped angle in 0 to 360.
 */
function wrapHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

// -----------------------------------------------------------------
//  Lightness
// -----------------------------------------------------------------

/**
 * @summary
 * Increase the perceptual lightness of a color.
 *
 * @description
 * The function converts to OKLCh. It adds `amount` to the L channel. It
 * clamps the result to 0 to 1. Chroma and hue are unchanged. A negative
 * `amount` is allowed and calls `darken` in effect.
 *
 * @template S - The source color space type.
 *
 * @param color - The source color.
 * @param amount - The amount to add, in OKLCh L units.
 * @returns A new `ColorValue<typeof OKLCh>`.
 *
 * @example
 * lighten(make(sRGB, 0.5, 0.5, 0.5), 0.2);
 */
export function lighten<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  amount: number,
): ColorValue<typeof OKLCh> {
  const lch = convert(color, OKLCh);
  return make(OKLCh, clamp01(lch.c1 + amount), lch.c2, lch.c3, lch.alpha);
}

/**
 * @summary
 * Decrease the perceptual lightness of a color.
 *
 * @description
 * The function converts to OKLCh. It subtracts `amount` from the L
 * channel. It clamps the result to 0 to 1. Chroma and hue are
 * unchanged. A negative `amount` is allowed and calls `lighten` in
 * effect.
 *
 * @template S - The source color space type.
 *
 * @param color - The source color.
 * @param amount - The amount to subtract, in OKLCh L units.
 * @returns A new `ColorValue<typeof OKLCh>`.
 *
 * @example
 * darken(make(sRGB, 0.5, 0.5, 0.5), 0.2);
 */
export function darken<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  amount: number,
): ColorValue<typeof OKLCh> {
  const lch = convert(color, OKLCh);
  return make(OKLCh, clamp01(lch.c1 - amount), lch.c2, lch.c3, lch.alpha);
}

// -----------------------------------------------------------------
//  Chroma
// -----------------------------------------------------------------

/**
 * @summary
 * Increase the perceptual chroma of a color.
 *
 * @description
 * The function converts to OKLCh. It adds `amount` to the C channel. It
 * clamps the result to the OKLCh chroma range. Lightness and hue are
 * unchanged.
 *
 * @template S - The source color space type.
 *
 * @param color - The source color.
 * @param amount - The amount to add, in OKLCh C units.
 * @returns A new `ColorValue<typeof OKLCh>`.
 *
 * @example
 * saturate(make(sRGB, 0.5, 0.5, 0.5), 0.1);
 */
export function saturate<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  amount: number,
): ColorValue<typeof OKLCh> {
  const lch = convert(color, OKLCh);
  const max = OKLCh.descriptor.channelRanges[1].max;
  const c = Math.max(0, Math.min(max, lch.c2 + amount));
  return make(OKLCh, lch.c1, c, lch.c3, lch.alpha);
}

/**
 * @summary
 * Decrease the perceptual chroma of a color.
 *
 * @description
 * The function converts to OKLCh. It subtracts `amount` from the C
 * channel. It clamps the result to 0 or above. Lightness and hue are
 * unchanged. A color at chroma 0 is gray with the same lightness.
 *
 * @template S - The source color space type.
 *
 * @param color - The source color.
 * @param amount - The amount to subtract, in OKLCh C units.
 * @returns A new `ColorValue<typeof OKLCh>`.
 *
 * @example
 * desaturate(make(sRGB, 1, 0, 0), 0.1);
 */
export function desaturate<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  amount: number,
): ColorValue<typeof OKLCh> {
  const lch = convert(color, OKLCh);
  const c = Math.max(0, lch.c2 - amount);
  return make(OKLCh, lch.c1, c, lch.c3, lch.alpha);
}

// -----------------------------------------------------------------
//  Hue
// -----------------------------------------------------------------

/**
 * @summary
 * Rotate the hue of a color.
 *
 * @description
 * The function converts to OKLCh. It adds `degrees` to the H channel.
 * It wraps the result to 0 to 360. Lightness and chroma are unchanged.
 *
 * The angle may be negative or larger than 360. It wraps around.
 *
 * @template S - The source color space type.
 *
 * @param color - The source color.
 * @param degrees - The number of degrees to add. Any real number.
 * @returns A new `ColorValue<typeof OKLCh>`.
 *
 * @example
 * rotateHue(make(sRGB, 1, 0, 0), 180);  // cyan-ish
 * rotateHue(make(sRGB, 1, 0, 0), -90);  // magenta-ish
 */
export function rotateHue<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  degrees: number,
): ColorValue<typeof OKLCh> {
  const lch = convert(color, OKLCh);
  return make(OKLCh, lch.c1, lch.c2, wrapHue(lch.c3 + degrees), lch.alpha);
}

/**
 * @summary
 * Return the complement of a color.
 *
 * @description
 * The function rotates the hue by 180 degrees. It is the same as
 * `rotateHue(color, 180)`. Lightness and chroma are unchanged.
 *
 * @template S - The source color space type.
 *
 * @param color - The source color.
 * @returns A new `ColorValue<typeof OKLCh>`.
 *
 * @example
 * complement(make(sRGB, 1, 0, 0));  // a cyan with the same lightness
 */
export function complement<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
): ColorValue<typeof OKLCh> {
  return rotateHue(color, 180);
}

// -----------------------------------------------------------------
//  Channel-wise
// -----------------------------------------------------------------

/**
 * @summary
 * Invert the color channels of a color in its own space.
 *
 * @description
 * The function reads each channel's `channelRanges` from the descriptor.
 * It replaces each value with `max - v + min`. The result is in the same
 * space as the input.
 *
 * For sRGB with range 0 to 1, this maps 1 to 0 and 0.25 to 0.75. For
 * OKLab, the ranges are not symmetric. Check the `channelRanges`
 * values for the exact behavior.
 *
 * Alpha is unchanged.
 *
 * @template S - The source color space type.
 *
 * @param color - The source color.
 * @returns A new `ColorValue<S>`.
 *
 * @example
 * invert(make(sRGB, 1, 0, 0));  // sRGB(0, 1, 1, 1)
 */
export function invert<S extends ColorSpaceDef<string>>(color: ColorValue<S>): ColorValue<S> {
  const [rr, rg, rb] = color._space.descriptor.channelRanges;
  return make(
    color._space,
    rr.max - color.c1 + rr.min,
    rg.max - color.c2 + rg.min,
    rb.max - color.c3 + rb.min,
    color.alpha,
  );
}

/**
 * @summary
 * Remove the chroma of a color. The result is gray.
 *
 * @description
 * The function converts to OKLCh. It sets the C channel to 0. It then
 * converts back to the source space. Lightness is preserved. Hue is
 * lost because chroma is 0.
 *
 * @template S - The source color space type.
 *
 * @param color - The source color.
 * @returns A new `ColorValue<S>` with chroma 0.
 *
 * @example
 * grayscale(make(sRGB, 1, 0, 0));  // a gray with the same lightness as red
 */
export function grayscale<S extends ColorSpaceDef<string>>(color: ColorValue<S>): ColorValue<S> {
  const lch = convert(color, OKLCh);
  const gray = make(OKLCh, lch.c1, 0, lch.c3, lch.alpha);
  return convert(gray, color._space);
}
