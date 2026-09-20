/**
 * @fileoverview Fast batch conversion using the JS path.
 *
 * @summary
 * Provides `convertBatchFast`. The function hoists the source and
 * destination lookups out of the loop. It also detects the identity
 * case when the source and destination match.
 *
 * @description
 * The standard `convertBatch` calls `convert` per color. That is
 * correct but slow. Each call reads the source space, then the
 * destination space, then the matrix. Hoisting those reads cuts the
 * per-color work in half.
 *
 * ```text
 *   convertBatch:      for each color { convert(color, dst) }
 *   convertBatchFast:  hoist descriptors
 *                      for each color { matrix and transfer only }
 * ```
 *
 * @author MathAid
 */

import { type ColorValue, _internal, make } from '../convert';
import { type ColorSpaceDef } from '../space';

/**
 * @summary
 * Convert an array of colors with hoisted lookups.
 *
 * @description
 * The function reads the source space from the first color. It reads
 * the destination space once. It then runs the conversion loop with
 * the descriptors preloaded.
 *
 * When every color is already in the destination space, the function
 * returns a shallow copy. When the input is empty, it returns an
 * empty array.
 *
 * @template Src - The source color space type.
 * @template Dst - The destination color space type.
 *
 * @param colors - The source colors.
 * @param dst - The destination space.
 * @returns A new array of `ColorValue<Dst>`.
 *
 * @example
 * const linear = convertBatchFast(encodedColors, Linear_sRGB);
 */
export function convertBatchFast<
  Src extends ColorSpaceDef<string>,
  Dst extends ColorSpaceDef<string>,
>(colors: ReadonlyArray<ColorValue<Src>>, dst: Dst): ReadonlyArray<ColorValue<Dst>> {
  if (colors.length === 0) return [];

  const first = colors[0]!;
  const src = first._space;

  // Same-space shortcut.
  if (src.id === dst.id) {
    const out: ColorValue<Dst>[] = new Array(colors.length);
    for (let i = 0; i < colors.length; i++) {
      out[i] = colors[i] as unknown as ColorValue<Dst>;
    }
    return out;
  }

  const out: ColorValue<Dst>[] = new Array(colors.length);
  const { toXYZ, fromXYZ } = _internal;

  for (let i = 0; i < colors.length; i++) {
    const c = colors[i]!;
    const [X, Y, Z] = toXYZ(src, c.r, c.g, c.b);
    const [r, g, b] = fromXYZ(dst, X, Y, Z);
    out[i] = make(dst, r, g, b, c.a);
  }

  return out;
}