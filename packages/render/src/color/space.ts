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
  number, number, number,
  number, number, number,
  number, number, number,
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
  0.4124564, 0.3575761, 0.1804375,
  0.2126729, 0.7151522, 0.072175,
  0.0193339, 0.119192,  0.9503041,
];

/** @summary The inverse of `M_sRGB_to_XYZ`. XYZ D65 to BT.709 primaries. */
const M_XYZ_to_sRGB: Mat3 = [
   3.2404542, -1.5371385, -0.4985314,
  -0.969266,   1.8760108,  0.041556,
   0.0556434, -0.2040259,  1.0572252,
];

/** @summary DCI-P3 primaries to XYZ D65. */
const M_P3_to_XYZ: Mat3 = [
  0.4865709, 0.2656677, 0.1982173,
  0.2289746, 0.6917385, 0.0792869,
  0.0,       0.0451134, 1.0439444,
];

/** @summary The inverse of `M_P3_to_XYZ`. XYZ D65 to DCI-P3 primaries. */
const M_XYZ_to_P3: Mat3 = [
   2.4934969, -0.9313836, -0.4027108,
  -0.829489,   1.7626641,  0.0236247,
   0.0358458, -0.0761724,  0.9568845,
];

/** @summary BT.2020 primaries to XYZ D65. */
const M_2020_to_XYZ: Mat3 = [
  0.636958,  0.1446169, 0.168881,
  0.2627002, 0.6779981, 0.0593017,
  0.0,       0.0280727, 1.0609851,
];

/** @summary The inverse of `M_2020_to_XYZ`. XYZ D65 to BT.2020 primaries. */
const M_XYZ_to_2020: Mat3 = [
   1.7166512, -0.3556708, -0.2533663,
  -0.6666844,  1.6164812,  0.0157685,
   0.0176399, -0.0427706,  0.9421031,
];

/** @summary ACES AP0 primaries to XYZ D65. */
const M_AP0_to_XYZ: Mat3 = [
  0.9525523959, 0.0,           0.0000936786,
  0.3439664498, 0.7281660966, -0.0721325464,
  0.0,          0.0,           1.0088251844,
];

/** @summary The inverse of `M_AP0_to_XYZ`. XYZ D65 to ACES AP0 primaries. */
const M_XYZ_to_AP0: Mat3 = [
   1.0498110175,  0.0,          -0.0000974845,
  -0.4959030207,  1.3733130458,  0.0982400361,
   0.0,           0.0,           0.9912520182,
];

/** @summary ACES AP1 (ACEScg) primaries to XYZ D65. */
const M_AP1_to_XYZ: Mat3 = [
   0.6624541811,  0.1340042065,  0.1561876744,
   0.2722287168,  0.6740817658,  0.0536895174,
  -0.0055746495,  0.0040607335,  1.0103391003,
];

/** @summary The inverse of `M_AP1_to_XYZ`. XYZ D65 to ACES AP1 primaries. */
const M_XYZ_to_AP1: Mat3 = [
   1.6410233797, -0.3248032942, -0.2364246952,
  -0.6636628587,  1.6153315917,  0.0167563477,
   0.0117218943, -0.008284442,   0.9883948585,
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

// -----------------------------------------------------------------
//  Union convenience type
// -----------------------------------------------------------------

/**
 * @summary
 * The union of every space object the library ships.
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
  | typeof XYZ_D65
  | typeof OKLab
  | typeof OKLCh;

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