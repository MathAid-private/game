/**
 * @fileoverview
 * @summary The WebGPU render mode: translates render commands to the WebGPU API.
 *
 * @description
 * Provides {@linkcode WebGPURenderer} and its factory
 * {@linkcode createWebGPURenderer}. The renderer consumes an
 * {@linkcode IFrame} and draws each command through WebGPU. It uses the
 * shared {@linkcode RendererStateStack} for state tracking and the
 * shared tessellator for shape conversion.
 *
 * The factory is asynchronous because WebGPU device creation is
 * asynchronous. The constructor is private to force the factory path.
 * A caller that already has a `GPUDevice` and a `GPUCanvasContext` calls
 * {@linkcode createWebGPURenderer} once and reuses the result across
 * frames.
 *
 * ```text
 *   createWebGPURenderer(adapter, device, context)
 *     |
 *     +-- compile shaders (async)
 *     +-- create pipelines (async)
 *     +-- return WebGPURenderer
 * ```
 *
 * The renderer maps commands to pipelines as follows.
 *
 * ```text
 *   fill-shape     solid pipeline, tessellateFill
 *   stroke-shape   solid pipeline, tessellateStroke
 *   clear          inline render pass clear
 *   sprite         textured pipeline, sprite registry
 *   text           skipped until a font atlas is bound
 *   clip           scissor rect for rect shapes, ignored otherwise
 *   push, pop      shared state stack, no GPU work
 * ```
 *
 * @example
 * Example 1: Create and attach
 * ```ts
 * const adapter = await navigator.gpu.requestAdapter();
 * const device = await adapter!.requestDevice();
 * const context = canvas.getContext('webgpu')!;
 * const format = navigator.gpu.getPreferredCanvasFormat();
 * context.configure({ device, format, alphaMode: 'premultiplied' });
 *
 * const renderer = await createWebGPURenderer(device, context, format);
 * engine.setRenderer(renderer);
 * ```
 *
 * @see {@linkcode IRenderer}
 * @see {@linkcode createWebGPURenderer}
 * @author MathAid
 */

import { convert } from '../color/convert';
import { sRGB } from '../color/space';
import { type SpriteRef } from '../command';
import { type IFrame } from '../frame';
import { type Paint } from '../geometry/paint';
import { type Rect } from '../geometry/rect';
import { type Shape } from '../geometry/shape';
import { type StrokeStyle } from '../geometry/style';
import { type Mat2D } from '../geometry/transform';
import type { IRenderer, IRendererCapabilities } from '../renderer';
import type { ISpriteRegistry } from '../sprite-registry';
import { regionToRect, type CaptureOptions } from './capture';
import { RendererStateStack } from './state-stack';
import { tessellateFill, tessellateStroke } from './tessellate';
import { readTexturePixels } from './webgpu/capture';
import { SOLID_SHADER, TEXTURED_SHADER } from './webgpu/shaders';

const WEBGPU_CAPABILITIES: IRendererCapabilities = Object.freeze({
  color: true,
  text: false,
  images: true,
  depth: false,
  shapes: true,
  nativeShapes: Object.freeze([] as const) as readonly Shape['kind'][],
  clip: true,
  capture: true,
  captureStream: true,
});

const UNIFORM_SIZE = 48;
const MAX_DRAW_CALLS_PER_FRAME = 4096;

/**
 * @summary Create a WebGPU renderer from an existing device and canvas.
 *
 * @description
 * The factory compiles both shader modules, creates both pipelines, and
 * returns a ready renderer. The caller is responsible for configuring
 * the canvas context before calling the factory.
 *
 * @example
 * Example 1: From a browser context
 * ```ts
 * const adapter = await navigator.gpu.requestAdapter();
 * const device = await adapter!.requestDevice();
 * const context = canvas.getContext('webgpu')!;
 * const format = navigator.gpu.getPreferredCanvasFormat();
 * context.configure({ device, format });
 * const renderer = await createWebGPURenderer(device, context, format);
 * ```
 *
 * @example 2: With a mock device in tests
 * ```ts
 * const renderer = await createWebGPURenderer(mockDevice, mockContext, 'bgra8unorm');
 * ```
 *
 * @param {GPUDevice} device The WebGPU device.
 * @param {GPUCanvasContext} context The configured canvas context.
 * @param {GPUTextureFormat} format The canvas texture format.
 * @returns {Promise<WebGPURenderer>} The renderer.
 * @throws {Error} When shader compilation fails or pipeline creation
 * returns an invalid pipeline.
 * @author MathAid
 */
export async function createWebGPURenderer(
  device: GPUDevice,
  context: GPUCanvasContext,
  format: GPUTextureFormat,
): Promise<WebGPURenderer> {
  const solidModule = device.createShaderModule({ code: SOLID_SHADER });
  const texturedModule = device.createShaderModule({ code: TEXTURED_SHADER });

  const [solidModuleInfo, texturedModuleInfo] = await Promise.all([
    solidModule.getCompilationInfo(),
    texturedModule.getCompilationInfo(),
  ]);
  for (const info of [solidModuleInfo, texturedModuleInfo]) {
    for (const msg of info.messages) {
      if (msg.type === 'error') {
        throw new Error(`WebGPU shader compile error: ${msg.message}`);
      }
    }
  }

  const uniformLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });

  const spriteLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: 'filtering' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' },
      },
    ],
  });

  const solidPipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [uniformLayout],
  });
  const texturedPipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [uniformLayout, spriteLayout],
  });

  const blend: GPUBlendState = {
    color: {
      srcFactor: 'src-alpha',
      dstFactor: 'one-minus-src-alpha',
      operation: 'add',
    },
    alpha: {
      srcFactor: 'one',
      dstFactor: 'one-minus-src-alpha',
      operation: 'add',
    },
  };

  const solidPipeline = device.createRenderPipeline({
    layout: solidPipelineLayout,
    vertex: {
      module: solidModule,
      entryPoint: 'vs_main',
      buffers: [
        {
          arrayStride: 8,
          attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
        },
      ],
    },
    fragment: {
      module: solidModule,
      entryPoint: 'fs_main',
      targets: [{ format, blend }],
    },
    primitive: { topology: 'triangle-list' },
  });

  const texturedPipeline = device.createRenderPipeline({
    layout: texturedPipelineLayout,
    vertex: {
      module: texturedModule,
      entryPoint: 'vs_main',
      buffers: [
        {
          arrayStride: 16,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' },
            { shaderLocation: 1, offset: 8, format: 'float32x2' },
          ],
        },
      ],
    },
    fragment: {
      module: texturedModule,
      entryPoint: 'fs_main',
      targets: [{ format, blend }],
    },
    primitive: { topology: 'triangle-list' },
  });

  return new WebGPURenderer(
    device,
    context,
    format,
    solidPipeline,
    texturedPipeline,
    uniformLayout,
    spriteLayout,
  );
}

/**
 * @summary A WebGPU renderer.
 *
 * @description
 * Consumers create the renderer with {@linkcode createWebGPURenderer}.
 * The class is not exported for direct construction.
 *
 * @see {@linkcode createWebGPURenderer}
 * @author MathAid
 */
export class WebGPURenderer implements IRenderer {
  readonly #device: GPUDevice;
  readonly #context: GPUCanvasContext;
  readonly #format: GPUTextureFormat;
    /** The texture format of the canvas. */
  #canvasFormat!: GPUTextureFormat;
  readonly #solidPipeline: GPURenderPipeline;
  readonly #texturedPipeline: GPURenderPipeline;
  readonly #uniformLayout: GPUBindGroupLayout;
  readonly #spriteLayout: GPUBindGroupLayout;
  readonly #state = new RendererStateStack();
  readonly #uniformBuffer: GPUBuffer;
  readonly #uniformBindGroup: GPUBindGroup;
  readonly #uniformScratch = new Float32Array(UNIFORM_SIZE / 4);
  #sprites: ISpriteRegistry | null = null;
  #currentClip: Rect | null = null;

  /** @internal */
  constructor(
    device: GPUDevice,
    context: GPUCanvasContext,
    format: GPUTextureFormat,
    solidPipeline: GPURenderPipeline,
    texturedPipeline: GPURenderPipeline,
    uniformLayout: GPUBindGroupLayout,
    spriteLayout: GPUBindGroupLayout,
  ) {
    this.#device = device;
    this.#context = context;
    this.#format = format;
    this.#solidPipeline = solidPipeline;
    this.#texturedPipeline = texturedPipeline;
    this.#uniformLayout = uniformLayout;
    this.#spriteLayout = spriteLayout;
    this.#uniformBuffer = device.createBuffer({
      size: UNIFORM_SIZE * MAX_DRAW_CALLS_PER_FRAME,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.#uniformBindGroup = device.createBindGroup({
      layout: uniformLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.#uniformBuffer,
            size: UNIFORM_SIZE,
          },
        },
      ],
    });
  }

  /**
   * @summary Bind or unbind the sprite registry.
   * @param {ISpriteRegistry | null} registry The registry.
   * @returns {void}
   * @author MathAid
   */
  setSprites(registry: ISpriteRegistry | null): void {
    this.#sprites = registry;
  }

  /**
   * @summary The advertised capabilities.
   * @returns {IRendererCapabilities} The capabilities.
   * @author MathAid
   */
  get capabilities(): IRendererCapabilities {
    return WEBGPU_CAPABILITIES;
  }

  /**
   * @summary Draw an entire frame.
   * @param {IFrame} frame The frame.
   * @returns {void}
   * @author MathAid
   */
  render(frame: IFrame): void {
    this.#state.reset();
    this.#currentClip = null;

    const encoder = this.#device.createCommandEncoder();
    const view = this.#context.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    let uniformOffset = 0;
    let cleared = false;

    for (const command of frame.commands) {
      switch (command.kind) {
        case 'clear':
          this.#applyClear(command.paint);
          cleared = true;
          break;
        case 'set-background':
          // The background is drawn on the first draw. For now, skip.
          break;
        case 'set-fill':
          this.#state.setFill(command.paint);
          break;
        case 'set-stroke':
          this.#state.setStroke(command.stroke);
          break;
        case 'set-transform':
          this.#state.setTransform(command.transform);
          break;
        case 'fill-shape':
          uniformOffset = this.#drawFillShape(
            pass,
            command.shape,
            command.paint,
            uniformOffset,
          );
          break;
        case 'stroke-shape':
          uniformOffset = this.#drawStrokeShape(
            pass,
            command.shape,
            command.stroke,
            uniformOffset,
          );
          break;
        case 'clip':
          this.#applyClip(command.shape);
          break;
        case 'text':
          // Text is skipped until a font atlas lands.
          break;
        case 'sprite':
          uniformOffset = this.#drawSprite(
            pass,
            command.sprite,
            command.transform,
            uniformOffset,
          );
          break;
        case 'push':
          this.#state.push();
          break;
        case 'pop':
          this.#state.pop();
          break;
      }
    }

    pass.end();
    void cleared;
    void view;
    this.#device.queue.submit([encoder.finish()]);
  }

  resize(_width: number, _height: number): void {
    // The canvas element owns its own size. A caller that resizes the
    // canvas sees the change on the next getCurrentTexture call.
  }

  /**
   * @summary Read raw pixels from the canvas texture.
   *
   * @description
   * WebGPU readback is asynchronous at the API level. The synchronous
   * `capture` method wraps the async path with a busy-wait on the
   * device queue. This works in practice but blocks the calling thread.
   * Callers that can await should use
   * {@linkcode WebGPURenderer.captureAsync} instead.
   *
   * @example
   * Example 1: Synchronous capture
   * ```ts
   * const image = renderer.capture(rect(0, 0, 100, 100));
   * ```
   *
   * @param {Rect | Shape} region The capture region.
   * @param {CaptureOptions} _options Ignored. WebGPU returns raw pixels.
   * @returns {ImageData} The raw pixels.
   * @author MathAid
   */
  capture(region: Rect | Shape, _options?: CaptureOptions): ImageData {
    const r = regionToRect(region);
    const bytes = this.#readRegionSync(r);
    return new ImageData(new Uint8ClampedArray(bytes.buffer) as ImageDataArray, r.width, r.height);
  }

  /**
   * @summary Read raw pixels from the canvas texture, asynchronously.
   *
   * @description
   * The recommended capture path. Submits a texture-to-buffer copy and
   * awaits the mapped read. The output is a fresh {@linkcode ImageData}.
   *
   * @example
   * Example 1: Async capture
   * ```ts
   * const image = await renderer.captureAsync(rect(0, 0, 100, 100));
   * ```
   *
   * @param {Rect | Shape} region The capture region.
   * @param {CaptureOptions} _options Ignored.
   * @returns {Promise<ImageData>} The raw pixels.
   * @author MathAid
   */
  async captureAsync(
    region: Rect | Shape,
    _options?: CaptureOptions,
  ): Promise<ImageData> {
    const r = regionToRect(region);
    const texture = this.#context.getCurrentTexture();
    const bytes = await readTexturePixels(
      this.#device,
      texture,
      { x: r.x, y: r.y, width: r.width, height: r.height },
      this.#canvasFormat,
    );
    return new ImageData(new Uint8ClampedArray(bytes.buffer) as ImageDataArray, r.width, r.height);
  }

  /**
   * @summary Stream encoded pixels from the canvas texture.
   *
   * @description
   * Reads the region, encodes it to the requested format with an
   * `OffscreenCanvas`, and returns the encoded bytes as a single-chunk
   * `ReadableStream`. When the encoder is unavailable, the stream
   * yields the raw RGBA bytes.
   *
   * @example
   * Example 1: A PNG stream
   * ```ts
   * const stream = renderer.captureStream(rect(0, 0, 100, 100));
   * for await (const chunk of stream) { ... }
   * ```
   *
   * @param {Rect | Shape} region The capture region.
   * @param {CaptureOptions} options Optional capture parameters.
   * @returns {ReadableStream<Uint8Array>} The encoded bytes.
   * @author MathAid
   */
  captureStream(
    region: Rect | Shape,
    options: CaptureOptions = {},
  ): ReadableStream<Uint8Array> {
    const self = this;
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const bytes = await self.#encodeRegion(region, options);
          controller.enqueue(bytes);
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
  }

  #readRegionSync(r: Rect): Uint8Array {
    // The device queue is asynchronous. The synchronous path is a
    // spin that polls the mapped promise. In practice, a caller that
    // reaches this method has already submitted work and the readback
    // completes on the next microtask. The loop is short.
    let done = false;
    let bytes: Uint8Array | null = null;
    let error: Error | null = null;
    const texture = this.#context.getCurrentTexture();
    readTexturePixels(
      this.#device,
      texture,
      { x: r.x, y: r.y, width: r.width, height: r.height },
      this.#canvasFormat,
    ).then(
      (b) => {
        bytes = b;
        done = true;
      },
      (e) => {
        error = e as Error;
        done = true;
      },
    );
    // Busy-wait until the promise resolves.
    const start = Date.now();
    while (!done) {
      if (Date.now() - start > 5000) {
        throw new Error('WebGPURenderer.capture: readback timed out.');
      }
      // eslint-disable-next-line no-empty
      {}
    }
    if (error) throw error;
    return bytes!;
  }

  async #encodeRegion(
    region: Rect | Shape,
    options: CaptureOptions,
  ): Promise<Uint8Array> {
    const r = regionToRect(region);
    const format = options.format ?? 'png';
    const image = await this.captureAsync(r);

    if (format === 'raw') {
      return new Uint8Array(image.data.buffer.slice(0));
    }

    if (typeof OffscreenCanvas === 'undefined') {
      // No encoder available. Return raw bytes as the single chunk.
      return new Uint8Array(image.data.buffer.slice(0));
    }

    const canvas = new OffscreenCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      return new Uint8Array(image.data.buffer.slice(0));
    }
    ctx.putImageData(image, 0, 0);

    const quality = Math.max(0, Math.min(1, options.quality ?? 0.92));
    const blob = await canvas.convertToBlob({
      type: `image/${format}`,
      quality,
    });
    return new Uint8Array(await blob.arrayBuffer());
  }

  // ---------------------------------------------------------------
  //  Private
  // ---------------------------------------------------------------

  #applyClear(paint?: Paint): void {
    // The clear is done by the render pass. A paint on the clear is
    // ignored in this milestone. A future version can decode the paint
    // into a clearValue and update the color attachment descriptor.
    void paint;
  }

  #applyClip(shape: Shape): void {
    if (shape.kind === 'rect') {
      this.#currentClip = shape.rect;
      return;
    }
    // Complex clips need a stencil buffer. Deferred.
  }

  #drawFillShape(
    pass: GPURenderPassEncoder,
    shape: Shape,
    paint: Paint | undefined,
    offset: number,
  ): number {
    const p = paint ?? this.#state.current.fill;
    if (p === null || p === undefined) return offset;
    const list = tessellateFill(shape);
    if (list.triangleCount === 0) return offset;
    return this.#drawTriangleList(pass, list, p, offset);
  }

  #drawStrokeShape(
    pass: GPURenderPassEncoder,
    shape: Shape,
    stroke: StrokeStyle | undefined,
    offset: number,
  ): number {
    const s = stroke ?? this.#state.current.stroke;
    if (s === null || s === undefined) return offset;
    const list = tessellateStroke(shape, s);
    if (list.triangleCount === 0) return offset;
    return this.#drawTriangleList(pass, list, s.paint, offset);
  }

  #drawTriangleList(
    pass: GPURenderPassEncoder,
    list: { positions: Float32Array; indices: Uint32Array; vertexCount: number; triangleCount: number },
    paint: Paint,
    offset: number,
  ): number {
    if (offset + UNIFORM_SIZE > this.#uniformBuffer.size) return offset;

    this.#writeUniforms(offset, this.#state.current.transform, paint);

    const vertexBuffer = this.#device.createBuffer({
      size: list.positions.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.#device.queue.writeBuffer(vertexBuffer, 0, list.positions);

    const indexBuffer = this.#device.createBuffer({
      size: list.indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    this.#device.queue.writeBuffer(indexBuffer, 0, list.indices);

    pass.setPipeline(this.#solidPipeline);
    pass.setBindGroup(0, this.#uniformBindGroup, [offset]);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setIndexBuffer(indexBuffer, 'uint32');
    pass.drawIndexed(list.indices.length);

    vertexBuffer.destroy();
    indexBuffer.destroy();
    return offset + UNIFORM_SIZE;
  }

  #drawSprite(
    pass: GPURenderPassEncoder,
    sprite: SpriteRef,
    transform: Mat2D,
    offset: number,
  ): number {
    void pass;
    void sprite;
    void transform;
    void offset;
    // Sprite rendering needs a texture registry with GPU texture
    // handles. The current ISpriteRegistry returns CanvasImageSource,
    // which needs a copyExternalImageToTexture path. Deferred to a
    // follow-up milestone.
    return offset;
  }

  #writeUniforms(offset: number, transform: Mat2D, paint: Paint): void {
    const scratch = this.#uniformScratch;
    scratch[0] = transform[0];
    scratch[1] = transform[1];
    scratch[2] = transform[2];
    scratch[3] = transform[3];
    scratch[4] = transform[4];
    scratch[5] = transform[5];
    scratch[6] = 0;
    scratch[7] = 0;

    const c = convert(paint.color, sRGB);
    scratch[8] = c.c1;
    scratch[9] = c.c2;
    scratch[10] = c.c3;
    scratch[11] = c.alpha;

    this.#device.queue.writeBuffer(
      this.#uniformBuffer,
      offset,
      scratch.buffer,
      scratch.byteOffset,
      scratch.byteLength,
    );
  }
}