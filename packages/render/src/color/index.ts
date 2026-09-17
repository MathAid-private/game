/**
 * @fileoverview Public entry point. Re-exports every module.
 *
 * @summary
 * Re-exports the backend adapters, the conversion engine, the gamut
 * mapping functions, the color space type system, the Milestone 1
 * extensions, and the Milestone 2 GPU bridge.
 *
 * @description
 * Import from this file to get the full public API. The named exports
 * come from these modules:
 *
 * ```text
 *   backend.ts        Backend adapters for five graphics APIs.
 *   convert.ts        ColorValue, convert, and helpers.
 *   gamut-mapping.ts  Gamut checking and mapping.
 *   space.ts          Color space definitions and descriptors.
 *   mutable.ts        MutableColor and the converters.
 *   accessibility.ts  Luminance, contrast, and text helpers.
 *   difference.ts     Delta-E metrics.
 *   operations.ts     Lighten, darken, saturate, and friends.
 *   composite.ts      Alpha compositing.
 *   bridge.ts         Typed-array bridge.
 *   packed.ts         Packed integer formats.
 *   gradient/         Linear, radial, multi, and pattern rasters.
 * ```
 *
 * @example
 * import {
 *   make, convert, mapToGamut, format,
 *   sRGB, Display_P3, DX12,
 *   lighten, over, contrast, deltaEOK,
 *   toFloat32Array, toRgb565,
 *   sampleLinear, type LinearGradient,
 * } from './index.js';
 *
 * @author MathAid
 */

export * from './accessibility';
export * from './backend';
export * from './bridge';
export * from './composite';
export * from './convert';
export * from './difference';
export * from './gamut-mapping';
export * from './gradient';
export * from './mutable';
export * from './operations';
export * from './packed';
export * from './space';
