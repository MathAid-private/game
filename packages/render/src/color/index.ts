/**
 * @fileoverview Public entry point. Re-exports every module.
 *
 * @summary
 * Re-exports the backend adapters, the conversion engine, the gamut
 * mapping functions, and the color space type system.
 *
 * @description
 * Import from this file to get the full public API. The named exports
 * come from four modules:
 *
 *   backend.ts        Backend adapters for five graphics APIs.
 *   convert.ts        ColorValue, convert, and helpers.
 *   gamut-mapping.ts  Gamut checking and mapping.
 *   space.ts          Color space definitions and descriptors.
 *
 * @example
 * import { make, convert, mapToGamut, sRGB, Display_P3, DX12 } from './index.js';
 *
 * const wide = make(Display_P3, 0.0, 0.9, 0.5);
 * const safe = mapToGamut(wide, sRGB);
 * const clear = DX12.clearColor(safe);
 *
 * @author MathAid
 */

export * from './backend';
export * from './convert';
export * from './gamut-mapping';
export * from './space';
