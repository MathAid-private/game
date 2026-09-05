/**
 * @fileoverview
 * @summary The Canvas2D render mode — translates render commands to the Canvas 2D API.
 *
 * @description
 * This module provides `Canvas2DRenderer`, the first concrete `IRenderer`. It walks an `IFrame`'s
 * command list and draws each command with the HTML Canvas 2D context. It is the reference
 * implementation that proves the command-list seam: a game emits the same commands regardless of
 * whether this renderer, a WebGL renderer, or a terminal renderer ultimately draws them.
 *
 * @author MathAid
 */

import type { Color, Rect } from '@games/math';
import type { RenderCommand, StrokeStyle, TextStyle } from '../command';
import type { IFrame } from '../frame';
import type { IRenderer, IRendererCapabilities } from '../renderer';

/**
 * @summary Capabilities of a Canvas 2D surface.
 * @author MathAid
 */
const CANVAS_CAPABILITIES: IRendererCapabilities = {
  color: true,
  text: true,
  images: true,
  depth: false,
};

/**
 * @summary Convert a normalised `Color` to a CSS `rgba()` string.
 * @param color - The colour with components in `0..1`.
 * @return A CSS colour string the Canvas API accepts.
 * @author MathAid
 */
function toCssColor(color: Color): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `rgba(${r}, ${g}, ${b}, ${color.a})`;
}

/**
 * @summary An `IRenderer` that draws frames with the Canvas 2D API.
 *
 * @description
 * `Canvas2DRenderer` owns a `CanvasRenderingContext2D` and translates every `RenderCommand` to
 * the matching Canvas call: `clear` to clear/fill the surface, `rect` to `fillRect`/`strokeRect`,
 * `text` to `fillText`, and `push`/`pop` to `save`/`restore`. Colours are normalised `0..1` and
 * converted to CSS here — the one place the engine's colour representation meets a concrete API.
 *
 * `resize` resets the backing canvas to the given logical size. DPI scaling is deliberately left
 * to a later refinement; this renderer draws at logical resolution.
 *
 * @example
 * const renderer = new Canvas2DRenderer(canvas.getContext('2d')!);
 * engine.setRenderer(renderer);
 *
 * @see {@link IRenderer}
 * @author MathAid
 */
export class Canvas2DRenderer implements IRenderer {
  readonly #ctx: CanvasRenderingContext2D;

  /**
   * @summary Construct a renderer over an existing 2D context.
   * @param ctx - The `CanvasRenderingContext2D` to draw into.
   * @author MathAid
   */
  constructor(ctx: CanvasRenderingContext2D) {
    this.#ctx = ctx;
  }

  /**
   * @summary The backing 2D context.
   * @author MathAid
   */
  get context(): CanvasRenderingContext2D {
    return this.#ctx;
  }

  /**
   * @summary Canvas 2D supports colour, text, and images (no depth).
   * @author MathAid
   */
  get capabilities(): IRendererCapabilities {
    return CANVAS_CAPABILITIES;
  }

  /**
   * @summary Resize the backing canvas (resets its context state).
   * @param width - Logical width in device-independent pixels.
   * @param height - Logical height in device-independent pixels.
   * @author MathAid
   */
  resize(width: number, height: number): void {
    this.#ctx.canvas.width = width;
    this.#ctx.canvas.height = height;
  }

  /**
   * @summary Draw an entire frame to the backing canvas.
   * @param frame - The completed command list to draw.
   * @author MathAid
   */
  render(frame: IFrame): void {
    for (const command of frame.commands) this.#draw(command);
  }

  /**
   * @summary Dispatch a single command to its Canvas operation.
   * @param command - The command to draw.
   * @author MathAid
   */
  #draw(command: RenderCommand): void {
    switch (command.kind) {
      case 'clear':
        this.#clear(command.color);
        break;
      case 'rect':
        this.#rect(command.rect, command.fill, command.stroke);
        break;
      case 'text':
        this.#text(command.text, command.position.x, command.position.y, command.style);
        break;
      case 'sprite':
        this.#sprite(command.transform.x, command.transform.y, command.transform.scaleX ?? 1, command.transform.scaleY ?? 1);
        break;
      case 'push':
        this.#ctx.save();
        break;
      case 'pop':
        this.#ctx.restore();
        break;
    }
  }

  /**
   * @summary Clear the surface, optionally to a colour.
   * @param color - Fill colour, or `undefined` for a transparent clear.
   * @author MathAid
   */
  #clear(color?: Color): void {
    const { width, height } = this.#ctx.canvas;
    if (color === undefined) {
      this.#ctx.clearRect(0, 0, width, height);
      return;
    }
    this.#ctx.fillStyle = toCssColor(color);
    this.#ctx.fillRect(0, 0, width, height);
  }

  /**
   * @summary Draw a filled and/or stroked rectangle.
   * @param rect - The rectangle geometry.
   * @param fill - Fill colour, if any.
   * @param stroke - Stroke style, if any.
   * @author MathAid
   */
  #rect(rect: Rect, fill?: Color, stroke?: StrokeStyle): void {
    if (fill !== undefined) {
      this.#ctx.fillStyle = toCssColor(fill);
      this.#ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
    if (stroke !== undefined) {
      this.#ctx.strokeStyle = toCssColor(stroke.color);
      this.#ctx.lineWidth = stroke.width ?? 1;
      this.#ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  /**
   * @summary Draw a text string.
   * @param text - The string to draw.
   * @param x - Anchor x.
   * @param y - Anchor y.
   * @param style - Text style.
   * @author MathAid
   */
  #text(text: string, x: number, y: number, style: TextStyle): void {
    this.#ctx.fillStyle = style.color !== undefined ? toCssColor(style.color) : this.#ctx.fillStyle;
    if (style.size !== undefined) this.#ctx.font = `${style.size}px monospace`;
    this.#ctx.textAlign = style.align ?? 'left';
    this.#ctx.textBaseline = 'top';
    this.#ctx.fillText(text, x, y);
  }

  /**
   * @summary Draw a sprite placeholder at a transform.
   *
   * @description
   * Sprite assets require a registry mapping `SpriteRef.id` to an image or shape, which is a
   * later refinement. Until then this renders a unit placeholder at the transform so sprite
   * commands are visible and layout is verifiable.
   *
   * @param x - Horizontal translation.
   * @param y - Vertical translation.
   * @param scaleX - Horizontal scale.
   * @param scaleY - Vertical scale.
   * @author MathAid
   */
  #sprite(x: number, y: number, scaleX: number, scaleY: number): void {
    this.#ctx.save();
    this.#ctx.translate(x, y);
    this.#ctx.scale(scaleX, scaleY);
    this.#ctx.fillStyle = 'magenta';
    this.#ctx.fillRect(0, 0, 1, 1);
    this.#ctx.restore();
  }
}
