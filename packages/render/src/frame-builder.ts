/**
 * @fileoverview
 * @summary The concrete frame builder: accumulates render commands into a frame.
 *
 * @description
 * Provides {@linkcode FrameBuilder}, a single object that serves both
 * halves of a frame. A game writes {@linkcode RenderCommand} values into
 * it during `present()` through the {@linkcode IFrameBuilder} surface.
 * The engine then hands the same object to a renderer as the completed
 * {@linkcode IFrame}.
 *
 * The class has no graphics API dependency. It works identically behind
 * every render mode. A long-lived builder reuses its internal array
 * across frames when {@linkcode FrameBuilder.reset} is called.
 *
 * @example
 * Example 1: Build and render
 * ```ts
 * const builder = new FrameBuilder();
 * game.present({ alpha, frame: builder });
 * renderer.render(builder);
 * ```
 *
 * @example
 * Example 2: Reuse across frames
 * ```ts
 * const builder = new FrameBuilder();
 * for (let i = 0; i < 60; i++) {
 *   builder.reset();
 *   game.present({ alpha: i / 60, frame: builder });
 *   renderer.render(builder);
 * }
 * ```
 *
 * @see {@linkcode IFrame}
 * @see {@linkcode IFrameBuilder}
 * @see {@linkcode RenderCommand}
 * @author MathAid
 */

import type { RenderCommand, SpriteRef } from './command';
import type { IFrame, IFrameBuilder } from './frame';
import { type Paint } from './geometry/paint';
import { type Point2D } from './geometry/point';
import { type Rect } from './geometry/rect';
import {
  type Shape,
  makeCircle,
  makeEllipse,
  makeLine,
  makePolygon,
  makeRect,
} from './geometry/shape';
import { type StrokeStyle, type TextStyle } from './geometry/style';
import {
  type Mat2D,
  type Transform2D,
  compose,
  identity,
  rotation,
  scaling,
  toMat2D,
  translation,
} from './geometry/transform';

/**
 * @summary An {@linkcode IFrameBuilder} that is also the {@linkcode IFrame} it produces.
 *
 * @description
 * {@linkcode FrameBuilder} accumulates draw commands in call order and
 * exposes them read-only as `commands`. The same instance a game writes
 * into can be passed straight to {@linkcode IRenderer.render}.
 *
 * The builder tracks a current transform for the `translate`, `rotate`,
 * `scale`, and `transform` methods. The tracker resets at every `reset`.
 * The renderer maintains its own state stack. The builder's tracker is
 * only for composing relative transforms into absolute matrices.
 *
 * @example
 * Example 1: Build a frame
 * ```ts
 * const builder = new FrameBuilder();
 * builder.clear(makeSolid(make(sRGB, 0, 0, 0)));
 * builder.fillRect(rect(0, 0, 32, 32), makeSolid(make(sRGB, 1, 0, 0)));
 * ```
 *
 * @example
 * Example 2: Reuse across frames
 * ```ts
 * const builder = new FrameBuilder();
 * function tick(): void {
 *   builder.reset();
 *   game.present({ alpha, frame: builder });
 *   renderer.render(builder);
 * }
 * ```
 *
 * @see {@linkcode IFrameBuilder}
 * @see {@linkcode IFrame}
 * @see {@linkcode IRenderer}
 * @author MathAid
 */
export class FrameBuilder implements IFrameBuilder, IFrame {
  readonly #commands: RenderCommand[] = [];
  #currentTransform: Mat2D = identity();

  /**
   * @summary The accumulated draw commands, in order.
   * @returns {readonly RenderCommand[]} The command list.
   * @author MathAid
   */
  get commands(): readonly RenderCommand[] {
    return this.#commands;
  }

  /**
   * @summary Fill the surface, optionally to a paint.
   * @param {Paint} paint The fill paint. Optional.
   * @returns {void}
   * @author MathAid
   */
  clear(paint?: Paint): void {
    this.#commands.push({ kind: 'clear', paint });
  }

  /**
   * @summary Set the background paint.
   * @param {Paint | null} paint The background paint. `null` disables.
   * @returns {void}
   * @author MathAid
   */
  setBackground(paint: Paint | null): void {
    this.#commands.push({ kind: 'set-background', paint });
  }

  /**
   * @summary Set the fill paint.
   * @param {Paint | null} paint The fill paint. `null` disables.
   * @returns {void}
   * @author MathAid
   */
  setFill(paint: Paint | null): void {
    this.#commands.push({ kind: 'set-fill', paint });
  }

  /**
   * @summary Set the stroke style.
   * @param {StrokeStyle | null} stroke The stroke style. `null` disables.
   * @returns {void}
   * @author MathAid
   */
  setStroke(stroke: StrokeStyle | null): void {
    this.#commands.push({ kind: 'set-stroke', stroke });
  }

  /**
   * @summary Replace the current transform.
   * @param {Mat2D | Transform2D} m The new transform.
   * @returns {void}
   * @author MathAid
   */
  setTransform(m: Mat2D | Transform2D): void {
    const matrix = toMat2D(m);
    this.#currentTransform = matrix;
    this.#commands.push({ kind: 'set-transform', transform: matrix });
  }

  /**
   * @summary Reset the transform to the identity.
   * @returns {void}
   * @author MathAid
   */
  resetTransform(): void {
    this.setTransform(identity());
  }

  /**
   * @summary Compose a translation onto the current transform.
   * @param {number} x The horizontal shift.
   * @param {number} y The vertical shift.
   * @returns {void}
   * @author MathAid
   */
  translate(x: number, y: number): void {
    this.setTransform(compose(this.#currentTransform, translation(x, y)));
  }

  /**
   * @summary Compose a rotation onto the current transform.
   * @param {number} rad The angle in radians.
   * @returns {void}
   * @author MathAid
   */
  rotate(rad: number): void {
    this.setTransform(compose(this.#currentTransform, rotation(rad)));
  }

  /**
   * @summary Compose a scale onto the current transform.
   * @param {number} sx The horizontal scale.
   * @param {number} sy The vertical scale. Defaults to `sx`.
   * @returns {void}
   * @author MathAid
   */
  scale(sx: number, sy?: number): void {
    this.setTransform(compose(this.#currentTransform, scaling(sx, sy ?? sx)));
  }

  /**
   * @summary Compose an arbitrary matrix onto the current transform.
   * @param {Mat2D} m The matrix to compose.
   * @returns {void}
   * @author MathAid
   */
  transform(m: Mat2D): void {
    this.setTransform(compose(this.#currentTransform, m));
  }

  /**
   * @summary Restrict subsequent drawing to a shape's interior.
   * @param {Shape} shape The clip shape.
   * @returns {void}
   * @author MathAid
   */
  clip(shape: Shape): void {
    this.#commands.push({ kind: 'clip', shape });
  }

  /**
   * @summary Restrict subsequent drawing to a rectangle.
   * @param {Rect} rect The clip rectangle.
   * @returns {void}
   * @author MathAid
   */
  clipRect(rect: Rect): void {
    this.clip(makeRect(rect));
  }

  /**
   * @summary Fill a shape.
   * @param {Shape} shape The shape geometry.
   * @param {Paint} paint The fill paint. Optional.
   * @returns {void}
   * @author MathAid
   */
  fill(shape: Shape, paint?: Paint): void {
    this.#commands.push({ kind: 'fill-shape', shape, paint });
  }

  /**
   * @summary Fill a polygon.
   * @param {readonly Point2D[]} points The vertices.
   * @param {Paint} paint The fill paint. Optional.
   * @returns {void}
   * @author MathAid
   */
  fillPolygon(points: readonly Point2D[], paint?: Paint): void {
    this.fill(makePolygon(points, true), paint);
  }

  /**
   * @summary Fill a rectangle.
   * @param {Rect} rect The rectangle geometry.
   * @param {Paint} paint The fill paint. Optional.
   * @returns {void}
   * @author MathAid
   */
  fillRect(rect: Rect, paint?: Paint): void {
    this.fill(makeRect(rect), paint);
  }

  /**
   * @summary Fill an ellipse.
   * @param {Point2D} center The center point.
   * @param {number} radiusX The horizontal radius.
   * @param {number} radiusY The vertical radius.
   * @param {Paint} paint The fill paint. Optional.
   * @returns {void}
   * @author MathAid
   */
  fillEllipse(center: Point2D, radiusX: number, radiusY: number, paint?: Paint): void {
    this.fill(makeEllipse(center, radiusX, radiusY), paint);
  }

  /**
   * @summary Fill a circle.
   * @param {Point2D} center The center point.
   * @param {number} radius The radius.
   * @param {Paint} paint The fill paint. Optional.
   * @returns {void}
   * @author MathAid
   */
  fillCircle(center: Point2D, radius: number, paint?: Paint): void {
    this.fill(makeCircle(center, radius), paint);
  }

  /**
   * @summary Stroke a shape.
   * @param {Shape} shape The shape geometry.
   * @param {StrokeStyle} stroke The stroke style. Optional.
   * @returns {void}
   * @author MathAid
   */
  stroke(shape: Shape, stroke?: StrokeStyle): void {
    this.#commands.push({ kind: 'stroke-shape', shape, stroke });
  }

  /**
   * @summary Stroke a line segment.
   * @param {Point2D} from The start point.
   * @param {Point2D} to The end point.
   * @param {StrokeStyle} stroke The stroke style. Optional.
   * @returns {void}
   * @author MathAid
   */
  strokeLine(from: Point2D, to: Point2D, stroke?: StrokeStyle): void {
    this.stroke(makeLine(from, to), stroke);
  }

  /**
   * @summary Stroke a polygon.
   * @param {readonly Point2D[]} points The vertices.
   * @param {boolean} closed Whether the last vertex connects to the first.
   * @param {StrokeStyle} stroke The stroke style. Optional.
   * @returns {void}
   * @author MathAid
   */
  strokePolygon(points: readonly Point2D[], closed: boolean, stroke?: StrokeStyle): void {
    this.stroke(makePolygon(points, closed), stroke);
  }

  /**
   * @summary Stroke a rectangle.
   * @param {Rect} rect The rectangle geometry.
   * @param {StrokeStyle} stroke The stroke style. Optional.
   * @returns {void}
   * @author MathAid
   */
  strokeRect(rect: Rect, stroke?: StrokeStyle): void {
    this.stroke(makeRect(rect), stroke);
  }

  /**
   * @summary Stroke an ellipse.
   * @param {Point2D} center The center point.
   * @param {number} radiusX The horizontal radius.
   * @param {number} radiusY The vertical radius.
   * @param {StrokeStyle} stroke The stroke style. Optional.
   * @returns {void}
   * @author MathAid
   */
  strokeEllipse(center: Point2D, radiusX: number, radiusY: number, stroke?: StrokeStyle): void {
    this.stroke(makeEllipse(center, radiusX, radiusY), stroke);
  }

  /**
   * @summary Stroke a circle.
   * @param {Point2D} center The center point.
   * @param {number} radius The radius.
   * @param {StrokeStyle} stroke The stroke style. Optional.
   * @returns {void}
   * @author MathAid
   */
  strokeCircle(center: Point2D, radius: number, stroke?: StrokeStyle): void {
    this.stroke(makeCircle(center, radius), stroke);
  }

  /**
   * @summary Draw a filled and stroked rectangle.
   * @param {Rect} rect The rectangle geometry.
   * @param {Paint} fill The fill paint. Optional.
   * @param {StrokeStyle} stroke The stroke style. Optional.
   * @returns {void}
   * @author MathAid
   */
  rect(rect: Rect, fill?: Paint, stroke?: StrokeStyle): void {
    const shape = makeRect(rect);
    if (fill !== undefined) {
      this.fill(shape, fill);
    }
    if (stroke !== undefined) {
      this.stroke(shape, stroke);
    }
  }

  /**
   * @summary Draw a sprite at a transform.
   * @param {SpriteRef} sprite The sprite asset.
   * @param {Mat2D | Transform2D} transform The placement, scale, and
   * rotation.
   * @returns {void}
   * @author MathAid
   */
  sprite(sprite: SpriteRef, transform: Mat2D | Transform2D): void {
    this.#commands.push({
      kind: 'sprite',
      sprite,
      transform: toMat2D(transform),
    });
  }

  /**
   * @summary Draw a text string at a position.
   * @param {string} text The string to draw.
   * @param {Point2D} position The anchor position.
   * @param {TextStyle} style The text style.
   * @returns {void}
   * @author MathAid
   */
  text(text: string, position: Point2D, style: TextStyle): void {
    this.#commands.push({ kind: 'text', text, position, style });
  }

  /**
   * @summary Save the current transform and style state.
   * @returns {void}
   * @author MathAid
   */
  push(): void {
    this.#commands.push({ kind: 'push' });
  }

  /**
   * @summary Restore the most recently saved state.
   * @returns {void}
   * @author MathAid
   */
  pop(): void {
    this.#commands.push({ kind: 'pop' });
  }

  /**
   * @summary Discard all accumulated commands for reuse.
   * @returns {void}
   * @author MathAid
   */
  reset(): void {
    this.#commands.length = 0;
    this.#currentTransform = identity();
  }
}
