/**
 * @fileoverview
 * @summary The renderer contract: the seam every render mode implements.
 *
 * @description
 * Defines {@linkcode IRenderer}, the environment-agnostic contract each
 * render mode implements, together with {@linkcode IRendererCapabilities},
 * which advertises what a mode's surface can do. A renderer consumes an
 * {@linkcode IFrame} of {@linkcode RenderCommand} values and translates
 * them to a concrete graphics API.
 *
 * Because a renderer is a first-class, swappable dependency, adding a
 * render mode is exactly adding an {@linkcode IRenderer} implementation.
 * Games and the engine core stay untouched.
 *
 * ```text
 *   Game  --writes-->  IFrame  --consumed by-->  IRenderer  --draws-->  Surface
 *                          |
 *                          +-- sees capabilities before writing
 * ```
 *
 * @see {@linkcode IFrame}
 * @see {@linkcode IRendererCapabilities}
 * @author MathAid
 */

import type { Rect } from './command';
import type { IFrame } from './frame';
import { type Shape } from './geometry/shape';
import type { CaptureOptions } from './renderers/capture';

/**
 * @summary Advertised capabilities of a renderer's backing surface.
 *
 * @description
 * {@linkcode IRendererCapabilities} tells callers what a mode can do
 * before they rely on it. A terminal has no color or image support. A
 * headless recorder may support none. Capabilities let a game or host
 * degrade gracefully without type-unsafe feature detection.
 *
 * The nine flags fall into four groups.
 *
 * ```text
 *   Output features     color, text, images, depth
 *   Geometry features   shapes, nativeShapes, clip
 *   Capture features    capture, captureStream
 * ```
 *
 * A renderer must report honestly. A flag that is `false` means a call
 * to the matching method throws with a message that names the missing
 * capability. A flag that is `true` means the call succeeds or degrades
 * to a documented fallback.
 *
 * @example
 * Example 1: Gate sprite drawing on image support
 * ```ts
 * if (renderer.capabilities.images) {
 *   frame.sprite({ id: 'ship' }, { x: 0, y: 0 });
 * }
 * ```
 *
 * @example
 * Example 2: Check shape coverage before emitting complex geometry
 * ```ts
 * import { makePath } from './geometry/shape';
 *
 * if (renderer.capabilities.nativeShapes.includes('path')) {
 *   frame.fill(makePath(segments));
 * } else {
 *   frame.fill(makeRect(boundsOfPath));
 * }
 * ```
 *
 * @example
 * Example 3: Test for capture support
 * ```ts
 * if (renderer.capabilities.capture) {
 *   const image = renderer.capture(region);
 * }
 * ```
 *
 * @see {@linkcode IRenderer}
 * @author MathAid
 */
export interface IRendererCapabilities {
  /** Whether the surface supports color output. */
  readonly color: boolean;
  /** Whether the surface can draw text. */
  readonly text: boolean;
  /** Whether the surface can draw images and sprites. */
  readonly images: boolean;
  /** Whether the surface has a depth buffer. Reserved for a 3D mode. */
  readonly depth: boolean;
  /** Whether the surface can draw shapes at all. */
  readonly shapes: boolean;
  /**
   * The shape kinds the backend draws without tessellation. A renderer
   * that tessellates everything reports an empty array. A renderer that
   * has a native rectangle primitive reports `['rect']`.
   */
  readonly nativeShapes: readonly Shape['kind'][];
  /** Whether the surface supports clipping. */
  readonly clip: boolean;
  /** Whether the surface supports synchronous pixel capture. */
  readonly capture: boolean;
  /** Whether the surface supports streaming pixel capture. */
  readonly captureStream: boolean;
}

/**
 * @summary A render mode: translates abstract frames into a concrete graphics API.
 *
 * @description
 * {@linkcode IRenderer} is the seam between the engine and any drawing
 * backend. {@linkcode IRenderer.render} consumes a completed
 * {@linkcode IFrame} and draws it. {@linkcode IRenderer.resize} resizes
 * the backing surface before the next render. The three capture methods read pixels back from
 * the surface when the backend supports it.
 *
 * The interface is the single unit of rendering extensibility. Canvas2D,
 * WebGPU, a terminal, and a headless recorder are all implementations.
 * The engine holds one active renderer. Games never see it. A render
 * mode can be added, removed, or swapped at runtime without touching
 * game or engine-core code.
 *
 * @example
 * Example 1: Attach to an engine
 * ```ts
 * const renderer = new Canvas2DRenderer(canvas.getContext('2d')!);
 * engine.setRenderer(renderer);
 * ```
 *
 * @example
 * Example 2: Record commands for assertion
 * ```ts
 * const recorder = new RecordingRenderer();
 * engine.setRenderer(recorder);
 * engine.frame(now);
 * assert.deepEqual(recorder.lastFrame?.commands, expected);
 * ```
 *
 * @example
 * Example 3: Inspect capabilities before drawing
 * ```ts
 * if (renderer.capabilities.text) {
 *   frame.text('SCORE 42', point(10, 10), { size: 16 });
 * }
 * ```
 *
 * @see {@linkcode IFrame}
 * @see {@linkcode IRendererCapabilities}
 * @author MathAid
 */
export interface IRenderer {
  /** What the backing surface supports. */
  readonly capabilities: IRendererCapabilities;

  /**
   * @summary Draw an entire frame to the backing surface.
   *
   * @description
   * Iterates the frame's commands and draws each. The call is
   * synchronous. A renderer that draws asynchronously queues the work
   * and returns immediately.
   *
   * @example
   * Example 1: Render a builder
   * ```ts
   * const builder = new FrameBuilder();
   * renderer.render(builder);
   * ```
   *
   * @param {IFrame} frame The completed command list.
   * @returns {void}
   * @author MathAid
   */
  render(frame: IFrame): void;

  /**
   * @summary Resize the backing surface.
   *
   * @description
   * The size is in logical, device-independent pixels. A renderer may
   * apply a device pixel ratio internally. The engine calls this once
   * per size change.
   *
   * @example
   * Example 1: Match the viewport
   * ```ts
   * renderer.resize(window.innerWidth, window.innerHeight);
   * ```
   *
   * @param {number} width The logical width.
   * @param {number} height The logical height.
   * @returns {void}
   * @author MathAid
   */
  resize(width: number, height: number): void;

  /**
   * @summary Read raw pixels from the surface, synchronously.
   *
   * @description
   * Returns the region's pixels as raw RGBA. Callers check
   * `capabilities.capture` first. A renderer that cannot capture
   * synchronously reports `false` and throws here.
   *
   * @param {Rect | Shape} region The capture region.
   * @param {CaptureOptions} options Optional capture parameters.
   * @returns {ImageData} The raw pixels.
   * @throws {Error} When `capabilities.capture` is `false`.
   * @author MathAid
   */
  capture(region: Rect | Shape, options?: CaptureOptions): ImageData;

  /**
   * @summary Read raw pixels from the surface, asynchronously.
   *
   * @description
   * The recommended capture path. A renderer that cannot capture
   * synchronously but can capture asynchronously reports
   * `capabilities.capture: true` and implements only this method.
   *
   * @param {Rect | Shape} region The capture region.
   * @param {CaptureOptions} options Optional capture parameters.
   * @returns {Promise<ImageData>} The raw pixels.
   * @throws {Error} When `capabilities.capture` is `false`.
   * @author MathAid
   */
  captureAsync(region: Rect | Shape, options?: CaptureOptions): Promise<ImageData>;

  /**
   * @summary Stream encoded pixels from the surface.
   *
   * @description
   * Returns a `ReadableStream` of encoded bytes. The format is set by
   * `options.format`. A renderer that cannot stream natively falls back
   * to a buffered capture wrapped in a single-chunk stream.
   *
   * @param {Rect | Shape} region The capture region.
   * @param {CaptureOptions} options Optional capture parameters.
   * @returns {ReadableStream<Uint8Array>} The encoded bytes.
   * @throws {Error} When `capabilities.captureStream` is `false`.
   * @author MathAid
   */
  captureStream(region: Rect | Shape, options?: CaptureOptions): ReadableStream<Uint8Array>;
}
