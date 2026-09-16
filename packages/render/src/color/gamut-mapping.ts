/**
 * @fileoverview Gamut mapping. CSS Color 4 chroma reduction.
 *
 * @summary
 * Provides `mapToGamut()`. The function reduces a color to a target
 * gamut by compressing OKLCh chroma. The algorithm is the CSS Color
 * Level 4 bisection method.
 *
 * @description
 * `mapToGamut(color, targetSpace)` takes a color in any space and
 * returns an equivalent color inside `targetSpace`'s gamut.
 *
 * A simple channel clamp distorts hue and lightness when you convert
 * wide-gamut or HDR colors to a smaller gamut. Chroma reduction in a
 * perceptually uniform space keeps hue and lightness stable.
 *
 * The algorithm is the CSS Color Level 4 gamut mapping method:
 *
 * ```text
 *   1. Convert the color to OKLCh.
 *   2. If L is at least 1, the color is white. Return the white point.
 *   3. If L is at most 0, the color is black. Return the black point.
 *   4. Binary-search the highest OKLCh chroma that keeps the color
 *      inside the target gamut. Use a delta-E tolerance of 0.02 in
 *      OKLab, matching the CSS spec.
 * ```
 *
 * @example
 * import { make, mapToGamut, Display_P3, sRGB } from './index.js';
 *
 * // A Display P3 color that is outside sRGB.
 * const wideGamut = make(Display_P3, 0.0, 0.9, 0.5);
 * const sRGBSafe  = mapToGamut(wideGamut, sRGB);
 *
 * @see {@link https://www.w3.org/TR/css-color-4/#css-gamut-mapping} CSS Color 4 gamut mapping
 *
 * @author MathAid
 */

import { type ColorValue, convert, isInRange, make } from './convert';
import { type ColorSpaceDef, OKLCh, OKLab } from './space';

// -----------------------------------------------------------------
//  Types
// -----------------------------------------------------------------

/**
 * @summary
 * The result of a gamut-containment check.
 *
 * @description
 * The result carries a boolean and the converted color. The boolean is
 * true when the color is inside the target gamut. The color is in the
 * target space and its channels may be out of range when the boolean
 * is false.
 *
 * @example
 * const r = checkGamut(make(Display_P3, 0.0, 0.9, 0.5), sRGB);
 * if (!r.inGamut) {
 *   console.log('out of sRGB:', format(r.converted));
 * }
 */
export interface GamutCheckResult {
  /** True if the color is inside the target gamut. Uses a small epsilon. */
  readonly inGamut: boolean;
  /** The color in the target space. Channels may be out of range. */
  readonly converted: ColorValue<ColorSpaceDef<string>>;
}

/**
 * @summary
 * The gamut mapping strategy.
 *
 * @description
 * Two strategies are available.
 *
 * `clamp` is fast. It clamps channels. It shifts hue.
 *
 * `css-chroma` follows CSS Color 4. It uses OKLCh chroma bisection. It
 * is slower but it preserves hue and lightness.
 *
 * @example
 * const method: GamutMappingMethod = 'css-chroma';
 */
export type GamutMappingMethod = 'clamp' | 'css-chroma';

// -----------------------------------------------------------------
//  Internals
// -----------------------------------------------------------------

/** @summary The delta-E tolerance for the CSS Color 4 bisection. */
const DELTA_E_EPSILON = 0.02;

/**
 * @summary
 * Euclidean distance in OKLab. Used as a delta-E approximation.
 *
 * @description
 * The true delta-E is the CIEDE2000 formula. The CSS Color 4 spec uses
 * the simpler Euclidean distance in OKLab. The two agree well enough
 * for gamut mapping.
 *
 * @param a - First color in OKLab.
 * @param b - Second color in OKLab.
 * @returns The distance.
 *
 * @example
 * deltaEOKLab(make(OKLab, 0.5, 0.0, 0.0), make(OKLab, 0.5, 0.1, 0.0));
 * // 0.1
 */
function deltaEOKLab(a: ColorValue<typeof OKLab>, b: ColorValue<typeof OKLab>): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

// -----------------------------------------------------------------
//  Public API
// -----------------------------------------------------------------

/**
 * @summary
 * Check if a color is inside the target space's gamut.
 *
 * @description
 * Converts the color to the target space and reads the result. The
 * `isInRange` helper reads per-channel bounds, so this works for every
 * built-in space.
 *
 * @template S - The source space type.
 * @template T - The target space type.
 *
 * @param color - A color in any space.
 * @param targetSpace - The space to check against.
 * @returns A `GamutCheckResult`.
 *
 * @example
 * const r = checkGamut(make(Display_P3, 0.0, 0.9, 0.5), sRGB);
 * r.inGamut;      // false
 * r.converted;    // ColorValue<typeof sRGB>
 */
export function checkGamut<S extends ColorSpaceDef<string>, T extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  targetSpace: T,
): GamutCheckResult {
  const converted = convert(color, targetSpace);
  return {
    inGamut: isInRange(converted),
    converted,
  };
}

/**
 * @summary
 * Map a color into the target space's gamut.
 *
 * @description
 * Returns the input unchanged when the color is already inside the
 * target gamut. Otherwise applies the chosen strategy.
 *
 * The default strategy is `'css-chroma'`. It follows CSS Color 4 and
 * preserves hue and lightness.
 *
 * @template S - The source space type.
 * @template T - The target space type.
 *
 * @param color - A color in any space.
 * @param targetSpace - The destination space. Defines the gamut.
 * @param method - The strategy. Defaults to `"css-chroma"`.
 * @returns A `ColorValue<T>` inside the gamut.
 *
 * @example
 * // Wide-gamut P3 to sRGB, hue-preserving.
 * const safe = mapToGamut(p3Color, sRGB, 'css-chroma');
 *
 * @example
 * // Fast clamp, hue-shifting.
 * const fast = mapToGamut(p3Color, sRGB, 'clamp');
 */
export function mapToGamut<S extends ColorSpaceDef<string>, T extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  targetSpace: T,
  method: GamutMappingMethod = 'css-chroma',
): ColorValue<T> {
  // Early out: already in gamut.
  const inTarget = convert(color, targetSpace);
  if (isInRange(inTarget)) return inTarget;

  if (method === 'clamp') {
    return clampGamut(inTarget, targetSpace);
  }

  return cssChromaBisect(color, targetSpace);
}

/**
 * @summary
 * Fast channel-clamp gamut mapping.
 *
 * @description
 * Clamps each channel against its own range from the space descriptor.
 * The result is inside the gamut. Hue may shift.
 *
 * @template T - The space type.
 *
 * @param color - The color in `space`.
 * @param space - The space.
 * @returns A clamped `ColorValue<T>`.
 *
 * @example
 * clampGamut(make(sRGB, 1.5, -0.2, 0.5), sRGB);
 * // { r: 1, g: 0, b: 0.5, a: 1 }
 */
function clampGamut<T extends ColorSpaceDef<string>>(
  color: ColorValue<T>,
  space: T,
): ColorValue<T> {
  const [rr, rg, rb] = space.descriptor.channelRanges;
  const cr = Math.max(rr.min, Math.min(rr.max, color.r));
  const cg = Math.max(rg.min, Math.min(rg.max, color.g));
  const cb = Math.max(rb.min, Math.min(rb.max, color.b));
  return make(space, cr, cg, cb, color.a);
}

/**
 * @summary
 * The CSS Color Level 4 gamut mapping algorithm.
 *
 * @description
 * Binary-searches the maximum OKLCh chroma that keeps the color inside
 * the gamut. The search runs for at most 20 iterations. The loop stops
 * early when the delta-E between the mapped color and its clamp is
 * within 0.02.
 *
 * The white and black poles return the exact white and black in the
 * target space. The result is clamped, because matrix rounding can
 * push the pole values slightly outside the range.
 *
 * @template S - The source space type.
 * @template T - The target space type.
 *
 * @param color - The source color.
 * @param targetSpace - The target space.
 * @returns A `ColorValue<T>` inside the gamut.
 *
 * @see {@link https://www.w3.org/TR/css-color-4/#css-gamut-mapping} CSS Color 4
 */
function cssChromaBisect<S extends ColorSpaceDef<string>, T extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  targetSpace: T,
): ColorValue<T> {
  const lch = convert(color, OKLCh);
  const L = lch.r;
  const H = lch.b;

  // White and black poles. Return the exact white and black in the
  // target space, then clamp to remove matrix rounding error.
  if (L >= 1) {
    const white = convert(make(OKLab, 1, 0, 0), targetSpace);
    return clampGamut(white, targetSpace);
  }
  if (L <= 0) {
    const black = convert(make(OKLab, 0, 0, 0), targetSpace);
    return clampGamut(black, targetSpace);
  }

  let lo = 0;
  let hi = lch.g;
  let current = lch;

  const MAX_ITER = 20;
  for (let i = 0; i < MAX_ITER; i++) {
    const mid = (lo + hi) / 2;
    current = make(OKLCh, L, mid, H, color.a);
    const mapped = convert(current, targetSpace);

    if (isInRange(mapped)) {
      const clamped = clampGamut(mapped, targetSpace);
      const labMapped = convert(mapped, OKLab);
      const labClamped = convert(clamped, OKLab);
      const dE = deltaEOKLab(labMapped, labClamped);
      if (dE <= DELTA_E_EPSILON) break;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const result = convert(current, targetSpace);
  return clampGamut(result, targetSpace);
}

/**
 * @summary
 * Batch gamut check. Returns a map of space IDs to results.
 *
 * @description
 * Runs `checkGamut` against each space in the input list. The returned
 * record is keyed by the space ID.
 *
 * @template S - The source space type.
 *
 * @param color - The source color.
 * @param spaces - An array of spaces to check against.
 * @returns A record keyed by space ID.
 *
 * @example
 * const checks = checkGamutAll(wideGamutColor, [sRGB, Display_P3, Linear_Rec2020]);
 * console.log(checks.sRGB.inGamut); // false
 */
export function checkGamutAll<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  spaces: ReadonlyArray<ColorSpaceDef<string>>,
): Record<string, GamutCheckResult> {
  const out: Record<string, GamutCheckResult> = {};
  for (const space of spaces) {
    out[space.id] = checkGamut(color, space);
  }
  return out;
}
