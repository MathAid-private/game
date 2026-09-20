/**
 * @fileoverview Color science helpers.
 *
 * @summary
 * Provides `chromaticityCoordinates`, `dominantWavelength`,
 * `colorTemperature`, and `metamerCheck`. These serve color grading,
 * calibration, and asset pipelines.
 *
 * @description
 * The module works with tristimulus values in CIE XYZ D65. It reads
 * the CIE 1931 2-degree standard observer table for the spectral
 * locus. It uses the McCamy approximation for correlated color
 * temperature.
 *
 * ```text
 *   chromaticity    xy coordinates of a color
 *   dominant        wavelength of the closest spectral color
 *   temperature     correlated color temperature in Kelvin
 *   metamerCheck    do two colors match under one light but not another
 * ```
 *
 * @see {@link https://en.wikipedia.org/wiki/CIE_1931_color_space} CIE 1931
 * @see {@link https://en.wikipedia.org/wiki/Color_temperature} Color temperature
 *
 * @author MathAid
 */

import { adapt } from './adaptation';
import { type ColorValue, convert, make } from './convert';
import { deltaE2000 } from './difference';
import { type ColorSpaceDef, CIE_Lab, sRGB, XYZ_D65 } from './space';

// -----------------------------------------------------------------
//  Spectral locus table (CIE 1931 2-degree observer)
// -----------------------------------------------------------------

/**
 * @summary
 * The CIE 1931 spectral locus at 10 nm steps.
 *
 * @description
 * Each entry pairs a wavelength in nm with an xy chromaticity. The
 * table spans 380 nm to 780 nm. Values are from the published CIE
 * tables. Interpolate between entries for finer resolution.
 */
const SPECTRAL_LOCUS: ReadonlyArray<readonly [number, number, number]> = [
  [380, 0.1741, 0.0050],
  [390, 0.1738, 0.0049],
  [400, 0.1733, 0.0048],
  [410, 0.1726, 0.0048],
  [420, 0.1714, 0.0051],
  [430, 0.1689, 0.0069],
  [440, 0.1644, 0.0109],
  [450, 0.1566, 0.0177],
  [460, 0.1440, 0.0297],
  [470, 0.1241, 0.0578],
  [480, 0.0913, 0.1327],
  [490, 0.0454, 0.2950],
  [500, 0.0082, 0.5384],
  [510, 0.0139, 0.7502],
  [520, 0.0743, 0.8338],
  [530, 0.1547, 0.8059],
  [540, 0.2296, 0.7543],
  [550, 0.3016, 0.6923],
  [560, 0.3731, 0.6245],
  [570, 0.4441, 0.5547],
  [580, 0.5125, 0.4866],
  [590, 0.5752, 0.4242],
  [600, 0.6270, 0.3725],
  [610, 0.6658, 0.3340],
  [620, 0.6915, 0.3083],
  [630, 0.7079, 0.2920],
  [640, 0.7190, 0.2809],
  [650, 0.7260, 0.2740],
  [660, 0.7300, 0.2700],
  [670, 0.7320, 0.2680],
  [680, 0.7334, 0.2666],
  [690, 0.7344, 0.2656],
  [700, 0.7347, 0.2653],
  [710, 0.7347, 0.2653],
  [720, 0.7347, 0.2653],
  [730, 0.7347, 0.2653],
  [740, 0.7347, 0.2653],
  [750, 0.7347, 0.2653],
  [760, 0.7347, 0.2653],
  [770, 0.7347, 0.2653],
  [780, 0.7347, 0.2653],
];

/** The chromaticity of the D65 white point. */
const D65_XY = [0.3127, 0.3290] as const;

// -----------------------------------------------------------------
//  Chromaticity
// -----------------------------------------------------------------

/**
 * @summary
 * Return the xy chromaticity coordinates of a color.
 *
 * @description
 * The function converts to XYZ D65 and normalizes. The result is a
 * pair of xy values. The pair sums with z to 1.
 *
 * Black has no chromaticity. The function returns `(0.3127, 0.3290)`
 * for pure black. That is the D65 white point. It avoids a
 * division-by-zero.
 *
 * @template S - The color space type.
 *
 * @param color - The input color.
 * @returns The x and y coordinates.
 *
 * @example
 * chromaticityCoordinates(make(sRGB, 1, 1, 1));  // near D65
 */
export function chromaticityCoordinates<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
): { readonly x: number; readonly y: number } {
  const xyz = convert(color, XYZ_D65);
  const sum = xyz.r + xyz.g + xyz.b;
  if (sum <= 1e-12) {
    return { x: D65_XY[0], y: D65_XY[1] };
  }
  return { x: xyz.r / sum, y: xyz.g / sum };
}

// -----------------------------------------------------------------
//  Dominant wavelength
// -----------------------------------------------------------------

/**
 * @summary
 * Return the dominant wavelength of a color.
 *
 * @description
 * The function draws a ray from the D65 white point through the
 * color's chromaticity. It finds where that ray crosses the CIE
 * 1931 spectral locus. The wavelength at the crossing is the
 * dominant wavelength.
 *
 * When the ray does not cross the visible spectrum, the function
 * returns the wavelength of the closest locus point. This happens
 * for purple colors. The purple line is not part of the spectral
 * locus.
 *
 * @template S - The color space type.
 *
 * @param color - The input color.
 * @returns The dominant wavelength in nm, 380 to 780.
 *
 * @example
 * dominantWavelength(make(sRGB, 1, 0, 0));  // near 611
 * dominantWavelength(make(sRGB, 0, 0, 1));  // near 465
 */
export function dominantWavelength<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
): number {
  const { x, y } = chromaticityCoordinates(color);
  return findLocusCrossing(D65_XY[0], D65_XY[1], x, y);
}

function findLocusCrossing(
  wx: number,
  wy: number,
  px: number,
  py: number,
): number {
  const dx = px - wx;
  const dy = py - wy;
  let bestWavelength = 550;
  let bestT = Infinity;

  for (let i = 0; i < SPECTRAL_LOCUS.length - 1; i++) {
    const [w0, x0, y0] = SPECTRAL_LOCUS[i]!;
    const [w1, x1, y1] = SPECTRAL_LOCUS[i + 1]!;

    const ex = x1 - x0;
    const ey = y1 - y0;

    // Solve w + t*d = a + s*e for t in [0, inf) and s in [0, 1].
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-12) continue;

    const s = (dx * (y0 - wy) - dy * (x0 - wx)) / denom;
    if (s < 0 || s > 1) continue;

    const t = (x0 - wx + s * ex) / (dx === 0 ? 1e-12 : dx);
    if (t < 0) continue;

    if (t < bestT) {
      bestT = t;
      bestWavelength = w0 + s * (w1 - w0);
    }
  }

  if (bestT === Infinity) {
    // Purple line case. Return the closest locus wavelength.
    let minDist = Infinity;
    for (const [w, lx, ly] of SPECTRAL_LOCUS) {
      const d = (lx - px) ** 2 + (ly - py) ** 2;
      if (d < minDist) {
        minDist = d;
        bestWavelength = w;
      }
    }
  }

  return bestWavelength;
}

// -----------------------------------------------------------------
//  Color temperature
// -----------------------------------------------------------------

/**
 * @summary
 * Return the correlated color temperature of a color.
 *
 * @description
 * The function uses the McCamy approximation. It works well for
 * temperatures between 2000 K and 25000 K. That covers most display
 * and lighting conditions.
 *
 * The approximation does not handle tint. Two colors with the same
 * CCT but different tint return the same value. Add tint separation
 * if your pipeline needs it.
 *
 * @template S - The color space type.
 *
 * @param color - The input color.
 * @returns The correlated color temperature in Kelvin.
 *
 * @example
 * colorTemperature(make(sRGB, 1, 1, 1));         // near 6500
 * colorTemperature(make(sRGB, 1, 0.8, 0.6));     // near 3000
 */
export function colorTemperature<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
): number {
  const { x, y } = chromaticityCoordinates(color);
  const denom = 0.1858 - y;
  if (Math.abs(denom) < 1e-6) return 6500;
  const n = (x - 0.3320) / denom;
  const cct = 449 * n ** 3 + 3525 * n ** 2 + 6823.3 * n + 5520.33;
  return Math.max(1000, Math.min(25000, cct));
}

// -----------------------------------------------------------------
//  Metamer check
// -----------------------------------------------------------------

/**
 * @summary
 * Check whether two colors are metamers.
 *
 * @description
 * Two colors are metamers when they match under one illuminant but
 * differ under another. This happens because the eye reduces spectra
 * to three responses. Two different spectra can trigger the same
 * response under one light and different responses under another.
 *
 * The function computes `deltaE2000` under two illuminants. It
 * returns true when the difference under the reference illuminant is
 * below `threshold` and the difference under the test illuminant is
 * above it.
 *
 * @template A - The first color space type.
 * @template B - The second color space type.
 *
 * @param a - The first color.
 * @param b - The second color.
 * @param opts - Options. `reference` defaults to `'D65'`. `test`
 *   defaults to `'A'`. `threshold` defaults to 2.
 * @returns True when the two colors are metamers.
 *
 * @example
 * metamerCheck(color1, color2);                       // D65 vs A
 * metamerCheck(color1, color2, { test: 'F11' });      // if F11 is added
 */
export function metamerCheck<
  A extends ColorSpaceDef<string>,
  B extends ColorSpaceDef<string>,
>(
  a: ColorValue<A>,
  b: ColorValue<B>,
  opts: {
    readonly reference?: 'D50' | 'D55' | 'D65' | 'D93' | 'E' | 'A' | 'C';
    readonly test?: 'D50' | 'D55' | 'D65' | 'D93' | 'E' | 'A' | 'C';
    readonly threshold?: number;
  } = {},
): boolean {
  const reference = opts.reference ?? 'D65';
  const test = opts.test ?? 'A';
  const threshold = opts.threshold ?? 2;

  // Compare under the reference illuminant.
  const aRef = adapt(convert(a, XYZ_D65), reference, reference);
  const bRef = adapt(convert(b, XYZ_D65), reference, reference);
  const deltaRef = deltaE2000(aRef, bRef);

  // Compare under the test illuminant.
  const aTest = adapt(convert(a, XYZ_D65), reference, test);
  const bTest = adapt(convert(b, XYZ_D65), reference, test);
  const deltaTest = deltaE2000(aTest, bTest);

  return deltaRef < threshold && deltaTest > threshold;
}

// Suppress "unused import" for `make` and `sRGB` when tree-shaken.
void make;
void sRGB;
void CIE_Lab;