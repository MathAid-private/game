/**
 * @fileoverview
 * @summary The concrete frame builder — accumulates render commands into a frame.
 *
 * @description
 * This module provides `FrameBuilder`, a single object that serves both halves of a frame: a
 * game writes `RenderCommand`s into it during `present()` (the `IFrameBuilder` surface), and the
 * engine then hands the same object to a renderer as the completed `IFrame`. Accumulating and
 * reading from one object keeps the frame lifecycle allocation-light and the wiring trivial.
 *
 * @author MathAid
 */

import type { Color, Point2D, Rect, Transform2D } from '@games/math';
import type { RenderCommand, SpriteRef, StrokeStyle, TextStyle } from './command';
import type { IFrame, IFrameBuilder } from './frame';

/**
 * @summary An `IFrameBuilder` that is also the `IFrame` it produces.
 *
 * @description
 * `FrameBuilder` accumulates draw commands in call order and exposes them read-only as
 * `commands`, so the same instance a game writes into can be passed straight to
 * `IRenderer.render`. `reset` clears the accumulated commands so a long-lived builder can be
 * reused across frames without reallocating.
 *
 * It is pure data plus append methods — no graphics API — so it works identically behind every
 * render mode.
 *
 * @example
 * const builder = new FrameBuilder();
 * game.present({ alpha, frame: builder });
 * renderer.render(builder); // builder.commands is the frame
 *
 * @see {@link IFrameBuilder}
 * @see {@link IFrame}
 * @author MathAid
 */
export class FrameBuilder implements IFrameBuilder, IFrame {
  readonly #commands: RenderCommand[] = [];

  /**
   * @summary The accumulated draw commands, in order.
   * @author MathAid
   */
  get commands(): readonly RenderCommand[] {
    return this.#commands;
  }

  /**
   * @summary Clear the surface (optionally to a colour) as the first command.
   * @param color - The clear colour; omit for a transparent/blank clear.
   * @author MathAid
   */
  clear(color?: Color): void {
    this.#commands.push({ kind: 'clear', color });
  }

  /**
   * @summary Draw a filled and/or stroked rectangle.
   * @param rect - The rectangle's position and size.
   * @param fill - Fill colour; omit for no fill.
   * @param stroke - Stroke style; omit for no outline.
   * @author MathAid
   */
  rect(rect: Rect, fill?: Color, stroke?: StrokeStyle): void {
    this.#commands.push({ kind: 'rect', rect, fill, stroke });
  }

  /**
   * @summary Draw a sprite at a transform.
   * @param sprite - The sprite asset to draw.
   * @param transform - Placement, scale, and rotation.
   * @author MathAid
   */
  sprite(sprite: SpriteRef, transform: Transform2D): void {
    this.#commands.push({ kind: 'sprite', sprite, transform });
  }

  /**
   * @summary Draw a text string at a position.
   * @param text - The string to draw.
   * @param position - The anchor position.
   * @param style - Text style (colour, size, alignment).
   * @author MathAid
   */
  text(text: string, position: Point2D, style: TextStyle): void {
    this.#commands.push({ kind: 'text', text, position, style });
  }

  /**
   * @summary Save the current transform/style state.
   * @author MathAid
   */
  push(): void {
    this.#commands.push({ kind: 'push' });
  }

  /**
   * @summary Restore the most recently saved state.
   * @author MathAid
   */
  pop(): void {
    this.#commands.push({ kind: 'pop' });
  }

  /**
   * @summary Discard all accumulated commands for reuse.
   * @author MathAid
   */
  reset(): void {
    this.#commands.length = 0;
  }
}
