/**
 * @fileoverview Color space type system. Phantom brands and runtime
 * descriptors for every supported color space.
 *
 * @summary
 * Defines each logical color space the library understands as two
 * things. First, a phantom type brand for compile-time tracking.
 * Second, a runtime descriptor for matrix lookup and gamut bounds.
 *
 * @description
 * A color space in this library is two objects in one.
 *
 * It is a unique string literal brand such as `"sRGB"` or
 * `"Linear_sRGB"`. TypeScript uses this brand as a phantom type
 * parameter on `ColorValue<S>`. The brand stops accidental mixing at
 * compile time.
 *
 * It is also a runtime `SpaceDescriptor` object. The descriptor carries
 * the metadata the conversion engine needs. The metadata is the matrix
 * to and from CIE XYZ D65, the OETF and EOTF pair, and the legal value
 * range per channel.
 *
 * The library uses `unique symbol` branding. Each space is a const
 * object. The object carries both the brand and the descriptor. You
 * import the object, not the string.
 *
 * You can also build your own space. See the `_brand` doc and the
 * `makeSpace` doc for examples.
 *
 * @example
 * import { sRGB, Linear_sRGB, make, type ColorValue } from './index.js';
 *
 * // These two values hold the same numbers. TypeScript sees two types.
 * const encoded = make(sRGB, 0.5, 0.5, 0.5);
 * const linear: ColorValue<typeof Linear_sRGB> = encoded;
 * //    ^ Type error: sRGB is not assignable to Linear_sRGB
 *
 * @see {@link https://en.wikipedia.org/wiki/CIE_1931_color_space} CIE XYZ
 *
 * @author MathAid
 */

// -----------------------------------------------------------------
//  Phantom brand
// -----------------------------------------------------------------

/**
 * @summary
 * The unique symbol that brands every color space object.
 *
 * @description
 * Each `ColorSpaceDef<B>` embeds this symbol in its type. The symbol
 * carries the literal string `B`. Two spaces with different `B` values
 * are not assignable to each other.
 *
 * The symbol is a normal runtime value. You can use it to build your
 * own space without calling `makeSpace`. This is useful when you want
 * to write the object literal by hand or when you generate spaces from
 * a config file.
 *
 * @example
 * import { _brand, type ColorSpaceDef, type SpaceDescriptor } from './space.js';
 *
 * const myDescriptor: SpaceDescriptor = {
 *   name: 'My custom space',
 *   isLinear: true,
 *   toXYZ: [1, 0, 0, 0, 1, 0, 0, 0, 1],
 *   fromXYZ: [1, 0, 0, 0, 1, 0, 0, 0, 1],
 *   transfer: { eotf: (x) => x, oetf: (x) => x },
 *   channelRanges: [
 *     { min: 0, max: 1 },
 *     { min: 0, max: 1 },
 *     { min: 0, max: 1 },
 *   ],
 *   channelNames: ['R', 'G', 'B'],
 * };
 *
 * export const MySpace: ColorSpaceDef<'MySpace'> = {
 *   [_brand]: 'MySpace',
 *   id: 'MySpace',
 *   descriptor: myDescriptor,
 * };
 *
 * @example
 * // The easier path. Use makeSpace instead.
 * import { makeSpace } from './space.js';
 *
 * export const MySpace = makeSpace('MySpace', myDescriptor);
 */
export const _brand = Symbol('@color/space-brand');

/**
 * @summary
 * The structural interface every color space object satisfies.
 *
 * @description
 * `B` is the literal string that becomes the phantom type parameter.
 * The `id` field is the same string at runtime. The `descriptor` field
 * holds the matrices, transfer functions, and channel ranges.
 *
 * @template B - The literal string that names this space, for example
 *   `"sRGB"` or `"Linear_sRGB"`.
 *
 * @example
 * import { _brand, type ColorSpaceDef } from './space.js';
 *
 * const MySpace: ColorSpaceDef<'MySpace'> = {
 *   [_brand]: 'MySpace',
 *   id: 'MySpace',
 *   descriptor: myDescriptor,
 * };
 */
export interface ColorSpaceDef<B extends string> {
  /**
   * The phantom brand. A unique symbol that carries the literal
   * string `B`. TypeScript uses this field to distinguish spaces at
   * compile time. The value is the same string as `id`.
   */
  readonly [_brand]: B;

  /**
   * The unique string ID for this space. For example `"sRGB"` or
   * `"Linear_sRGB"`. Use this for logging and for runtime switches.
   */
  readonly id: B;

  /**
   * The runtime metadata the conversion engine reads. See
   * `SpaceDescriptor`.
   */
  readonly descriptor: SpaceDescriptor;
}

// -----------------------------------------------------------------
//  Runtime descriptor
// -----------------------------------------------------------------

/**
 * @summary
 * A 3 by 3 matrix stored as a flat 9-element tuple in row-major order.
 *
 * @description
 * The layout is row-major. Row 0 is indices 0, 1, 2. Row 1 is indices
 * 3, 4, 5. Row 2 is indices 6, 7, 8.
 *
 * @example
 * ```text
 *   +------+------+------+
 *   | m[0] | m[1] | m[2] |   row 0
 *   | m[3] | m[4] | m[5] |   row 1
 *   | m[6] | m[7] | m[8] |   row 2
 *   +------+------+------+
 * ```
 *
 * @example
 * const I: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
 */
export type Mat3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/**
 * @summary
 * The legal value range for one channel.
 *
 * @description
 * A channel is inside its range when the value is at least `min` and at
 * most `max`. The `isInRange` and `clampToRange` helpers use this.
 *
 * @example
 * const srgbChannel: ChannelRange = { min: 0, max: 1 };
 * const oklchHue: ChannelRange = { min: 0, max: 360 };
 */
export interface ChannelRange {
  /** The smallest legal value. */
  readonly min: number;
  /** The largest legal value. */
  readonly max: number;
}

/**
 * @summary
 * A pair of transfer functions for a color space.
 *
 * @description
 * `eotf` converts an encoded signal to linear light. `oetf` converts
 * linear light back to an encoded signal. Already-linear spaces use the
 * identity pair.
 *
 * @example
 * const srgbTransfer: TransferFunctions = {
 *   eotf: (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4),
 *   oetf: (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055),
 * };
 */
export interface TransferFunctions {
  /**
   * Encoded signal to linear light. Also called degamma.
   */
  readonly eotf: (encoded: number) => number;

  /**
   * Linear light to encoded signal. Also called gamma.
   */
  readonly oetf: (linear: number) => number;
}

/**
 * @summary
 * Everything the conversion engine needs to know about a color space.
 *
 * @description
 * All matrices are relative to CIE XYZ with a D65 white point. The
 * descriptor is read-only at runtime. Each space object carries one.
 *
 * @example
 * const sRGBDescriptor: SpaceDescriptor = {
 *   name: 'sRGB (IEC 61966-2-1)',
 *   isLinear: false,
 *   toXYZ: M_sRGB_to_XYZ,
 *   fromXYZ: M_XYZ_to_sRGB,
 *   transfer: srgbTransfer,
 *   channelRanges: [
 *     { min: 0, max: 1 },
 *     { min: 0, max: 1 },
 *     { min: 0, max: 1 },
 *   ],
 *   channelNames: ['R', 'G', 'B'],
 * };
 */
export interface SpaceDescriptor {
  /**
   * A human-readable name. Used in diagnostics and in backend mappers.
   */
  readonly name: string;

  /**
   * True if values in this space are proportional to scene or display
   * light. Non-linear spaces such as sRGB, Display P3, PQ, and HLG
   * carry a transfer function. Linear spaces use the identity.
   */
  readonly isLinear: boolean;

  /**
   * A 3 by 3 matrix that converts linear-light tristimulus in this
   * space's primaries to CIE XYZ (D65).
   *
   * Undefined for spaces whose coordinates are already XYZ, such as
   * `XYZ_D65`. Undefined for OKLab and OKLCh, which use a cube-root
   * LMS path instead.
   */
  readonly toXYZ?: Mat3;

  /**
   * A 3 by 3 matrix that converts CIE XYZ (D65) to linear-light
   * tristimulus in this space's primaries.
   *
   * Undefined for `XYZ_D65` and for OKLab and OKLCh.
   */
  readonly fromXYZ?: Mat3;

  /**
   * The EOTF and OETF pair for this space. Already-linear spaces use
   * the identity pair.
   */
  readonly transfer: TransferFunctions;

  /**
   * The legal value range for each channel. The order is R, G, B. For
   * polar spaces the order is L, C, H. For non-RGB spaces the order is
   * L, a, b or X, Y, Z.
   *
   * @example
   * // OKLCh: L is 0 to 1, C is 0 to about 0.5, H is any angle.
   * const oklchRanges = [
   *   { min: 0, max: 1 },
   *   { min: 0, max: 0.5 },
   *   { min: -Infinity, max: Infinity },
   * ];
   */
  readonly channelRanges: readonly [ChannelRange, ChannelRange, ChannelRange];

  /**
   * Human-readable channel names in channel order. Examples are
   * `['R', 'G', 'B']`, `['L', 'a', 'b']`, `['L', 'C', 'H']`, and
   * `['X', 'Y', 'Z']`.
   */
  readonly channelNames: readonly [string, string, string];
}

// -----------------------------------------------------------------
//  Transfer functions
// -----------------------------------------------------------------

/**
 * @summary
 * The identity transfer pair. Used by every linear space.
 *
 * @description
 * Both functions return the input unchanged. Linear spaces need no
 * encoding step.
 *
 * @example
 * linear.eotf(0.5); // 0.5
 * linear.oetf(0.5); // 0.5
 */
const linear: TransferFunctions = {
  eotf: (x) => x,
  oetf: (x) => x,
};

/**
 * @summary
 * The IEC 61966-2-1 sRGB transfer pair. Used by sRGB and Display P3.
 *
 * @description
 * The curve is a linear segment near zero and a power segment above it.
 * The break points are 0.04045 for the EOTF and 0.0031308 for the OETF.
 *
 * @example
 * ```text
 *   encoded
 *     1.0 |                    ,-------
 *         |                 ,-'
 *         |              ,-'
 *         |           ,-'
 *         |        ,-'
 *         |     ,-'
 *     0.0 |___/'________________________ linear
 *         0                         1.0
 * ```
 *
 * @see {@link https://www.color.org/chardata/rgb/srgb.xalter} ICC sRGB
 */
const srgbTransfer: TransferFunctions = {
  eotf: (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4),
  oetf: (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055),
};

/** SMPTE ST.2084 (PQ) constant, m1. */
const PQ_M1 = 0.1593017578125;
/** SMPTE ST.2084 (PQ) constant, m2. */
const PQ_M2 = 78.84375;
/** SMPTE ST.2084 (PQ) constant, c1. */
const PQ_C1 = 0.8359375;
/** SMPTE ST.2084 (PQ) constant, c2. */
const PQ_C2 = 18.8515625;
/** SMPTE ST.2084 (PQ) constant, c3. */
const PQ_C3 = 18.6875;

/**
 * @summary
 * The SMPTE ST.2084 (PQ) transfer pair. Peak luminance is 10000 cd/m^2.
 *
 * @description
 * PQ is used by HDR10 and by Dolby Vision. PQ gives a fixed mapping
 * between code value and absolute display luminance. This makes PQ
 * display-referred rather than scene-referred.
 *
 * @see {@link https://www.itu.int/rec/R-REC-BT.2100} ITU-R BT.2100
 */
const pqTransfer: TransferFunctions = {
  eotf: (E) => {
    const Em = Math.max(0, E) ** (1 / PQ_M2);
    return 10_000 * (Math.max(0, Em - PQ_C1) / (PQ_C2 - PQ_C3 * Em)) ** (1 / PQ_M1);
  },
  oetf: (L) => {
    const Lm = (Math.max(0, L) / 10_000) ** PQ_M1;
    return ((PQ_C1 + PQ_C2 * Lm) / (1 + PQ_C3 * Lm)) ** PQ_M2;
  },
};

/** ITU-R BT.2100 HLG constant, a. */
const HLG_A = 0.17883277;
/** ITU-R BT.2100 HLG constant, b. */
const HLG_B = 0.28466892;
/** ITU-R BT.2100 HLG constant, c. */
const HLG_C = 0.55991073;

/**
 * @summary
 * The ITU-R BT.2100 HLG transfer pair. System gamma is 1.2.
 *
 * @description
 * HLG is scene-referred, unlike PQ. HLG is compatible with SDR displays
 * without a tone-mapping step. HLG is used by live HDR broadcast.
 *
 * @see {@link https://www.itu.int/rec/R-REC-BT.2100} ITU-R BT.2100
 */
const hlgTransfer: TransferFunctions = {
  oetf: (L) => (L <= 1 / 12 ? Math.sqrt(3 * L) : HLG_A * Math.log(12 * L - HLG_B) + HLG_C),
  eotf: (E) => (E <= 0.5 ? (E * E) / 3 : (Math.exp((E - HLG_C) / HLG_A) + HLG_B) / 12),
};

// -----------------------------------------------------------------
//  Log transfer functions
// -----------------------------------------------------------------

/** ACEScct linear segment break point. */
const ACEScct_CUT = 0.0078125;
/** ACEScct linear segment slope. */
const ACEScct_A = 10.5402377416545;
/** ACEScct linear segment offset. */
const ACEScct_B = 0.0729055341958355;
/** ACEScct log segment scale. */
const ACEScct_C = 17.52;
/** ACEScct log segment offset. */
const ACEScct_D = 9.72;

/**
 * @summary
 * The ACEScct transfer pair.
 *
 * @description
 * ACEScct is a log encoding of the ACES AP1 linear space. It uses a
 * small linear segment near black, then a log segment. The linear
 * segment gives ACEScct a true black, unlike ACEScc. Editors use
 * ACEScct for color grading.
 *
 * The linear segment below 0.0078125 is smooth. Above it the curve is
 * logarithmic with a slope of 1 at the break point.
 *
 * @see {@link https://docs.acescentral.com/specifications/acescct/} ACEScct specification
 */
const acesCctTransfer: TransferFunctions = {
  eotf: (cct) => {
    if (cct <= ACEScct_A * ACEScct_CUT + ACEScct_B) {
      return (cct - ACEScct_B) / ACEScct_A;
    }
    return 2 ** (cct * ACEScct_C - ACEScct_D);
  },
  oetf: (lin) => {
    if (lin <= ACEScct_CUT) {
      return ACEScct_A * lin + ACEScct_B;
    }
    return (Math.log2(lin) + ACEScct_D) / ACEScct_C;
  },
};

/**
 * @summary
 * The ACEScc transfer pair.
 *
 * @description
 * ACEScc is a pure log encoding of ACES AP1. There is no linear
 * segment. The result has no true black: the minimum code value maps
 * to a small positive linear value. Editors use ACEScc for logarithmic
 * grading workflows.
 *
 * The curve uses a two-piece formula below the linear threshold. The
 * first piece handles negative linear values, which are clamped to the
 * minimum code. The second piece handles values up to `2 ** -15`.
 *
 * @see {@link https://docs.acescentral.com/specifications/acescc/} ACEScc specification
 */
const acesCcTransfer: TransferFunctions = {
  eotf: (cc) => {
    const minCode = (Math.log2(2 ** -16) + ACEScct_D) / ACEScct_C;
    const maxCode = (Math.log2(65504) + ACEScct_D) / ACEScct_C;
    if (cc < minCode) return 0;
    if (cc < maxCode) {
      const v = 2 ** (cc * ACEScct_C - ACEScct_D);
      if (v < 2 ** -15) return (v - 2 ** -16) * 2;
      return v;
    }
    return 65504;
  },
  oetf: (lin) => {
    if (lin <= 0) {
      return (Math.log2(2 ** -16) + ACEScct_D) / ACEScct_C;
    }
    if (lin < 2 ** -15) {
      return (Math.log2(2 ** -16 + lin * 0.5) + ACEScct_D) / ACEScct_C;
    }
    if (lin > 65504) {
      return (Math.log2(65504) + ACEScct_D) / ACEScct_C;
    }
    return (Math.log2(lin) + ACEScct_D) / ACEScct_C;
  },
};

/** ARRI LogC3 EI 800 break point in linear. */
const LOGC3_CUT = 0.010591;
/** ARRI LogC3 EI 800 coefficient a. */
const LOGC3_A = 5.555556;
/** ARRI LogC3 EI 800 coefficient b. */
const LOGC3_B = 0.052272;
/** ARRI LogC3 EI 800 coefficient c. */
const LOGC3_C = 0.24719;
/** ARRI LogC3 EI 800 coefficient d. */
const LOGC3_D = 0.385537;
/** ARRI LogC3 EI 800 coefficient e. */
const LOGC3_E = 5.367655;
/** ARRI LogC3 EI 800 coefficient f. */
const LOGC3_F = 0.092809;

/**
 * @summary
 * The ARRI LogC3 transfer pair at EI 800.
 *
 * @description
 * ARRI LogC3 is a log encoding of the ARRI Wide Gamut 3 linear space.
 * It has a linear segment near black and a log segment above it. The
 * EI 800 parameters match the camera's default rating.
 *
 * The curve is used by ALEXA and by other ARRI cameras. It is common
 * in film and in episodic television post-production.
 *
 * @see {@link https://www.arri.com/en/learn-help/learn-help-camera-system/white-papers} ARRI white papers
 */
const logC3Transfer: TransferFunctions = {
  eotf: (log) => {
    const breakCode = LOGC3_E * LOGC3_CUT + LOGC3_F;
    if (log >= breakCode) {
      return (10 ** ((log - LOGC3_D) / LOGC3_C) - LOGC3_B) / LOGC3_A;
    }
    return (log - LOGC3_F) / LOGC3_E;
  },
  oetf: (lin) => {
    if (lin >= LOGC3_CUT) {
      return LOGC3_C * Math.log10(LOGC3_A * lin + LOGC3_B) + LOGC3_D;
    }
    return LOGC3_E * lin + LOGC3_F;
  },
};

// -----------------------------------------------------------------
//  Primary matrices
// -----------------------------------------------------------------

/**
 * @summary
 * The BT.709 and sRGB primaries to XYZ D65 matrix.
 *
 * @description
 * Rows are XYZ. Columns are R, G, B. Use this matrix after applying the
 * EOTF to each channel.
 *
 * @see {@link https://www.colour-science.org/} Colour-science reference
 */
const M_sRGB_to_XYZ: Mat3 = [
  0.4124564, 0.3575761, 0.1804375, 0.2126729, 0.7151522, 0.072175, 0.0193339, 0.119192, 0.9503041,
];

/** @summary The inverse of `M_sRGB_to_XYZ`. XYZ D65 to BT.709 primaries. */
const M_XYZ_to_sRGB: Mat3 = [
  3.2404542, -1.5371385, -0.4985314, -0.969266, 1.8760108, 0.041556, 0.0556434, -0.2040259,
  1.0572252,
];

/** @summary DCI-P3 primaries to XYZ D65. */
const M_P3_to_XYZ: Mat3 = [
  0.4865709, 0.2656677, 0.1982173, 0.2289746, 0.6917385, 0.0792869, 0.0, 0.0451134, 1.0439444,
];

/** @summary The inverse of `M_P3_to_XYZ`. XYZ D65 to DCI-P3 primaries. */
const M_XYZ_to_P3: Mat3 = [
  2.4934969, -0.9313836, -0.4027108, -0.829489, 1.7626641, 0.0236247, 0.0358458, -0.0761724,
  0.9568845,
];

/** @summary BT.2020 primaries to XYZ D65. */
const M_2020_to_XYZ: Mat3 = [
  0.636958, 0.1446169, 0.168881, 0.2627002, 0.6779981, 0.0593017, 0.0, 0.0280727, 1.0609851,
];

/** @summary The inverse of `M_2020_to_XYZ`. XYZ D65 to BT.2020 primaries. */
const M_XYZ_to_2020: Mat3 = [
  1.7166512, -0.3556708, -0.2533663, -0.6666844, 1.6164812, 0.0157685, 0.0176399, -0.0427706,
  0.9421031,
];

/** @summary ACES AP0 primaries to XYZ D65. */
const M_AP0_to_XYZ: Mat3 = [
  0.9525523959, 0.0, 0.0000936786, 0.3439664498, 0.7281660966, -0.0721325464, 0.0, 0.0,
  1.0088251844,
];

/** @summary The inverse of `M_AP0_to_XYZ`. XYZ D65 to ACES AP0 primaries. */
const M_XYZ_to_AP0: Mat3 = [
  1.0498110175, 0.0, -0.0000974845, -0.4959030207, 1.3733130458, 0.0982400361, 0.0, 0.0,
  0.9912520182,
];

/** @summary ACES AP1 (ACEScg) primaries to XYZ D65. */
const M_AP1_to_XYZ: Mat3 = [
  0.6624541811, 0.1340042065, 0.1561876744, 0.2722287168, 0.6740817658, 0.0536895174, -0.0055746495,
  0.0040607335, 1.0103391003,
];

/** @summary The inverse of `M_AP1_to_XYZ`. XYZ D65 to ACES AP1 primaries. */
const M_XYZ_to_AP1: Mat3 = [
  1.6410233797, -0.3248032942, -0.2364246952, -0.6636628587, 1.6153315917, 0.0167563477,
  0.0117218943, -0.008284442, 0.9883948585,
];

/**
 * @summary
 * ARRI Wide Gamut 3 primaries to XYZ D65.
 *
 * @description
 * Used by the ARRI LogC3 transfer curve. The primaries cover a wide
 * gamut similar to Rec.2020.
 *
 * @see {@link https://www.arri.com/en/learn-help/learn-help-camera-system/white-papers} ARRI white papers
 */
const M_AWG_to_XYZ: Mat3 = [
  0.6380081, 0.2147041, 0.0977439, 0.2919536, 0.8238412, -0.1157948, 0.0027983, -0.0670341,
  1.1532944,
];

/** @summary The inverse of `M_AWG_to_XYZ`. XYZ D65 to ARRI Wide Gamut 3. */
const M_XYZ_to_AWG: Mat3 = [
  1.7890658, -0.4822018, -0.2000705, -0.6391092, 1.3962747, 0.1943174, -0.0414644, 0.0893456,
  0.8766034,
];

// -----------------------------------------------------------------
//  Space definitions
// -----------------------------------------------------------------

/**
 * @summary
 * Build a typed color space object from an ID and a descriptor.
 *
 * @description
 * Use this helper to build your own space. The returned object carries
 * the phantom brand, the ID, and the descriptor. `ColorValue<S>` from
 * the new space will not mix with values from other spaces.
 *
 * The helper is a plain function. You can call it at module load time.
 *
 * @template B - The literal string ID. This becomes the phantom type.
 *
 * @param id - The unique string ID for the space.
 * @param descriptor - The runtime metadata.
 * @returns A `ColorSpaceDef<B>` object.
 *
 * @example
 * import { makeSpace } from './space.js';
 *
 * export const MySpace = makeSpace('MySpace', {
 *   name: 'My custom space',
 *   isLinear: true,
 *   toXYZ: M_sRGB_to_XYZ,
 *   fromXYZ: M_XYZ_to_sRGB,
 *   transfer: { eotf: (x) => x, oetf: (x) => x },
 *   channelRanges: [
 *     { min: 0, max: 1 },
 *     { min: 0, max: 1 },
 *     { min: 0, max: 1 },
 *   ],
 *   channelNames: ['R', 'G', 'B'],
 * });
 *
 * @example
 * // The result is strongly typed. The brand is `'MySpace'`.
 * import { make } from './convert.js';
 * const c = make(MySpace, 0.5, 0.5, 0.5);
 * // c: ColorValue<typeof MySpace>
 */
export function makeSpace<B extends string>(id: B, descriptor: SpaceDescriptor): ColorSpaceDef<B> {
  return { [_brand]: id, id, descriptor };
}

/**
 * @summary
 * sRGB. The standard SDR space for the web and for consumer displays.
 *
 * @description
 * Uses the BT.709 primaries and the IEC 61966-2-1 transfer curve.
 * Channels are 0 to 1. This is the default space for CSS colors and for
 * most image files on the web.
 */
export const sRGB = makeSpace('sRGB', {
  name: 'sRGB (IEC 61966-2-1)',
  isLinear: false,
  toXYZ: M_sRGB_to_XYZ,
  fromXYZ: M_XYZ_to_sRGB,
  transfer: srgbTransfer,
  channelRanges: [
    { min: 0, max: 1 },
    { min: 0, max: 1 },
    { min: 0, max: 1 },
  ],
  channelNames: ['R', 'G', 'B'],
});

/**
 * @summary
 * Linear sRGB. Same BT.709 primaries as sRGB, with no transfer curve.
 *
 * @description
 * Use this for lighting math and for GPU shader inputs. Values in this
 * space are proportional to physical light.
 */
export const Linear_sRGB = makeSpace('Linear_sRGB', {
  name: 'Linear sRGB (BT.709 primaries)',
  isLinear: true,
  toXYZ: M_sRGB_to_XYZ,
  fromXYZ: M_XYZ_to_sRGB,
  transfer: linear,
  channelRanges: [
    { min: 0, max: 1 },
    { min: 0, max: 1 },
    { min: 0, max: 1 },
  ],
  channelNames: ['R', 'G', 'B'],
});

/**
 * @summary
 * Display P3. DCI-P3 primaries with the sRGB transfer curve.
 *
 * @description
 * The standard wide-gamut space for Apple displays and for many modern
 * phones. The transfer curve is the same as sRGB. The primaries are the
 * wider P3 set.
 */
export const Display_P3 = makeSpace('Display_P3', {
  name: 'Display P3 (DCI-P3 + sRGB transfer)',
  isLinear: false,
  toXYZ: M_P3_to_XYZ,
  fromXYZ: M_XYZ_to_P3,
  transfer: srgbTransfer,
  channelRanges: [
    { min: 0, max: 1 },
    { min: 0, max: 1 },
    { min: 0, max: 1 },
  ],
  channelNames: ['R', 'G', 'B'],
});

/**
 * @summary
 * Linear DCI-P3. Same primaries as Display P3, with no transfer curve.
 *
 * @description
 * Use this for wide-gamut lighting math and for GPU shader inputs.
 */
export const Linear_P3 = makeSpace('Linear_P3', {
  name: 'Linear DCI-P3',
  isLinear: true,
  toXYZ: M_P3_to_XYZ,
  fromXYZ: M_XYZ_to_P3,
  transfer: linear,
  channelRanges: [
    { min: 0, max: 1 },
    { min: 0, max: 1 },
    { min: 0, max: 1 },
  ],
  channelNames: ['R', 'G', 'B'],
});

/**
 * @summary
 * Linear BT.2020. The wide-gamut HDR container space.
 *
 * @description
 * The primaries are BT.2020. There is no transfer curve. Use this as the
 * linear step before PQ or HLG encoding.
 */
export const Linear_Rec2020 = makeSpace('Linear_Rec2020', {
  name: 'Linear BT.2020',
  isLinear: true,
  toXYZ: M_2020_to_XYZ,
  fromXYZ: M_XYZ_to_2020,
  transfer: linear,
  channelRanges: [
    { min: 0, max: 1 },
    { min: 0, max: 1 },
    { min: 0, max: 1 },
  ],
  channelNames: ['R', 'G', 'B'],
});

/**
 * @summary
 * BT.2100 PQ (ST.2084). Used by HDR10 and by HDR10+.
 *
 * @description
 * Channels are PQ-encoded. Peak luminance is 10000 cd/m^2. PQ is
 * display-referred. The same code value means the same absolute
 * luminance on any PQ display.
 */
export const PQ_Rec2020 = makeSpace('PQ_Rec2020', {
  name: 'BT.2100 PQ (ST.2084, HDR10)',
  isLinear: false,
  toXYZ: M_2020_to_XYZ,
  fromXYZ: M_XYZ_to_2020,
  transfer: pqTransfer,
  channelRanges: [
    { min: 0, max: 1 },
    { min: 0, max: 1 },
    { min: 0, max: 1 },
  ],
  channelNames: ['R', 'G', 'B'],
});

/**
 * @summary
 * BT.2100 HLG. Used by live HDR broadcast.
 *
 * @description
 * HLG is scene-referred. HLG works on SDR displays without a tone
 * mapping step. The system gamma is 1.2.
 */
export const HLG_Rec2020 = makeSpace('HLG_Rec2020', {
  name: 'BT.2100 HLG',
  isLinear: false,
  toXYZ: M_2020_to_XYZ,
  fromXYZ: M_XYZ_to_2020,
  transfer: hlgTransfer,
  channelRanges: [
    { min: 0, max: 1 },
    { min: 0, max: 1 },
    { min: 0, max: 1 },
  ],
  channelNames: ['R', 'G', 'B'],
});

/**
 * @summary
 * ACES AP0. The archival and interchange space for ACES.
 *
 * @description
 * The AP0 gamut covers the full visible spectrum. Values can be
 * negative. The channel range is the IEEE 754 half-float bound.
 */
export const ACES_AP0 = makeSpace('ACES_AP0', {
  name: 'ACES AP0 (scene-linear, wide gamut)',
  isLinear: true,
  toXYZ: M_AP0_to_XYZ,
  fromXYZ: M_XYZ_to_AP0,
  transfer: linear,
  channelRanges: [
    { min: -65504, max: 65504 },
    { min: -65504, max: 65504 },
    { min: -65504, max: 65504 },
  ],
  channelNames: ['R', 'G', 'B'],
});

/**
 * @summary
 * ACES AP1 (ACEScg). The working space for ACES rendering.
 *
 * @description
 * AP1 is smaller than AP0 but still larger than Rec.2020. Most ACES
 * rendering and compositing uses AP1.
 */
export const ACES_AP1 = makeSpace('ACES_AP1', {
  name: 'ACES AP1 / ACEScg',
  isLinear: true,
  toXYZ: M_AP1_to_XYZ,
  fromXYZ: M_XYZ_to_AP1,
  transfer: linear,
  channelRanges: [
    { min: -65504, max: 65504 },
    { min: -65504, max: 65504 },
    { min: -65504, max: 65504 },
  ],
  channelNames: ['R', 'G', 'B'],
});

/**
 * @summary
 * ACEScct. A log encoding of the ACES AP1 linear space.
 *
 * @description
 * ACEScct uses the ACES AP1 primaries and a transfer pair with a
 * short linear segment near black. The linear segment gives true
 * black. Use ACEScct for color grading and for interchange between
 * grading tools.
 *
 * The channel range is the log code value range. It is roughly
 * -0.0729 to 1.468. Values above 1 are legal and represent HDR
 * highlights.
 *
 * @see {@link https://docs.acescentral.com/specifications/acescct/} ACEScct specification
 */
export const ACEScct = makeSpace('ACEScct', {
  name: 'ACEScct (ACES log with toe)',
  isLinear: false,
  toXYZ: M_AP1_to_XYZ,
  fromXYZ: M_XYZ_to_AP1,
  transfer: acesCctTransfer,
  channelRanges: [
    { min: -0.08, max: 1.5 },
    { min: -0.08, max: 1.5 },
    { min: -0.08, max: 1.5 },
  ],
  channelNames: ['R', 'G', 'B'],
});

/**
 * @summary
 * ACEScc. A pure log encoding of the ACES AP1 linear space.
 *
 * @description
 * ACEScc uses the ACES AP1 primaries and a pure log transfer pair.
 * There is no linear segment. The curve has no true black: the
 * minimum code value maps to a small positive value. Use ACEScc for
 * log grading workflows that expect a continuous log curve.
 *
 * @see {@link https://docs.acescentral.com/specifications/acescc/} ACEScc specification
 */
export const ACEScc = makeSpace('ACEScc', {
  name: 'ACEScc (pure ACES log)',
  isLinear: false,
  toXYZ: M_AP1_to_XYZ,
  fromXYZ: M_XYZ_to_AP1,
  transfer: acesCcTransfer,
  channelRanges: [
    { min: -0.36, max: 1.47 },
    { min: -0.36, max: 1.47 },
    { min: -0.36, max: 1.47 },
  ],
  channelNames: ['R', 'G', 'B'],
});

/**
 * @summary
 * ARRI LogC3 at EI 800. A log encoding of ARRI Wide Gamut 3.
 *
 * @description
 * LogC3 uses the ARRI Wide Gamut 3 primaries. The transfer pair has a
 * linear segment near black and a log segment above it. The EI 800
 * parameters are the camera's default rating.
 *
 * Use LogC3 when ingesting ALEXA footage or when matching a DI
 * pipeline that expects ARRI curves.
 *
 * @see {@link https://www.arri.com/en/learn-help/learn-help-camera-system/white-papers} ARRI white papers
 */
export const LogC3 = makeSpace('LogC3', {
  name: 'ARRI LogC3 (EI 800)',
  isLinear: false,
  toXYZ: M_AWG_to_XYZ,
  fromXYZ: M_XYZ_to_AWG,
  transfer: logC3Transfer,
  channelRanges: [
    { min: -0.25, max: 1.0 },
    { min: -0.25, max: 1.0 },
    { min: -0.25, max: 1.0 },
  ],
  channelNames: ['R', 'G', 'B'],
});

/**
 * @summary
 * CIE XYZ with a D65 white point. The interchange space for conversion.
 *
 * @description
 * Every conversion in the engine passes through this space. The channel
 * range is the IEEE 754 half-float bound. This admits HDR values and
 * wide-gamut tristimulus values.
 */
export const XYZ_D65 = makeSpace('XYZ_D65', {
  name: 'CIE XYZ (D65 white point)',
  isLinear: true,
  transfer: linear,
  channelRanges: [
    { min: -65504, max: 65504 },
    { min: -65504, max: 65504 },
    { min: -65504, max: 65504 },
  ],
  channelNames: ['X', 'Y', 'Z'],
});

/**
 * @summary
 * OKLab by Bjorn Ottosson. A perceptually uniform rectangular space.
 *
 * @description
 * Channels are L, a, b. L is 0 to 1. a and b are roughly -0.5 to 0.5.
 * OKLab has no matrix path. The engine uses a cube-root LMS path.
 *
 * @see {@link https://bottosson.github.io/posts/oklab/} OKLab spec
 */
export const OKLab = makeSpace('OKLab', {
  name: 'OKLab (Bjorn Ottosson)',
  isLinear: false,
  transfer: linear,
  channelRanges: [
    { min: 0, max: 1 },
    { min: -0.5, max: 0.5 },
    { min: -0.5, max: 0.5 },
  ],
  channelNames: ['L', 'a', 'b'],
});

/**
 * @summary
 * OKLCh. The polar form of OKLab. Channels are L, C, H.
 *
 * @description
 * H is an angle in degrees. H wraps by definition. The channel range
 * for H is unbounded. L is 0 to 1. C is 0 to about 0.5 for real colors.
 *
 * @see {@link https://bottosson.github.io/posts/oklab/} OKLab spec
 */
export const OKLCh = makeSpace('OKLCh', {
  name: 'OKLCh (OKLab polar form)',
  isLinear: false,
  transfer: linear,
  channelRanges: [
    { min: 0, max: 1 },
    { min: 0, max: 0.5 },
    { min: -Infinity, max: Infinity },
  ],
  channelNames: ['L', 'C', 'H'],
});

/**
 * @summary
 * HSL. A cylindrical tooling space.
 *
 * @description
 * H is the hue in degrees. S and L run 0 to 1. HSL is not
 * perceptually uniform. It is common in UI design tools. Use it for
 * authoring and for CSS interop. Do not use it for blending.
 *
 * @see {@link https://www.w3.org/TR/css-color-4/#the-hsl-notation} CSS Color 4 HSL
 */
export const HSL = makeSpace('HSL', {
  name: 'HSL (CSS cylindrical)',
  isLinear: false,
  transfer: linear,
  channelRanges: [
    { min: -Infinity, max: Infinity },
    { min: 0, max: 1 },
    { min: 0, max: 1 },
  ],
  channelNames: ['H', 'S', 'L'],
});

/**
 * @summary
 * HSV. A cylindrical tooling space.
 *
 * @description
 * H is the hue in degrees. S and V run 0 to 1. HSV is not
 * perceptually uniform. It is common in color pickers. The V channel
 * is the maximum of the three RGB channels. The S channel is the
 * normalized chroma above the minimum.
 */
export const HSV = makeSpace('HSV', {
  name: 'HSV (hue, saturation, value)',
  isLinear: false,
  transfer: linear,
  channelRanges: [
    { min: -Infinity, max: Infinity },
    { min: 0, max: 1 },
    { min: 0, max: 1 },
  ],
  channelNames: ['H', 'S', 'V'],
});

/**
 * @summary
 * HWB. A cylindrical tooling space.
 *
 * @description
 * H is the hue in degrees. W is whiteness. B is blackness. Both run 0
 * to 1. When W + B is at least 1, the color is a gray. HWB is common
 * in CSS. It maps cleanly to and from HSV.
 *
 * @see {@link https://www.w3.org/TR/css-color-4/#the-hwb-notation} CSS Color 4 HWB
 */
export const HWB = makeSpace('HWB', {
  name: 'HWB (hue, whiteness, blackness)',
  isLinear: false,
  transfer: linear,
  channelRanges: [
    { min: -Infinity, max: Infinity },
    { min: 0, max: 1 },
    { min: 0, max: 1 },
  ],
  channelNames: ['H', 'W', 'B'],
});

/**
 * @summary
 * CIE 1976 Lab with a D65 white point.
 *
 * @description
 * L runs 0 to 100. a and b are roughly -128 to 127 for real colors.
 * The space is perceptually more uniform than XYZ. It is older than
 * OKLab and less accurate for small differences. Use `deltaE2000` for
 * difference metrics in this space.
 *
 * @see {@link https://en.wikipedia.org/wiki/CIELAB_color_space} CIE Lab
 */
export const CIE_Lab = makeSpace('CIE_Lab', {
  name: 'CIE 1976 Lab (D65)',
  isLinear: false,
  transfer: linear,
  channelRanges: [
    { min: 0, max: 100 },
    { min: -128, max: 127 },
    { min: -128, max: 127 },
  ],
  channelNames: ['L', 'a', 'b'],
});

/**
 * @summary
 * CIE 1976 LCh. The polar form of CIE Lab.
 *
 * @description
 * L runs 0 to 100. C is chroma. H is the hue in degrees. The space is
 * rectangular Lab in polar form. H wraps by definition.
 *
 * @see {@link https://en.wikipedia.org/wiki/CIELAB_color_space} CIE Lab
 */
export const CIE_LCh = makeSpace('CIE_LCh', {
  name: 'CIE 1976 LCh (D65)',
  isLinear: false,
  transfer: linear,
  channelRanges: [
    { min: 0, max: 100 },
    { min: 0, max: 150 },
    { min: -Infinity, max: Infinity },
  ],
  channelNames: ['L', 'C', 'H'],
});

/**
 * @summary
 * YCbCr with ITU-R BT.709 coefficients.
 *
 * @description
 * Y is luma, 0 to 1. Cb and Cr are the blue and red chroma
 * differences, roughly -0.5 to 0.5. The space is common in video
 * pipelines. The coefficients match the BT.709 primaries used by sRGB
 * and Rec.2020 SDR.
 *
 * Use this only for BT.709 content. BT.601 and BT.2020 use different
 * coefficients. Add a separate space if you need them.
 *
 * @see {@link https://www.itu.int/rec/R-REC-BT.709} ITU-R BT.709
 */
export const YCbCr = makeSpace('YCbCr', {
  name: 'YCbCr (BT.709)',
  isLinear: false,
  transfer: linear,
  channelRanges: [
    { min: 0, max: 1 },
    { min: -0.5, max: 0.5 },
    { min: -0.5, max: 0.5 },
  ],
  channelNames: ['Y', 'Cb', 'Cr'],
});

/**
 * @summary
 * Dolby ICtCp. An HDR perceptual space.
 *
 * @description
 * I is intensity, 0 to 1. Ct and Cp are the blue and red chroma
 * differences, roughly -0.5 to 0.5. ICtCp is designed for HDR and
 * wide gamut content. It is more uniform than PQ RGB.
 *
 * Use it for HDR quality checks and for HDR tone mapping. Use
 * `deltaEITP` for difference metrics in this space.
 *
 * @see {@link https://professional.dolby.com/siteassets/pdfs/ictcp_dolbywhitepaper_v071.pdf} Dolby ICtCp
 */
export const ICtCp = makeSpace('ICtCp', {
  name: 'Dolby ICtCp',
  isLinear: false,
  transfer: linear,
  channelRanges: [
    { min: 0, max: 1 },
    { min: -0.5, max: 0.5 },
    { min: -0.5, max: 0.5 },
  ],
  channelNames: ['I', 'Ct', 'Cp'],
});

/**
 * @summary
 * Jzazbz by Safdar et al 2017. An HDR perceptual space.
 *
 * @description
 * Jzazbz is designed for HDR. It is more uniform than OKLab above
 * 1000 cd/m^2. The three channels are Jz (lightness), az (red-green),
 * and bz (yellow-blue).
 *
 * The space uses an absolute luminance reference. The reference is
 * 10000 cd/m^2. Values below this scale linearly. Values above it
 * compress with a PQ-like curve.
 *
 * The path from XYZ D65 is not a single matrix. The engine wires it
 * into `convert.ts` as a special case. See `toXYZ` and `fromXYZ`.
 *
 * @see {@link https://www.osapublishing.org/oe/fulltext.cfm?uri=oe-25-13-15131} Safdar et al 2017
 */
export const Jzazbz = makeSpace('Jzazbz', {
  name: 'Jzazbz (Safdar 2017)',
  isLinear: false,
  transfer: linear,
  channelRanges: [
    { min: -0.1, max: 1.0 },
    { min: -0.5, max: 0.5 },
    { min: -0.5, max: 0.5 },
  ],
  channelNames: ['Jz', 'az', 'bz'],
});

/**
 * @summary
 * JzCzHz. The polar form of Jzazbz.
 *
 * @description
 * Jz is lightness. Cz is chroma. Hz is the hue in degrees. Hz wraps
 * by definition.
 *
 * @see {@link https://www.osapublishing.org/oe/fulltext.cfm?uri=oe-25-13-15131} Safdar et al 2017
 */
export const JzCzHz = makeSpace('JzCzHz', {
  name: 'JzCzHz (Jzazbz polar)',
  isLinear: false,
  transfer: linear,
  channelRanges: [
    { min: -0.1, max: 1.0 },
    { min: 0, max: 0.5 },
    { min: -Infinity, max: Infinity },
  ],
  channelNames: ['Jz', 'Cz', 'Hz'],
});

// -----------------------------------------------------------------
//  Union convenience type
// -----------------------------------------------------------------

/**
 * @summary
 * The union of every space object in this module.
 *
 * @description
 * Use this when a function accepts any built-in space. The union is
 * closed. New spaces you build with `makeSpace` are not part of it.
 *
 * @example
 * function describe(space: AnyColorSpace): string {
 *   return `${space.id}: ${space.descriptor.name}`;
 * }
 */
export type AnyColorSpace =
  | typeof sRGB
  | typeof Linear_sRGB
  | typeof Display_P3
  | typeof Linear_P3
  | typeof Linear_Rec2020
  | typeof PQ_Rec2020
  | typeof HLG_Rec2020
  | typeof ACES_AP0
  | typeof ACES_AP1
  | typeof ACEScct
  | typeof ACEScc
  | typeof LogC3
  | typeof XYZ_D65
  | typeof OKLab
  | typeof OKLCh
  | typeof HSL
  | typeof HSV
  | typeof HWB
  | typeof CIE_Lab
  | typeof CIE_LCh
  | typeof YCbCr
  | typeof ICtCp
  | typeof Jzazbz
  | typeof JzCzHz;
/**
 * @summary
 * The string IDs of every built-in space.
 *
 * @description
 * Use this for runtime switch statements and for string keys. Custom
 * spaces you build with `makeSpace` are not part of this union.
 *
 * @example
 * function isHDR(id: ColorSpaceId): boolean {
 *   return id === 'PQ_Rec2020' || id === 'HLG_Rec2020' || id === 'Linear_Rec2020';
 * }
 */
export type ColorSpaceId = AnyColorSpace['id'];
