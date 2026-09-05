/**
 * @fileoverview
 * @summary The frame contracts — the builder a game writes into and the frame a renderer reads.
 *
 * @description
 * This module defines the two halves of a frame. A game receives an `IFrameBuilder` during
 * `present()` and *emits* `RenderCommand`s into it; the engine collects those commands into an
 * `IFrame` and hands that to an `IRenderer`. The game never sees the renderer, and the renderer
 * never sees the game — the frame in between is the shared, renderer-agnostic contract.
 *
 * @author MathAid
 */

import type { Color, Point2D, Rect, Transform2D } from '@games/math';
import type { RenderCommand, SpriteRef, StrokeStyle, TextStyle } from './command';

/**
 * @summary A completed frame: the ordered list of commands a renderer consumes.
 *
 * @description
 * `IFrame` is the immutable result of one presentation pass — a read-only sequence of
 * `RenderCommand`s in draw order. It carries no state and no identity; a renderer simply
 * iterates `commands` and translates each. Keeping it read-only makes frames safe to hand
 * across a decoupling boundary (even, later, to a worker).
 *
 * @see {@link IFrameBuilder}
 * @see {@link RenderCommand}
 * @author MathAid
 */
export interface IFrame {
  /** Draw commands in order. */
  readonly commands: readonly RenderCommand[];
}

/**
 * @summary The output a game writes into during `present()`.
 *
 * @description
 * `IFrameBuilder` is the imperative surface a game uses to describe one frame. Each method
 * appends a `RenderCommand` in call order, so a game builds a frame as a sequence of
 * instructions rather than drawing to a context. The engine supplies the concrete builder; a
 * game only ever sees this interface, which is what keeps it portable across render modes.
 *
 * `push`/`pop` scope subsequent commands to a saved/restored state, matching the `push`/`pop`
 * command variants.
 *
 * @example
 * function present({ frame }: IPresentationContext<IFrameBuilder>): void {
 *   frame.clear(black);
 *   frame.rect(this.board, undefined, whiteBorder);
 * }
 *
 * @see {@link IFrame}
 * @author MathAid
 */
export interface IFrameBuilder {
  /**
   * @summary Clear the surface (optionally to a colour) as the first command.
   * @param color - The clear colour; omit for a transparent/blank clear.
   * @author MathAid
   */
  clear(color?: Color): void;
  /**
   * @summary Draw a filled and/or stroked rectangle.
   * @param rect - The rectangle's position and size.
   * @param fill - Fill colour; omit for no fill.
   * @param stroke - Stroke style; omit for no outline.
   * @author MathAid
   */
  rect(rect: Rect, fill?: Color, stroke?: StrokeStyle): void;
  /**
   * @summary Draw a sprite at a transform.
   * @param sprite - The sprite asset to draw.
   * @param transform - Placement, scale, and rotation.
   * @author MathAid
   */
  sprite(sprite: SpriteRef, transform: Transform2D): void;
  /**
   * @summary Draw a text string at a position.
   * @param text - The string to draw.
   * @param position - The anchor position.
   * @param style - Text style (colour, size, alignment).
   * @author MathAid
   */
  text(text: string, position: Point2D, style: TextStyle): void;
  /**
   * @summary Save the current transform/style state.
   * @author MathAid
   */
  push(): void;
  /**
   * @summary Restore the most recently saved state.
   * @author MathAid
   */
  pop(): void;
}
