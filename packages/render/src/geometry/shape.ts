/**
 * @fileoverview
 * @summary The closed shape vocabulary and its constructors.
 *
 * @description
 * Defines {@linkcode Shape} as the union of every geometry primitive the
 * render pipeline understands. A shape describes geometry only. It carries
 * no style, no color, and no transform. The same shape object may be
 * referenced by any number of commands.
 *
 * The union is closed. Every renderer dispatches on the `kind` field. A
 * new shape kind is a union change plus a handler in each renderer. That
 * is the only extension point.
 *
 * ```text
 *   Shape
 *   +-- LineShape        a segment between two points
 *   +-- PolygonShape     a closed or open list of vertices
 *   +-- RectShape        an axis-aligned rect, optional rounded corners
 *   +-- EllipseShape     an ellipse, a circle, or an arc
 *   +-- PathShape        an SVG-style path of segments
 *   +-- GroupShape       a composition of other shapes
 * ```
 *
 * Style lives outside the shape. The caller attaches a {@linkcode Paint}
 * or a {@linkcode StrokeStyle} at draw time. The same shape may be filled
 * with one paint and stroked with another in the same frame.
 *
 * Every constructor is pure. No constructor mutates its input.
 *
 * @example
 * Example 1: A rectangle and a circle
 * ```ts
 * import { makeRect, makeCircle } from './shape';
 * import { rect } from './rect';
 * import { point } from './point';
 *
 * const box = makeRect(rect(0, 0, 32, 32));
 * const dot = makeCircle(point(16, 16), 4);
 * ```
 *
 * @example
 * Example 2: A group of shapes
 * ```ts
 * import { makeGroup, makeLine, makePolygon } from './shape';
 * import { point } from './point';
 *
 * const cross = makeGroup([
 *   makeLine(point(-10, 0), point(10, 0)),
 *   makeLine(point(0, -10), point(0, 10)),
 * ]);
 * ```
 *
 * @see {@linkcode Paint}
 * @see {@linkcode StrokeStyle}
 * @author MathAid
 */

import { type Point2D, point } from './point';
import { type Rect, rect } from './rect';

/**
 * @summary A straight line segment.
 *
 * @description
 * The shape carries two endpoints. It has no thickness. A rendered line
 * gets its thickness from the {@linkcode StrokeStyle} at draw time.
 *
 * @example
 * Example 1: A horizontal segment
 * ```ts
 * const s: LineShape = { kind: 'line', from: point(0, 0), to: point(10, 0) };
 * ```
 *
 * @example
 * Example 2: A diagonal
 * ```ts
 * const d: LineShape = { kind: 'line', from: point(0, 0), to: point(10, 10) };
 * ```
 *
 * @see {@linkcode Shape}
 * @author MathAid
 */
export interface LineShape {
  /** The kind tag. */
  readonly kind: 'line';
  /** The start point. */
  readonly from: Point2D;
  /** The end point. */
  readonly to: Point2D;
}

/**
 * @summary A polygon defined by a list of vertices.
 *
 * @description
 * The vertices are in drawing order. The `closed` flag controls whether
 * the last vertex connects back to the first. A fill treats an open
 * polygon as closed. A stroke respects the flag.
 *
 * The shape does not require convexity. Self-intersecting polygons are
 * legal. The renderer decides how to fill them.
 *
 * @example
 * Example 1: A closed triangle
 * ```ts
 * const t: PolygonShape = {
 *   kind: 'polygon',
 *   points: [point(0, 0), point(10, 0), point(5, 10)],
 *   closed: true,
 * };
 * ```
 *
 * @example
 * Example 2: An open polyline
 * ```ts
 * const p: PolygonShape = {
 *   kind: 'polygon',
 *   points: [point(0, 0), point(10, 0), point(10, 10)],
 *   closed: false,
 * };
 * ```
 *
 * @see {@linkcode Shape}
 * @author MathAid
 */
export interface PolygonShape {
  /** The kind tag. */
  readonly kind: 'polygon';
  /** The vertices in drawing order. */
  readonly points: readonly Point2D[];
  /** When `true`, the last vertex connects back to the first. */
  readonly closed: boolean;
}

/**
 * @summary An axis-aligned rectangle with optional rounded corners.
 *
 * @description
 * The rectangle geometry comes from {@linkcode Rect}. The `cornerRadius`
 * field is optional. A single number applies the same radius to all four
 * corners. An array of four numbers gives per-corner radii in CSS order.
 *
 * ```text
 *   [topLeft, topRight, bottomRight, bottomLeft]
 * ```
 *
 * @example
 * Example 1: A square corner
 * ```ts
 * const s: RectShape = { kind: 'rect', rect: rect(0, 0, 32, 32) };
 * ```
 *
 * @example
 * Example 2: A pill shape
 * ```ts
 * const pill: RectShape = {
 *   kind: 'rect',
 *   rect: rect(0, 0, 100, 30),
 *   cornerRadius: 15,
 * };
 * ```
 *
 * @see {@linkcode Shape}
 * @author MathAid
 */
export interface RectShape {
  /** The kind tag. */
  readonly kind: 'rect';
  /** The rectangle geometry. */
  readonly rect: Rect;
  /**
   * The corner radii. A single number applies to all four. An array uses
   * CSS order.
   */
  readonly cornerRadius?:
    | number
    | readonly [number, number, number, number];
}

/**
 * @summary An ellipse, a circle, or an arc.
 *
 * @description
 * The shape is defined by a center, two radii, an optional rotation, and
 * an angular span. A circle is an ellipse with `radiusX === radiusY`. An
 * arc is an ellipse with `startAngle` and `endAngle` that do not span a
 * full turn.
 *
 * The default `startAngle` is `0` and the default `endAngle` is
 * `2 * Math.PI`. Both are in radians and measured counter-clockwise from
 * the positive x-axis of the local frame. A positive `rotation` rotates
 * that frame.
 *
 * ```text
 *             radiusY
 *               |
 *               |   ___
 *               |  /   \
 *               | |     |
 *               |  \___/
 *               |
 *               +------------ radiusX
 *             center
 * ```
 *
 * @example
 * Example 1: A circle
 * ```ts
 * const c: EllipseShape = {
 *   kind: 'ellipse',
 *   center: point(50, 50),
 *   radiusX: 20,
 *   radiusY: 20,
 * };
 * ```
 *
 * @example
 * Example 2: A quarter arc
 * ```ts
 * const a: EllipseShape = {
 *   kind: 'ellipse',
 *   center: point(0, 0),
 *   radiusX: 10,
 *   radiusY: 10,
 *   startAngle: 0,
 *   endAngle: Math.PI / 2,
 * };
 * ```
 *
 * @see {@linkcode Shape}
 * @author MathAid
 */
export interface EllipseShape {
  /** The kind tag. */
  readonly kind: 'ellipse';
  /** The center point. */
  readonly center: Point2D;
  /** The horizontal radius. */
  readonly radiusX: number;
  /** The vertical radius. */
  readonly radiusY: number;
  /** The rotation in radians. Defaults to `0`. */
  readonly rotation?: number;
  /** The start angle in radians. Defaults to `0`. */
  readonly startAngle?: number;
  /** The end angle in radians. Defaults to `2 * Math.PI`. */
  readonly endAngle?: number;
}

/**
 * @summary One segment of a {@linkcode PathShape}.
 *
 * @description
 * A discriminated union that mirrors the SVG path grammar. Every segment
 * has a `kind`. The union covers every curved primitive.
 *
 * ```text
 *   move       jump to a point without drawing
 *   line       straight segment
 *   quadratic  quadratic Bezier with one control point
 *   cubic      cubic Bezier with two control points
 *   arc        elliptical arc with SVG flags
 *   close      connect back to the start of the subpath
 * ```
 *
 * @see {@linkcode PathShape}
 * @author MathAid
 */
export type PathSegment =
  | { readonly kind: 'move'; readonly to: Point2D }
  | { readonly kind: 'line'; readonly to: Point2D }
  | {
      readonly kind: 'quadratic';
      readonly control: Point2D;
      readonly to: Point2D;
    }
  | {
      readonly kind: 'cubic';
      readonly c1: Point2D;
      readonly c2: Point2D;
      readonly to: Point2D;
    }
  | {
      readonly kind: 'arc';
      readonly rx: number;
      readonly ry: number;
      readonly rotation: number;
      readonly largeArc: boolean;
      readonly sweep: boolean;
      readonly to: Point2D;
    }
  | { readonly kind: 'close' };

/**
 * @summary An SVG-style path of segments.
 *
 * @description
 * The shape is a list of {@linkcode PathSegment} values. The first
 * segment is normally a `move` that sets the start of the subpath. The
 * `close` segment connects the current point back to the start.
 *
 * The path may contain any mix of straight and curved segments. It may
 * contain more than one subpath. The renderer walks the list in order.
 *
 * @example
 * Example 1: A triangle from a move and two lines
 * ```ts
 * const tri: PathShape = {
 *   kind: 'path',
 *   segments: [
 *     { kind: 'move', to: point(0, 0) },
 *     { kind: 'line', to: point(10, 0) },
 *     { kind: 'line', to: point(5, 10) },
 *     { kind: 'close' },
 *   ],
 * };
 * ```
 *
 * @example
 * Example 2: A curved path
 * ```ts
 * const wave: PathShape = {
 *   kind: 'path',
 *   segments: [
 *     { kind: 'move', to: point(0, 0) },
 *     { kind: 'quadratic', control: point(5, -10), to: point(10, 0) },
 *     { kind: 'quadratic', control: point(15, 10), to: point(20, 0) },
 *   ],
 * };
 * ```
 *
 * @see {@linkcode PathSegment}
 * @see {@linkcode Shape}
 * @author MathAid
 */
export interface PathShape {
  /** The kind tag. */
  readonly kind: 'path';
  /** The segments in drawing order. */
  readonly segments: readonly PathSegment[];
}

/**
 * @summary A composition of shapes.
 *
 * @description
 * The group carries a list of shapes. The list may contain any shape
 * kind, including other groups. The group has no transform of its own.
 * The caller pushes a transform before drawing the group.
 *
 * ```text
 *   GroupShape
 *     +-- LineShape
 *     +-- PolygonShape
 *     +-- GroupShape
 *           +-- RectShape
 *           +-- EllipseShape
 * ```
 *
 * @example
 * Example 1: A cross
 * ```ts
 * const cross: GroupShape = {
 *   kind: 'group',
 *   shapes: [
 *     makeLine(point(-10, 0), point(10, 0)),
 *     makeLine(point(0, -10), point(0, 10)),
 *   ],
 * };
 * ```
 *
 * @example
 * Example 2: A nested group
 * ```ts
 * const scene: GroupShape = {
 *   kind: 'group',
 *   shapes: [
 *     makeRect(rect(0, 0, 100, 100)),
 *     makeGroup([makeCircle(point(50, 50), 10)]),
 *   ],
 * };
 * ```
 *
 * @see {@linkcode Shape}
 * @author MathAid
 */
export interface GroupShape {
  /** The kind tag. */
  readonly kind: 'group';
  /** The shapes in drawing order. */
  readonly shapes: readonly Shape[];
}

/**
 * @summary The union of every shape kind.
 *
 * @description
 * A {@linkcode Shape} is one of six variants. Every renderer dispatches
 * on the `kind` field. The union is closed. Adding a variant is a union
 * change plus a handler in every renderer.
 *
 * @see {@linkcode LineShape}
 * @see {@linkcode PolygonShape}
 * @see {@linkcode RectShape}
 * @see {@linkcode EllipseShape}
 * @see {@linkcode PathShape}
 * @see {@linkcode GroupShape}
 * @author MathAid
 */
export type Shape =
  | LineShape
  | PolygonShape
  | RectShape
  | EllipseShape
  | PathShape
  | GroupShape;

/**
 * @summary Construct a {@linkcode LineShape}.
 *
 * @description
 * A thin wrapper over the object literal. The function exists so the
 * caller expresses a drawing intent, not a data shape.
 *
 * @example
 * Example 1: A segment
 * ```ts
 * makeLine(point(0, 0), point(10, 10));
 * ```
 *
 * @example
 * Example 2: Inside a group
 * ```ts
 * makeGroup([
 *   makeLine(point(0, 0), point(10, 0)),
 *   makeLine(point(0, 0), point(0, 10)),
 * ]);
 * ```
 *
 * @param {Point2D} from The start point.
 * @param {Point2D} to The end point.
 * @returns {LineShape} A new line shape.
 * @author MathAid
 */
export function makeLine(from: Point2D, to: Point2D): LineShape {
  return { kind: 'line', from, to };
}

/**
 * @summary Construct a {@linkcode PolygonShape}.
 *
 * @description
 * When `closed` is omitted, the function closes the polygon. A fill
 * treats an open polygon as closed anyway. Use `closed: false` for a
 * polyline that should not have a closing edge when stroked.
 *
 * @example
 * Example 1: A triangle
 * ```ts
 * makePolygon([point(0, 0), point(10, 0), point(5, 10)]);
 * ```
 *
 * @example
 * Example 2: A polyline
 * ```ts
 * makePolygon([point(0, 0), point(10, 0), point(10, 10)], false);
 * ```
 *
 * @param {readonly Point2D[]} points The vertices in drawing order.
 * @param {boolean} closed Whether the last vertex connects to the first.
 * Defaults to `true`.
 * @default {true}
 * @returns {PolygonShape} A new polygon shape.
 * @author MathAid
 */
export function makePolygon(
  points: readonly Point2D[],
  closed: boolean = true,
): PolygonShape {
  return { kind: 'polygon', points, closed };
}

/**
 * @summary Construct a {@linkcode RectShape}.
 *
 * @description
 * The corner radius is optional. A single number applies to all four
 * corners. An array of four numbers uses CSS order.
 *
 * @example
 * Example 1: A square
 * ```ts
 * makeRect(rect(0, 0, 32, 32));
 * ```
 *
 * @example
 * Example 2: A pill
 * ```ts
 * makeRect(rect(0, 0, 100, 30), 15);
 * ```
 *
 * @param {Rect} r The rectangle geometry.
 * @param {number | readonly [number, number, number, number]} cornerRadius
 * The corner radii. Optional.
 * @returns {RectShape} A new rect shape.
 * @author MathAid
 */
export function makeRect(
  r: Rect,
  cornerRadius?: number | readonly [number, number, number, number],
): RectShape {
  if (cornerRadius === undefined) {
    return { kind: 'rect', rect: r };
  }
  return { kind: 'rect', rect: r, cornerRadius };
}

/**
 * @summary Construct an {@linkcode EllipseShape}.
 *
 * @description
 * The `options` object accepts `rotation`, `startAngle`, and `endAngle`.
 * All three are optional. The defaults give a full, unrotated ellipse.
 *
 * @example
 * Example 1: An axis-aligned ellipse
 * ```ts
 * makeEllipse(point(50, 50), 30, 20);
 * ```
 *
 * @example
 * Example 2: A rotated arc
 * ```ts
 * makeEllipse(point(0, 0), 10, 10, {
 *   rotation: Math.PI / 4,
 *   startAngle: 0,
 *   endAngle: Math.PI,
 * });
 * ```
 *
 * @param {Point2D} center The center point.
 * @param {number} radiusX The horizontal radius.
 * @param {number} radiusY The vertical radius.
 * @param {object} options Optional rotation and angular span.
 * @returns {EllipseShape} A new ellipse shape.
 * @author MathAid
 */
export function makeEllipse(
  center: Point2D,
  radiusX: number,
  radiusY: number,
  options: {
    readonly rotation?: number;
    readonly startAngle?: number;
    readonly endAngle?: number;
  } = {},
): EllipseShape {
  const shape: EllipseShape = { kind: 'ellipse', center, radiusX, radiusY };
  if (
    options.rotation === undefined &&
    options.startAngle === undefined &&
    options.endAngle === undefined
  ) {
    return shape;
  }
  return {
    ...shape,
    rotation: options.rotation,
    startAngle: options.startAngle,
    endAngle: options.endAngle,
  };
}

/**
 * @summary Construct a circle as an {@linkcode EllipseShape}.
 *
 * @description
 * A circle is an ellipse with equal radii. The function is a convenience
 * for the common case. The result is a full, unrotated ellipse.
 *
 * @example
 * Example 1: A dot
 * ```ts
 * makeCircle(point(0, 0), 4);
 * ```
 *
 * @example
 * Example 2: A ring outline
 * ```ts
 * makeCircle(point(50, 50), 25);
 * ```
 *
 * @param {Point2D} center The center point.
 * @param {number} radius The radius.
 * @returns {EllipseShape} A new ellipse shape.
 * @author MathAid
 */
export function makeCircle(center: Point2D, radius: number): EllipseShape {
  return { kind: 'ellipse', center, radiusX: radius, radiusY: radius };
}

/**
 * @summary Construct a {@linkcode PathShape}.
 *
 * @description
 * A thin wrapper over the object literal. The segments are used in order.
 *
 * @example
 * Example 1: A triangle
 * ```ts
 * makePath([
 *   { kind: 'move', to: point(0, 0) },
 *   { kind: 'line', to: point(10, 0) },
 *   { kind: 'line', to: point(5, 10) },
 *   { kind: 'close' },
 * ]);
 * ```
 *
 * @example
 * Example 2: A curve
 * ```ts
 * makePath([
 *   { kind: 'move', to: point(0, 0) },
 *   { kind: 'cubic', c1: point(0, 10), c2: point(10, 10), to: point(10, 0) },
 * ]);
 * ```
 *
 * @param {readonly PathSegment[]} segments The segments in order.
 * @returns {PathShape} A new path shape.
 * @author MathAid
 */
export function makePath(segments: readonly PathSegment[]): PathShape {
  return { kind: 'path', segments };
}

/**
 * @summary Construct a {@linkcode GroupShape}.
 *
 * @description
 * A thin wrapper over the object literal. The shapes are drawn in order.
 *
 * @example
 * Example 1: A cross
 * ```ts
 * makeGroup([
 *   makeLine(point(-10, 0), point(10, 0)),
 *   makeLine(point(0, -10), point(0, 10)),
 * ]);
 * ```
 *
 * @example
 * Example 2: A nested scene
 * ```ts
 * makeGroup([makeCircle(point(0, 0), 10), makeGroup([])]);
 * ```
 *
 * @param {readonly Shape[]} shapes The shapes in order.
 * @returns {GroupShape} A new group shape.
 * @author MathAid
 */
export function makeGroup(shapes: readonly Shape[]): GroupShape {
  return { kind: 'group', shapes };
}

// Re-export the point and rect constructors for the shape caller.
export { point, rect };
