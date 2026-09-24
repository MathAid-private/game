/**
 * @fileoverview
 * @summary The frame contracts: the builder a game writes into and the frame a renderer reads.
 *
 * @description
 * Defines the two halves of a frame. A game receives an
 * {@linkcode IFrameBuilder} during `present()` and emits
 * {@linkcode RenderCommand} values into it. The engine collects those
 * commands into an {@linkcode IFrame} and hands that to an
 * {@linkcode IRenderer}. The game never sees the renderer, and the
 * renderer never sees the game.
 *
 * The builder surface is imperative. Each method appends a command in
 * call order. The interface has methods for state, for shape drawing,
 * and for sprites and text.
 *
 * @see {@linkcode RenderCommand}
 * @see {@linkcode IFrameBuilder}
 * @author MathAid
 */

import type { RenderCommand, SpriteRef } from './command';
import { type Paint } from './geometry/paint';
import { type Point2D } from './geometry/point';
import { type Rect } from './geometry/rect';
import { type Shape } from './geometry/shape';
import { type StrokeStyle, type TextStyle } from './geometry/style';
import { type Mat2D, type Transform2D } from './geometry/transform';

/**
 * @summary A completed frame: the ordered list of commands a renderer consumes.
 *
 * @description
 * {@linkcode IFrame} is the immutable result of one presentation pass. It
 * is a read-only sequence of {@linkcode RenderCommand} values in draw
 * order. It carries no state and no identity. A renderer iterates
 * `commands` and translates each.
 *
 * @example
 * Example 1: Iterate a frame
 * ```ts
 * function draw(frame: IFrame, renderer: IRenderer): void {
 *   renderer.render(frame);
 * }
 * ```
 *
 * @see {@linkcode IFrameBuilder}
 * @see {@linkcode RenderCommand}
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
 * {@linkcode IFrameBuilder} is the imperative surface a game uses to
 * describe one frame. Each method appends a {@linkcode RenderCommand} in
 * call order. The engine supplies the concrete builder. A game only sees
 * this interface, which is what keeps it portable across render modes.
 *
 * The builder has three families of methods.
 *
 * ```text
 *   State methods    clear, setBackground, setFill, setStroke,
 *                    setTransform, resetTransform, translate, rotate,
 *                    scale, transform, clip, clipRect,
 *                    push, pop
 *   Shape methods    fill, fillPolygon, fillRect, fillEllipse, fillCircle,
 *                    stroke, strokeLine, strokePolygon, strokeRect,
 *                    strokeEllipse, strokeCircle, rect
 *   Sprite methods   sprite, text
 * ```
 *
 * @example
 * Example 1: A present method
 * ```ts
 * function present({ frame }: IPresentationContext<IFrameBuilder>): void {
 *   frame.clear(makeSolid(make(sRGB, 0, 0, 0)));
 *   frame.setFill(makeSolid(make(sRGB, 1, 1, 1)));
 *   frame.fillRect(rect(0, 0, 32, 32));
 * }
 * ```
 *
 * @see {@linkcode IFrame}
 * @see {@linkcode RenderCommand}
 * @author MathAid
 */
export interface IFrameBuilder {
  /**
   * @summary Fill the surface, optionally to a paint.
   * @param {Paint} paint The fill paint. Optional.
   * @returns {void}
   * @author MathAid
   */
  clear(paint?: Paint): void;

  /**
   * @summary Set the background paint applied before every frame.
   * @param {Paint | null} paint The background paint. `null` disables.
   * @returns {void}
   * @author MathAid
   */
  setBackground(paint: Paint | null): void;

  /**
   * @summary Set the fill paint for subsequent shape fills.
   * @param {Paint | null} paint The fill paint. `null` disables.
   * @returns {void}
   * @author MathAid
   */
  setFill(paint: Paint | null): void;

  /**
   * @summary Set the stroke style for subsequent shape strokes.
   * @param {StrokeStyle | null} stroke The stroke style. `null` disables.
   * @returns {void}
   * @author MathAid
   */
  setStroke(stroke: StrokeStyle | null): void;

  /**
   * @summary Replace the current transform.
   * @param {Mat2D | Transform2D} m The new transform.
   * @returns {void}
   * @author MathAid
   */
  setTransform(m: Mat2D | Transform2D): void;

  /**
   * @summary Reset the transform to the identity.
   * @returns {void}
   * @author MathAid
   */
  resetTransform(): void;

  /**
   * @summary Compose a translation onto the current transform.
   *
   * @description
   * Adds a translation matrix to the builder's current transform. The
   * composition order is current times translation, so the new translation
   * applies in the frame already established by earlier transform calls.
   *
   * A chain of `translate` calls accumulates. The builder emits one
   * `set-transform` command per call. The renderer applies the last matrix
   * it receives.
   *
   * @example
   * Example 1: A single translation
   * ```ts
   * const b = new FrameBuilder();
   * b.translate(100, 50);
   * // emits set-transform with matrix [1, 0, 0, 1, 100, 50]
   * ```
   *
   * @example
   * Example 2: A chain of translations
   * ```ts
   * const b = new FrameBuilder();
   * b.translate(10, 0);
   * b.translate(5, 5);
   * // the last set-transform carries [1, 0, 0, 1, 15, 5]
   * ```
   *
   * @example
   * Example 3: Translate in a rotated frame
   * ```ts
   * const b = new FrameBuilder();
   * b.rotate(Math.PI / 2);
   * b.translate(10, 0);
   * // the translation is applied along the rotated x-axis.
   * ```
   *
   * @param {number} x The horizontal shift in the current frame.
   * @param {number} y The vertical shift in the current frame.
   * @returns {void}
   * @author MathAid
   */
  translate(x: number, y: number): void;

  /**
   * @summary Compose a rotation onto the current transform.
   * @param {number} rad The angle in radians.
   * @returns {void}
   * @author MathAid
   */
  rotate(rad: number): void;

  /**
   * @summary Compose a scale onto the current transform.
   * @param {number} sx The horizontal scale.
   * @param {number} sy The vertical scale. Defaults to `sx`.
   * @returns {void}
   * @author MathAid
   */
  scale(sx: number, sy?: number): void;

  /**
   * @summary Compose an arbitrary matrix onto the current transform.
   * @param {Mat2D} m The matrix to compose.
   * @returns {void}
   * @author MathAid
   */
  transform(m: Mat2D): void;

  /**
   * @summary Restrict subsequent drawing to a shape's interior.
   * @param {Shape} shape The clip shape.
   * @returns {void}
   * @author MathAid
   */
  clip(shape: Shape): void;

  /**
   * @summary Restrict subsequent drawing to a rectangle.
   * @param {Rect} rect The clip rectangle.
   * @returns {void}
   * @author MathAid
   */
  clipRect(rect: Rect): void;

  /**
   * @summary Fill a shape with a paint.
   *
   * @description
   * Appends a `fill-shape` command. The `paint` argument overrides the
   * current fill state for this one command. When `paint` is omitted, the
   * renderer uses the fill set by the most recent `set-fill`. When neither
   * is available, the command draws nothing.
   *
   * The shape is a full geometry object from `./geometry/shape`. Use one of
   * the specific helper methods (`fillRect`, `fillCircle`, and so on) when
   * the shape is a common primitive. Use this method directly for paths and
   * groups.
   *
   * @example
   * Example 1: Fill a rectangle with an explicit paint
   * ```ts
   * const b = new FrameBuilder();
   * b.fill(makeRect(rect(0, 0, 32, 32)), makeSolid(make(sRGB, 1, 0, 0)));
   * ```
   *
   * @example
   * Example 2: Fill with the current fill state
   * ```ts
   * const b = new FrameBuilder();
   * b.setFill(makeSolid(make(sRGB, 0, 0, 1)));
   * b.fill(makeCircle(point(50, 50), 10));
   * b.fill(makeCircle(point(80, 50), 10));
   * // both circles use the same fill
   * ```
   *
   * @example
   * Example 3: Fill a path
   * ```ts
   * const b = new FrameBuilder();
   * b.fill(makePath([
   *   { kind: 'move', to: point(0, 0) },
   *   { kind: 'line', to: point(10, 0) },
   *   { kind: 'line', to: point(5, 10) },
   *   { kind: 'close' },
   * ]), makeSolid(make(sRGB, 0, 1, 0)));
   * ```
   *
   * @param {Shape} shape The shape geometry.
   * @param {Paint} paint The fill paint override. Optional.
   * @returns {void}
   * @author MathAid
   */
  fill(shape: Shape, paint?: Paint): void;

  /**
   * @summary Fill a polygon.
   * @param {readonly Point2D[]} points The vertices.
   * @param {Paint} paint The fill paint. Optional.
   * @returns {void}
   * @author MathAid
   */
  fillPolygon(points: readonly Point2D[], paint?: Paint): void;

  /**
   * @summary Fill a rectangle.
   * @param {Rect} rect The rectangle geometry.
   * @param {Paint} paint The fill paint. Optional.
   * @returns {void}
   * @author MathAid
   */
  fillRect(rect: Rect, paint?: Paint): void;

  /**
   * @summary Fill an ellipse.
   * @param {Point2D} center The center point.
   * @param {number} radiusX The horizontal radius.
   * @param {number} radiusY The vertical radius.
   * @param {Paint} paint The fill paint. Optional.
   * @returns {void}
   * @author MathAid
   */
  fillEllipse(center: Point2D, radiusX: number, radiusY: number, paint?: Paint): void;

  /**
   * @summary Fill a circle.
   * @param {Point2D} center The center point.
   * @param {number} radius The radius.
   * @param {Paint} paint The fill paint. Optional.
   * @returns {void}
   * @author MathAid
   */
  fillCircle(center: Point2D, radius: number, paint?: Paint): void;

  /**
   * @summary Stroke a shape.
   * @param {Shape} shape The shape geometry.
   * @param {StrokeStyle} stroke The stroke style. Optional.
   * @returns {void}
   * @author MathAid
   */
  stroke(shape: Shape, stroke?: StrokeStyle): void;

  /**
   * @summary Stroke a line segment.
   * @param {Point2D} from The start point.
   * @param {Point2D} to The end point.
   * @param {StrokeStyle} stroke The stroke style. Optional.
   * @returns {void}
   * @author MathAid
   */
  strokeLine(from: Point2D, to: Point2D, stroke?: StrokeStyle): void;

  /**
   * @summary Stroke a polygon.
   * @param {readonly Point2D[]} points The vertices.
   * @param {boolean} closed Whether the last vertex connects to the first.
   * @param {StrokeStyle} stroke The stroke style. Optional.
   * @returns {void}
   * @author MathAid
   */
  strokePolygon(points: readonly Point2D[], closed: boolean, stroke?: StrokeStyle): void;

  /**
   * @summary Stroke a rectangle.
   * @param {Rect} rect The rectangle geometry.
   * @param {StrokeStyle} stroke The stroke style. Optional.
   * @returns {void}
   * @author MathAid
   */
  strokeRect(rect: Rect, stroke?: StrokeStyle): void;

  /**
   * @summary Stroke an ellipse.
   * @param {Point2D} center The center point.
   * @param {number} radiusX The horizontal radius.
   * @param {number} radiusY The vertical radius.
   * @param {StrokeStyle} stroke The stroke style. Optional.
   * @returns {void}
   * @author MathAid
   */
  strokeEllipse(center: Point2D, radiusX: number, radiusY: number, stroke?: StrokeStyle): void;

  /**
   * @summary Stroke a circle.
   * @param {Point2D} center The center point.
   * @param {number} radius The radius.
   * @param {StrokeStyle} stroke The stroke style. Optional.
   * @returns {void}
   * @author MathAid
   */
  strokeCircle(center: Point2D, radius: number, stroke?: StrokeStyle): void;

  /**
   * @summary Draw a filled and stroked rectangle.
   *
   * @description
   * A convenience method that emits one or two commands. When only `fill`
   * is given, the method emits a `fill-shape`. When only `stroke` is
   * given, it emits a `stroke-shape`. When both are given, it emits a
   * `fill-shape` followed by a `stroke-shape`. When neither is given, it
   * emits nothing.
   *
   * The two commands share the same shape instance. This is a memory
   * optimization. The shape is immutable, so sharing is safe.
   *
   * Prefer `fillRect` and `strokeRect` when only one is needed. Use this
   * method when both are needed and the shape is a rectangle.
   *
   * @example
   * Example 1: A filled rectangle
   * ```ts
   * const b = new FrameBuilder();
   * b.rect(rect(0, 0, 32, 32), makeSolid(make(sRGB, 1, 0, 0)));
   * // emits one fill-shape command
   * ```
   *
   * @example
   * Example 2: A stroked rectangle
   * ```ts
   * const b = new FrameBuilder();
   * b.rect(rect(0, 0, 32, 32), undefined, {
   *   paint: makeSolid(make(sRGB, 1, 1, 1)),
   *   width: 2,
   * });
   * // emits one stroke-shape command
   * ```
   *
   * @example
   * Example 3: A rect with fill and stroke
   * ```ts
   * const b = new FrameBuilder();
   * b.rect(
   *   rect(0, 0, 32, 32),
   *   makeSolid(make(sRGB, 0, 0, 0)),
   *   { paint: makeSolid(make(sRGB, 1, 1, 1)), width: 1 },
   * );
   * // emits fill-shape followed by stroke-shape
   * ```
   *
   * @param {Rect} rect The rectangle geometry.
   * @param {Paint} fill The fill paint. Optional.
   * @param {StrokeStyle} stroke The stroke style. Optional.
   * @returns {void}
   * @author MathAid
   */
  rect(rect: Rect, fill?: Paint, stroke?: StrokeStyle): void;

  /**
   * @summary Draw a sprite at a transform.
   * @param {SpriteRef} sprite The sprite asset.
   * @param {Mat2D | Transform2D} transform The placement, scale, and
   * rotation.
   * @returns {void}
   * @author MathAid
   */
  sprite(sprite: SpriteRef, transform: Mat2D | Transform2D): void;

  /**
   * @summary Draw a text string at a position.
   * @param {string} text The string to draw.
   * @param {Point2D} position The anchor position.
   * @param {TextStyle} style The text style.
   * @returns {void}
   * @author MathAid
   */
  text(text: string, position: Point2D, style: TextStyle): void;

  /**
   * @summary Save the current transform and style state.
   * @returns {void}
   * @author MathAid
   */
  push(): void;

  /**
   * @summary Restore the most recently saved state.
   * @returns {void}
   * @author MathAid
   */
  pop(): void;
}
