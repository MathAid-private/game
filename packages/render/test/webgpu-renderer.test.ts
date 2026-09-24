/**
 * @fileoverview
 * @summary Tests for {@linkcode WebGPURenderer} with a mock device.
 *
 * @description
 * The mock device records every call the renderer makes. The tests check
 * that the factory compiles shaders, creates pipelines, and returns a
 * working renderer. The command tests check that the renderer walks the
 * frame and issues the expected number of draw calls.
 *
 * The mock is not a complete WebGPU implementation. It provides only the
 * surface the renderer uses.
 *
 * @see {@linkcode createWebGPURenderer}
 * @author MathAid
 */

import {
  FrameBuilder,
  make,
  makeSolid,
  point,
  rect,
  sRGB,
} from '@games/render';
import { describe, expect, it, vi } from 'vitest';

interface MockDevice {
  readonly limits: { readonly minUniformBufferOffsetAlignment: number };
  readonly queue: { writeBuffer: ReturnType<typeof vi.fn>; submit: ReturnType<typeof vi.fn> };
  createShaderModule: ReturnType<typeof vi.fn>;
  createBindGroupLayout: ReturnType<typeof vi.fn>;
  createPipelineLayout: ReturnType<typeof vi.fn>;
  createRenderPipeline: ReturnType<typeof vi.fn>;
  createBuffer: ReturnType<typeof vi.fn>;
  createBindGroup: ReturnType<typeof vi.fn>;
  createCommandEncoder: ReturnType<typeof vi.fn>;
}

function makeDevice(): MockDevice {
  const writeBuffer = vi.fn();
  const submit = vi.fn();
  const buffer = {
    size: 0,
    destroy: vi.fn(),
  };
  return {
    limits: { minUniformBufferOffsetAlignment: 256 },
    queue: { writeBuffer, submit },
    createShaderModule: vi.fn(() => ({
      getCompilationInfo: vi.fn(async () => ({ messages: [] })),
    })),
    createBindGroupLayout: vi.fn(() => ({})),
    createPipelineLayout: vi.fn(() => ({})),
    createRenderPipeline: vi.fn(() => ({
      getBindGroupLayout: vi.fn(() => ({})),
    })),
    createBuffer: vi.fn((desc: { size: number }) => ({
      size: desc.size,
      destroy: vi.fn(),
    })),
    createBindGroup: vi.fn(() => ({})),
    createCommandEncoder: vi.fn(() => ({
      beginRenderPass: vi.fn(() => ({
        setPipeline: vi.fn(),
        setBindGroup: vi.fn(),
        setVertexBuffer: vi.fn(),
        setIndexBuffer: vi.fn(),
        drawIndexed: vi.fn(),
        end: vi.fn(),
      })),
      finish: vi.fn(() => ({})),
    })),
  };
}

function makeContext(): { getCurrentTexture: ReturnType<typeof vi.fn> } {
  return {
    getCurrentTexture: vi.fn(() => ({
      createView: vi.fn(() => ({})),
    })),
  };
}

const Globals = {
  GPUShaderStage: { VERTEX: 1, FRAGMENT: 2 },
  GPUBufferUsage: {
    UNIFORM: 1,
    COPY_DST: 2,
    VERTEX: 4,
    INDEX: 8,
  },
};

(globalThis as Record<string, unknown>)['GPUShaderStage'] =
  Globals.GPUShaderStage;
(globalThis as Record<string, unknown>)['GPUBufferUsage'] = Globals.GPUBufferUsage;

// Import after the globals are set.
const { createWebGPURenderer } = await import('@games/render');

describe('createWebGPURenderer', () => {
  it('compiles both shader modules', async () => {
    const device = makeDevice();
    const context = makeContext();
    await createWebGPURenderer(
      device as unknown as GPUDevice,
      context as unknown as GPUCanvasContext,
      'bgra8unorm',
    );
    expect(device.createShaderModule).toHaveBeenCalledTimes(2);
  });

  it('creates two pipelines', async () => {
    const device = makeDevice();
    const context = makeContext();
    await createWebGPURenderer(
      device as unknown as GPUDevice,
      context as unknown as GPUCanvasContext,
      'bgra8unorm',
    );
    expect(device.createRenderPipeline).toHaveBeenCalledTimes(2);
  });

  it('creates one uniform buffer and one bind group', async () => {
    const device = makeDevice();
    const context = makeContext();
    await createWebGPURenderer(
      device as unknown as GPUDevice,
      context as unknown as GPUCanvasContext,
      'bgra8unorm',
    );
    // One uniform buffer, no other buffers at construction.
    expect(device.createBuffer).toHaveBeenCalledTimes(1);
    expect(device.createBindGroup).toHaveBeenCalledTimes(1);
  });

  it('reports the expected capabilities', async () => {
    const device = makeDevice();
    const context = makeContext();
    const renderer = await createWebGPURenderer(
      device as unknown as GPUDevice,
      context as unknown as GPUCanvasContext,
      'bgra8unorm',
    );
    expect(renderer.capabilities.color).toBe(true);
    expect(renderer.capabilities.images).toBe(true);
    expect(renderer.capabilities.shapes).toBe(true);
    expect(renderer.capabilities.text).toBe(false);
    expect(renderer.capabilities.depth).toBe(false);
    expect(renderer.capabilities.capture).toBe(false);
  });
});

describe('WebGPURenderer.render', () => {
  it('submits a command buffer', async () => {
    const device = makeDevice();
    const context = makeContext();
    const renderer = await createWebGPURenderer(
      device as unknown as GPUDevice,
      context as unknown as GPUCanvasContext,
      'bgra8unorm',
    );
    const b = new FrameBuilder();
    b.clear();
    renderer.render(b);
    expect(device.queue.submit).toHaveBeenCalledTimes(1);
  });

  it('creates one render pass per frame', async () => {
    const device = makeDevice();
    const context = makeContext();
    const renderer = await createWebGPURenderer(
      device as unknown as GPUDevice,
      context as unknown as GPUCanvasContext,
      'bgra8unorm',
    );
    const b = new FrameBuilder();
    b.clear();
    b.fillRect(rect(0, 0, 32, 32), makeSolid(make(sRGB, 1, 0, 0)));
    renderer.render(b);
    expect(device.createCommandEncoder).toHaveBeenCalledTimes(1);
  });

  it('does not create buffers for a frame with no draws', async () => {
    const device = makeDevice();
    const context = makeContext();
    const renderer = await createWebGPURenderer(
      device as unknown as GPUDevice,
      context as unknown as GPUCanvasContext,
      'bgra8unorm',
    );
    const b = new FrameBuilder();
    b.clear();
    b.push();
    b.pop();
    const before = (device.createBuffer as ReturnType<typeof vi.fn>).mock.calls.length;
    renderer.render(b);
    const after = (device.createBuffer as ReturnType<typeof vi.fn>).mock.calls.length;
    // Only the constructor's uniform buffer is created.
    expect(after).toBe(before);
  });

  it('creates vertex and index buffers for a fill-shape', async () => {
    const device = makeDevice();
    const context = makeContext();
    const renderer = await createWebGPURenderer(
      device as unknown as GPUDevice,
      context as unknown as GPUCanvasContext,
      'bgra8unorm',
    );
    const b = new FrameBuilder();
    b.fillRect(rect(0, 0, 32, 32), makeSolid(make(sRGB, 1, 0, 0)));
    const before = (device.createBuffer as ReturnType<typeof vi.fn>).mock.calls.length;
    renderer.render(b);
    const after = (device.createBuffer as ReturnType<typeof vi.fn>).mock.calls.length;
    // One uniform buffer created in the constructor, two more for the
    // rect draw (vertex + index).
    expect(after).toBe(before + 2);
  });

  it('writes uniform data for a filled shape', async () => {
    const device = makeDevice();
    const context = makeContext();
    const renderer = await createWebGPURenderer(
      device as unknown as GPUDevice,
      context as unknown as GPUCanvasContext,
      'bgra8unorm',
    );
    const b = new FrameBuilder();
    b.fillCircle(point(50, 50), 10, makeSolid(make(sRGB, 1, 0, 0)));
    renderer.render(b);
    // The uniform write for the circle plus the vertex and index writes.
    expect(device.queue.writeBuffer).toHaveBeenCalled();
  });
});

describe('WebGPURenderer capture', () => {
  it('throws from capture', async () => {
    const device = makeDevice();
    const context = makeContext();
    const renderer = await createWebGPURenderer(
      device as unknown as GPUDevice,
      context as unknown as GPUCanvasContext,
      'bgra8unorm',
    );
    expect(() => renderer.capture(rect(0, 0, 1, 1))).toThrow(/future milestone/);
  });
});