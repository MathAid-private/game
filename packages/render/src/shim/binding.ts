/**
 * @fileoverview
 * @summary The koffi-based FFI binding for the C ABI.
 *
 * @description
 * Loads a shared library that implements `shims/gfx.h` and exposes a
 * typed TypeScript API. The library path is resolved from the platform.
 * The binding layer checks the ABI version, loads every symbol, and
 * exposes the twelve functions in the header.
 *
 * The binding is synchronous. Every function blocks the calling thread
 * for the duration of the C call. The C calls are cheap except for
 * `gfx_read_pixels`, which copies the framebuffer.
 *
 * ```text
 *   loadBinding()
 *     +-- resolve the library path
 *     +-- koffi.load(path)
 *     +-- check gfx_get_version
 *     +-- bind every function name
 *     +-- return GfxBinding
 * ```
 *
 * @example
 * Example 1: Load the binding
 * ```ts
 * import { loadBinding, GfxApi } from './binding';
 *
 * const binding = loadBinding();
 * const device = binding.createDevice(GfxApi.OpenGL, null);
 * ```
 *
 * @example 2: Create a buffer and a pipeline
 * ```ts
 * const vbuf = binding.createBuffer(device, verts, 'vertex');
 * const ibuf = binding.createBuffer(device, indices, 'index');
 * const pipeline = binding.createPipeline(device, VS_SRC, FS_SRC);
 * ```
 *
 * @see {@linkcode GfxBinding}
 * @author MathAid
 */

import * as koffi from 'koffi';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  EXPECTED_ABI_VERSION,
  GfxApi,
  GfxResult,
  type GfxCapabilities
} from './api';
import { throwForResult } from './errors';
import { BufferHandle, DeviceHandle, PipelineHandle } from './handles';

/**
 * @summary The typed surface the binding exposes.
 *
 * @description
 * Every method maps to one C function. Every method returns a value or
 * a handle. Errors throw as {@linkcode GfxError}.
 *
 * @example
 * Example 1: Use the binding
 * ```ts
 * const binding = loadBinding();
 * const device = binding.createDevice(GfxApi.OpenGL, null);
 * const caps = binding.getCapabilities(device);
 * device.dispose();
 * ```
 *
 * @example 2: Draw a triangle
 * ```ts
 * binding.beginFrame(device, [0, 0, 0, 1]);
 * binding.draw(device, pipeline, vbuf, ibuf, uniform);
 * binding.endFrame(device);
 * binding.present(device);
 * ```
 *
 * @see {@linkcode loadBinding}
 * @author MathAid
 */
export interface GfxBinding {
  /** The raw koffi library object. For debugging. */
  readonly raw: koffi.IKoffiLib;

  /** Return the ABI version of the loaded shim. */
  getVersion(): number;

  /** Create a device. */
  createDevice(api: GfxApi, native: unknown | null): DeviceHandle;

  /** Query the capabilities of a device. */
  getCapabilities(device: DeviceHandle): GfxCapabilities;

  /** Create a buffer. */
  createBuffer(device: DeviceHandle, data: Uint8Array, usage: 'vertex' | 'index'): BufferHandle;

  /** Create a pipeline from GLSL source. */
  createPipeline(device: DeviceHandle, vsSrc: string, fsSrc: string): PipelineHandle;

  /** Begin a frame. */
  beginFrame(
    device: DeviceHandle,
    clearColor: readonly [number, number, number, number] | null,
  ): void;

  /** Draw indexed geometry. */
  draw(
    device: DeviceHandle,
    pipeline: PipelineHandle,
    vertices: BufferHandle,
    indices: BufferHandle,
    uniform: Float32Array,
  ): void;

  /** End the current frame. */
  endFrame(device: DeviceHandle): void;

  /** Present the frame. */
  present(device: DeviceHandle): void;

  /** Read pixels from the current frame. */
  readPixels(
    device: DeviceHandle,
    x: number,
    y: number,
    width: number,
    height: number,
    out: Uint8Array,
  ): void;
}

/**
 * @summary Load the platform library for the shim.
 *
 * @description
 * The library name is `gfx_<api>`. The extension is platform-specific.
 * The function searches three locations:
 *
 * 1. The path given by the `GFX_SHIM_PATH` environment variable.
 * 2. The `shims/build/<api>/` directory next to the package.
 * 3. The system library path.
 *
 * The first location that exists wins. A caller that ships its own
 * build of a shim sets `GFX_SHIM_PATH` to the absolute path.
 *
 * @example
 * Example 1: Load the OpenGL shim
 * ```ts
 * const binding = loadBinding('opengl');
 * ```
 *
 * @example 2: Load a specific file
 * ```ts
 * process.env.GFX_SHIM_PATH = '/opt/gfx/libgfx_opengl.so';
 * const binding = loadBinding('opengl');
 * ```
 *
 * @param {string} api The shim API name: `'opengl'`, `'vulkan'`, `'dx12'`, or `'metal'`.
 * @returns {GfxBinding} The binding.
 * @throws {Error} When the library cannot be found or the ABI does not match.
 * @author MathAid
 */
export function loadBinding(api: 'opengl' | 'vulkan' | 'dx12' | 'metal' = 'opengl'): GfxBinding {
  const path = resolveLibraryPath(api);
  const lib = koffi.load(path);
  return makeBinding(lib);
}

function resolveLibraryPath(api: string): string {
  const envPath = process.env['GFX_SHIM_PATH'];
  if (envPath && existsSync(envPath)) return envPath;

  const ext =
    process.platform === 'win32' ? '.dll' : process.platform === 'darwin' ? '.dylib' : '.so';
  const name = `gfx_${api}${ext}`;

  const candidates = [
    resolve(__dirname, '..', '..', '..', 'shims', 'build', api, name),
    resolve(__dirname, '..', '..', '..', '..', 'shims', 'build', api, name),
    name,
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return name;
}

function makeBinding(lib: koffi.IKoffiLib): GfxBinding {
  // Declare every function. koffi reads the C signature from the
  // declaration and caches the function pointer.
  const gfx_get_version = lib.func('uint32 gfx_get_version()');
  const gfx_create_device = lib.func('int gfx_create_device(int api, void* native, void** out)');
  const gfx_destroy_device = lib.func('void gfx_destroy_device(void* device)');
  const gfx_get_capabilities = lib.func(
    'int gfx_get_capabilities(void* device, _Out_ GfxCapabilities* out)',
    {
      GfxCapabilities: koffi.struct('GfxCapabilities', {
        supportsCompute: 'int32',
        supportsGeometryShaders: 'int32',
        supportsCapture: 'int32',
        maxTextureSize: 'int32',
        maxVertexCount: 'int32',
        maxIndexCount: 'int32',
      }),
    },
  );
  const gfx_create_buffer = lib.func(
    'int gfx_create_buffer(void* device, const void* data, size_t size, int is_index, void** out)',
  );
  const gfx_destroy_buffer = lib.func('void gfx_destroy_buffer(void* buffer)');
  const gfx_create_pipeline = lib.func(
    'int gfx_create_pipeline(void* device, const char* vs, const char* fs, void** out)',
  );
  const gfx_destroy_pipeline = lib.func('void gfx_destroy_pipeline(void* pipeline)');
  const gfx_begin_frame = lib.func('int gfx_begin_frame(void* device, const float* clear_color)');
  const gfx_draw = lib.func(
    'int gfx_draw(void* device, void* pipeline, void* vertices, void* indices, const float* uniform)',
  );
  const gfx_end_frame = lib.func('int gfx_end_frame(void* device)');
  const gfx_present = lib.func('int gfx_present(void* device)');
  const gfx_read_pixels = lib.func(
    'int gfx_read_pixels(void* device, int x, int y, int w, int h, void* out)',
  );

  const version = gfx_get_version() as number;
  if (version !== EXPECTED_ABI_VERSION) {
    throw new Error(
      `gfx binding: ABI version mismatch. Expected 0x${EXPECTED_ABI_VERSION.toString(16)}, got 0x${version.toString(16)}.`,
    );
  }

  return {
    raw: lib,

    getVersion(): number {
      return gfx_get_version() as number;
    },

    createDevice(api: GfxApi, native: unknown | null): DeviceHandle {
      const out: [unknown] = [null];
      const result = gfx_create_device(api, native, out) as GfxResult;
      throwForResult(result, 'gfx_create_device');
      return new DeviceHandle(out[0], (raw) => {
        gfx_destroy_device(raw);
      });
    },

    getCapabilities(device: DeviceHandle): GfxCapabilities {
      const out: [GfxCapabilities] = [
        {
          supportsCompute: 0,
          supportsGeometryShaders: 0,
          supportsCapture: 0,
          maxTextureSize: 0,
          maxVertexCount: 0,
          maxIndexCount: 0,
        },
      ];
      const result = gfx_get_capabilities(device.raw, out) as GfxResult;
      throwForResult(result, 'gfx_get_capabilities');
      return out[0];
    },

    createBuffer(device: DeviceHandle, data: Uint8Array, usage: 'vertex' | 'index'): BufferHandle {
      const out: [unknown] = [null];
      const result = gfx_create_buffer(
        device.raw,
        data,
        data.byteLength,
        usage === 'index' ? 1 : 0,
        out,
      ) as GfxResult;
      throwForResult(result, 'gfx_create_buffer');
      return new BufferHandle(out[0], (raw) => {
        gfx_destroy_buffer(raw);
      });
    },

    createPipeline(device: DeviceHandle, vsSrc: string, fsSrc: string): PipelineHandle {
      const out: [unknown] = [null];
      const result = gfx_create_pipeline(device.raw, vsSrc, fsSrc, out) as GfxResult;
      throwForResult(result, 'gfx_create_pipeline');
      return new PipelineHandle(out[0], (raw) => {
        gfx_destroy_pipeline(raw);
      });
    },

    beginFrame(
      device: DeviceHandle,
      clearColor: readonly [number, number, number, number] | null,
    ): void {
      const arr = clearColor === null ? null : new Float32Array(clearColor);
      const result = gfx_begin_frame(device.raw, arr) as GfxResult;
      throwForResult(result, 'gfx_begin_frame');
    },

    draw(
      device: DeviceHandle,
      pipeline: PipelineHandle,
      vertices: BufferHandle,
      indices: BufferHandle,
      uniform: Float32Array,
    ): void {
      if (uniform.length !== 20) {
        throw new Error(`gfx_draw: uniform must have 20 floats, got ${uniform.length}.`);
      }
      const result = gfx_draw(
        device.raw,
        pipeline.raw,
        vertices.raw,
        indices.raw,
        uniform,
      ) as GfxResult;
      throwForResult(result, 'gfx_draw');
    },

    endFrame(device: DeviceHandle): void {
      const result = gfx_end_frame(device.raw) as GfxResult;
      throwForResult(result, 'gfx_end_frame');
    },

    present(device: DeviceHandle): void {
      const result = gfx_present(device.raw) as GfxResult;
      throwForResult(result, 'gfx_present');
    },

    readPixels(
      device: DeviceHandle,
      x: number,
      y: number,
      width: number,
      height: number,
      out: Uint8Array,
    ): void {
      const expected = width * height * 4;
      if (out.byteLength < expected) {
        throw new Error(
          `gfx_read_pixels: output buffer too small. Expected ${expected}, got ${out.byteLength}.`,
        );
      }
      const result = gfx_read_pixels(device.raw, x, y, width, height, out) as GfxResult;
      throwForResult(result, 'gfx_read_pixels');
    },
  };
}
