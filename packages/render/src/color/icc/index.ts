/**
 * @fileoverview ICC profile reader.
 *
 * @summary
 * Re-exports the parser, the profile types, and the transform
 * helpers.
 *
 * @description
 * Import from this barrel to read ICC profiles and to apply them to
 * colors. The reader supports ICC v2 and v4 matrix or TRC profiles.
 * LUT-based profiles throw a clear error.
 *
 * @example
 * import { applyProfile, parseICC } from './index.js';
 * import { make, sRGB } from '../index.js';
 *
 * const bytes = await fetch('./display.icc').then(r => r.arrayBuffer());
 * const profile = parseICC(bytes);
 * const xyz = applyProfile(make(sRGB, 1, 0, 0), profile);
 *
 * @author MathAid
 */

export * from './parser';
export * from './profile';
export * from './transforms';
