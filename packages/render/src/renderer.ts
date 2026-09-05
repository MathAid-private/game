/**
 * @fileoverview
 * @summary The renderer contract — the seam every render mode implements.
 *
 * @description
 * This module defines `IRenderer`, the environment-agnostic contract each render mode
 * implements, together with `IRendererCapabilities`, which advertises what a mode's surface can
 * do. A renderer consumes an `IFrame` of `RenderCommand`s and translates them to a concrete
 * graphics API. Because a renderer is a first-class, swappable dependency (set via
 * `IEngine.setRenderer`), adding a render mode is exactly adding an `IRenderer` implementation —
 * games and the engine core are untouched.
 *
 * @author MathAid
 */

import type { IFrame } from './frame';

/**
 * @summary Advertised capabilities of a renderer's backing surface.
 *
 * @description
 * `IRendererCapabilities` tells callers what a mode can do before they rely on it. A terminal
 * has no colour or image support; a headless recorder may support none. Capabilities let a game
 * or host degrade gracefully (e.g. drop sprites on a text-only renderer) without type-unsafe
 * feature detection.
 *
 * @example
 * if (renderer.capabilities.images) frame.sprite(ship, transform);
 *
 * @see {@link IRenderer}
 * @author MathAid
 */
export interface IRendererCapabilities {
  /** Whether the surface supports colour output. */
  readonly color: boolean;
  /** Whether the surface can draw text. */
  readonly text: boolean;
  /** Whether the surface can draw images/sprites. */
  readonly images: boolean;
  /** Whether the surface has a depth buffer (reserved for a future 3D mode). */
  readonly depth: boolean;
}

/**
 * @summary A render mode: translates abstract frames into a concrete graphics API.
 *
 * @description
 * `IRenderer` is the seam between the engine and any drawing backend. `render` consumes a
 * completed `IFrame` of `RenderCommand`s and draws them; `resize` re-sizes the backing surface
 * before the next `render`. It is the single unit of rendering extensibility: Canvas2D, WebGL,
 * a terminal, and a headless recorder are all `IRenderer` implementations.
 *
 * The engine holds one active renderer. Games never see it — they only emit commands — so a
 * render mode can be added, removed, or swapped at runtime without touching game or engine-core
 * code.
 *
 * @example
 * const renderer = new Canvas2DRenderer(canvas.getContext('2d')!);
 * engine.setRenderer(renderer);
 *
 * @example
 * // Headless: record commands without drawing anything.
 * const recorder = new RecordingRenderer();
 * engine.setRenderer(recorder);
 * engine.frame(now);
 * assert.deepEqual(recorder.lastFrame.commands, expected);
 *
 * @see {@link IFrame}
 * @see {@link IRendererCapabilities}
 * @author MathAid
 */
export interface IRenderer {
  /** What the backing surface supports. */
  readonly capabilities: IRendererCapabilities;
  /**
   * @summary Draw an entire frame to the backing surface.
   * @param frame - The completed command list produced by the game this frame.
   * @return Nothing; the frame is consumed synchronously.
   * @author MathAid
   */
  render(frame: IFrame): void;
  /**
   * @summary Resize the backing surface.
   * @param width - Logical width in device-independent pixels.
   * @param height - Logical height in device-independent pixels.
   * @author MathAid
   */
  resize(width: number, height: number): void;
}
