/**
 * @fileoverview
 * @summary Axis-aligned rectangles and operations.
 *
 * @description
 * Defines {@linkcode Rect} as an axis-aligned bounding box. The fields are
 * `x`, `y`, `width`, and `height`, with `(x, y)` at the top-left corner.
 * The type is the smallest rectangle that contains a set of 2D points, and
 * it is the primitive used for hit testing, clipping, and dirty-region
 * tracking.
 *
 * Half-open semantics apply to every containment test. A point on the
 * left or top edge is inside. A point on the right or bottom edge is
 * outside. This matches the pixel-grid convention used by Canvas2D and by
 * every GPU texture sampler.
 *
 * ```text
 *   (x, y)
 *     +----------------------+
 *     |                      |
 *     |       Rect           |  height
 *     |                      |
 *     +----------------------+
 *              width
 * ```
 *
 * Every operation is pure. No function mutates its input.
 *
 * @example
 * Example 1: A bounding box for a sprite
 * ```ts
 * import { rect } from './rect';
 *
 * const sprite = rect(0, 0, 32, 32);
 * ```
 *
 * @example
 * Example 2: Hit testing
 * ```ts
 * import { contains, point } from './rect';
 *
 * const button = rect(100, 100, 80, 40);
 * rectContains(button, point(120, 110)); // true
 * rectContains(button, point(200, 110)); // false
 * ```
 *
 * @see {@linkcode Point2D}
 * @author MathAid
 */

import { type Point2D, point } from './point';

/**
 * @summary An axis-aligned rectangle.
 *
 * @description
 * The four fields place the rectangle in the plane. The `(x, y)` pair is
 * the top-left corner in screen space. The `width` and `height` are the
 * extent to the right and down.
 *
 * The type does not constrain `width` or `height` to be positive. A zero
 * or negative dimension is legal. A negative width means the rectangle
 * extends left of `x`. Callers that require positive dimensions should
 * enforce that themselves.
 *
 * @example
 * Example 1: A 32 by 32 square at the origin
 * ```ts
 * const r: Rect = { x: 0, y: 0, width: 32, height: 32 };
 * ```
 *
 * @example
 * Example 2: A viewport
 * ```ts
 * const viewport: Rect = { x: 0, y: 0, width: 1920, height: 1080 };
 * ```
 *
 * @see {@linkcode Point2D}
 * @author MathAid
 */
export interface Rect {
  /** The left edge. */
  readonly x: number;
  /** The top edge. */
  readonly y: number;
  /** The horizontal extent. */
  readonly width: number;
  /** The vertical extent. */
  readonly height: number;
}

/**
 * @summary Construct a {@linkcode Rect}.
 *
 * @description
 * A thin wrapper over the object literal. The function exists so call sites
 * read as code, not as data.
 *
 * @example
 * Example 1: A square
 * ```ts
 * const square = rect(0, 0, 32, 32);
 * ```
 *
 * @example
 * Example 2: A button
 * ```ts
 * const button = rect(100, 100, 80, 40);
 * ```
 *
 * @param {number} x The left edge.
 * @param {number} y The top edge.
 * @param {number} width The horizontal extent.
 * @param {number} height The vertical extent.
 * @returns {Rect} A new rectangle.
 * @author MathAid
 */
export function rect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height };
}

/**
 * @summary Construct a rectangle from two opposite corners.
 *
 * @description
 * Accepts any two corners of the rectangle. The function normalizes so
 * that the resulting `x` and `y` are the smaller coordinates. The two
 * corners may be on the same horizontal or vertical line, in which case
 * one dimension of the result is zero.
 *
 * @example
 * Example 1: Top-left and bottom-right
 * ```ts
 * rectFromPoints(point(0, 0), point(32, 32)); // { x: 0, y: 0, width: 32, height: 32 }
 * ```
 *
 * @example
 * Example 2: Reversed corners still work
 * ```ts
 * rectFromPoints(point(32, 32), point(0, 0)); // { x: 0, y: 0, width: 32, height: 32 }
 * ```
 *
 * @param {Point2D} a The first corner.
 * @param {Point2D} b The second corner.
 * @returns {Rect} A new rectangle.
 * @author MathAid
 */
export function rectFromPoints(a: Point2D, b: Point2D): Rect {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x, b.x);
  const maxY = Math.max(a.y, b.y);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * @summary Construct a rectangle from bounds.
 *
 * @description
 * Equivalent to {@linkcode rectFromPoints}. The function name expresses
 * intent when the two arguments are understood as minimum and maximum
 * corners rather than arbitrary opposite corners.
 *
 * @example
 * Example 1: A minimum and maximum corner
 * ```ts
 * rectFromBounds(point(0, 0), point(10, 10)); // { x: 0, y: 0, width: 10, height: 10 }
 * ```
 *
 * @example
 * Example 2: From a scan of points
 * ```ts
 * const min = point(2, 3);
 * const max = point(8, 9);
 * rectFromBounds(min, max);
 * ```
 *
 * @param {Point2D} min The minimum corner. Must be less than or equal
 * to `max` on both axes.
 * @param {Point2D} max The maximum corner.
 * @returns {Rect} A new rectangle.
 * @author MathAid
 */
export function rectFromBounds(min: Point2D, max: Point2D): Rect {
  return rectFromPoints(min, max);
}

/**
 * @summary The center point of a rectangle.
 *
 * @description
 * Returns the point at `(x + width / 2, y + height / 2)`. The result is
 * a fresh {@linkcode Point2D}.
 *
 * @example
 * Example 1: Center of a square
 * ```ts
 * rectCenter(rect(0, 0, 32, 32)); // { x: 16, y: 16 }
 * ```
 *
 * @example
 * Example 2: Center of a wide rectangle
 * ```ts
 * rectCenter(rect(10, 20, 100, 40)); // { x: 60, y: 40 }
 * ```
 *
 * @param {Rect} r The rectangle.
 * @returns {Point2D} The center.
 * @author MathAid
 */
export function rectCenter(r: Rect): Point2D {
  return point(r.x + r.width / 2, r.y + r.height / 2);
}

/**
 * @summary Test whether a point lies inside a rectangle.
 *
 * @description
 * Uses half-open semantics. A point on the left or top edge is inside. A
 * point on the right or bottom edge is outside. This avoids double counting
 * on shared boundaries.
 *
 * ```text
 *      included      excluded
 *   +-------------+
 *   |             |
 *   |             |
 *   +-------------+
 * ```
 *
 * @example
 * Example 1: A point inside
 * ```ts
 * rectContains(rect(0, 0, 10, 10), point(5, 5)); // true
 * ```
 *
 * @example
 * Example 2: The right edge is excluded
 * ```ts
 * rectContains(rect(0, 0, 10, 10), point(10, 5)); // false
 * ```
 *
 * @param {Rect} r The rectangle.
 * @param {Point2D} p The point to test.
 * @returns {boolean} `true` when the point is inside.
 * @author MathAid
 */
export function rectContains(r: Rect, p: Point2D): boolean {
  return (
    p.x >= r.x &&
    p.x < r.x + r.width &&
    p.y >= r.y &&
    p.y < r.y + r.height
  );
}

/**
 * @summary Test whether two rectangles overlap.
 *
 * @description
 * Two rectangles overlap when their interiors share at least one point.
 * Rectangles that only touch on an edge do not overlap. A zero-area
 * rectangle never overlaps anything.
 *
 * @example
 * Example 1: Overlapping rectangles
 * ```ts
 * rectIntersects(rect(0, 0, 10, 10), rect(5, 5, 10, 10)); // true
 * ```
 *
 * @example
 * Example 2: Edge-touching rectangles do not overlap
 * ```ts
 * rectIntersects(rect(0, 0, 10, 10), rect(10, 0, 10, 10)); // false
 * ```
 *
 * @param {Rect} a The first rectangle.
 * @param {Rect} b The second rectangle.
 * @returns {boolean} `true` when the interiors overlap.
 * @author MathAid
 */
export function rectIntersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * @summary The bounding rectangle of two rectangles.
 *
 * @description
 * Returns the smallest axis-aligned rectangle that contains both inputs.
 * The result contains the union of the two rectangles even when they do
 * not overlap.
 *
 * @example
 * Example 1: Union of two overlapping rectangles
 * ```ts
 * rectUnion(rect(0, 0, 10, 10), rect(5, 5, 10, 10)); // { x: 0, y: 0, width: 15, height: 15 }
 * ```
 *
 * @example
 * Example 2: Union of two distant rectangles
 * ```ts
 * rectUnion(rect(0, 0, 5, 5), rect(100, 100, 5, 5));
 * // { x: 0, y: 0, width: 105, height: 105 }
 * ```
 *
 * @param {Rect} a The first rectangle.
 * @param {Rect} b The second rectangle.
 * @returns {Rect} A new bounding rectangle.
 * @author MathAid
 */
export function rectUnion(a: Rect, b: Rect): Rect {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * @summary Expand or shrink a rectangle by a uniform or per-axis amount.
 *
 * @description
 * A positive `dx` and `dy` grow the rectangle outward by that amount on
 * every side. A negative value shrinks it inward. When `dy` is omitted,
 * the function uses `dx` for both axes.
 *
 * The center of the rectangle does not move.
 *
 * ```text
 *   before:   +---------+         after (inflate by 2):
 *             |         |
 *             |         |         +-----------------+
 *             +---------+         |  +---------+    |
 *                                 |  |         |    |
 *                                 |  |         |    |
 *                                 |  +---------+    |
 *                                 +-----------------+
 * ```
 *
 * @example
 * Example 1: Grow uniformly by 2
 * ```ts
 * rectInflate(rect(10, 10, 20, 20), 2);
 * // { x: 8, y: 8, width: 24, height: 24 }
 * ```
 *
 * @example
 * Example 2: Grow horizontally only
 * ```ts
 * rectInflate(rect(0, 0, 10, 10), 5, 0);
 * // { x: -5, y: 0, width: 20, height: 10 }
 * ```
 *
 * @param {Rect} r The rectangle.
 * @param {number} dx The horizontal amount. Positive grows, negative
 * shrinks.
 * @param {number} dy The vertical amount. Defaults to `dx`.
 * @default {dx}
 * @returns {Rect} A new rectangle.
 * @author MathAid
 */
export function rectInflate(r: Rect, dx: number, dy: number = dx): Rect {
  return {
    x: r.x - dx,
    y: r.y - dy,
    width: r.width + 2 * dx,
    height: r.height + 2 * dy,
  };
}

/**
 * @summary Translate a rectangle by a horizontal and vertical amount.
 *
 * @description
 * Moves the rectangle without changing its size. Equivalent to adding a
 * {@linkcode Vector2D} to the top-left corner.
 *
 * @example
 * Example 1: Move right and down
 * ```ts
 * rectOffset(rect(0, 0, 10, 10), 5, 5);
 * // { x: 5, y: 5, width: 10, height: 10 }
 * ```
 *
 * @example
 * Example 2: Move left
 * ```ts
 * rectOffset(rect(100, 0, 10, 10), -50, 0);
 * // { x: 50, y: 0, width: 10, height: 10 }
 * ```
 *
 * @param {Rect} r The rectangle.
 * @param {number} dx The horizontal shift.
 * @param {number} dy The vertical shift.
 * @returns {Rect} A new rectangle.
 * @author MathAid
 */
export function rectOffset(r: Rect, dx: number, dy: number): Rect {
  return { x: r.x + dx, y: r.y + dy, width: r.width, height: r.height };
}