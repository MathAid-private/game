/**
 * @fileoverview Conversion engine. The `ColorValue<S>` type and the
 * `convert()` function.
 *
 * @summary
 * The central type of the library. A phantom-typed color value that
 * carries its color space at the type level. Plus a pure `convert()`
 * function that transforms between any two supported spaces.
 *
 * @description
 * `ColorValue<S>` is a plain object with fields r, g, b, a. The object
 * also carries a phantom type parameter S. S is a `ColorSpaceDef`. The
 * tag has no extra runtime cost. TypeScript uses the tag to stop you
 * from passing a `ColorValue<typeof sRGB>` where a
 * `ColorValue<typeof Linear_sRGB>` is expected.
 *
 * Silent space mismatches are a common source of color-rendering bugs.
 * Tracking the space in the type system turns that bug into a
 * compile-time error with a clear message.
 *
 * Every conversion routes through CIE XYZ D65. The pipeline is:
 *
 * ```text
 *   source encoded  -->  [EOTF]  -->  source linear
 *   source linear   -->  [M_src]  -->  XYZ D65
 *   XYZ D65         -->  [M_dst]  -->  dest linear
 *   dest linear     -->  [OETF]  -->  dest encoded
 * ```
 *
 * OKLab and OKLCh use a non-matrix path through cube-root LMS. The
 * engine wires that path in as a special case.
 *
 * @example
 * import { make, convert } from './convert.js';
 * import { sRGB, OKLab } from './space.js';
 *
 * const red  = make(sRGB, 1, 0, 0);
 * const lab  = convert(red, OKLab);
 * const back = convert(lab, sRGB);
 *
 * @throws {Error} If a space has no `toXYZ` matrix and is not handled as
 *   a special case. The special cases are OKLab, OKLCh, and XYZ_D65.
 *
 * @see {@link https://bottosson.github.io/posts/oklab/} OKLab spec
 * @see {@link https://www.colour-science.org/} Colour-science reference
 *
 * @author MathAid
 */
import {
  CIE_Lab,
  CIE_LCh,
  type ColorSpaceDef,
  HSL,
  HSV,
  HWB,
  ICtCp,
  type Mat3,
  OKLab,
  OKLCh,
  sRGB,
  XYZ_D65,
  YCbCr,
} from './space';

// -----------------------------------------------------------------
//  Core type
// -----------------------------------------------------------------

/**
 * @summary
 * A color value in a specific logical color space `S`.
 *
 * @description
 * Channels are floating-point numbers. The natural range depends on the
 * space. Common ranges are 0 to 1 for SDR encoded spaces, unbounded for
 * linear HDR spaces, -0.5 to 0.5 for OKLab a and b, and any angle for
 * OKLCh H.
 *
 * The `_space` field carries the phantom type at runtime. `make` writes
 * it. `convert` reads it. Application code should not read it directly.
 * Use `color._space.descriptor` if you need metadata.
 *
 * @template S - The color space type. A `ColorSpaceDef<string>`.
 *
 * @example
 * import { sRGB, make } from './index.js';
 *
 * const red = make(sRGB, 1, 0, 0);
 * // red._space === sRGB
 */
export interface ColorValue<S extends ColorSpaceDef<string>> {
  /** First channel. R, L, or X, depending on the space. */
  readonly r: number;
  /** Second channel. G, a, or Y, depending on the space. */
  readonly g: number;
  /** Third channel. B, b, or Z, depending on the space. */
  readonly b: number;
  /** Alpha. Always linear. Range 0 to 1. */
  readonly a: number;
  /** The space object. Written by `make`. Read by `convert`. */
  readonly _space: S;
}

// -----------------------------------------------------------------
//  Constructors
// -----------------------------------------------------------------

/**
 * @summary
 * Build a `ColorValue` in space `S`.
 *
 * @description
 * This is the only recommended way to create a color value. The
 * function writes the `_space` field, which the conversion engine reads.
 *
 * @template S - The color space type.
 *
 * @param space - The color space object, for example `sRGB` or `OKLab`.
 * @param r - First channel. R, L, or X.
 * @param g - Second channel. G, a, or Y.
 * @param b - Third channel. B, b, or Z.
 * @param a - Alpha, always linear, 0 to 1. Defaults to 1.
 * @returns A new `ColorValue<S>`.
 *
 * @example
 * const red   = make(sRGB, 1, 0, 0);
 * const lab   = make(OKLab, 0.6, 0.2, 0.1);
 * const faint = make(sRGB, 1, 0, 0, 0.5);
 */
export function make<S extends ColorSpaceDef<string>>(
  space: S,
  r: number,
  g: number,
  b: number,
  a = 1,
): ColorValue<S> {
  return { r, g, b, a, _space: space };
}

/**
 * @summary
 * Parse a hex string into an sRGB `ColorValue`.
 *
 * @description
 * Accepts four CSS hex forms. The leading `#` is optional in every form.
 * Bad input throws an `Error` with a message that names the input.
 *
 * ```text
 *   #RGB       ->  #RGBA
 *   #RRGGBB    ->  #RRGGBBAA
 * ```
 *
 * The short form is expanded by duplicating each nibble. For example
 * `#F80` becomes `#FF8800`.
 *
 * @param hex - A CSS hex color string.
 * @returns A `ColorValue<typeof sRGB>` with channels in 0 to 1.
 *
 * @throws {Error} If the string does not match one of the four allowed
 *   forms.
 *
 * @example
 * const red   = fromHex('#FF0000');     // { r: 1, g: 0, b: 0, a: 1 }
 * const clear = fromHex('#FF000000');   // { r: 1, g: 0, b: 0, a: 0 }
 * const half  = fromHex('F80');         // { r: 1, g: 0.533, b: 0, a: 1 }
 */
export function fromHex(hex: string): ColorValue<typeof sRGB> {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;

  let r: number;
  let g: number;
  let b: number;
  let a = 1;

  if (h.length === 3) {
    r = parseInt(h[0]! + h[0]!, 16) / 255;
    g = parseInt(h[1]! + h[1]!, 16) / 255;
    b = parseInt(h[2]! + h[2]!, 16) / 255;
  } else if (h.length === 4) {
    r = parseInt(h[0]! + h[0]!, 16) / 255;
    g = parseInt(h[1]! + h[1]!, 16) / 255;
    b = parseInt(h[2]! + h[2]!, 16) / 255;
    a = parseInt(h[3]! + h[3]!, 16) / 255;
  } else if (h.length === 6) {
    r = parseInt(h.slice(0, 2), 16) / 255;
    g = parseInt(h.slice(2, 4), 16) / 255;
    b = parseInt(h.slice(4, 6), 16) / 255;
  } else if (h.length === 8) {
    r = parseInt(h.slice(0, 2), 16) / 255;
    g = parseInt(h.slice(2, 4), 16) / 255;
    b = parseInt(h.slice(4, 6), 16) / 255;
    a = parseInt(h.slice(6, 8), 16) / 255;
  } else {
    throw new Error(
      `fromHex: "${hex}" is not a valid hex color. Expected 3, 4, 6, or 8 hex digits.`,
    );
  }

  if ([r, g, b, a].some((v) => Number.isNaN(v))) {
    throw new Error(`fromHex: "${hex}" contains non-hex characters.`);
  }

  return make(sRGB, r, g, b, a);
}

// -----------------------------------------------------------------
//  Linear algebra helpers
// -----------------------------------------------------------------

/** PQ constants reused by ICtCp. */
const ICtCp_M1 = 2610 / 16384;
const ICtCp_M2 = (2523 / 4096) * 128;
const ICtCp_C1 = 3424 / 4096;
const ICtCp_C2 = (2413 / 4096) * 32;
const ICtCp_C3 = (2392 / 4096) * 32;

/**
 * @summary
 * Encode a linear luminance into PQ code value.
 *
 * @param L - The linear luminance in cd/m^2.
 * @returns The PQ code value.
 */
function pqEncode(L: number): number {
  const Lm = Math.max(0, L / 10000) ** ICtCp_M1;
  return ((ICtCp_C1 + ICtCp_C2 * Lm) / (1 + ICtCp_C3 * Lm)) ** ICtCp_M2;
}

/**
 * @summary
 * Decode a PQ code value into linear luminance.
 *
 * @param E - The PQ code value.
 * @returns The linear luminance in cd/m^2.
 */
function pqDecode(E: number): number {
  const Em = Math.max(0, E) ** (1 / ICtCp_M2);
  return 10000 * (Math.max(0, Em - ICtCp_C1) / (ICtCp_C2 - ICtCp_C3 * Em)) ** (1 / ICtCp_M1);
}

/**
 * @summary
 * Multiply a 3 by 3 row-major matrix by a column vector `[x, y, z]`.
 *
 * @description
 * The matrix is stored as a flat 9-element tuple in row-major order.
 * The result is a 3-tuple in the same layout.
 *
 * @param m - The matrix.
 * @param x - First component of the vector.
 * @param y - Second component.
 * @param z - Third component.
 * @returns The product as a 3-tuple.
 *
 * @example
 * const I: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
 * mulMat3(I, 2, 3, 4); // [2, 3, 4]
 */
function mulMat3(m: Mat3, x: number, y: number, z: number): [number, number, number] {
  return [
    m[0] * x + m[1] * y + m[2] * z,
    m[3] * x + m[4] * y + m[5] * z,
    m[6] * x + m[7] * y + m[8] * z,
  ];
}

// -----------------------------------------------------------------
//  OKLab matrices
// -----------------------------------------------------------------

/** @summary XYZ D65 to LMS, scaled for OKLab. */
const M_XYZ_to_LMS: Mat3 = [
  0.8189330101, 0.3618667424, -0.1288597137, 0.0329845436, 0.9293118715, 0.0361456387, 0.0482003018,
  0.2643662691, 0.633851707,
];

/** @summary Cube-root LMS to OKLab. */
const M_LMS_to_Lab: Mat3 = [
  0.2104542553, 0.793617785, -0.0040720468, 1.9779984951, -2.428592205, 0.4505937099, 0.0259040371,
  0.7827717662, -0.808675766,
];

/** @summary The inverse of `M_LMS_to_Lab`. OKLab to cube-root LMS. */
const M_Lab_to_LMS: Mat3 = [
  1.0, 0.3963377774, 0.2158037573, 1.0, -0.1055613458, -0.0638541728, 1.0, -0.0894841775,
  -1.291485548,
];

/** @summary The inverse of `M_XYZ_to_LMS`. Cube-root LMS to XYZ D65. */
const M_LMS_to_XYZ: Mat3 = [
  1.2270138511035211, -0.5577999806518222, 0.2812561489664678, -0.0405801784232806,
  1.1122568696168302, -0.0716766786656012, -0.0763812845057069, -0.4214819784180127,
  1.5861632204407947,
];

// -----------------------------------------------------------------
//  Space to XYZ D65
// -----------------------------------------------------------------

/** CIE Lab D65 white point. */
const LAB_Xn = 0.95047;
const LAB_Yn = 1.0;
const LAB_Zn = 1.08883;

/** CIE Lab f-function break point. */
const LAB_EPSILON = 216 / 24389;
/** CIE Lab kappa constant. */
const LAB_KAPPA = 24389 / 27;

/**
 * @summary
 * The CIE Lab f-function. Applies the cube-root curve.
 *
 * @param t - The normalized tristimulus value.
 * @returns The transformed value.
 */
function labF(t: number): number {
  return t > LAB_EPSILON ? Math.cbrt(t) : (LAB_KAPPA * t + 16) / 116;
}

/**
 * @summary
 * The inverse CIE Lab f-function.
 *
 * @param t - The transformed value.
 * @returns The normalized tristimulus value.
 */
function labFInv(t: number): number {
  const t3 = t * t * t;
  return t3 > LAB_EPSILON ? t3 : (116 * t - 16) / LAB_KAPPA;
}

/** HSL to sRGB. H is in degrees. S and L are 0 to 1. */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const hh = (((h % 360) + 360) % 360) / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [hue2rgb(hh + 1 / 3), hue2rgb(hh), hue2rgb(hh - 1 / 3)];
}

/** sRGB to HSL. */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

/** HSV to sRGB. */
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const hh = (((h % 360) + 360) % 360) / 60;
  const i = Math.floor(hh);
  const f = hh - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  switch (i % 6) {
    case 0:
      return [v, t, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, t];
    case 3:
      return [p, q, v];
    case 4:
      return [t, p, v];
    default:
      return [v, p, q];
  }
}

/** sRGB to HSV. */
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  if (d === 0) return [0, s, v];
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, v];
}

/**
 * @summary
 * Convert a color in `space` to XYZ D65.
 *
 * @description
 * Handles three cases. XYZ_D65 is a pass-through. OKLab and OKLCh use
 * the cube-root LMS path. Every other space uses its `toXYZ` matrix
 * after the EOTF step.
 *
 * @param space - The source space.
 * @param r - First channel in the source space.
 * @param g - Second channel.
 * @param b - Third channel.
 * @returns The XYZ D65 triplet.
 *
 * @throws {Error} If the space has no `toXYZ` matrix and is not OKLab,
 *   OKLCh, or XYZ_D65.
 *
 * @example
 * toXYZ(sRGB, 1, 0, 0); // [0.4124, 0.2126, 0.0193] (approx)
 */
function toXYZ(
  space: ColorSpaceDef<string>,
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const id = space.id;

  // XYZ_D65 is the interchange. Pass through.
  if (id === XYZ_D65.id) return [r, g, b];

  // OKLCh to OKLab to XYZ.
  if (id === OKLCh.id) {
    const hRad = (b * Math.PI) / 180;
    return toXYZ(OKLab, r, g * Math.cos(hRad), g * Math.sin(hRad));
  }

  // OKLab to XYZ via cube-root LMS.
  if (id === OKLab.id) {
    const [l_, m_, s_] = mulMat3(M_Lab_to_LMS, r, g, b);
    return mulMat3(M_LMS_to_XYZ, l_ ** 3, m_ ** 3, s_ ** 3);
  }

  // ICtCp to XYZ D65.
  if (id === ICtCp.id) {
    const [lp, mp, sp] = mulMat3(M_ICtCp_to_LMS, r, g, b);
    const L = pqDecode(lp);
    const M = pqDecode(mp);
    const S = pqDecode(sp);
    return mulMat3(M_LMS_to_XYZ_ICtCp, L, M, S);
  }

  // HSL to sRGB to XYZ.
  if (id === HSL.id) {
    const [rr, gg, bb] = hslToRgb(r, g, b);
    return toXYZ(sRGB, rr, gg, bb);
  }

  // HSV to sRGB to XYZ.
  if (id === HSV.id) {
    const [rr, gg, bb] = hsvToRgb(r, g, b);
    return toXYZ(sRGB, rr, gg, bb);
  }

  // HWB to HSV to sRGB to XYZ.
  if (id === HWB.id) {
    const W = g;
    const B = b;
    const sum = W + B;
    if (sum >= 1) {
      const gray = W / sum;
      return toXYZ(sRGB, gray, gray, gray);
    }
    const [hr, hg, hb] = hsvToRgb(r, 1, 1);
    const scale = 1 - sum;
    return toXYZ(sRGB, hr * scale + W, hg * scale + W, hb * scale + W);
  }

  // CIE Lab to XYZ (D65).
  if (id === CIE_Lab.id) {
    const fy = (r + 16) / 116;
    const fx = g / 500 + fy;
    const fz = fy - b / 200;
    return [labFInv(fx) * LAB_Xn, labFInv(fy) * LAB_Yn, labFInv(fz) * LAB_Zn];
  }

  // CIE LCh to CIE Lab to XYZ.
  if (id === CIE_LCh.id) {
    const hRad = (b * Math.PI) / 180;
    return toXYZ(CIE_Lab, r, g * Math.cos(hRad), g * Math.sin(hRad));
  }

  // YCbCr (BT.709) to sRGB to XYZ.
  if (id === YCbCr.id) {
    const Y = r;
    const Cb = g;
    const Cr = b;
    const rr = Y + 1.5748 * Cr;
    const gg = Y - 0.1873 * Cb - 0.4681 * Cr;
    const bb = Y + 1.8556 * Cb;
    return toXYZ(sRGB, rr, gg, bb);
  }

  // ICtCp to XYZ (D65).
  if (id === ICtCp.id) {
    const [lp, mp, sp] = mulMat3(
      [0.000488, 0.000488, 0.000488, 0.000173, -0.000237, -0.000014, 0.000213, -0.00016, -0.000015],
      r,
      g,
      b,
    );
    const L = pqDecode(lp);
    const M = pqDecode(mp);
    const S = pqDecode(sp);
    return mulMat3(
      [
        2.0701800566956137, -1.3264568761030211, 0.20661600684785517, 0.3649882500326575,
        0.6804673628522352, -0.04542175307585324, -0.0495955422389321, -0.0494211611867573,
        1.1879959417328034,
      ],
      L,
      M,
      S,
    );
  }

  // General path: decode the transfer, then apply the toXYZ matrix.
  const { transfer, toXYZ: mat } = space.descriptor;
  if (!mat) throw new Error(`Space "${id}" has no toXYZ matrix.`);
  const rLin = transfer.eotf(r);
  const gLin = transfer.eotf(g);
  const bLin = transfer.eotf(b);
  return mulMat3(mat, rLin, gLin, bLin);
}

// -----------------------------------------------------------------
//  XYZ D65 to space
// -----------------------------------------------------------------

/**
 * @summary
 * Convert an XYZ D65 triplet to `space`.
 *
 * @description
 * Handles the same three cases as `toXYZ`, in reverse. XYZ_D65 passes
 * through. OKLab and OKLCh use the cube-root LMS path. Other spaces
 * apply their `fromXYZ` matrix and then the OETF.
 *
 * @param space - The destination space.
 * @param X - The X component.
 * @param Y - The Y component.
 * @param Z - The Z component.
 * @returns The three channels in `space`.
 *
 * @throws {Error} If the space has no `fromXYZ` matrix and is not OKLab,
 *   OKLCh, or XYZ_D65.
 *
 * @example
 * fromXYZ(sRGB, 0.4124, 0.2126, 0.0193); // [1, 0, 0] (approx)
 */
function fromXYZ(
  space: ColorSpaceDef<string>,
  X: number,
  Y: number,
  Z: number,
): [number, number, number] {
  const id = space.id;

  if (id === XYZ_D65.id) return [X, Y, Z];

  // XYZ to OKLab via cube-root LMS.
  if (id === OKLab.id) {
    const [l, m, s] = mulMat3(M_XYZ_to_LMS, X, Y, Z);
    return mulMat3(M_LMS_to_Lab, Math.cbrt(l), Math.cbrt(m), Math.cbrt(s));
  }

  // OKLab to OKLCh.
  if (id === OKLCh.id) {
    const [L, a, b] = fromXYZ(OKLab, X, Y, Z);
    const C = Math.sqrt(a * a + b * b);
    const H = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
    return [L, C, H];
  }

  // XYZ D65 to ICtCp.
  if (id === ICtCp.id) {
    const [L, M, S] = mulMat3(M_XYZ_to_LMS_ICtCp, X, Y, Z);
    const lp = pqEncode(L);
    const mp = pqEncode(M);
    const sp = pqEncode(S);
    return mulMat3(M_LMS_to_ICtCp, lp, mp, sp);
  }

  // XYZ to CIE Lab (D65).
  if (id === CIE_Lab.id) {
    const fx = labF(X / LAB_Xn);
    const fy = labF(Y / LAB_Yn);
    const fz = labF(Z / LAB_Zn);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  // XYZ to CIE LCh.
  if (id === CIE_LCh.id) {
    const [L, a, b] = fromXYZ(CIE_Lab, X, Y, Z);
    const C = Math.sqrt(a * a + b * b);
    const H = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
    return [L, C, H];
  }

  // XYZ to sRGB to HSL.
  if (id === HSL.id) {
    const c = fromXYZ(sRGB, X, Y, Z);
    return rgbToHsl(c[0], c[1], c[2]);
  }

  // XYZ to sRGB to HSV.
  if (id === HSV.id) {
    const c = fromXYZ(sRGB, X, Y, Z);
    return rgbToHsv(c[0], c[1], c[2]);
  }

  // XYZ to sRGB to HWB.
  if (id === HWB.id) {
    const c = fromXYZ(sRGB, X, Y, Z);
    const [h, s, v] = rgbToHsv(c[0], c[1], c[2]);
    const w = (1 - s) * v;
    const bl = 1 - v;
    return [h, w, bl];
  }

  // XYZ to sRGB to YCbCr.
  if (id === YCbCr.id) {
    const c = fromXYZ(sRGB, X, Y, Z);
    const rr = c[0];
    const gg = c[1];
    const bb = c[2];
    const Y2 = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
    const Cb = (bb - Y2) / 1.8556;
    const Cr = (rr - Y2) / 1.5748;
    return [Y, Cb, Cr];
  }

  // XYZ to ICtCp.
  if (id === ICtCp.id) {
    const [L, M, S] = mulMat3(
      [0.3592, 0.6976, -0.0358, -0.1922, 1.1004, 0.0755, 0.007, 0.0749, 0.8434],
      X,
      Y,
      Z,
    );
    const lp = pqEncode(L);
    const mp = pqEncode(M);
    const sp = pqEncode(S);
    return mulMat3([2048, 2048, 0, 6610, -13613, 7003, 17933, -17390, -543], lp, mp, sp);
  }

  // General path: apply the fromXYZ matrix, then encode the transfer.
  const { transfer, fromXYZ: mat } = space.descriptor;
  if (!mat) throw new Error(`Space "${id}" has no fromXYZ matrix.`);
  const [rLin, gLin, bLin] = mulMat3(mat, X, Y, Z);
  return [transfer.oetf(rLin), transfer.oetf(gLin), transfer.oetf(bLin)];
}

// -----------------------------------------------------------------
//  CIE Lab and ICtCp helpers
// -----------------------------------------------------------------

/** ICtCp XYZ to LMS matrix from the Dolby white paper. */
const M_XYZ_to_LMS_ICtCp: Mat3 = [
  0.3592, 0.6976, -0.0358, -0.1922, 1.1004, 0.0755, 0.007, 0.0749, 0.8434,
];

/** ICtCp LMS to XYZ matrix. The inverse of `M_XYZ_to_LMS_ICtCp`. */
const M_LMS_to_XYZ_ICtCp: Mat3 = [
  2.0701800566956137, -1.3264568761030211, 0.20661600684785517, 0.3649882500326575,
  0.6804673628522352, -0.04542175307585324, -0.0495955422389321, -0.0494211611867573,
  1.1879959417328034,
];

/** ICtCp LMS to ICtCp matrix. */
const M_LMS_to_ICtCp: Mat3 = [2048, 2048, 0, 6610, -13613, 7003, 17933, -17390, -543];

/** ICtCp to LMS matrix. The inverse of `M_LMS_to_ICtCp`. */
const M_ICtCp_to_LMS: Mat3 = [
  0.000488, 0.000488, 0.000488, 0.000173, -0.000237, -0.000014, 0.000213, -0.00016, -0.000015,
];

// -----------------------------------------------------------------
//  Public API
// -----------------------------------------------------------------

/**
 * @summary
 * Convert a color from its source space to a destination space.
 *
 * @description
 * All conversions route through CIE XYZ D65.
 *
 * ```text
 *   source --> XYZ D65 --> destination
 * ```
 *
 * Alpha is copied unchanged. Alpha is always linear. If the source and
 * destination are the same space, the input object is returned as-is.
 *
 * @template Src - The source space type.
 * @template Dst - The destination space type.
 *
 * @param color - The source color value.
 * @param dst - The destination space object.
 * @returns A new `ColorValue<Dst>`.
 *
 * @example
 * const linear = convert(make(sRGB, 0.5, 0.2, 0.8), Linear_sRGB);
 * const lab    = convert(linear, OKLab);
 *
 * @example
 * // A no-op conversion returns the same object.
 * const same = convert(make(sRGB, 0.5, 0.2, 0.8), sRGB);
 */
export function convert<Src extends ColorSpaceDef<string>, Dst extends ColorSpaceDef<string>>(
  color: ColorValue<Src>,
  dst: Dst,
): ColorValue<Dst> {
  const src = color._space;

  // Optimise no-op conversions.
  if (src.id === dst.id) {
    return color as unknown as ColorValue<Dst>;
  }

  const [X, Y, Z] = toXYZ(src, color.r, color.g, color.b);
  const [r, g, b] = fromXYZ(dst, X, Y, Z);
  return make(dst, r, g, b, color.a);
}

/**
 * @summary
 * Clamp each channel to the space's declared legal range.
 *
 * @description
 * Reads `channelRanges` from the space descriptor. Each channel is
 * clamped against its own range. Alpha is clamped to 0 to 1. The OKLCh
 * hue channel is never clamped because it wraps by definition.
 *
 * @template S - The color space type.
 *
 * @param color - The color to clamp.
 * @returns A new clamped `ColorValue<S>`.
 *
 * @example
 * const c = make(sRGB, 1.5, -0.2, 0.5);
 * clampToRange(c); // { r: 1, g: 0, b: 0.5, a: 1 }
 */
export function clampToRange<S extends ColorSpaceDef<string>>(color: ColorValue<S>): ColorValue<S> {
  const [rr, rg, rb] = color._space.descriptor.channelRanges;
  const cr = Math.max(rr.min, Math.min(rr.max, color.r));
  const cg = Math.max(rg.min, Math.min(rg.max, color.g));
  const cb = Math.max(rb.min, Math.min(rb.max, color.b));
  const ca = Math.max(0, Math.min(1, color.a));
  return make(color._space, cr, cg, cb, ca);
}

/**
 * @summary
 * Check that all channels are inside the space's legal range.
 *
 * @description
 * Reads `channelRanges` from the space descriptor. Each channel is
 * checked against its own range. A small epsilon of 1e-4 handles
 * floating-point rounding.
 *
 * @template S - The color space type.
 *
 * @param color - The color to test.
 * @returns True if all channels are inside their range.
 *
 * @example
 * isInRange(make(sRGB, 0.5, 0.5, 0.5));  // true
 * isInRange(make(sRGB, 1.5, 0.5, 0.5));  // false
 */
export function isInRange<S extends ColorSpaceDef<string>>(color: ColorValue<S>): boolean {
  const [rr, rg, rb] = color._space.descriptor.channelRanges;
  const eps = 1e-4;
  return (
    color.r >= rr.min - eps &&
    color.r <= rr.max + eps &&
    color.g >= rg.min - eps &&
    color.g <= rg.max + eps &&
    color.b >= rb.min - eps &&
    color.b <= rb.max + eps
  );
}

/**
 * @summary
 * Check that the color is inside the sRGB gamut.
 *
 * @description
 * Converts the color to sRGB, then checks each channel. A color is in
 * the sRGB gamut when a standard display can show it.
 *
 * @template S - The color space type.
 *
 * @param color - The color to test.
 * @returns True if the color is inside the sRGB gamut.
 *
 * @example
 * isInSRGBGamut(make(Display_P3, 0.0, 0.9, 0.5)); // false
 * isInSRGBGamut(make(sRGB, 0.5, 0.5, 0.5));       // true
 */
export function isInSRGBGamut<S extends ColorSpaceDef<string>>(color: ColorValue<S>): boolean {
  const c = convert(color, sRGB);
  return isInRange(c);
}

/**
 * @summary
 * Format a `ColorValue` for human reading.
 *
 * @description
 * The output is `<spaceId>(r, g, b, a)`. Each channel is fixed to the
 * requested number of decimal places. The default is 4.
 *
 * @template S - The color space type.
 *
 * @param color - The color to format.
 * @param decimals - The number of decimal places. Defaults to 4.
 * @returns A string such as `"sRGB(0.5000, 0.2000, 0.8000, 1.0000)"`.
 *
 * @example
 * format(make(sRGB, 0.5, 0.2, 0.8));
 * // "sRGB(0.5000, 0.2000, 0.8000, 1.0000)"
 *
 * @example
 * format(make(OKLab, 0.6, 0.2, 0.1), 2);
 * // "OKLab(0.60, 0.20, 0.10, 1.00)"
 */
export function format<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  decimals = 4,
): string {
  const d = decimals;
  return `${color._space.id}(${color.r.toFixed(d)}, ${color.g.toFixed(d)}, ${color.b.toFixed(d)}, ${color.a.toFixed(d)})`;
}

/**
 * @summary
 * Interpolate between two colors in a working space.
 *
 * @description
 * Both inputs are converted to `workingSpace` before mixing. Each
 * channel is linearly interpolated. Alpha is interpolated as well.
 *
 * The default working space is OKLab. OKLab gives perceptual blending.
 * Pass a different space if you want a different result. For example,
 * pass `sRGB` for CSS-style blends.
 *
 * @template Sa - The first color space type.
 * @template Sb - The second color space type.
 * @template W - The working space type. Defaults to OKLab.
 *
 * @param a - Start color.
 * @param b - End color.
 * @param t - Mix factor, 0 to 1. 0 returns `a`. 1 returns `b`.
 * @param workingSpace - The space to interpolate in. Defaults to OKLab.
 * @returns A new `ColorValue<W>`.
 *
 * @example
 * const red  = make(sRGB, 1, 0, 0);
 * const blue = make(sRGB, 0, 0, 1);
 * const mid  = mix(red, blue, 0.5);          // OKLab blend
 * const srgb = mix(red, blue, 0.5, sRGB);    // sRGB blend
 */
export function mix<
  Sa extends ColorSpaceDef<string>,
  Sb extends ColorSpaceDef<string>,
  W extends ColorSpaceDef<string> = typeof OKLab,
>(a: ColorValue<Sa>, b: ColorValue<Sb>, t: number, workingSpace?: W): ColorValue<W> {
  const ws = (workingSpace ?? OKLab) as unknown as W;
  const ca = convert(a, ws);
  const cb = convert(b, ws);
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return make(ws, lerp(ca.r, cb.r), lerp(ca.g, cb.g), lerp(ca.b, cb.b), lerp(ca.a, cb.a));
}
/**
 * @summary
 * Set one channel of a color value and return a new value.
 *
 * @description
 * The function copies the input. It writes the new channel value. The
 * space tag is preserved. The input object is not changed.
 *
 * Use the three string literals `'r'`, `'g'`, and `'b'` as the channel
 * name. The `a` channel has its own helper, `withAlpha`.
 *
 * @template S - The color space type.
 * @template C - The channel name. One of `'r'`, `'g'`, or `'b'`.
 *
 * @param color - The source color.
 * @param channel - The channel to replace.
 * @param value - The new channel value.
 * @returns A new `ColorValue<S>` with the changed channel.
 *
 * @example
 * const red = make(sRGB, 1, 0, 0);
 * const dark = withChannel(red, 'r', 0.5);
 * // dark.r === 0.5 and red.r === 1
 */
export function withChannel<S extends ColorSpaceDef<string>, C extends 'r' | 'g' | 'b'>(
  color: ColorValue<S>,
  channel: C,
  value: number,
): ColorValue<S> {
  if (channel === 'r') return make(color._space, value, color.g, color.b, color.a);
  if (channel === 'g') return make(color._space, color.r, value, color.b, color.a);
  return make(color._space, color.r, color.g, value, color.a);
}

/**
 * @summary
 * Set the alpha channel of a color value and return a new value.
 *
 * @description
 * The function copies the input. It writes the new alpha value. The
 * three color channels are unchanged. The space tag is preserved.
 *
 * @template S - The color space type.
 *
 * @param color - The source color.
 * @param a - The new alpha value. The caller should supply 0 to 1.
 * @returns A new `ColorValue<S>` with the changed alpha.
 *
 * @example
 * const red = make(sRGB, 1, 0, 0);
 * const faint = withAlpha(red, 0.5);
 * // faint.a === 0.5 and red.a === 1
 */
export function withAlpha<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  a: number,
): ColorValue<S> {
  return make(color._space, color.r, color.g, color.b, a);
}
