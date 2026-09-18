/**
 * @fileoverview Public entry point. Re-exports every module.
 *
 * @summary
 * Re-exports the backend adapters, the conversion engine, the gamut
 * mapping functions, the color space type system, the Milestone 1 and
 * 2 extensions, and the Milestone 3 authoring tools.
 *
 * @description
 * Import from this file to get the full public API. See the README in
 * this directory for a full module map.
 *
 * @example
 * import {
 *   make, convert, mapToGamut, format,
 *   sRGB, Display_P3, OKLCh, DX12,
 *   lighten, over, contrast, deltaEOK,
 *   toFloat32Array, toRgb565,
 *   sampleLinear, type LinearGradient,
 *   fromCSS, toCSS, toneMap,
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
export * from './tone-mapping';
export * from './w3c';
