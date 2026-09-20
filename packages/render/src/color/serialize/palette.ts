/**
 * @fileoverview Palette construction and space lookup.
 *
 * @summary
 * Provides `getSpaceById` and the palette pack and unpack helpers.
 *
 * @description
 * The module keeps a registry of the built-in spaces. The registry
 * maps a space ID string to the space object. Serialized data is
 * keyed by ID. The unpack step reads the ID and finds the object.
 *
 * ```text
 *   pack:    ColorValue<S>  -->  [spaceId, c1, c2, c3, alpha]
 *   unpack:  [spaceId, ...] -->  ColorValue<S>
 * ```
 *
 * @author MathAid
 */

import { type ColorValue, make } from '../convert';
import {
  type AnyColorSpace,
  type ColorSpaceDef,
  ACES_AP0,
  ACES_AP1,
  ACEScc,
  ACEScct,
  CIE_Lab,
  CIE_LCh,
  Display_P3,
  HLG_Rec2020,
  HSL,
  HSV,
  HWB,
  ICtCp,
  Jzazbz,
  JzCzHz,
  Linear_P3,
  Linear_Rec2020,
  Linear_sRGB,
  LogC3,
  OKLab,
  OKLCh,
  PQ_Rec2020,
  sRGB,
  XYZ_D65,
  YCbCr,
} from '../space';
import { type Palette, type SerializedColor } from './types';

// -----------------------------------------------------------------
//  Registry
// -----------------------------------------------------------------

/**
 * @summary
 * The registry of built-in color spaces.
 *
 * @description
 * The map is keyed by space ID. The values are the space objects. The
 * registry is populated at module load time. Custom spaces built with
 * `makeSpace` are not in the registry. Serialize custom spaces by ID
 * and register them manually.
 */
const SPACE_REGISTRY: ReadonlyMap<string, ColorSpaceDef<string>> = new Map([
  [sRGB.id, sRGB],
  [Linear_sRGB.id, Linear_sRGB],
  [Display_P3.id, Display_P3],
  [Linear_P3.id, Linear_P3],
  [Linear_Rec2020.id, Linear_Rec2020],
  [PQ_Rec2020.id, PQ_Rec2020],
  [HLG_Rec2020.id, HLG_Rec2020],
  [ACES_AP0.id, ACES_AP0],
  [ACES_AP1.id, ACES_AP1],
  [ACEScct.id, ACEScct],
  [ACEScc.id, ACEScc],
  [LogC3.id, LogC3],
  [XYZ_D65.id, XYZ_D65],
  [OKLab.id, OKLab],
  [OKLCh.id, OKLCh],
  [HSL.id, HSL],
  [HSV.id, HSV],
  [HWB.id, HWB],
  [CIE_Lab.id, CIE_Lab],
  [CIE_LCh.id, CIE_LCh],
  [YCbCr.id, YCbCr],
  [ICtCp.id, ICtCp],
  [Jzazbz.id, Jzazbz],
  [JzCzHz.id, JzCzHz],
] as [string, AnyColorSpace][]);

// -----------------------------------------------------------------
//  Space lookup
// -----------------------------------------------------------------

/**
 * @summary
 * Look up a space by its ID.
 *
 * @description
 * The function reads the registry. When the ID is unknown, the
 * function throws a clear error that names the ID and the count of
 * registered spaces.
 *
 * @param id - The space ID string.
 * @returns The space object.
 *
 * @throws {Error} When the ID is not in the registry.
 *
 * @example
 * getSpaceById('sRGB');       // typeof sRGB
 * getSpaceById('OKLab');      // typeof OKLab
 * getSpaceById('NotASpace');  // throws
 */
export function getSpaceById(id: string): ColorSpaceDef<string> {
  const s = SPACE_REGISTRY.get(id);
  if (!s) {
    throw new Error(
      `serialize: unknown space ID "${id}". Registered spaces: ${SPACE_REGISTRY.size}.`,
    );
  }
  return s;
}

/**
 * @summary
 * The list of space IDs the registry knows.
 *
 * @description
 * Use this to validate external data. Serialized palettes written by
 * an older version of the module may name a space that the current
 * version does not have.
 *
 * @returns A frozen array of space IDs.
 */
export function knownSpaceIds(): ReadonlyArray<string> {
  return Array.from(SPACE_REGISTRY.keys());
}

// -----------------------------------------------------------------
//  Pack and unpack
// -----------------------------------------------------------------

/**
 * @summary
 * Convert a `ColorValue` to a `SerializedColor`.
 *
 * @description
 * The function reads the space ID from the color's `_space` field. It
 * writes the four channels into the tuple.
 *
 * @template S - The color space type.
 * @param color - The input color.
 * @returns A five-element tuple.
 *
 * @example
 * packColor(make(sRGB, 1, 0, 0, 1));
 * // ['sRGB', 1, 0, 0, 1]
 */
export function packColor<S extends ColorSpaceDef<string>>(color: ColorValue<S>): SerializedColor {
  return [color._space.id, color.r, color.g, color.b, color.a];
}

/**
 * @summary
 * Convert a `SerializedColor` to a `ColorValue`.
 *
 * @description
 * The function reads the space ID and looks it up in the registry. It
 * builds a new `ColorValue` in that space.
 *
 * @param packed - The five-element tuple.
 * @returns A new `ColorValue` in the named space.
 *
 * @throws {Error} When the space ID is unknown.
 *
 * @example
 * unpackColor(['sRGB', 1, 0, 0, 1]);
 * // ColorValue<typeof sRGB> with r=1, g=0, b=0, a=1
 */
export function unpackColor(packed: SerializedColor): ColorValue<ColorSpaceDef<string>> {
  const [id, c1, c2, c3, alpha] = packed;
  const space = getSpaceById(id);
  return make(space, c1, c2, c3, alpha);
}

/**
 * @summary
 * Convert a color array into a palette.
 *
 * @description
 * The function packs each color. The optional `name` is stored on the
 * result.
 *
 * @template S - The color space type of the input colors.
 * @param colors - The input colors.
 * @param name - An optional palette name.
 * @returns A `Palette`.
 *
 * @example
 * packPalette([make(sRGB, 1, 0, 0), make(sRGB, 0, 0, 1)], 'rgbi');
 */
export function packPalette<S extends ColorSpaceDef<string>>(
  colors: ReadonlyArray<ColorValue<S>>,
  name?: string,
): Palette {
  return {
    kind: 'palette',
    name,
    colors: colors.map(packColor),
  };
}

/**
 * @summary
 * Convert a palette back into a color array.
 *
 * @description
 * The function unpacks each color. Each color keeps its own space.
 *
 * @param palette - The input palette.
 * @returns A frozen array of colors.
 *
 * @throws {Error} When a space ID is unknown.
 */
export function unpackPalette(palette: Palette): ReadonlyArray<ColorValue<ColorSpaceDef<string>>> {
  return palette.colors.map(unpackColor);
}
