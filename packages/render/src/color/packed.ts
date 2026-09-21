/**
 * @fileoverview Packed integer color formats.
 *
 * @summary
 * Provides `toRGBA8`, `fromRGBA8`, `toBGRA8`, `fromBGRA8`, `toRgb565`,
 * and `fromRgb565`. These move colors to and from single-integer
 * encodings.
 *
 * @description
 * Font atlases, sprite sheets, and icon packs store colors as packed
 * integers. A packed format holds every channel in one 32-bit or 16-bit
 * value. This module reads and writes those formats.
 *
 * ```text
 *   RGBA8 layout (32 bits, big-endian hex):
 *
 *   +--------+--------+--------+--------+
 *   | R (8)  | G (8)  | B (8)  | A (8)  |
 *   +--------+--------+--------+--------+
 *    bit 24    bit 16   bit 8    bit 0
 *
 *   BGRA8 layout (32 bits, big-endian hex):
 *
 *   +--------+--------+--------+--------+
 *   | B (8)  | G (8)  | R (8)  | A (8)  |
 *   +--------+--------+--------+--------+
 *    bit 24    bit 16   bit 8    bit 0
 *
 *   Rgb565 layout (16 bits):
 *
 *   +--------+--------+--------+
 *   | R (5)  | G (6)  | B (5)  |
 *   +--------+--------+--------+
 *    bit 11   bit 5    bit 0
 * ```
 *
 * The 8-bit formats always convert to sRGB first. The 16-bit format
 * always converts to sRGB first. The alpha channel is not present in
 * `Rgb565`.
 *
 * @author MathAid
 */

import { type ColorValue, convert, make } from './convert';
import { type ColorSpaceDef, sRGB } from './space';

// -----------------------------------------------------------------
//  RGBA8
// -----------------------------------------------------------------

/**
 * @summary
 * Pack a color into a 32-bit RGBA8 integer.
 *
 * @description
 * The function converts to sRGB. Each channel is scaled to 0 to 255 and
 * rounded. The result packs the channels as `C1 << 24 | C2 << 16 | C3 << 8 | ALPHA`.
 *
 * The high byte is red. The low byte is alpha. This matches the common
 * canvas and `ImageData` layout in web code.
 *
 * @template S - The color space type.
 *
 * @param color - The source color.
 * @returns A 32-bit unsigned integer. The result may be negative in
 *   JavaScript if the top bit is set. Use `>>> 0` at the call site if
 *   you need an unsigned value.
 *
 * @example
 * toRGBA8(make(sRGB, 1, 0, 0, 1));  // 0xFF0000FF
 */
export function toRGBA8<S extends ColorSpaceDef<string>>(color: ColorValue<S>): number {
  const c = convert(color, sRGB);
  const r = Math.round(clamp01(c.c1) * 255);
  const g = Math.round(clamp01(c.c2) * 255);
  const b = Math.round(clamp01(c.c3) * 255);
  const a = Math.round(clamp01(c.alpha) * 255);
  return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
}

/**
 * @summary
 * Unpack a 32-bit RGBA8 integer into an sRGB color.
 *
 * @description
 * The function reads each byte from the packed value. It divides each
 * byte by 255 to give a 0 to 1 float.
 *
 * @param packed - The packed 32-bit value.
 * @returns A new `ColorValue<typeof sRGB>`.
 *
 * @example
 * fromRGBA8(0xFF0000FF);  // sRGB(1, 0, 0, 1)
 */
export function fromRGBA8(packed: number): ColorValue<typeof sRGB> {
  const r = ((packed >>> 24) & 0xff) / 255;
  const g = ((packed >>> 16) & 0xff) / 255;
  const b = ((packed >>> 8) & 0xff) / 255;
  const a = (packed & 0xff) / 255;
  return make(sRGB, r, g, b, a);
}

// -----------------------------------------------------------------
//  BGRA8
// -----------------------------------------------------------------

/**
 * @summary
 * Pack a color into a 32-bit BGRA8 integer.
 *
 * @description
 * The function converts to sRGB. Each channel is scaled to 0 to 255 and
 * rounded. The result packs the channels as `C3 << 24 | C2 << 16 | C1 << 8 | ALPHA`.
 *
 * The high byte is blue. The low byte is alpha. This matches the common
 * layout on Windows DirectX surfaces and in some image codecs.
 *
 * @template S - The color space type.
 *
 * @param color - The source color.
 * @returns A 32-bit unsigned integer.
 *
 * @example
 * toBGRA8(make(sRGB, 1, 0, 0, 1));  // 0x0000FFFF (blue=0, green=0, red=255, a=255)
 */
export function toBGRA8<S extends ColorSpaceDef<string>>(color: ColorValue<S>): number {
  const c = convert(color, sRGB);
  const r = Math.round(clamp01(c.c1) * 255);
  const g = Math.round(clamp01(c.c2) * 255);
  const b = Math.round(clamp01(c.c3) * 255);
  const a = Math.round(clamp01(c.alpha) * 255);
  return ((b << 24) | (g << 16) | (r << 8) | a) >>> 0;
}

/**
 * @summary
 * Unpack a 32-bit BGRA8 integer into an sRGB color.
 *
 * @param packed - The packed 32-bit value.
 * @returns A new `ColorValue<typeof sRGB>`.
 *
 * @example
 * fromBGRA8(0x0000FFFF);  // sRGB(1, 0, 0, 1)
 */
export function fromBGRA8(packed: number): ColorValue<typeof sRGB> {
  const b = ((packed >>> 24) & 0xff) / 255;
  const g = ((packed >>> 16) & 0xff) / 255;
  const r = ((packed >>> 8) & 0xff) / 255;
  const a = (packed & 0xff) / 255;
  return make(sRGB, r, g, b, a);
}

// -----------------------------------------------------------------
//  Rgb565
// -----------------------------------------------------------------

/**
 * @summary
 * Pack a color into a 16-bit Rgb565 integer.
 *
 * @description
 * The function converts to sRGB. It quantizes red and blue to 5 bits,
 * and green to 6 bits. Green gets the extra bit because the eye is
 * most sensitive to green.
 *
 * The alpha channel is dropped. `Rgb565` has no alpha.
 *
 * Note the operator precedence in the packing expression. Multiplication
 * binds tighter than the bitwise AND. The parentheses make the intent
 * clear.
 *
 * @template S - The color space type.
 *
 * @param color - The source color.
 * @returns A 16-bit unsigned integer.
 *
 * @example
 * toRgb565(make(sRGB, 1, 0, 0));  // 0xF800 (red is the top 5 bits)
 * toRgb565(make(sRGB, 0, 1, 0));  // 0x07E0 (green is the middle 6 bits)
 * toRgb565(make(sRGB, 0, 0, 1));  // 0x001F (blue is the bottom 5 bits)
 */
export function toRgb565<S extends ColorSpaceDef<string>>(color: ColorValue<S>): number {
  const c = convert(color, sRGB);
  const r5 = (Math.round(clamp01(c.c1) * 31) & 0x1f) << 11;
  const g6 = (Math.round(clamp01(c.c2) * 63) & 0x3f) << 5;
  const b5 = Math.round(clamp01(c.c3) * 31) & 0x1f;
  return (r5 | g6 | b5) >>> 0;
}

/**
 * @summary
 * Unpack a 16-bit Rgb565 integer into an sRGB color.
 *
 * @description
 * The function reads red and blue from 5 bits, and green from 6 bits.
 * Each value is divided by its maximum to give a 0 to 1 float.
 *
 * The result has alpha 1. The source format has no alpha.
 *
 * @param packed - The packed 16-bit value.
 * @returns A new `ColorValue<typeof sRGB>`.
 *
 * @example
 * fromRgb565(0xF800);  // sRGB(1, 0, 0, 1)
 * fromRgb565(0x07E0);  // sRGB(0, 1, 0, 1)
 */
export function fromRgb565(packed: number): ColorValue<typeof sRGB> {
  const r = ((packed >> 11) & 0x1f) / 31;
  const g = ((packed >> 5) & 0x3f) / 63;
  const b = (packed & 0x1f) / 31;
  return make(sRGB, r, g, b, 1);
}

// -----------------------------------------------------------------
//  Internals
// -----------------------------------------------------------------

/**
 * @summary
 * Clamp a number to the 0 to 1 range.
 *
 * @param v - The input value.
 * @returns The clamped value.
 */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
