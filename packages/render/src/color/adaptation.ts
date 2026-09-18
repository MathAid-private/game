/**
 * @fileoverview Chromatic adaptation transforms.
 *
 * @summary
 * Provides `adapt` and the `WhitePoint` and `AdaptationMethod` types.
 * The function converts a color from one white point to another.
 *
 * @description
 * Chromatic adaptation adjusts a color so it appears the same under a
 * different illuminant. The eye does this automatically. Cameras and
 * color pipelines model it with a matrix.
 *
 * ```text
 *   Source color at D65 --> [M_adapt] --> Same color at D50
 *
 *   M_adapt = M_cone^-1 * diag(target / source) * M_cone
 *
 *   The matrix is built from the cone response of the two whites.
 * ```
 *
 * Four methods are provided. Each has its own cone response matrix.
 *
 * ```text
 *   bradford      The industry default. Used by ICC.
 *   von-kries     The original 1902 model. XYZ scaled in cone space.
 *   cat02         The CIECAM02 model. Accurate for a wide range.
 *   xyz-scaling   A naive scale of XYZ. Fast, but not accurate.
 * ```
 *
 * @see {@link https://en.wikipedia.org/wiki/CIECAM02} CIECAM02
 * @see {@link https://en.wikipedia.org/wiki/Chromatic_adaptation} Chromatic adaptation
 *
 * @author MathAid
 */

import { type ColorValue, convert, make } from './convert';
import { type ColorSpaceDef, type Mat3, XYZ_D65 } from './space';

// -----------------------------------------------------------------
//  Types
// -----------------------------------------------------------------

/**
 * @summary
 * The standard illuminant names.
 *
 * @description
 * `D50` is print and ICC. `D55` is midday daylight. `D65` is the sRGB
 * and Rec.2020 white. `D93` is a wider display white. `E` is the equal
 * energy white. `A` is incandescent. `C` is an old daylight
 * approximation.
 */
export type WhitePoint = 'D50' | 'D55' | 'D65' | 'D93' | 'E' | 'A' | 'C';

/**
 * @summary
 * The chromatic adaptation method.
 *
 * @description
 * See the module JSDoc for a description of each method.
 */
export type AdaptationMethod = 'bradford' | 'von-kries' | 'cat02' | 'xyz-scaling';

// -----------------------------------------------------------------
//  Constants
// -----------------------------------------------------------------

/**
 * @summary
 * The XYZ tristimulus of each reference white.
 *
 * @description
 * Values are relative to `Y = 1`. They come from the CIE 15:2004
 * tables. `D65` matches the value used by the color module.
 */
const WHITE_POINTS: Record<WhitePoint, readonly [number, number, number]> = {
  D50: [0.96422, 1.0, 0.82521],
  D55: [0.95682, 1.0, 0.92149],
  D65: [0.95047, 1.0, 1.08883],
  D93: [0.91947, 1.0, 1.26897],
  E: [1.0, 1.0, 1.0],
  A: [1.0985, 1.0, 0.35585],
  C: [0.98074, 1.0, 1.18232],
};

/**
 * @summary
 * The Bradford cone response matrix.
 *
 * @description
 * The most accurate of the four methods for typical viewing. Adopted
 * by ICC and by most color management tools.
 */
const M_BRADFORD: Mat3 = [
  0.8951, 0.2664, -0.1614, -0.7502, 1.7135, 0.0367, 0.0389, -0.0685, 1.0296,
];

/** @summary The inverse of `M_BRADFORD`. */
const M_BRADFORD_INV: Mat3 = [
  0.9869929, -0.1470543, 0.1599627, 0.4323053, 0.5183603, 0.0492912, -0.0085287, 0.0400428,
  0.9684867,
];

/** @summary The Von Kries cone response matrix. */
const M_VON_KRIES: Mat3 = [0.40024, 0.7076, -0.08081, -0.2263, 1.16532, 0.0457, 0.0, 0.0, 0.91822];

/** @summary The inverse of `M_VON_KRIES`. */
const M_VON_KRIES_INV: Mat3 = [
  1.8599364, -1.1293816, 0.2198974, 0.3611914, 0.6388125, -0.0000064, 0.0, 0.0, 1.0890636,
];

/** @summary The CAT02 cone response matrix from CIECAM02. */
const M_CAT02: Mat3 = [0.7328, 0.4296, -0.1624, -0.7036, 1.6975, 0.0061, 0.003, 0.0136, 0.9834];

/** @summary The inverse of `M_CAT02`. */
const M_CAT02_INV: Mat3 = [
  1.0961238, -0.278869, 0.1827452, 0.454369, 0.4735332, 0.0720978, -0.0096276, -0.005698, 1.0153256,
];

/** @summary The identity matrix. Used by `xyz-scaling`. */
const M_IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

// -----------------------------------------------------------------
//  Internals
// -----------------------------------------------------------------

function mulMat3(m: Mat3, x: number, y: number, z: number): [number, number, number] {
  return [
    m[0] * x + m[1] * y + m[2] * z,
    m[3] * x + m[4] * y + m[5] * z,
    m[6] * x + m[7] * y + m[8] * z,
  ];
}

function methodMatrices(method: AdaptationMethod): { m: Mat3; inv: Mat3 } {
  switch (method) {
    case 'bradford':
      return { m: M_BRADFORD, inv: M_BRADFORD_INV };
    case 'von-kries':
      return { m: M_VON_KRIES, inv: M_VON_KRIES_INV };
    case 'cat02':
      return { m: M_CAT02, inv: M_CAT02_INV };
    case 'xyz-scaling':
      return { m: M_IDENTITY, inv: M_IDENTITY };
  }
}

// -----------------------------------------------------------------
//  Public API
// -----------------------------------------------------------------

/**
 * @summary
 * Adapt a color from one white point to another.
 *
 * @description
 * The function converts the input to `XYZ_D65`. It applies the
 * adaptation matrix. It converts back to the source space. When the
 * two white points are the same, the input is returned unchanged.
 *
 * @template S - The color space type.
 *
 * @param color - The source color.
 * @param from - The source white point.
 * @param to - The target white point.
 * @param method - The adaptation method. Defaults to `'bradford'`.
 * @returns A new `ColorValue<S>` in the same space as the input.
 *
 * @example
 * import { make, sRGB } from './index.js';
 * import { adapt } from './adaptation.js';
 *
 * const red = make(sRGB, 1, 0, 0);
 * const redD50 = adapt(red, 'D65', 'D50');
 */
export function adapt<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  from: WhitePoint,
  to: WhitePoint,
  method: AdaptationMethod = 'bradford',
): ColorValue<S> {
  if (from === to) return color;

  const srcWhite = WHITE_POINTS[from];
  const dstWhite = WHITE_POINTS[to];
  const { m, inv } = methodMatrices(method);

  const srcCone = mulMat3(m, srcWhite[0], srcWhite[1], srcWhite[2]);
  const dstCone = mulMat3(m, dstWhite[0], dstWhite[1], dstWhite[2]);

  const scale: Mat3 = [
    dstCone[0] / srcCone[0],
    0,
    0,
    0,
    dstCone[1] / srcCone[1],
    0,
    0,
    0,
    dstCone[2] / srcCone[2],
  ];

  const xyz = convert(color, XYZ_D65);
  const cone = mulMat3(m, xyz.r, xyz.g, xyz.b);
  const scaled = mulMat3(scale, cone[0], cone[1], cone[2]);
  const back = mulMat3(inv, scaled[0], scaled[1], scaled[2]);

  const outXyz = make(XYZ_D65, back[0], back[1], back[2], color.a);
  return convert(outXyz, color._space);
}

/**
 * @summary
 * The XYZ tristimulus of a reference white.
 *
 * @description
 * The values are relative to `Y = 1`. Use them to build your own
 * matrices or to compare against external color science tools.
 *
 * @param name - The white point name.
 * @returns The XYZ tristimulus as a 3-tuple.
 *
 * @example
 * whitePointXYZ('D65');  // [0.95047, 1.0, 1.08883]
 */
export function whitePointXYZ(name: WhitePoint): readonly [number, number, number] {
  return WHITE_POINTS[name];
}
