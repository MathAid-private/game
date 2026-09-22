/**
 * @fileoverview WASM batch conversion entry point.
 *
 * @summary
 * Provides `convertBatchSIMD`. The function uses the WASM path when
 * available and falls back to the JS path otherwise.
 *
 * @description
 * The WASM path is a future optimization. The current module only
 * exposes the fallback. The interface is stable so the WASM path can
 * land later without a breaking change.
 *
 * ```text
 *   convertBatchSIMD:
 *     if WASM available  ->  wasm path
 *     else               ->  convertBatchFast
 * ```
 *
 * The `wasmReady` flag reports whether the WASM path is active. It is
 * false in this version.
 *
 * @author MathAid
 */

import { type ColorValue } from '../convert';
import { type ColorSpaceDef } from '../space';
import { convertBatchFast } from './fallback';

/**
 * @summary
 * True when the WASM SIMD path is loaded and ready.
 *
 * @description
 * This version always returns `false`. When the WASM path lands, the
 * value reflects runtime support detection.
 */
export const wasmReady = false;

/**
 * @summary
 * Convert an array of colors with the fastest available path.
 *
 * @description
 * The function dispatches to the WASM path when `wasmReady` is true.
 * Otherwise it calls `convertBatchFast`. The result is identical in
 * either case.
 *
 * @template Src - The source color space type.
 * @template Dst - The destination color space type.
 *
 * @param colors - The source colors.
 * @param dst - The destination space.
 * @returns A new array of `ColorValue<Dst>`.
 *
 * @example
 * const out = convertBatchSIMD(encodedColors, Linear_sRGB);
 */
export function convertBatchSIMD<
  Src extends ColorSpaceDef<string>,
  Dst extends ColorSpaceDef<string>,
>(colors: ReadonlyArray<ColorValue<Src>>, dst: Dst): ReadonlyArray<ColorValue<Dst>> {
  if (wasmReady) {
    // The WASM path is a future addition. When it lands, add the
    // dispatch here. The interface does not change.
    return convertBatchFast(colors, dst);
  }
  return convertBatchFast(colors, dst);
}

export { convertBatchFast } from './fallback';
