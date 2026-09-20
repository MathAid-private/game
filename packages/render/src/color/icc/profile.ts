/**
 * @fileoverview In-memory ICC profile types.
 *
 * @summary
 * Describes the fields a parsed ICC profile carries. The parser
 * produces these. The transform layer consumes them.
 *
 * @description
 * An ICC profile is a binary file. The header describes the profile's
 * purpose and the PCS (profile connection space). A tag table maps
 * four-character signatures to byte ranges inside the file.
 *
 * ```text
 *   +-------------------+  Byte 0
 *   | Header (128 B)    |
 *   +-------------------+  Byte 128
 *   | Tag table         |
 *   |   count (4 B)     |
 *   |   entries (12 B)  |  One per tag.
 *   +-------------------+
 *   | Tag data          |
 *   |   (referred to    |
 *   |    by offsets)    |
 *   +-------------------+
 * ```
 *
 * @author MathAid
 */

import { type Mat3 } from '../space';

// -----------------------------------------------------------------
//  Types
// -----------------------------------------------------------------

/**
 * @summary
 * The ICC profile class.
 *
 * @description
 * The class states the profile's purpose. A display profile describes
 * how a monitor shows color. An output profile describes a printer.
 * A colorspace profile is a working space.
 */
export type ICCProfileClass =
  'input' | 'display' | 'output' | 'link' | 'abstract' | 'colorspace' | 'named';

/**
 * @summary
 * The profile connection space.
 *
 * @description
 * The PCS is the space that all ICC transforms connect through. It is
 * always either XYZ or CIE Lab, with a D50 white point.
 */
export type ICCPCS = 'XYZ' | 'Lab';

/**
 * @summary
 * A parsed ICC profile.
 *
 * @description
 * The parser fills every field it can from the file. Fields that a
 * matrix or TRC profile does not have are undefined.
 */
export interface ICCProfile {
  /** The ICC version, such as `'4.3.0'`. */
  readonly version: string;
  /** The profile class. */
  readonly deviceClass: ICCProfileClass;
  /** The device color space. Examples are `'RGB'`, `'CMYK'`, `'GRAY'`. */
  readonly colorSpace: string;
  /** The profile connection space. */
  readonly pcs: ICCPCS;
  /** The PCS illuminant as XYZ. Usually D50. */
  readonly pcsIlluminant: readonly [number, number, number];
  /** The media white point as XYZ. */
  readonly mediaWhite: readonly [number, number, number];

  /** The RGB-to-PCS matrix. Present for RGB matrix or TRC profiles. */
  readonly toPCS?: Mat3;
  /** The PCS-to-RGB matrix. The inverse of `toPCS`, when available. */
  readonly fromPCS?: Mat3;
  /** The per-channel TRC curves. Present for RGB matrix or TRC profiles. */
  readonly trc?: readonly [TRCFunction, TRCFunction, TRCFunction];
  /** The single gray TRC. Present for gray profiles. */
  readonly grayTRC?: TRCFunction;

  /** All tag signatures found in the file, as a list. */
  readonly tags: ReadonlyArray<string>;
}

/**
 * @summary
 * A TRC curve.
 *
 * @description
 * A TRC maps a device-encoded value in 0 to 1 to a linear value in 0
 * to 1. ICC profiles store three kinds. Identity, a power curve, or a
 * lookup table.
 *
 * Use `apply` to evaluate the curve at a value.
 */
export interface TRCFunction {
  /** Evaluate the curve at a 0 to 1 input. */
  readonly apply: (v: number) => number;
  /** The curve kind. */
  readonly kind: 'identity' | 'gamma' | 'table';
}
