/**
 * @fileoverview Color difference metrics.
 *
 * @summary
 * Provides `deltaEOK`, `deltaE2000`, `deltaE76`, and `deltaEITP`. Each
 * function measures the perceptual distance between two colors.
 *
 * @description
 * Delta-E is a scalar distance between two colors. A small value means
 * the colors look similar. A large value means they look different.
 * The scale depends on the formula.
 *
 * ```text
 *   Formula      Space          Rough scale
 *   ---------    -----------    ---------------------------
 *   deltaE76     CIE Lab        1 unit is just noticeable
 *   deltaE2000   CIE Lab        1 unit is just noticeable
 *   deltaEOK     OKLab          0.02 units is just noticeable
 *   deltaEITP    ICtCp          0.02 units is just noticeable
 * ```
 *
 * CIEDE2000 is the most accurate for small differences. It is also the
 * slowest. Use it for color matching and quality checks. Use `deltaEOK`
 * for gamut mapping and for real-time checks. Use `deltaE76` for old
 * tooling compatibility.
 *
 * @see {@link http://www2.ece.rochester.edu/~gsharma/ciede2000/} Sharma CIEDE2000 reference
 *
 * @author MathAid
 */

import { type ColorValue, convert } from './convert';
import { type ColorSpaceDef, CIE_Lab, ICtCp, OKLab } from './space';

// -----------------------------------------------------------------
//  OKLab distance
// -----------------------------------------------------------------

/**
 * @summary
 * Euclidean distance in OKLab. Also called delta-E OK.
 *
 * @description
 * The function converts both colors to OKLab. It then takes the
 * Euclidean distance of the three channels. This is the metric the CSS
 * Color 4 gamut mapping uses.
 *
 * The scale is small. A value of 0.02 is a just-noticeable difference
 * for most observers. A value of 0.1 is clearly different.
 *
 * @template A - The first color space type.
 * @template B - The second color space type.
 *
 * @param a - The first color.
 * @param b - The second color.
 * @returns The OKLab distance, non-negative.
 *
 * @example
 * deltaEOK(make(sRGB, 1, 0, 0), make(sRGB, 1, 0, 0));  // 0
 * deltaEOK(make(sRGB, 1, 0, 0), make(sRGB, 0, 0, 1));  // about 0.35
 */
export function deltaEOK<A extends ColorSpaceDef<string>, B extends ColorSpaceDef<string>>(
  a: ColorValue<A>,
  b: ColorValue<B>,
): number {
  const la = convert(a, OKLab);
  const lb = convert(b, OKLab);
  return Math.sqrt((la.r - lb.r) ** 2 + (la.g - lb.g) ** 2 + (la.b - lb.b) ** 2);
}

// -----------------------------------------------------------------
//  CIE Lab distance
// -----------------------------------------------------------------

/**
 * @summary
 * Euclidean distance in CIE Lab. Also called delta-E 1976.
 *
 * @description
 * The function converts both colors to CIE Lab with a D65 white point.
 * It then takes the Euclidean distance of the three channels.
 *
 * The scale is close to one unit per just-noticeable difference. The
 * metric is old. It overweights differences in the blue region.
 * `deltaE2000` corrects this. Use `deltaE76` for compatibility only.
 *
 * @template A - The first color space type.
 * @template B - The second color space type.
 *
 * @param a - The first color.
 * @param b - The second color.
 * @returns The CIE Lab distance, non-negative.
 *
 * @example
 * deltaE76(make(sRGB, 1, 0, 0), make(sRGB, 1, 0, 0));  // 0
 */
export function deltaE76<A extends ColorSpaceDef<string>, B extends ColorSpaceDef<string>>(
  a: ColorValue<A>,
  b: ColorValue<B>,
): number {
  const la = convert(a, CIE_Lab);
  const lb = convert(b, CIE_Lab);
  return Math.sqrt((la.r - lb.r) ** 2 + (la.g - lb.g) ** 2 + (la.b - lb.b) ** 2);
}

// -----------------------------------------------------------------
//  CIEDE2000
// -----------------------------------------------------------------

/**
 * @summary
 * The CIEDE2000 color difference.
 *
 * @description
 * The function converts both colors to CIE Lab with a D65 white point.
 * It then applies the CIEDE2000 formula. The formula is long. It
 * corrects several known issues in the 1976 metric.
 *
 * The result is dimensionless. A value of 1 is a just-noticeable
 * difference under reference viewing conditions. The metric uses the
 * 2 degree observer and a D65 white point.
 *
 * `kL`, `kC`, and `kH` default to 1. Change them only when the viewing
 * conditions call for it. See the Sharma reference for the meaning.
 *
 * @template A - The first color space type.
 * @template B - The second color space type.
 *
 * @param a - The first color.
 * @param b - The second color.
 * @param kL - The lightness weight. Defaults to 1.
 * @param kC - The chroma weight. Defaults to 1.
 * @param kH - The hue weight. Defaults to 1.
 * @returns The CIEDE2000 distance, non-negative.
 *
 * @example
 * deltaE2000(make(sRGB, 1, 0, 0), make(sRGB, 1, 0, 0));  // 0
 * deltaE2000(make(sRGB, 0.5, 0.5, 0.5), make(sRGB, 0.51, 0.5, 0.5));  // small
 *
 * @see {@link http://www2.ece.rochester.edu/~gsharma/ciede2000/} Sharma test data
 */
export function deltaE2000<A extends ColorSpaceDef<string>, B extends ColorSpaceDef<string>>(
  a: ColorValue<A>,
  b: ColorValue<B>,
  kL = 1,
  kC = 1,
  kH = 1,
): number {
  const lab1 = convert(a, CIE_Lab);
  const lab2 = convert(b, CIE_Lab);

  const L1 = lab1.r;
  const a1 = lab1.g;
  const b1 = lab1.b;
  const L2 = lab2.r;
  const a2 = lab2.g;
  const b2 = lab2.b;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;
  const Cbar7 = Cbar ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7)));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  const h1p = hueAngle(b1, a1p);
  const h2p = hueAngle(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI) / 360);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp: number;
  if (C1p * C2p === 0) {
    hbarp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hbarp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hbarp = (h1p + h2p + 360) / 2;
  } else {
    hbarp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(((hbarp - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * hbarp * Math.PI) / 180) +
    0.32 * Math.cos(((3 * hbarp + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * hbarp - 63) * Math.PI) / 180);

  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Cbarp7 = Cbarp ** 7;
  const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2);
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin((2 * dTheta * Math.PI) / 180) * RC;

  const tL = dLp / (kL * SL);
  const tC = dCp / (kC * SC);
  const tH = dHp / (kH * SH);

  return Math.sqrt(tL * tL + tC * tC + tH * tH + RT * tC * tH);
}

/**
 * @summary
 * Compute the hue angle for CIEDE2000 in degrees, 0 to 360.
 *
 * @description
 * The function returns 0 when both inputs are 0. Otherwise it returns
 * `atan2(b, ap)` in degrees, wrapped to 0 to 360.
 *
 * @param b - The b channel.
 * @param ap - The adjusted a channel.
 * @returns The hue angle in degrees.
 */
function hueAngle(b: number, ap: number): number {
  if (b === 0 && ap === 0) return 0;
  const angle = (Math.atan2(b, ap) * 180) / Math.PI;
  return angle >= 0 ? angle : angle + 360;
}

// -----------------------------------------------------------------
//  ICtCp distance
// -----------------------------------------------------------------

/**
 * @summary
 * The Dolby ICtCp color difference.
 *
 * @description
 * The function converts both colors to ICtCp. It then applies the
 * weighted Euclidean distance. The weights match the Dolby white paper.
 *
 * The scale is close to `deltaEOK`. A value of 0.02 is a
 * just-noticeable difference. The metric is designed for HDR and wide
 * color gamut content.
 *
 * @template A - The first color space type.
 * @template B - The second color space type.
 *
 * @param a - The first color.
 * @param b - The second color.
 * @returns The ICtCp distance, non-negative.
 *
 * @example
 * deltaEITP(make(sRGB, 1, 0, 0), make(sRGB, 1, 0, 0));  // 0
 */
export function deltaEITP<A extends ColorSpaceDef<string>, B extends ColorSpaceDef<string>>(
  a: ColorValue<A>,
  b: ColorValue<B>,
): number {
  const ia = convert(a, ICtCp);
  const ib = convert(b, ICtCp);
  const dI = ia.r - ib.r;
  const dT = ia.g - ib.g;
  const dP = ia.b - ib.b;
  return 720 * Math.sqrt(dI * dI + 0.25 * dT * dT + dP * dP);
}
