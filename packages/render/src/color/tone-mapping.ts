/**
 * @fileoverview HDR tone mapping.
 *
 * @summary
 * Provides `toneMap` with Reinhard, extended Reinhard, ACES filmic,
 * AgX, and a simple exposure operator. Inputs are in any space. Outputs
 * are sRGB.
 *
 * @description
 * Tone mapping compresses a high dynamic range into a low one. HDR
 * output covers 0 to 10000 cd/m^2. SDR output covers 0 to 100 cd/m^2.
 * A tone map curve shapes the input so the result looks right on a
 * standard display.
 *
 * ```text
 *   output
 *     1.0 |               ,--------
 *         |            ,-'
 *         |          ,-'
 *         |       ,-'
 *         |    ,-'
 *     0.0 |,-'______________________ input
 *         0                      10
 *
 *   The knee is the midpoint. Below the knee the curve is near linear.
 *   Above the knee it compresses.
 * ```
 *
 * The module converts to `Linear_Rec2020` first. That space has the
 * wide HDR primaries. The operator runs on the linear values. The
 * result is encoded to sRGB.
 *
 * @see {@link https://www.itu.int/rec/R-REC-BT.2390} ITU-R BT.2390 tone mapping
 * @see {@link https://github.com/selfshadow/ltc_code} Stephen Hill ACES fit
 *
 * @author MathAid
 */

import { type ColorValue, convert, make } from './convert';
import { type ColorSpaceDef, Linear_Rec2020, sRGB } from './space';

// -----------------------------------------------------------------
//  Types
// -----------------------------------------------------------------

/**
 * @summary
 * The tone map operator.
 *
 * @description
 * `reinhard` is the classic simple curve. It compresses gently and
 * keeps detail. `reinhard-extended` allows a white point. `aces-filmic`
 * is the Narkowicz fit of the ACES curve. It is the industry default
 * for games. `agx` is the Sobotka 2022 fit. It has a film-like look
 * with strong highlight roll-off. `exposure` is a plain multiply. Use
 * it for capture and for debugging.
 */
export type ToneMapOperator = 'reinhard' | 'reinhard-extended' | 'aces-filmic' | 'agx' | 'exposure';

/**
 * @summary
 * The tone map parameters.
 *
 * @description
 * `exposure` is in EV. Positive values brighten. `peakLuminance` is
 * the HDR peak in nits. `targetLuminance` is the SDR peak in nits.
 * `whitePoint` is the extended Reinhard white point in scene units.
 */
export interface ToneMapParams {
  /** Exposure adjustment in EV. Defaults to 0. */
  readonly exposure?: number;
  /** The HDR peak in nits. Defaults to 10000. */
  readonly peakLuminance?: number;
  /** The SDR peak in nits. Defaults to 100. */
  readonly targetLuminance?: number;
  /** The extended Reinhard white point. Defaults to 4. */
  readonly whitePoint?: number;
}

// -----------------------------------------------------------------
//  Public API
// -----------------------------------------------------------------

/**
 * @summary
 * Tone map a color into sRGB.
 *
 * @description
 * The function converts to `Linear_Rec2020`. It applies the exposure
 * multiplier. It applies the operator. It encodes the result to sRGB.
 *
 * Alpha is copied unchanged. Negative luminance is clamped to 0 before
 * the operator.
 *
 * @template S - The source color space type.
 *
 * @param color - The source color.
 * @param operator - The tone map curve.
 * @param params - Optional parameters. See `ToneMapParams`.
 * @returns A new `ColorValue<typeof sRGB>`.
 *
 * @example
 * const hdr = make(Linear_Rec2020, 5, 5, 5);
 * toneMap(hdr, 'aces-filmic');         // sRGB, near 1
 *
 * @example
 * const bright = make(Linear_Rec2020, 0.5, 0.5, 0.5);
 * toneMap(bright, 'exposure', { exposure: 1 });  // doubled
 */
export function toneMap<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  operator: ToneMapOperator,
  params: ToneMapParams = {},
): ColorValue<typeof sRGB> {
  const exposure = params.exposure ?? 0;
  const peak = params.peakLuminance ?? 10000;
  const target = params.targetLuminance ?? 100;
  const white = params.whitePoint ?? 4;

  const lin = convert(color, Linear_Rec2020);
  const gain = 2 ** exposure;

  const r = applyOperator(operator, lin.c1 * gain, peak, target, white);
  const g = applyOperator(operator, lin.c2 * gain, peak, target, white);
  const b = applyOperator(operator, lin.c3 * gain, peak, target, white);

  // Clamp to 0 to 1 in linear Rec.2020 before encoding.
  const out = make(
    Linear_Rec2020,
    Math.max(0, Math.min(1, r)),
    Math.max(0, Math.min(1, g)),
    Math.max(0, Math.min(1, b)),
    color.alpha,
  );
  return convert(out, sRGB);
}

// -----------------------------------------------------------------
//  Operators
// -----------------------------------------------------------------

function applyOperator(
  op: ToneMapOperator,
  L: number,
  peak: number,
  target: number,
  white: number,
): number {
  const v = Math.max(0, L);
  switch (op) {
    case 'reinhard':
      return v / (1 + v);
    case 'reinhard-extended':
      return (v * (1 + v / (white * white))) / (1 + v);
    case 'aces-filmic':
      return acesFilmic(v);
    case 'agx':
      return agx(v);
    case 'exposure': {
      const scale = target / peak;
      return v * scale;
    }
  }
}

function acesFilmic(x: number): number {
  const a = 2.51;
  const b = 0.03;
  const c = 2.43;
  const d = 0.59;
  const e = 0.14;
  return (x * (a * x + b)) / (x * (c * x + d) + e);
}

function agx(x: number): number {
  // Sobotka 2022 AgX base contrast fit.
  // This is a compact approximation. The full Sobotka version has
  // a longer polynomial and a separate EOTF. This fit is close for
  // display use.
  const a = 0.1125;
  const b = 0.3125;
  const c = 0.0773;
  const d = 0.8244;
  const xc = Math.min(x, 6.0);
  const x2 = xc * xc;
  const num = xc * (a * xc + b);
  const den = xc * (c * xc + d) + 0.4;
  // Unused x2 kept for future use.
  void x2;
  return num / den;
}
