
/**
 * @fileoverview
 * @summary The shim binding barrel.
 *
 * @description
 * Re-exports the ABI declarations, the error types, the handle
 * wrappers, and the loader.
 *
 * ```text
 *   shim/
 *     api.ts       enums, structs, function names
 *     errors.ts    GfxError, throwForResult
 *     handles.ts   DeviceHandle, BufferHandle, PipelineHandle
 *     binding.ts   loadBinding, GfxBinding
 *     index.ts     this file
 * ```
 *
 * @example
 * Example 1: Load and use
 * ```ts
 * import { loadBinding, GfxApi } from './renderer/shim';
 * const binding = loadBinding();
 * const device = binding.createDevice(GfxApi.OpenGL, null);
 * ```
 *
 * @see {@linkcode loadBinding}
 * @author MathAid
 */

export * from './api';
export * from './binding';
export * from './errors';
export * from './handles';
