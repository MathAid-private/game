/**
 * @fileoverview
 * @summary Headless render modes — a no-op sink and a recording sink for tests.
 *
 * @description
 * This module provides the two render modes that draw nothing: `NoopRenderer`, which discards
 * every frame, and `RecordingRenderer`, which retains frames for later assertion. They are the
 * `IRenderer` implementations a headless engine, a server, or a test harness uses — proof that a
 * game runs identically whether or not any pixels are produced.
 *
 * @author MathAid
 */

import type { IFrame } from '../frame';
import type { IRenderer, IRendererCapabilities } from '../renderer';

/**
 * @summary Capabilities advertised by a surface that draws nothing.
 * @author MathAid
 */
const NONE_CAPABILITIES: IRendererCapabilities = {
  color: false,
  text: false,
  images: false,
  depth: false,
};

/**
 * @summary An `IRenderer` that discards every frame.
 *
 * @description
 * `NoopRenderer` satisfies the render contract while producing no output. It lets a game and
 * engine run at full speed with zero rendering cost — useful for headless simulation, load
 * testing, and servers. Every command is validated by type only; nothing is drawn.
 *
 * @example
 * engine.setRenderer(new NoopRenderer()); // simulation runs, no pixels
 *
 * @see {@link IRenderer}
 * @see {@link RecordingRenderer}
 * @author MathAid
 */
export class NoopRenderer implements IRenderer {
  /**
   * @summary Nothing is supported.
   * @author MathAid
   */
  get capabilities(): IRendererCapabilities {
    return NONE_CAPABILITIES;
  }

  /**
   * @summary Discard the frame.
   * @param _frame - Ignored.
   * @author MathAid
   */
  render(_frame: IFrame): void {}

  /**
   * @summary No-op resize.
   * @param width - Ignored.
   * @param height - Ignored.
   * @author MathAid
   */
  resize(_width: number, _height: number): void {}
}

/**
 * @summary An `IRenderer` that records frames for inspection.
 *
 * @description
 * `RecordingRenderer` keeps every frame it is handed, so a test can assert exactly which commands
 * a game emitted — without any graphics. `lastFrame` is the most recent frame, and `reset` clears
 * the log. It is the observation seam for renderer-agnostic testing.
 *
 * @example
 * const recorder = new RecordingRenderer();
 * engine.setRenderer(recorder);
 * engine.frame(now);
 * assert.deepEqual(recorder.lastFrame?.commands, expected);
 *
 * @see {@link IRenderer}
 * @see {@link NoopRenderer}
 * @author MathAid
 */
export class RecordingRenderer implements IRenderer {
  readonly #frames: IFrame[] = [];

  /**
   * @summary All frames received, in order.
   * @author MathAid
   */
  get frames(): readonly IFrame[] {
    return this.#frames;
  }

  /**
   * @summary The most recent frame, or `undefined` if none yet.
   * @author MathAid
   */
  get lastFrame(): IFrame | undefined {
    return this.#frames.at(-1);
  }

  /**
   * @summary A recording surface reports full capabilities so games emit everything.
   * @author MathAid
   */
  get capabilities(): IRendererCapabilities {
    return { color: true, text: true, images: true, depth: false };
  }

  /**
   * @summary Record a frame.
   * @param frame - The frame to retain.
   * @author MathAid
   */
  render(frame: IFrame): void {
    this.#frames.push(frame);
  }

  /**
   * @summary No-op resize.
   * @param width - Ignored.
   * @param height - Ignored.
   * @author MathAid
   */
  resize(_width: number, _height: number): void {}

  /**
   * @summary Clear all recorded frames.
   * @author MathAid
   */
  reset(): void {
    this.#frames.length = 0;
  }
}
