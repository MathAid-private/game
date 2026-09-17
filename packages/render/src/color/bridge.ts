/**
 * @fileoverview Typed-array bridge for batch color conversion.
 *
 * @summary
 * Provides `toFloat32Array`, `fromFloat32Array`, `toUint8Array`,
 * `fromUint8Array`, and `convertBatch`. These move colors between
 * `ColorValue<S>` objects and flat typed arrays.
 *
 * @description
 * GPU uploads take typed arrays. A per-color loop on `ColorValue`
 * objects allocates and boxes. This module avoids that cost.
 *
 * The layout is interleaved RGBA. Four values per color. No padding.
 * This matches the standard texture upload layout for WebGL, WebGPU,
 * Vulkan, and Metal.
 *
 * ```text
 *   Input colors:   [c0, c1, c2, c3]
 *
 *   Float32 output: [r0, g0, b0, a0, r1, g1, b1, a1, r2, ...]
 *                    ^--------------^  ^--------------^
 *                         color 0           color 1
 *
 *   Byte output:    [R0, G0, B0, A0, R1, G1, B1, A1, R2, ...]
 *                    ^--------------^  ^--------------^
 *                     0 to 255 each     0 to 255 each
 * ```
 *
 * @author MathAid
 */

import { type ColorValue, convert, make } from './convert';
import { type ColorSpaceDef } from './space';

// -----------------------------------------------------------------
//  Float32
// -----------------------------------------------------------------

/**
 * @summary
 * Pack an array of colors into a `Float32Array`.
 *
 * @description
 * The function writes four floats per color. The order is R, G, B, A.
 * The values are copied as-is. No clamping and no scaling.
 *
 * The array length is `colors.length * 4`.
 *
 * @template S - The color space type.
 *
 * @param colors - The input colors.
 * @returns A `Float32Array` with interleaved RGBA.
 *
 * @example
 * const red = make(sRGB, 1, 0, 0);
 * const blue = make(sRGB, 0, 0, 1);
 * const data = toFloat32Array([red, blue]);
 * // data is [1, 0, 0, 1, 0, 0, 1, 1]
 */
export function toFloat32Array<S extends ColorSpaceDef<string>>(
  colors: ReadonlyArray<ColorValue<S>>,
): Float32Array {
  const out = new Float32Array(colors.length * 4);
  for (let i = 0; i < colors.length; i++) {
    const c = colors[i]!;
    const o = i * 4;
    out[o] = c.r;
    out[o + 1] = c.g;
    out[o + 2] = c.b;
    out[o + 3] = c.a;
  }
  return out;
}

/**
 * @summary
 * Unpack a `Float32Array` into an array of colors.
 *
 * @description
 * The function reads four floats per color. The order is R, G, B, A.
 * The input length must be a multiple of 4.
 *
 * @template S - The target color space type.
 *
 * @param data - The input `Float32Array`.
 * @param space - The color space for every output color.
 * @returns A frozen array of `ColorValue<S>`.
 *
 * @throws {Error} When the data length is not a multiple of 4.
 *
 * @example
 * const data = new Float32Array([1, 0, 0, 1, 0, 0, 1, 1]);
 * const colors = fromFloat32Array(data, sRGB);
 * // colors[0] is red. colors[1] is blue.
 */
export function fromFloat32Array<S extends ColorSpaceDef<string>>(
  data: Float32Array,
  space: S,
): ReadonlyArray<ColorValue<S>> {
  if (data.length % 4 !== 0) {
    throw new Error(
      `fromFloat32Array: data length must be a multiple of 4, got ${data.length}.`,
    );
  }
  const count = data.length / 4;
  const out: ColorValue<S>[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    out[i] = make(space, data[o]!, data[o + 1]!, data[o + 2]!, data[o + 3]!);
  }
  return out;
}

// -----------------------------------------------------------------
//  Uint8
// -----------------------------------------------------------------

/**
 * @summary
 * Pack an array of colors into a `Uint8Array`.
 *
 * @description
 * The function writes four bytes per color. The order is R, G, B, A.
 * Values are clamped to 0 to 1. Then they are scaled to 0 to 255 with
 * `Math.round`.
 *
 * Rounding gives better precision than truncation. The bias is under
 * half a step and is invisible for 8-bit output.
 *
 * @template S - The color space type.
 *
 * @param colors - The input colors.
 * @returns A `Uint8Array` with interleaved RGBA bytes.
 *
 * @example
 * const red = make(sRGB, 1, 0, 0);
 * const data = toUint8Array([red]);
 * // data is Uint8Array [255, 0, 0, 255]
 */
export function toUint8Array<S extends ColorSpaceDef<string>>(
  colors: ReadonlyArray<ColorValue<S>>,
): Uint8Array {
  const out = new Uint8Array(colors.length * 4);
  for (let i = 0; i < colors.length; i++) {
    const c = colors[i]!;
    const o = i * 4;
    out[o] = toByte(c.r);
    out[o + 1] = toByte(c.g);
    out[o + 2] = toByte(c.b);
    out[o + 3] = toByte(c.a);
  }
  return out;
}

/**
 * @summary
 * Unpack a `Uint8Array` into an array of colors.
 *
 * @description
 * The function reads four bytes per color. The order is R, G, B, A.
 * Each byte is divided by 255 to give a 0 to 1 value. The input length
 * must be a multiple of 4.
 *
 * @template S - The target color space type.
 *
 * @param data - The input `Uint8Array`.
 * @param space - The color space for every output color.
 * @returns A frozen array of `ColorValue<S>`.
 *
 * @throws {Error} When the data length is not a multiple of 4.
 *
 * @example
 * const data = new Uint8Array([255, 0, 0, 255]);
 * const colors = fromUint8Array(data, sRGB);
 * // colors[0] is red.
 */
export function fromUint8Array<S extends ColorSpaceDef<string>>(
  data: Uint8Array,
  space: S,
): ReadonlyArray<ColorValue<S>> {
  if (data.length % 4 !== 0) {
    throw new Error(
      `fromUint8Array: data length must be a multiple of 4, got ${data.length}.`,
    );
  }
  const count = data.length / 4;
  const out: ColorValue<S>[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    out[i] = make(
      space,
      data[o]! / 255,
      data[o + 1]! / 255,
      data[o + 2]! / 255,
      data[o + 3]! / 255,
    );
  }
  return out;
}

/**
 * @summary
 * Convert a 0 to 1 float into a 0 to 255 byte.
 *
 * @description
 * The function clamps the input to 0 to 1. It multiplies by 255. It
 * rounds to the nearest integer.
 *
 * @param v - The input value.
 * @returns The byte value, 0 to 255.
 */
function toByte(v: number): number {
  const c = v < 0 ? 0 : v > 1 ? 1 : v;
  return Math.round(c * 255);
}

// -----------------------------------------------------------------
//  Batch conversion
// -----------------------------------------------------------------

/**
 * @summary
 * Convert an array of colors from a source space to a target space.
 *
 * @description
 * The function is the same as calling `convert` in a loop. It is
 * faster because it hoists the matrix and transfer lookups out of the
 * loop. The per-color work is a matrix multiply and a few function
 * calls.
 *
 * The output array is a new array. The inputs are not changed.
 *
 * @template Src - The source color space type.
 * @template Dst - The target color space type.
 *
 * @param colors - The source colors.
 * @param dst - The destination space.
 * @returns A new array of `ColorValue<Dst>`.
 *
 * @example
 * const encoded = [make(sRGB, 0.5, 0.2, 0.8)];
 * const linear = convertBatch(encoded, Linear_sRGB);
 * // linear[0] has the same color in linear space.
 */
export function convertBatch<
  Src extends ColorSpaceDef<string>,
  Dst extends ColorSpaceDef<string>,
>(colors: ReadonlyArray<ColorValue<Src>>, dst: Dst): ReadonlyArray<ColorValue<Dst>> {
  const out: ColorValue<Dst>[] = new Array(colors.length);
  for (let i = 0; i < colors.length; i++) {
    out[i] = convert(colors[i]!, dst);
  }
  return out;
}