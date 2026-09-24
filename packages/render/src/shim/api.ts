/**
 * @fileoverview
 * @summary TypeScript declarations for the C ABI in `shims/gfx.h`.
 *
 * @description
 * Mirrors the C header. Every enum, struct, and function signature has
 * a TypeScript equivalent. The binding layer in `binding.ts` uses these
 * declarations to load and call the shared library.
 *
 * The declarations are hand-written. A future milestone can generate
 * them from the header with a small script. Hand-written is fine for
 * now because the ABI changes rarely.
 *
 * ```text
 *   C type                    TypeScript type
 *   --------------------      ------------------
 *   gfx_result (enum)         GfxResult (enum)
 *   gfx_api (enum)            GfxApi (enum)
 *   gfx_capabilities (struct) GfxCapabilities (interface)
 *   gfx_device* (opaque)      GfxDeviceHandle (opaque)
 * ```
 *
 * @example
 * Example 1: Reference the enum values
 * ```ts
 * import { GfxApi, GfxResult } from './api';
 * GfxApi.OpenGL;   // 4
 * GfxResult.Ok;    // 0
 * ```
 *
 * @example 2: Type a capability struct
 * ```ts
 * const caps: GfxCapabilities = {
 *   supportsCompute: 0,
 *   supportsGeometryShaders: 1,
 *   supportsCapture: 1,
 *   maxTextureSize: 16384,
 *   maxVertexCount: 1 << 20,
 *   maxIndexCount: 1 << 22,
 * };
 * ```
 *
 * @see [gfx.h](./gfx.h)
 * @author MathAid
 */

/**
 * @summary The result code returned by every ABI function.
 *
 * @description
 * Mirrors the `gfx_result` C enum. Zero is success. Every other value
 * is a failure.
 *
 * @example
 * Example 1: Check a result
 * ```ts
 * if (result !== GfxResult.Ok) throw new Error('failed');
 * ```
 *
 * @example 2: Switch on the result
 * ```ts
 * switch (result) {
 *   case GfxResult.Ok: break;
 *   case GfxResult.Unsupported: throw new Error('unsupported');
 *   default: throw new Error('gpu failure');
 * }
 * ```
 *
 * @see {@linkcode GfxApi}
 * @author MathAid
 */
export enum GfxResult {
  /** The call succeeded. */
  Ok = 0,
  /** The API is not supported by this shim. */
  Unsupported = 1,
  /** The GPU device was lost or reset. */
  DeviceLost = 2,
  /** The shim could not allocate memory. */
  OutOfMemory = 3,
  /** An argument failed validation. */
  InvalidArg = 4,
  /** An internal shim error. */
  Internal = 5,
}

/**
 * @summary The GPU API a shim targets.
 *
 * @description
 * Mirrors the `gfx_api` C enum. A shim implements exactly one API.
 *
 * @example
 * Example 1: Select an API
 * ```ts
 * const api = process.platform === 'darwin' ? GfxApi.Metal : GfxApi.OpenGL;
 * ```
 *
 * @example 2: Map a platform to an API
 * ```ts
 * const api = { win32: GfxApi.DX12, darwin: GfxApi.Metal }[process.platform];
 * ```
 *
 * @see {@linkcode GfxResult}
 * @author MathAid
 */
export enum GfxApi {
  /** DirectX 12. Windows only. */
  DX12 = 1,
  /** Vulkan. Windows, Linux, Android. */
  Vulkan = 2,
  /** Metal. macOS and iOS. */
  Metal = 3,
  /** OpenGL. All desktop platforms. */
  OpenGL = 4,
}

/**
 * @summary The advertised capabilities of a shim.
 *
 * @description
 * Mirrors the `gfx_capabilities` C struct. Every boolean is encoded as
 * a 32-bit integer. A value of 1 means the feature is available.
 *
 * @example
 * Example 1: Read the max texture size
 * ```ts
 * const caps = binding.getCapabilities(device);
 * console.log(caps.maxTextureSize);
 * ```
 *
 * @example 2: Gate a feature on a capability
 * ```ts
 * if (caps.supportsCapture !== 1) {
 *   throw new Error('this shim cannot capture');
 * }
 * ```
 *
 * @see {@linkcode GfxDeviceHandle}
 * @author MathAid
 */
export interface GfxCapabilities {
  /** 1 if compute shaders are supported. */
  readonly supportsCompute: number;
  /** 1 if geometry shaders are supported. */
  readonly supportsGeometryShaders: number;
  /** 1 if pixel capture is supported. */
  readonly supportsCapture: number;
  /** The maximum texture size on either axis. */
  readonly maxTextureSize: number;
  /** The maximum vertices per draw call. */
  readonly maxVertexCount: number;
  /** The maximum indices per draw call. */
  readonly maxIndexCount: number;
}

/** An opaque device handle. */
export type GfxDeviceHandle = unknown;

/** An opaque buffer handle. */
export type GfxBufferHandle = unknown;

/** An opaque pipeline handle. */
export type GfxPipelineHandle = unknown;

/**
 * @summary The ABI version the binding layer expects.
 *
 * @description
 * Encoded as `(major << 16) | minor`. The binding layer compares the
 * value returned by the loaded shim against this constant. A mismatch
 * fails fast at load time.
 *
 * @example
 * Example 1: Compare against the loaded shim
 * ```ts
 * import { EXPECTED_ABI_VERSION } from './api';
 * if (shimVersion !== EXPECTED_ABI_VERSION) {
 *   throw new Error('ABI mismatch');
 * }
 * ```
 *
 * @author MathAid
 */
export const EXPECTED_ABI_VERSION = (1 << 16) | 0;

/**
 * @summary The list of native function names the binding layer loads.
 *
 * @description
 * A new shim must export every name in this list. The binding layer
 * loads each by name. A missing symbol fails at load time with a
 * message that names the missing function.
 *
 * @example
 * Example 1: Iterate the names
 * ```ts
 * for (const name of GFX_FUNCTIONS) {
 *   console.log('binding loads', name);
 * }
 * ```
 *
 * @author MathAid
 */
export const GFX_FUNCTIONS = [
  'gfx_get_version',
  'gfx_create_device',
  'gfx_destroy_device',
  'gfx_get_capabilities',
  'gfx_create_buffer',
  'gfx_destroy_buffer',
  'gfx_create_pipeline',
  'gfx_destroy_pipeline',
  'gfx_begin_frame',
  'gfx_draw',
  'gfx_end_frame',
  'gfx_present',
  'gfx_read_pixels',
] as const;
