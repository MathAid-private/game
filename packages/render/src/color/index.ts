/**
 * @fileoverview Public entry point. Re-exports every module.
 *
 * @summary
 * Re-exports the backend adapters, the conversion engine, the gamut
 * mapping functions, the color space type system, and every extension
 * module across the four milestones.
 *
 * @description
 * Import from this file to get the full public API. See the README in
 * this directory for a full module map and usage examples.
 *
 * @author MathAid
 */
export * from './accessibility';
export * from './adaptation';
export * from './backend';
export * from './bridge';
export * from './cam16';
export * from './composite';
export * from './convert';
export * from './debug';
export * from './difference';
export * from './gamut-mapping';
export * from './gradient';
export * from './icc';
export * from './mutable';
export * from './operations';
export * from './packed';
export * from './quantize';
export * from './science';
export * from './serialize';
export * from './shader';
export * from './space';
export * from './tone-mapping';
export * from './w3c';
export * from './wasm';
