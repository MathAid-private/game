/**
 * @fileoverview
 * @summary Headless render modes: a no-op sink and a recording sink for tests.
 *
 * @description
 * Provides the two render modes that draw nothing. {@linkcode NoopRenderer}
 * discards every frame. {@linkcode RecordingRenderer} retains frames for
 * later assertion. Both are {@linkcode IRenderer} implementations used by
 * a headless engine, a server, or a test harness. They prove that a game
 * runs identically whether or not any pixels are produced.
 *
 * Neither renderer has a pixel surface. Both report `capture: false` and
 * `captureStream: false`. Their capture methods throw with a message that
 * names the missing capability.
 *
 * ```text
 *   NoopRenderer       capabilities all false. Draws nothing.
 *   RecordingRenderer  capabilities all true. Records frames.
 * ```
 *
 * @see {@linkcode IRenderer}
 * @author MathAid
 */

import type { IFrame } from '../frame';
import { type Rect } from '../geometry/rect';
import { type Shape } from '../geometry/shape';
import type { IRenderer, IRendererCapabilities } from '../renderer';
import type { CaptureOptions } from './capture';

/**
 * @summary Capabilities of a surface that draws nothing.
 *
 * @description
 * Every flag is `false`. `nativeShapes` is empty. The object is frozen.
 *
 * @author MathAid
 */
const NONE_CAPABILITIES: IRendererCapabilities = Object.freeze({
  color: false,
  text: false,
  images: false,
  depth: false,
  shapes: false,
  nativeShapes: Object.freeze([] as const) as readonly never[],
  clip: false,
  capture: false,
  captureStream: false,
});

/**
 * @summary Capabilities of a recorder that accepts every frame.
 *
 * @description
 * Every drawing flag is `true` so a game emits everything it would emit
 * to a real surface. The capture flags are `false` because the recorder
 * has no pixels to capture. The object is frozen.
 *
 * @author MathAid
 */
const RECORD_CAPABILITIES: IRendererCapabilities = Object.freeze({
  color: true,
  text: true,
  images: true,
  depth: false,
  shapes: true,
  nativeShapes: Object.freeze([
    'line',
    'polygon',
    'rect',
    'ellipse',
    'path',
    'group',
  ] as const) as readonly (
    | 'line'
    | 'polygon'
    | 'rect'
    | 'ellipse'
    | 'path'
    | 'group'
  )[],
  clip: true,
  capture: false,
  captureStream: false,
});

/**
 * @summary An {@linkcode IRenderer} that discards every frame.
 *
 * @description
 * {@linkcode NoopRenderer} satisfies the render contract while producing
 * no output. It lets a game and engine run at full speed with zero
 * rendering cost. Useful for headless simulation, load testing, and
 * servers. Every command is validated by type only. Nothing is drawn.
 *
 * @example
 * Example 1: Run a simulation without pixels
 * ```ts
 * engine.setRenderer(new NoopRenderer());
 * engine.start();
 * ```
 *
 * @example
 * Example 2: Benchmark game logic
 * ```ts
 * const noop = new NoopRenderer();
 * engine.setRenderer(noop);
 * for (let i = 0; i < 1000; i++) engine.frame(i / 60);
 * ```
 *
 * @see {@linkcode IRenderer}
 * @see {@linkcode RecordingRenderer}
 * @author MathAid
 */
export class NoopRenderer implements IRenderer {
  /**
   * @summary Nothing is supported.
   * @returns {IRendererCapabilities} The capabilities.
   * @author MathAid
   */
  get capabilities(): IRendererCapabilities {
    return NONE_CAPABILITIES;
  }

  /**
   * @summary Discard the frame.
   * @param {IFrame} _frame Ignored.
   * @returns {void}
   * @author MathAid
   */
  render(_frame: IFrame): void {}

  /**
   * @summary No-op resize.
   * @param {number} _width Ignored.
   * @param {number} _height Ignored.
   * @returns {void}
   * @author MathAid
   */
  resize(_width: number, _height: number): void {}

  /**
   * @summary Not supported. Always throws.
   * @param {Rect | Shape} _region Ignored.
   * @param {CaptureOptions} _options Ignored.
   * @returns {ImageData} Never. Always throws.
   * @throws {Error} Always.
   * @author MathAid
   */
  capture(_region: Rect | Shape, _options?: CaptureOptions): ImageData {
    throw new Error(
      'NoopRenderer.capture: this renderer has no pixel surface (capabilities.capture is false).',
    );
  }

  /**
   * @summary Not supported. Always throws.
   * @param {Rect | Shape} _region Ignored.
   * @param {CaptureOptions} _options Ignored.
   * @returns {Promise<ImageData>} Never. Always throws.
   * @throws {Error} Always.
   * @author MathAid
   */
  async captureAsync(
    _region: Rect | Shape,
    _options?: CaptureOptions,
  ): Promise<ImageData> {
    throw new Error(
      'NoopRenderer.captureAsync: this renderer has no pixel surface (capabilities.capture is false).',
    );
  }

  /**
   * @summary Not supported. Always throws.
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
      'NoopRenderer.captureStream: this renderer has no pixel surface (capabilities.captureStream is false).',
    );
  }
}

/**
 * @summary An {@linkcode IRenderer} that records frames for inspection.
 *
 * @description
 * {@linkcode RecordingRenderer} keeps every frame it is handed. A test
 * can assert exactly which commands a game emitted, without any graphics.
 * {@linkcode RecordingRenderer.lastFrame} is the most recent frame.
 * {@linkcode RecordingRenderer.reset} clears the log.
 *
 * The recorder is the observation seam for renderer-agnostic testing.
 * It has no pixel surface, so the capture methods throw.
 *
 * @example
 * Example 1: Record and assert
 * ```ts
 * const recorder = new RecordingRenderer();
 * engine.setRenderer(recorder);
 * engine.frame(now);
 * assert.deepEqual(recorder.lastFrame?.commands, expected);
 * ```
 *
 * @example
 * Example 2: Inspect the full history
 * ```ts
 * const recorder = new RecordingRenderer();
 * engine.setRenderer(recorder);
 * for (let i = 0; i < 10; i++) engine.frame(i);
 * expect(recorder.frames).toHaveLength(10);
 * ```
 *
 * @example
 * Example 3: Clear between tests
 * ```ts
 * beforeEach(() => recorder.reset());
 * ```
 *
 * @see {@linkcode IRenderer}
 * @see {@linkcode NoopRenderer}
 * @author MathAid
 */
export class RecordingRenderer implements IRenderer {
  readonly #frames: IFrame[] = [];

  /**
   * @summary All frames received, in order.
   * @returns {readonly IFrame[]} The frame log.
   * @author MathAid
   */
  get frames(): readonly IFrame[] {
    return this.#frames;
  }

  /**
   * @summary The most recent frame, or `undefined` when none was recorded.
   * @returns {IFrame | undefined} The last frame.
   * @author MathAid
   */
  get lastFrame(): IFrame | undefined {
    return this.#frames.at(-1);
  }

  /**
   * @summary The advertised capabilities.
   * @returns {IRendererCapabilities} The capabilities.
   * @author MathAid
   */
  get capabilities(): IRendererCapabilities {
    return RECORD_CAPABILITIES;
  }

  /**
   * @summary Record a frame.
   * @param {IFrame} frame The frame to retain.
   * @returns {void}
   * @author MathAid
   */
  render(frame: IFrame): void {
    this.#frames.push(frame);
  }

  /**
   * @summary No-op resize.
   * @param {number} _width Ignored.
   * @param {number} _height Ignored.
   * @returns {void}
   * @author MathAid
   */
  resize(_width: number, _height: number): void {}

  /**
   * @summary Clear all recorded frames.
   * @returns {void}
   * @author MathAid
   */
  reset(): void {
    this.#frames.length = 0;
  }

  /**
   * @summary Not supported. Always throws.
   *
   * @description
   * The recorder has no pixel surface. The method throws with a message
   * that names the missing capability. Callers check
   * `capabilities.capture` before calling.
   *
   * @example
   * Example 1: The throw
   * ```ts
   * const recorder = new RecordingRenderer();
   * try { recorder.capture(rect(0, 0, 1, 1)); }
   * catch (e) { /* Error: RecordingRenderer has no pixel surface *\/ }
   * ```
   *
   * @param {Rect | Shape} _region Ignored.
   * @param {CaptureOptions} _options Ignored.
   * @returns {ImageData} Never. Always throws.
   * @throws {Error} Always.
   * @author MathAid
   */
  capture(_region: Rect | Shape, _options?: CaptureOptions): ImageData {
    throw new Error(
      'RecordingRenderer.capture: this renderer has no pixel surface (capabilities.capture is false).',
    );
  }

  /**
   * @summary Not supported. Always throws.
   *
   * @description
   * The recorder has no pixel surface. The method throws with a message
   * that names the missing capability. Callers check
   * `capabilities.capture` before calling.
   *
   * @param {Rect | Shape} _region Ignored.
   * @param {CaptureOptions} _options Ignored.
   * @returns {Promise<ImageData>} Never. Always throws.
   * @throws {Error} Always.
   * @author MathAid
   */
  async captureAsync(
    _region: Rect | Shape,
    _options?: CaptureOptions,
  ): Promise<ImageData> {
    throw new Error(
      'RecordingRenderer.captureAsync: this renderer has no pixel surface (capabilities.capture is false).',
    );
  }

  /**
   * @summary Not supported. Always throws.
   *
   * @description
   * The recorder has no pixel surface. The method throws with a message
   * that names the missing capability. Callers check
   * `capabilities.captureStream` before calling.
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
      'RecordingRenderer.captureStream: this renderer has no pixel surface (capabilities.captureStream is false).',
    );
  }
}