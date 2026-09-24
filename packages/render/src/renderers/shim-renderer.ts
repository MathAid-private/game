/**
 * @fileoverview
 * @summary The native shim render mode: translates render commands to the C ABI.
 *
 * @description
 * Provides {@linkcode ShimRenderer} and its factory
 * {@linkcode createShimRenderer}. The renderer consumes an
 * {@linkcode IFrame} and draws each command through a native shim that
 * implements `shims/gfx.h`. The same renderer targets OpenGL, Vulkan,
 * DX12, and Metal because the C ABI is shared.
 *
 * The renderer uses the shared {@linkcode RendererStateStack} for state
 * tracking and the shared tessellator for shape conversion. Every shape
 * becomes a triangle list. Every triangle list becomes one vertex
 * buffer, one index buffer, and one draw call.
 *
 * ```text
 *   RenderCommand           Native calls
 *   -------------           ------------
 *   clear                   gfx_begin_frame with clear color
 *   set-fill                state stack update
 *   set-stroke              state stack update
 *   set-transform           state stack update
 *   fill-shape              tessellate, create buffers, gfx_draw
 *   stroke-shape            tessellate, create buffers, gfx_draw
 *   clip                    ignored (deferred to a stencil milestone)
 *   text                    ignored (deferred to a font atlas milestone)
 *   sprite                  ignored (deferred to a texture milestone)
 *   push                    state stack push
 *   pop                     state stack pop
 * ```
 *
 * The renderer creates and destroys buffers on every draw call. This is
 * correct but not optimal. A future milestone pools buffers with a large
 * heap and suballocates. The C ABI already exposes offsets through the
 * `size` argument of `gfx_create_buffer`, so the pooling change is local
 * to this file.
 *
 * @example
 * Example 1: Attach to an engine
 * ```ts
 * import { loadBinding, GfxApi } from '../renderer/shim';
 * import { createShimRenderer } from './shim-renderer';
 *
 * const binding = loadBinding('opengl');
 * const renderer = createShimRenderer(binding, GfxApi.OpenGL);
 * engine.setRenderer(renderer);
 * ```
 *
 * @example 2: Vulkan on Linux
 * ```ts
 * const binding = loadBinding('vulkan');
 * const renderer = createShimRenderer(binding, GfxApi.Vulkan);
 * ```
 *
 * @example 3: Dispose when done
 * ```ts
 * renderer.dispose();
 * ```
 *
 * @see {@linkcode IRenderer}
 * @see {@linkcode GfxBinding}
 * @see {@linkcode loadBinding}
 * @author MathAid
 */

import { convert } from '../color/convert';
import { Linear_sRGB } from '../color/space';
import { type IFrame } from '../frame';
import { type Paint } from '../geometry/paint';
import { type Rect } from '../geometry/rect';
import { type Shape } from '../geometry/shape';
import { type StrokeStyle } from '../geometry/style';
import { type Mat2D } from '../geometry/transform';
import type { IRenderer, IRendererCapabilities } from '../renderer';
import {
  type DeviceHandle,
  GfxApi,
  type GfxBinding,
} from '../shim';
import { type CaptureOptions, regionToRect } from './capture';
import { RendererStateStack } from './state-stack';
import { tessellateFill, tessellateStroke } from './tessellate';

/**
 * @summary The GLSL vertex shader the renderer loads into every shim.
 *
 * @description
 * The shader receives a 2D position per vertex and a 4 by 4 matrix and
 * a color per draw. The matrix places the vertex in clip space. The
 * color goes straight to the fragment shader.
 *
 * The uniform block layout is `uniform mat4 u_mvp; uniform vec4
 * u_color;`. The C ABI's `gfx_draw` passes exactly this layout: 16
 * floats for the matrix, followed by 4 floats for the color.
 *
 * @see {@linkcode SHIM_FRAGMENT_SHADER}
 * @author MathAid
 */
const SHIM_VERTEX_SHADER = `#version 330 core
layout(location = 0) in vec2 a_pos;
uniform mat4 u_mvp;
void main() {
  gl_Position = u_mvp * vec4(a_pos, 0.0, 1.0);
}
`;

/**
 * @summary The GLSL fragment shader the renderer loads into every shim.
 *
 * @description
 * Returns the uniform color. Alpha blending is configured by the shim.
 *
 * @see {@linkcode SHIM_VERTEX_SHADER}
 * @author MathAid
 */
const SHIM_FRAGMENT_SHADER = `#version 330 core
uniform vec4 u_color;
out vec4 fragColor;
void main() {
  fragColor = u_color;
}
`;

/**
 * @summary The capabilities the native shim advertises.
 *
 * @description
 * The list mirrors what the reference shim reports. A backend that adds
 * text, sprites, or clip support updates the object before the renderer
 * returns from the factory.
 *
 * @author MathAid
 */
const SHIM_CAPABILITIES: IRendererCapabilities = Object.freeze({
  color: true,
  text: false,
  images: false,
  depth: false,
  shapes: true,
  nativeShapes: Object.freeze([] as const) as readonly Shape['kind'][],
  clip: false,
  capture: true,
  captureStream: false,
});

/**
 * @summary Create a native shim renderer.
 *
 * @description
 * The factory creates a device, compiles the solid pipeline, and returns
 * a ready renderer. The caller disposes the renderer when done.
 *
 * @example
 * Example 1: Create an OpenGL renderer
 * ```ts
 * const binding = loadBinding('opengl');
 * const renderer = createShimRenderer(binding, GfxApi.OpenGL);
 * ```
 *
 * @example 2: Create a Vulkan renderer
 * ```ts
 * const binding = loadBinding('vulkan');
 * const renderer = createShimRenderer(binding, GfxApi.Vulkan);
 * ```
 *
 * @example 3: Create a Metal renderer on macOS
 * ```ts
 * const binding = loadBinding('metal');
 * const renderer = createShimRenderer(binding, GfxApi.Metal);
 * ```
 *
 * @param {GfxBinding} binding The loaded shim binding.
 * @param {GfxApi} api The API the shim targets.
 * @param {unknown} native A platform-specific handle. Defaults to `null`.
 * @returns {ShimRenderer} The renderer.
 * @throws {GfxError} When device or pipeline creation fails.
 * @author MathAid
 */
export function createShimRenderer(
  binding: GfxBinding,
  api: GfxApi,
  native: unknown | null = null,
): ShimRenderer {
  const device = binding.createDevice(api, native);
  const pipeline = binding.createPipeline(
    device,
    SHIM_VERTEX_SHADER,
    SHIM_FRAGMENT_SHADER,
  );
  return new ShimRenderer(binding, device, pipeline);
}

/**
 * @summary A native shim renderer.
 *
 * @description
 * Consumers create the renderer with {@linkcode createShimRenderer}.
 * The class is not exported for direct construction.
 *
 * @see {@linkcode createShimRenderer}
 * @author MathAid
 */
export class ShimRenderer implements IRenderer {
  readonly #binding: GfxBinding;
  readonly #device: DeviceHandle;
  readonly #pipeline: ReturnType<GfxBinding['createPipeline']>;
  readonly #state = new RendererStateStack();
  readonly #uniformScratch = new Float32Array(20);
  #disposed = false;

  /** @internal */
  constructor(
    binding: GfxBinding,
    device: DeviceHandle,
    pipeline: ReturnType<GfxBinding['createPipeline']>,
  ) {
    this.#binding = binding;
    this.#device = device;
    this.#pipeline = pipeline;
  }

  /**
   * @summary The advertised capabilities.
   * @returns {IRendererCapabilities} The capabilities.
   * @author MathAid
   */
  get capabilities(): IRendererCapabilities {
    return SHIM_CAPABILITIES;
  }

  /**
   * @summary Draw an entire frame.
   *
   * @description
   * Walks the frame's commands. State commands update the shared stack.
   * Action commands tessellate their shape and issue a native draw call.
   * The frame is bracketed by a `gfx_begin_frame` and a `gfx_end_frame`.
   *
   * @example
   * Example 1: Render a builder
   * ```ts
   * const builder = new FrameBuilder();
   * builder.fillRect(rect(0, 0, 32, 32), makeSolid(make(sRGB, 1, 0, 0)));
   * renderer.render(builder);
   * ```
   *
   * @param {IFrame} frame The completed command list.
   * @returns {void}
   * @throws {GfxError} When a native call fails.
   * @author MathAid
   */
  render(frame: IFrame): void {
    if (this.#disposed) {
      throw new Error('ShimRenderer.render: the renderer has been disposed.');
    }
    this.#state.reset();

    // Find the clear color, if any.
    let clearColor: readonly [number, number, number, number] | null = null;
    for (const command of frame.commands) {
      if (command.kind === 'clear' && command.paint !== undefined) {
        const c = convert(command.paint.color, Linear_sRGB);
        clearColor = [c.c1, c.c2, c.c3, c.alpha];
        break;
      }
    }

    this.#binding.beginFrame(this.#device, clearColor);

    for (const command of frame.commands) {
      switch (command.kind) {
        case 'clear':
          // Handled by beginFrame.
          break;
        case 'set-background':
          // Not yet drawn.
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
          this.#drawFill(command.shape, command.paint);
          break;
        case 'stroke-shape':
          this.#drawStroke(command.shape, command.stroke);
          break;
        case 'clip':
          // Deferred to a stencil milestone.
          break;
        case 'text':
          // Deferred to a font atlas milestone.
          break;
        case 'sprite':
          // Deferred to a texture milestone.
          break;
        case 'push':
          this.#state.push();
          break;
        case 'pop':
          this.#state.pop();
          break;
      }
    }

    this.#binding.endFrame(this.#device);
    this.#binding.present(this.#device);
  }

  /**
   * @summary Resize is a no-op.
   *
   * @description
   * The C ABI does not expose a resize call. The native context owns its
   * own viewport. A caller that changes the window size sees the change
   * through the platform's context management.
   *
   * @param {number} _width Ignored.
   * @param {number} _height Ignored.
   * @returns {void}
   * @author MathAid
   */
  resize(_width: number, _height: number): void {}

  /**
   * @summary Read raw pixels from the current framebuffer.
   *
   * @description
   * Calls `gfx_read_pixels` with the region. The C shim copies the bytes
   * into the provided buffer. The output is a fresh
   * {@linkcode ImageData}.
   *
   * @example
   * Example 1: Capture the whole frame
   * ```ts
   * const image = renderer.capture(rect(0, 0, 640, 480));
   * ```
   *
   * @param {Rect | Shape} region The capture region.
   * @param {CaptureOptions} _options Ignored.
   * @returns {ImageData} The raw pixels.
   * @throws {GfxError} When the native call fails.
   * @author MathAid
   */
  capture(region: Rect | Shape, _options?: CaptureOptions): ImageData {
    if (this.#disposed) {
      throw new Error('ShimRenderer.capture: the renderer has been disposed.');
    }
    const r = regionToRect(region);
    const bytes = new Uint8Array(r.width * r.height * 4);
    this.#binding.readPixels(
      this.#device,
      r.x,
      r.y,
      r.width,
      r.height,
      bytes,
    );
    return new ImageData(new Uint8ClampedArray(bytes.buffer), r.width, r.height);
  }

  /**
   * @summary Read raw pixels from the current framebuffer, asynchronously.
   *
   * @description
   * Delegates to the synchronous {@linkcode ShimRenderer.capture}. The C
   * ABI has no asynchronous read path. The method exists for interface
   * compatibility.
   *
   * @param {Rect | Shape} region The capture region.
   * @param {CaptureOptions} options Optional capture parameters.
   * @returns {Promise<ImageData>} The raw pixels.
   * @author MathAid
   */
  async captureAsync(
    region: Rect | Shape,
    options?: CaptureOptions,
  ): Promise<ImageData> {
    return this.capture(region, options);
  }

  /**
   * @summary Streaming capture is not supported by the C ABI.
   *
   * @description
   * The C ABI has no streaming read path. The method throws with a
   * message that names the missing capability. A caller that wants an
   * encoded output runs the returned `ImageData` through a browser
   * canvas or an offscreen encoder.
   *
   * @param {Rect | Shape} _region Ignored.
   * @param {CaptureOptions} _options Ignored.
   * @returns {ReadableStream<Uint8Array>} Never. Always throws.
   * @throws {Error} Always.
   * @author MathAid
   */
  captureStream(
    _region: Rect | Shape,
    _options?: CaptureOptions,
  ): ReadableStream<Uint8Array> {
    throw new Error(
      'ShimRenderer.captureStream: the C ABI has no streaming read path (capabilities.captureStream is false).',
    );
  }

  /**
   * @summary Dispose the renderer and its native resources.
   *
   * @description
   * Destroys the pipeline and the device. A second call is a no-op.
   * A caller that forgets to dispose leaks the native resources.
   *
   * @example
   * Example 1: Dispose in a finally block
   * ```ts
   * try {
   *   // ... use renderer ...
   * } finally {
   *   renderer.dispose();
   * }
   * ```
   *
   * @returns {void}
   * @author MathAid
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#pipeline.dispose();
    this.#device.dispose();
    this.#disposed = true;
  }

  // ---------------------------------------------------------------
  //  Private
  // ---------------------------------------------------------------

  #drawFill(shape: Shape, paint: Paint | undefined): void {
    const p = paint ?? this.#state.current.fill;
    if (p === null || p === undefined) return;
    const list = tessellateFill(shape);
    if (list.triangleCount === 0) return;
    this.#issueDraw(list, p);
  }

  #drawStroke(shape: Shape, stroke: StrokeStyle | undefined): void {
    const s = stroke ?? this.#state.current.stroke;
    if (s === null || s === undefined) return;
    const list = tessellateStroke(shape, s);
    if (list.triangleCount === 0) return;
    this.#issueDraw(list, s.paint);
  }

  #issueDraw(
    list: {
      readonly positions: Float32Array;
      readonly indices: Uint32Array;
      readonly triangleCount: number;
    },
    paint: Paint,
  ): void {
    const vertexBytes = new Uint8Array(
      list.positions.buffer,
      list.positions.byteOffset,
      list.positions.byteLength,
    );
    const indexBytes = new Uint8Array(
      list.indices.buffer,
      list.indices.byteOffset,
      list.indices.byteLength,
    );

    const vbuf = this.#binding.createBuffer(
      this.#device,
      vertexBytes,
      'vertex',
    );
    const ibuf = this.#binding.createBuffer(
      this.#device,
      indexBytes,
      'index',
    );

    this.#writeUniforms(this.#state.current.transform, paint);

    try {
      this.#binding.draw(
        this.#device,
        this.#pipeline,
        vbuf,
        ibuf,
        this.#uniformScratch,
      );
    } catch (err) {
      vbuf.dispose();
      ibuf.dispose();
      throw err;
    }

    vbuf.dispose();
    ibuf.dispose();
  }

  #writeUniforms(transform: Mat2D, paint: Paint): void {
    const s = this.#uniformScratch;
    // A 4x4 row-major matrix. The 2D affine transform fits in the
    // upper-left 2x3 block. The remaining entries are identity.
    s[0] = transform[0];
    s[1] = transform[1];
    s[2] = 0;
    s[3] = 0;
    s[4] = transform[2];
    s[5] = transform[3];
    s[6] = 0;
    s[7] = 0;
    s[8] = 0;
    s[9] = 0;
    s[10] = 1;
    s[11] = 0;
    s[12] = transform[4];
    s[13] = transform[5];
    s[14] = 0;
    s[15] = 1;

    const c = convert(paint.color, Linear_sRGB);
    s[16] = c.c1;
    s[17] = c.c2;
    s[18] = c.c3;
    s[19] = c.alpha;
  }
}