/**
 * @fileoverview
 * @summary WebGPU pixel readback helper.
 *
 * @description
 * Provides {@linkcode readTexturePixels}, the function that copies a
 * region of a GPU canvas texture to a `Uint8Array`. The function handles
 * the WebGPU bytes-per-row alignment rule. A texture-to-buffer copy
 * requires the source row pitch to be a multiple of 256. The function
 * copies into a padded buffer and then repacks into a tight buffer.
 *
 * ```text
 *   Source texture (region)         Padded buffer           Tight output
 *   ----------------------          -------------           ------------
 *   [row 0: W * 4 bytes]            [row 0: P bytes]        [row 0: W * 4]
 *   [row 1: W * 4 bytes]    -->     [row 1: P bytes]  -->   [row 1: W * 4]
 *   [row 2: W * 4 bytes]            [row 2: P bytes]        [row 2: W * 4]
 *
 *   P = ceil(W * 4 / 256) * 256
 * ```
 *
 * The copy is asynchronous. It submits a command buffer, awaits
 * `mapAsync`, reads the mapped range, and unmaps. The buffer is
 * destroyed at the end. The function is safe to call once per frame.
 *
 * @example
 * Example 1: Read a region
 * ```ts
 * import { readTexturePixels } from './capture';
 *
 * const bytes = await readTexturePixels(device, texture, {
 *   x: 0, y: 0, width: 100, height: 100,
 * });
 * // bytes.length === 100 * 100 * 4
 * ```
 *
 * @example 2: Read a full canvas texture
 * ```ts
 * const texture = context.getCurrentTexture();
 * const bytes = await readTexturePixels(device, texture, {
 *   x: 0, y: 0, width: texture.width, height: texture.height,
 * });
 * ```
 *
 * @see {@linkcode WebGPURenderer.captureAsync}
 * @author MathAid
 */

/**
 * @summary A rectangular region of a texture.
 *
 * @description
 * The fields match the coordinate space of the source texture. The
 * origin is the top-left corner. The width and height are in pixels.
 *
 * @example
 * Example 1: A quadrant
 * ```ts
 * const region: TextureRegion = { x: 0, y: 0, width: 100, height: 100 };
 * ```
 *
 * @author MathAid
 */
export interface TextureRegion {
  /** The left edge of the region. */
  readonly x: number;
  /** The top edge of the region. */
  readonly y: number;
  /** The region width. */
  readonly width: number;
  /** The region height. */
  readonly height: number;
}

/**
 * @summary Read the pixels of a texture region into a `Uint8Array`.
 *
 * @description
 * Copies the region to a GPU buffer, maps the buffer for reading, and
 * returns the bytes. The output layout is RGBA8 with no padding. The
 * buffer is destroyed before the function returns.
 *
 * The `format` argument names the texture's pixel format. Only
 * `'rgba8unorm'` and `'bgra8unorm'` are supported. A `'bgra8unorm'`
 * texture is byte-swapped during the repack step so the output is
 * always RGBA.
 *
 * @example
 * Example 1: Read a 100 by 100 region
 * ```ts
 * const bytes = await readTexturePixels(device, texture, {
 *   x: 0, y: 0, width: 100, height: 100,
 * }, 'bgra8unorm');
 * bytes.length; // 40000
 * ```
 *
 * @example 2: Read a single pixel
 * ```ts
 * const bytes = await readTexturePixels(device, texture, {
 *   x: 10, y: 10, width: 1, height: 1,
 * });
 * ```
 *
 * @param {GPUDevice} device The WebGPU device.
 * @param {GPUTexture} texture The source texture.
 * @param {TextureRegion} region The region to read.
 * @param {GPUTextureFormat} [format] The texture format. Defaults to
 * `'rgba8unorm'`.
 * @returns {Promise<Uint8Array>} The RGBA8 bytes.
 * @throws {Error} When the format is unsupported or the region is empty.
 * @author MathAid
 */
export async function readTexturePixels(
  device: GPUDevice,
  texture: GPUTexture,
  region: TextureRegion,
  format: GPUTextureFormat = 'rgba8unorm',
): Promise<Uint8Array> {
  if (region.width <= 0 || region.height <= 0) {
    throw new Error(
      `readTexturePixels: region must have positive width and height, got ${region.width}x${region.height}.`,
    );
  }
  if (format !== 'rgba8unorm' && format !== 'bgra8unorm') {
    throw new Error(
      `readTexturePixels: unsupported format "${format}". Expected "rgba8unorm" or "bgra8unorm".`,
    );
  }

  // WebGPU requires the source row pitch to be a multiple of 256.
  const bytesPerRow = region.width * 4;
  const paddedBytesPerRow = Math.ceil(bytesPerRow / 256) * 256;
  const bufferSize = paddedBytesPerRow * region.height;

  const readBuffer = device.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  const encoder = device.createCommandEncoder();
  encoder.copyTextureToBuffer(
    { texture, origin: { x: region.x, y: region.y, z: 0 } },
    { buffer: readBuffer, bytesPerRow: paddedBytesPerRow, rowsPerImage: region.height },
    { width: region.width, height: region.height, depthOrArrayLayers: 1 },
  );
  device.queue.submit([encoder.finish()]);

  await readBuffer.mapAsync(GPUMapMode.READ);
  const mapped = new Uint8Array(readBuffer.getMappedRange());
  const tight = repack(mapped, region.width, region.height, paddedBytesPerRow, format === 'bgra8unorm');
  readBuffer.unmap();
  readBuffer.destroy();
  return tight;
}

function repack(
  source: Uint8Array,
  width: number,
  height: number,
  paddedBytesPerRow: number,
  swapRB: boolean,
): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  const tightBytesPerRow = width * 4;
  if (!swapRB) {
    for (let y = 0; y < height; y++) {
      const srcOff = y * paddedBytesPerRow;
      const dstOff = y * tightBytesPerRow;
      out.set(source.subarray(srcOff, srcOff + tightBytesPerRow), dstOff);
    }
    return out;
  }
  for (let y = 0; y < height; y++) {
    const srcOff = y * paddedBytesPerRow;
    const dstOff = y * tightBytesPerRow;
    for (let x = 0; x < width; x++) {
      const s = srcOff + x * 4;
      const d = dstOff + x * 4;
      out[d] = source[s + 2]!;
      out[d + 1] = source[s + 1]!;
      out[d + 2] = source[s]!;
      out[d + 3] = source[s + 3]!;
    }
  }
  return out;
}