/**
 * @fileoverview
 * @summary Tests for the WebGPU capture path with a mock device.
 *
 * @description
 * The mock device records every call the renderer makes during capture.
 * The tests check the command encoder submissions, the buffer size
 * calculation, and the byte-swap path for a BGRA texture.
 *
 * @see {@linkcode readTexturePixels}
 * @author MathAid
 */

import { readTexturePixels } from '@games/render';
import { describe, expect, it, vi } from 'vitest';

interface MockBuffer {
  readonly size: number;
  mapAsync: ReturnType<typeof vi.fn>;
  getMappedRange: ReturnType<typeof vi.fn>;
  unmap: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

function makeMockBuffer(size: number, fill?: Uint8Array): MockBuffer {
  const data = fill ?? new Uint8Array(size);
  return {
    size,
    mapAsync: vi.fn(async () => undefined),
    getMappedRange: vi.fn(() => data.buffer),
    unmap: vi.fn(),
    destroy: vi.fn(),
  };
}

function makeMockDevice(buffer: MockBuffer): {
  createBuffer: ReturnType<typeof vi.fn>;
  createCommandEncoder: ReturnType<typeof vi.fn>;
  queue: { submit: ReturnType<typeof vi.fn> };
} {
  return {
    createBuffer: vi.fn(() => buffer),
    createCommandEncoder: vi.fn(() => ({
      copyTextureToBuffer: vi.fn(),
      finish: vi.fn(() => ({})),
    })),
    queue: { submit: vi.fn() },
  };
}

(globalThis as Record<string, unknown>)['GPUBufferUsage'] = {
  COPY_DST: 1,
  MAP_READ: 2,
};
(globalThis as Record<string, unknown>)['GPUMapMode'] = {
  READ: 1,
};

describe('readTexturePixels', () => {
  it('returns a tight RGBA buffer for a 1x1 region', async () => {
    const paddedRow = 256;
    const buffer = makeMockBuffer(paddedRow, new Uint8Array([255, 0, 0, 255]));
    const device = makeMockDevice(buffer);
    const texture = {} as GPUTexture;

    const bytes = await readTexturePixels(
      device as unknown as GPUDevice,
      texture,
      { x: 0, y: 0, width: 1, height: 1 },
    );

    expect(bytes.length).toBe(4);
    expect(bytes[0]).toBe(255);
    expect(bytes[1]).toBe(0);
    expect(bytes[2]).toBe(0);
    expect(bytes[3]).toBe(255);
  });

  it('pads the row pitch to a multiple of 256', async () => {
    const buffer = makeMockBuffer(256);
    const device = makeMockDevice(buffer);
    const texture = {} as GPUTexture;

    await readTexturePixels(
      device as unknown as GPUDevice,
      texture,
      { x: 0, y: 0, width: 100, height: 1 },
    );

    const call = (device.createCommandEncoder as ReturnType<typeof vi.fn>).mock.results[0]!.value;
    const copy = call.copyTextureToBuffer as ReturnType<typeof vi.fn>;
    // 100 * 4 = 400. Rounded up to 512.
    expect(copy.mock.calls[0]![1].bytesPerRow).toBe(512);
  });

  it('byte-swaps a BGRA texture to RGBA', async () => {
    const paddedRow = 256;
    const source = new Uint8Array(paddedRow);
    // Pixel 0: BGRA order (blue, green, red, alpha).
    source[0] = 30;
    source[1] = 60;
    source[2] = 90;
    source[3] = 255;
    const buffer = makeMockBuffer(paddedRow, source);
    const device = makeMockDevice(buffer);
    const texture = {} as GPUTexture;

    const bytes = await readTexturePixels(
      device as unknown as GPUDevice,
      texture,
      { x: 0, y: 0, width: 1, height: 1 },
      'bgra8unorm',
    );

    expect(bytes[0]).toBe(90);
    expect(bytes[1]).toBe(60);
    expect(bytes[2]).toBe(30);
    expect(bytes[3]).toBe(255);
  });

  it('unmaps and destroys the buffer', async () => {
    const buffer = makeMockBuffer(256);
    const device = makeMockDevice(buffer);
    const texture = {} as GPUTexture;

    await readTexturePixels(
      device as unknown as GPUDevice,
      texture,
      { x: 0, y: 0, width: 1, height: 1 },
    );

    expect(buffer.unmap).toHaveBeenCalledTimes(1);
    expect(buffer.destroy).toHaveBeenCalledTimes(1);
  });

  it('throws on a zero-size region', async () => {
    const buffer = makeMockBuffer(256);
    const device = makeMockDevice(buffer);
    const texture = {} as GPUTexture;

    await expect(
      readTexturePixels(
        device as unknown as GPUDevice,
        texture,
        { x: 0, y: 0, width: 0, height: 10 },
      ),
    ).rejects.toThrow(/positive width and height/);
  });

  it('throws on an unsupported format', async () => {
    const buffer = makeMockBuffer(256);
    const device = makeMockDevice(buffer);
    const texture = {} as GPUTexture;

    await expect(
      readTexturePixels(
        device as unknown as GPUDevice,
        texture,
        { x: 0, y: 0, width: 1, height: 1 },
        'rgba16float',
      ),
    ).rejects.toThrow(/unsupported format/);
  });

  it('submits one command buffer per read', async () => {
    const buffer = makeMockBuffer(256);
    const device = makeMockDevice(buffer);
    const texture = {} as GPUTexture;

    await readTexturePixels(
      device as unknown as GPUDevice,
      texture,
      { x: 0, y: 0, width: 1, height: 1 },
    );

    expect(device.queue.submit).toHaveBeenCalledTimes(1);
  });

  it('repacks rows into a tight buffer', async () => {
    const width = 100;
    const height = 2;
    const paddedRow = 512;
    const source = new Uint8Array(paddedRow * height);
    // Row 0 pixel 0: red.
    source[0] = 255;
    source[1] = 0;
    source[2] = 0;
    source[3] = 255;
    // Row 1 pixel 0: blue.
    const row1Off = paddedRow;
    source[row1Off] = 0;
    source[row1Off + 1] = 0;
    source[row1Off + 2] = 255;
    source[row1Off + 3] = 255;
    const buffer = makeMockBuffer(paddedRow * height, source);
    const device = makeMockDevice(buffer);
    const texture = {} as GPUTexture;

    const bytes = await readTexturePixels(
      device as unknown as GPUDevice,
      texture,
      { x: 0, y: 0, width, height },
    );

    expect(bytes.length).toBe(width * height * 4);
    // Row 0 pixel 0 is red.
    expect(bytes[0]).toBe(255);
    expect(bytes[2]).toBe(0);
    // Row 1 pixel 0 is blue.
    const row1TightOff = width * 4;
    expect(bytes[row1TightOff]).toBe(0);
    expect(bytes[row1TightOff + 2]).toBe(255);
  });
});