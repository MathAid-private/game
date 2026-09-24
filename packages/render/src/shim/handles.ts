/**
 * @fileoverview
 * @summary Opaque handle wrappers for the C ABI.
 *
 * @description
 * Provides {@linkcode DeviceHandle}, {@linkcode BufferHandle}, and
 * {@linkcode PipelineHandle}. Each wrapper holds a raw C pointer and a
 * `disposed` flag. The wrapper exposes a `dispose` method that calls the
 * matching C destroy function. A second `dispose` call is a no-op.
 *
 * ```text
 *   DeviceHandle           wraps gfx_device*
 *     +-- .raw             the raw pointer
 *     +-- .dispose()       calls gfx_destroy_device
 *
 *   BufferHandle           wraps gfx_buffer*
 *     +-- .raw             the raw pointer
 *     +-- .device          the owning device
 *     +-- .dispose()       calls gfx_destroy_buffer
 *
 *   PipelineHandle         wraps gfx_pipeline*
 *     +-- .raw             the raw pointer
 *     +-- .device          the owning device
 *     +-- .dispose()       calls gfx_destroy_pipeline
 * ```
 *
 * The wrapper pattern exists so callers do not have to track
 * `destroy` calls by hand. A handle is a small object with a lifecycle.
 * The binding layer's `dispose` on the device destroys every buffer and
 * pipeline the device still owns.
 *
 * @example
 * Example 1: Dispose a buffer
 * ```ts
 * const buf = binding.createBuffer(device, data, 'vertex');
 * // ... use buf ...
 * buf.dispose();
 * ```
 *
 * @example 2: Dispose a device
 * ```ts
 * const device = binding.createDevice(GfxApi.OpenGL, null);
 * // ... use the device ...
 * device.dispose();
 * ```
 *
 * @see {@linkcode GfxDeviceHandle}
 * @author MathAid
 */

import { type GfxBufferHandle, type GfxDeviceHandle, type GfxPipelineHandle } from './api';

/**
 * @summary A raw device pointer and its dispose method.
 *
 * @description
 * The wrapper does not allocate. It stores the pointer the C shim
 * returned. The `dispose` method calls the destroy function through a
 * callback the binding layer provides at construction time.
 *
 * @example
 * Example 1: Wrap a device pointer
 * ```ts
 * const handle = new DeviceHandle(rawPtr, (p) => shim.gfx_destroy_device(p));
 * handle.raw; // the pointer
 * ```
 *
 * @example 2: Dispose
 * ```ts
 * handle.dispose();
 * handle.disposed; // true
 * ```
 *
 * @see {@linkcode GfxDeviceHandle}
 * @author MathAid
 */
export class DeviceHandle {
  /** The raw C pointer. */
  readonly raw: GfxDeviceHandle;

  /** True after `dispose` has been called. */
  disposed = false;

  readonly #destroy: (raw: GfxDeviceHandle) => void;

  /** @internal */
  constructor(raw: GfxDeviceHandle, destroy: (raw: GfxDeviceHandle) => void) {
    this.raw = raw;
    this.#destroy = destroy;
  }

  /**
   * @summary Destroy the device.
   *
   * @description
   * Calls the C destroy function once. A second call is a no-op.
   * Any buffer or pipeline the device still owns is not destroyed
   * automatically. The caller disposes those first when precise
   * lifetimes matter.
   *
   * @example
   * Example 1: Dispose in a finally block
   * ```ts
   * try {
   *   // ... use device ...
   * } finally {
   *   device.dispose();
   * }
   * ```
   *
   * @returns {void}
   * @author MathAid
   */
  dispose(): void {
    if (this.disposed) return;
    this.#destroy(this.raw);
    this.disposed = true;
  }
}

/**
 * @summary A raw buffer pointer and its dispose method.
 *
 * @see {@linkcode DeviceHandle}
 * @author MathAid
 */
export class BufferHandle {
  /** The raw C pointer. */
  readonly raw: GfxBufferHandle;

  /** True after `dispose` has been called. */
  disposed = false;

  readonly #destroy: (raw: GfxBufferHandle) => void;

  /** @internal */
  constructor(raw: GfxBufferHandle, destroy: (raw: GfxBufferHandle) => void) {
    this.raw = raw;
    this.#destroy = destroy;
  }

  /**
   * @summary Destroy the buffer.
   *
   * @description
   * Calls the C destroy function once. A second call is a no-op.
   *
   * @returns {void}
   * @author MathAid
   */
  dispose(): void {
    if (this.disposed) return;
    this.#destroy(this.raw);
    this.disposed = true;
  }
}

/**
 * @summary A raw pipeline pointer and its dispose method.
 *
 * @see {@linkcode DeviceHandle}
 * @author MathAid
 */
export class PipelineHandle {
  /** The raw C pointer. */
  readonly raw: GfxPipelineHandle;

  /** True after `dispose` has been called. */
  disposed = false;

  readonly #destroy: (raw: GfxPipelineHandle) => void;

  /** @internal */
  constructor(raw: GfxPipelineHandle, destroy: (raw: GfxPipelineHandle) => void) {
    this.raw = raw;
    this.#destroy = destroy;
  }

  /**
   * @summary Destroy the pipeline.
   *
   * @description
   * Calls the C destroy function once. A second call is a no-op.
   *
   * @returns {void}
   * @author MathAid
   */
  dispose(): void {
    if (this.disposed) return;
    this.#destroy(this.raw);
    this.disposed = true;
  }
}
