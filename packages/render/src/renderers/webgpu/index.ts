/**
 * @fileoverview
 * @summary WebGPU shader sources and helpers.
 *
 * @description
 * Re-exports the WGSL sources. The pipeline creation lives in the
 * WebGPU renderer file. Splitting shaders from pipelines keeps the WGSL
 * text in one place.
 * Re-exports the shader sources and the pixel readback helper.
 *
 * @example
 * Example 1: Import the sources
 * ```ts
 * import { SOLID_SHADER, TEXTURED_SHADER } from './renderer/webgpu';
 * ```
*
 * @see {@linkcode SOLID_SHADER}
 * @see {@linkcode TEXTURED_SHADER}
 * @see {@linkcode readTexturePixels}
 * @author MathAid
 */

export * from './capture';
export * from './shaders';

