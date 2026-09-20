/**
 * @fileoverview Serialization barrel.
 *
 * @summary
 * Re-exports the JSON and MessagePack encoders, the palette and
 * gradient packers, and the type definitions.
 *
 * @description
 * Import from this barrel to serialize palettes and gradients. Use
 * `toJSON` and `fromJSON` for human-readable data. Use `toMsgPack`
 * and `fromMsgPack` for compact binary data.
 *
 * @example
 * import {
 *   toJSON, fromJSON,
 *   packPalette, unpackPalette,
 * } from './serialize/index.js';
 * import { make, sRGB } from '../index.js';
 *
 * const palette = packPalette([make(sRGB, 1, 0, 0), make(sRGB, 0, 0, 1)]);
 * const text = toJSON(palette);
 * const back = unpackPalette(fromJSON(text));
 *
 * @author MathAid
 */

export * from './gradient';
export * from './json';
export * from './msgpack';
export * from './palette';
export * from './types';
