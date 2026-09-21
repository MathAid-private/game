/**
 * @fileoverview CAM16 color appearance model.
 *
 * @summary
 * Provides `cam16FromXYZ` and `xyzFromCAM16`. CAM16 predicts how a
 * color appears under a specific viewing environment. The output is
 * not a color value. It is a set of perceptual attributes.
 *
 * @description
 * CAM16 is the CIE 248:2022 appearance model. It improves on CIECAM02
 * and removes its numerical issues. It takes a color in XYZ and a set
 * of viewing conditions. It returns six perceptual attributes.
 *
 * ```text
 *   Attribute   Symbol   Meaning
 *   ---------   ------   -------------------------------------
 *   Lightness   J        Achromatic response, 0 to 100
 *   Chroma      C        Colorfulness relative to white
 *   Hue         h        Angle in degrees, 0 to 360
 *   Colorfulness M       Absolute colorfulness
 *   Saturation  s        Chroma relative to lightness
 *   Brightness  Q        Absolute brightness
 * ```
 *
 * The model is not a color space. It is a model. You cannot store a
 * CAM16 value in a `ColorValue`. You store a `CAM16` object.
 *
 * The forward path is XYZ -> CAM16. The reverse path is CAM16 -> XYZ.
 *
 * ```text
 *   XYZ  -->  [adapt to white]  -->  LMS
 *        -->  [compress]        -->  LMS'
 *        -->  [opponent]        -->  a, b
 *        -->  [attributes]      -->  J, C, h, M, s, Q
 * ```
 *
 * @see {@link https://cie.co.at/publications/cie-2482022} CIE 248:2022
 * @see {@link https://en.wikipedia.org/wiki/CIECAM02} CIECAM02 background
 *
 * @author MathAid
 */

import { type WhitePoint, whitePointXYZ } from './adaptation';
import { type ColorValue, convert, make } from './convert';
import { XYZ_D65 } from './space';
// Note: importing `ColorSpaceDef` for the generic.
import { type ColorSpaceDef } from './space';

// -----------------------------------------------------------------
//  Types
// -----------------------------------------------------------------

/**
 * @summary
 * The viewing environment for a CAM16 computation.
 *
 * @description
 * The defaults match CIE 248:2022 for "average" surround viewing.
 * Override any field to model a different condition.
 *
 * @example
 * const env: CAM16Env = {
 *   whitePoint: 'D65',
 *   adaptingLuminance: 20,
 *   backgroundLuminance: 0.2,
 *   surround: 'average',
 * };
 */
export interface CAM16Env {
  /** The reference white point. Defaults to `'D65'`. */
  readonly whitePoint?: WhitePoint;
  /** The adapting field luminance in cd/m^2. Defaults to 20. */
  readonly adaptingLuminance?: number;
  /** The relative Y of the background, 0 to 1. Defaults to 0.2. */
  readonly backgroundLuminance?: number;
  /** The surround condition. Defaults to `'average'`. */
  readonly surround?: 'dark' | 'dim' | 'average';
}

/**
 * @summary
 * The CAM16 perceptual attributes.
 *
 * @description
 * See the module JSDoc for the meaning of each field.
 */
export interface CAM16 {
  /** Lightness, 0 to 100. */
  readonly J: number;
  /** Chroma. */
  readonly C: number;
  /** Hue angle in degrees, 0 to 360. */
  readonly h: number;
  /** Colorfulness. */
  readonly M: number;
  /** Saturation. */
  readonly s: number;
  /** Brightness. */
  readonly Q: number;
}

// -----------------------------------------------------------------
//  Internals
// -----------------------------------------------------------------

/** The CAT16 cone response matrix. */
const M_CAT16: readonly number[] = [
  0.401288, 0.650173, -0.051461, -0.250268, 1.204414, 0.045854, -0.002079, 0.048952, 0.953127,
];

/** The inverse of `M_CAT16`. */
const M_CAT16_INV: readonly number[] = [
  1.86206786, -1.01125463, 0.14918677, 0.38752654, 0.62144744, -0.00897398, -0.0158415, -0.03412294,
  1.04996444,
];

function mul3(m: readonly number[], x: number, y: number, z: number): [number, number, number] {
  return [
    m[0]! * x + m[1]! * y + m[2]! * z,
    m[3]! * x + m[4]! * y + m[5]! * z,
    m[6]! * x + m[7]! * y + m[8]! * z,
  ];
}

interface SurroundParams {
  readonly F: number;
  readonly c: number;
  readonly Nc: number;
}

function surroundParams(kind: 'dark' | 'dim' | 'average'): SurroundParams {
  switch (kind) {
    case 'dark':
      return { F: 0.8, c: 0.525, Nc: 0.8 };
    case 'dim':
      return { F: 0.9, c: 0.59, Nc: 0.9 };
    case 'average':
      return { F: 1.0, c: 0.69, Nc: 1.0 };
  }
}

interface PreparedEnv {
  readonly Xw: number;
  readonly Yw: number;
  readonly Zw: number;
  readonly LA: number;
  readonly Yb: number;
  readonly F: number;
  readonly c: number;
  readonly Nc: number;
  readonly D: number;
  readonly FL: number;
  readonly n: number;
  readonly z: number;
  readonly Nbb: number;
  readonly Ncb: number;
  readonly DR: number;
  readonly DG: number;
  readonly DB: number;
  readonly Aw: number;
}

function prepareEnv(env: CAM16Env): PreparedEnv {
  const wp = env.whitePoint ?? 'D65';
  const LA = env.adaptingLuminance ?? 20;
  const Yb = env.backgroundLuminance ?? 0.2;
  const surround = env.surround ?? 'average';
  const sp = surroundParams(surround);

  if (LA <= 0) {
    throw new Error('CAM16: adapting luminance must be positive.');
  }
  if (Yb <= 0 || Yb > 1) {
    throw new Error('CAM16: background luminance must be in 0 to 1.');
  }

  const [Xw, Yw, Zw] = whitePointXYZ(wp);

  // Luminance-level adaptation factor.
  const k = 1 / (5 * LA + 1);
  const k4 = k ** 4;
  const FL = 0.2 * k4 * (5 * LA) + 0.1 * (1 - k4) ** 2 * (5 * LA) ** (1 / 3);

  // Background induction factor.
  const n = Yb / Yw;

  // Chromatic induction factors.
  const Nbb = 0.725 * (1 / n) ** 0.2;
  const Ncb = Nbb;

  // Degree of adaptation.
  const D = Math.max(0, Math.min(1, sp.F * (1 - (1 / 3.6) * Math.exp((-LA - 42) / 92))));

  // Cone white response.
  const [WLR, WLG, WLB] = mul3(M_CAT16, Xw, Yw, Zw);

  const DR = D * (Yw / WLR) + 1 - D;
  const DG = D * (Yw / WLG) + 1 - D;
  const DB = D * (Yw / WLB) + 1 - D;

  // Achromatic response to white.
  const [RW, GW, BW] = postAdapt(WLR * DR, WLG * DG, WLB * DB, FL);
  const Aw = (2 * RW + GW + BW / 20 - 0.305) * Nbb;

  return {
    Xw,
    Yw,
    Zw,
    LA,
    Yb,
    F: sp.F,
    c: sp.c,
    Nc: sp.Nc,
    D,
    FL,
    n,
    z: 1.48 + Math.sqrt(n),
    Nbb,
    Ncb,
    DR,
    DG,
    DB,
    Aw,
  };
}

function postAdapt(R: number, G: number, B: number, FL: number): [number, number, number] {
  const compress = (v: number): number => {
    const sign = v < 0 ? -1 : 1;
    const absV = Math.abs(v);
    const t = ((FL * absV) / 100) ** 0.42;
    return (sign * (400 * t)) / (27.13 + t) + 0.1;
  };
  return [compress(R), compress(G), compress(B)];
}

// -----------------------------------------------------------------
//  Public API
// -----------------------------------------------------------------

/**
 * @summary
 * Compute the CAM16 attributes of a color.
 *
 * @description
 * The function takes a color in XYZ D65 and a viewing environment. It
 * returns the six CAM16 attributes.
 *
 * The input can be in any space. It is converted to XYZ D65 first.
 *
 * @template S - The color space type.
 *
 * @param color - The input color.
 * @param env - The viewing environment. Defaults to a standard office.
 * @returns The CAM16 attributes.
 *
 * @example
 * const c = make(sRGB, 0.5, 0.5, 0.5);
 * const cam = cam16FromXYZ(c);
 * cam.J;   // lightness
 * cam.h;   // hue angle
 */
export function cam16FromXYZ<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  env: CAM16Env = {},
): CAM16 {
  const xyz = convert(color, XYZ_D65);
  const P = prepareEnv(env);

  const [Rr, Gr, Br] = mul3(M_CAT16, xyz.c1, xyz.c2, xyz.c3);
  const [Ra, Ga, Ba] = postAdapt(Rr * P.DR, Gr * P.DG, Br * P.DB, P.FL);

  const a = Ra - (12 * Ga) / 11 + Ba / 11;
  const b = (Ra + Ga - 2 * Ba) / 9;

  const hRad = Math.atan2(b, a);
  const h = ((hRad * 180) / Math.PI + 360) % 360;

  const et = (Math.cos((h * Math.PI) / 180 + 2) + 3.8) / 4;

  const A = (2 * Ra + Ga + Ba / 20 - 0.305) * P.Nbb;

  const J = 100 * (A / P.Aw) ** (P.c * P.z);

  const tNum = (50000 / 13) * P.Nc * P.Ncb * et * Math.sqrt(a * a + b * b);
  const tDen = Ra + Ga + (21 / 20) * Ba;
  const t = tNum / tDen;

  const C = t ** 0.9 * Math.sqrt(J / 100) * (1.64 - 0.29 ** P.n) ** 0.73;
  const M = C * P.FL ** 0.25;
  const Q = (4 / P.c) * Math.sqrt(J / 100) * (P.Aw + 4) * P.FL ** 0.25;
  const s = 50 * Math.sqrt((P.c * a) / (P.Aw + 4));

  return { J, C, h, M, s, Q };
}

/**
 * @summary
 * Reconstruct a color in XYZ D65 from CAM16 attributes.
 *
 * @description
 * The function inverts the CAM16 forward model. It reads the six
 * attributes and the viewing environment. It returns the XYZ D65
 * color that produced them.
 *
 * The forward and reverse directions round-trip within `1e-3` for
 * typical inputs.
 *
 * @param cam - The CAM16 attributes.
 * @param env - The viewing environment. Must match the forward call.
 * @returns A new `ColorValue<typeof XYZ_D65>`.
 *
 * @example
 * const cam = cam16FromXYZ(make(sRGB, 0.5, 0.5, 0.5));
 * const xyz = xyzFromCAM16(cam);
 */
export function xyzFromCAM16(cam: CAM16, env: CAM16Env = {}): ColorValue<typeof XYZ_D65> {
  const P = prepareEnv(env);

  const J = cam.J;
  const C = cam.C;
  const h = cam.h;

  const hr = (h * Math.PI) / 180;
  const sinH = Math.sin(hr);
  const cosH = Math.cos(hr);

  // Recover t from J and C.
  const t = C === 0 ? 0 : (C / (Math.sqrt(J / 100) * (1.64 - 0.29 ** P.n) ** 0.73)) ** (1 / 0.9);

  // Recover et from h.
  const et = (Math.cos(hr + 2) + 3.8) / 4;

  // Recover A from J.
  const A = P.Aw * (J / 100) ** (1 / (P.c * P.z));

  // Compute p1, p2, p3.
  const p1 = (50000 / 13) * P.Nc * P.Ncb * et;
  const p2 = A / P.Nbb + 0.305;
  const p3 = 21 / 20;

  // Solve for a and b. Case split on |sin| vs |cos| to avoid a
  // division by near-zero.
  let a = 0;
  let b = 0;
  if (t !== 0) {
    if (Math.abs(sinH) >= Math.abs(cosH)) {
      const p4 = p1 / sinH;
      b =
        (p2 * (2 + p3) * (460 / 1403)) /
        (p4 + (2 + p3) * (220 / 1403) * (cosH / sinH) - 27 / 1403 + p3 * (6300 / 1403));
      a = (b * cosH) / sinH;
    } else {
      const p4 = p1 / cosH;
      a =
        (p2 * (2 + p3) * (460 / 1403)) /
        (p4 +
          (2 + p3) * (220 / 1403) -
          (27 / 1403) * (sinH / cosH) +
          p3 * (6300 / 1403) * (sinH / cosH));
      b = (a * sinH) / cosH;
    }
  }

  // Recover Ra, Ga, Ba from p2, a, b.
  const Ra = (460 * p2 + 451 * a + 288 * b) / 1403;
  const Ga = (460 * p2 - 891 * a - 261 * b) / 1403;
  const Ba = (460 * p2 - 220 * a - 6300 * b) / 1403;

  // Undo the +0.1 offset and the compression.
  const undoCompress = (v: number): number => {
    const vv = v - 0.1;
    const sign = vv < 0 ? -1 : 1;
    const absV = Math.min(Math.abs(vv), 399.99);
    const t1 = (27.13 * absV) / (400 - absV);
    return sign * (100 / P.FL) * t1 ** (1 / 0.42);
  };

  const Rr = undoCompress(Ra) / P.DR;
  const Gr = undoCompress(Ga) / P.DG;
  const Br = undoCompress(Ba) / P.DB;

  const [X, Y, Z] = mul3(M_CAT16_INV, Rr, Gr, Br);
  return make(XYZ_D65, X, Y, Z);
}
