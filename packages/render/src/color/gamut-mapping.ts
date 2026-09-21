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

import { ColorTuple, type ColorValue, convert, fromTuple, isColorValue, isInRange, make } from './convert';
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
  return Math.sqrt((a.c1 - b.c1) ** 2 + (a.c2 - b.c2) ** 2 + (a.c3 - b.c3) ** 2);
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
 * @note
 * This function accepts a `ColorTuple<S>` in addition to a
 * `ColorValue<S>`. The tuple overload converts the tuple to a
 * `ColorValue` at the top of the function. The rest of the function
 * works on the object shape. The conversion is required for the
 * runtime space tag, for structural typing reliability, and to avoid
 * a global `WeakMap`.
 *
 * @template S - The source space type.
 * @template T - The target space type.
 * @param color - A color in any space. Object or tuple.
 * @param a - The target space, or the source space when `color` is
 *   a tuple.
 * @param b - The target space when `color` is a tuple.
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
): GamutCheckResult;
export function checkGamut<S extends ColorSpaceDef<string>, T extends ColorSpaceDef<string>>(
  color: ColorTuple<S>,
  from: S,
  targetSpace: T,
): GamutCheckResult;
export function checkGamut<S extends ColorSpaceDef<string>, T extends ColorSpaceDef<string>>(
  color: ColorValue<S> | ColorTuple<S>,
  a: T | S,
  b?: T,
): GamutCheckResult {
  let converted: ColorValue<ColorSpaceDef<string>>;
  if (b === undefined) {
    converted = convert(color as ColorValue<S>, a as T);
  } else {
    converted = convert(color as ColorTuple<S>, a as S, b);
  }
  return { inGamut: isInRange(converted), converted };
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
 * @note
 * This function accepts a `ColorTuple<S>` in addition to a
 * `ColorValue<S>`. The tuple overload converts the tuple to a
 * `ColorValue` at the top of the function. See `checkGamut` for the
 * reasoning.
 *
 * @template S - The source space type.
 * @template T - The target space type.
 * @param color - A color in any space. Object or tuple.
 * @param a - The target space, or the source space when `color` is
 *   a tuple.
 * @param b - The target space when `color` is a tuple.
 * @param method - The strategy. Defaults to `'css-chroma'`.
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
export function mapToGamut<
  S extends ColorSpaceDef<string>,
  T extends ColorSpaceDef<string>,
>(
  color: ColorValue<S>,
  targetSpace: T,
  method?: GamutMappingMethod,
): ColorValue<T>;
export function mapToGamut<
  S extends ColorSpaceDef<string>,
  T extends ColorSpaceDef<string>,
>(
  color: ColorTuple<S>,
  from: S,
  targetSpace: T,
  method?: GamutMappingMethod,
): ColorValue<T>;
export function mapToGamut<
  S extends ColorSpaceDef<string>,
  T extends ColorSpaceDef<string>,
>(
  color: ColorValue<S> | ColorTuple<S>,
  a: S | T,
  b?: T | GamutMappingMethod,
  c?: GamutMappingMethod,
): ColorValue<T> {
  let from: S;
  let to: T;
  let method: GamutMappingMethod;
  let c0: ColorValue<S>;

  if (isColorValue(color)) {
    c0 = color as ColorValue<S>;
    from = c0._space;
    to = a as T;
    method = (b as GamutMappingMethod | undefined) ?? 'css-chroma';
  } else {
    from = a as S;
    to = b as T;
    method = c ?? 'css-chroma';
    c0 = fromTuple(color as ColorTuple<S>, from);
  }

  const inTarget = convert(c0, to);
  if (isInRange(inTarget)) return inTarget;

  if (method === 'clamp') {
    return clampGamut(inTarget, to);
  }
  return cssChromaBisect(c0, to);
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
  const cc1 = Math.max(rr.min, Math.min(rr.max, color.c1));
  const cc2 = Math.max(rg.min, Math.min(rg.max, color.c2));
  const cc3 = Math.max(rb.min, Math.min(rb.max, color.c3));
  return make(space, cc1, cc2, cc3, color.alpha);
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
  const L = lch.c1;
  const H = lch.c3;

  if (L >= 1) {
    return clampGamut(convert(make(OKLab, 1, 0, 0), targetSpace), targetSpace);
  }
  if (L <= 0) {
    return clampGamut(convert(make(OKLab, 0, 0, 0), targetSpace), targetSpace);
  }

  let lo = 0;
  let hi = lch.c2;
  let current = lch;

  const MAX_ITER = 20;
  for (let i = 0; i < MAX_ITER; i++) {
    const mid = (lo + hi) / 2;
    current = make(OKLCh, L, mid, H, color.alpha);
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

  return clampGamut(convert(current, targetSpace), targetSpace);
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
): Record<string, GamutCheckResult>;
export function checkGamutAll<S extends ColorSpaceDef<string>>(
  color: ColorTuple<S>,
  from: S,
  spaces: ReadonlyArray<ColorSpaceDef<string>>,
): Record<string, GamutCheckResult>;
export function checkGamutAll<S extends ColorSpaceDef<string>>(
  color: ColorValue<S> | ColorTuple<S>,
  a: S | ReadonlyArray<ColorSpaceDef<string>>,
  b?: ReadonlyArray<ColorSpaceDef<string>>,
): Record<string, GamutCheckResult> {
  const out: Record<string, GamutCheckResult> = {};
  if (b === undefined) {
    for (const space of a as ReadonlyArray<ColorSpaceDef<string>>) {
      out[space.id] = checkGamut(color as ColorValue<S>, space);
    }
  } else {
    for (const space of b) {
      out[space.id] = checkGamut(color as ColorTuple<S>, a as S, space);
    }
  }
  return out;
}

/**
 * @summary
 * Expand a color into a wider gamut.
 *
 * @description
 * The function is the inverse of `mapToGamut`. It takes an in-gamut
 * color and pushes the chroma toward the target gamut boundary. The
 * hue and lightness stay the same.
 *
 * The expansion runs in OKLCh. It binary-searches the maximum chroma
 * that keeps the color inside the target gamut. The `amount` argument
 * scales the result between the input chroma and that boundary.
 *
 * ```text
 *     Chroma
 *       ^
 *       |     boundary
 *       |    /
 *       |   /  <-- search up the hue ray
 *       |  /
 *       | /
 *       |/
 *       *  in-gamut start
 *       +---------------> Lightness
 * ```
 *
 * When the color is already outside the target gamut, the input is
 * returned unchanged. Expansion only moves inward to outward. Use
 * `mapToGamut` to move outward to inward.
 *
 * @template S - The source color space type.
 * @template T - The target color space type.
 *
 * @param color - The source color.
 * @param targetSpace - The space to expand into. Defines the boundary.
 * @param amount - A scale in 0 to 1. Defaults to 1. Zero returns the
 *   input. One expands to the boundary.
 * @returns A new `ColorValue<T>`.
 *
 * @example
 * // Take an sRGB red and expand it toward the P3 boundary.
 * const expanded = expandGamut(make(sRGB, 1, 0, 0), Display_P3);
 *
 * @example
 * // Expand halfway.
 * const partial = expandGamut(make(sRGB, 1, 0, 0), Display_P3, 0.5);
 */
export function expandGamut<S extends ColorSpaceDef<string>, T extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  targetSpace: T,
  amount = 1,
): ColorValue<T> {
  // Convert the source to the target space.
  const inTarget = convert(color, targetSpace);
  // If the color is already outside the target gamut, no expansion.
  if (!isInRange(inTarget)) return inTarget;
  // No expansion wanted.
  if (amount <= 0) return inTarget;

  // Work in OKLCh.
  const lch = convert(color, OKLCh);
  const L = lch.c1;
  const H = lch.c3;
  const c0 = lch.c2;

  // Gray colors have no direction. Return the input.
  if (c0 < 1e-6) return inTarget;

  // Binary-search the boundary chroma.
  let lo = c0;
  let hi = OKLCh.descriptor.channelRanges[1].max;
  const MAX_ITER = 20;
  for (let i = 0; i < MAX_ITER; i++) {
    const mid = (lo + hi) / 2;
    const probe = make(OKLCh, L, mid, H);
    const probeIn = convert(probe, targetSpace);
    if (isInRange(probeIn)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  // Linearly interpolate between the input chroma and the boundary.
  const cBoundary = lo;
  const cNew = c0 + (cBoundary - c0) * Math.min(1, amount);
  const result = make(OKLCh, L, cNew, H, color.alpha);
  return convert(result, targetSpace);
}
