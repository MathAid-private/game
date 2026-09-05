/**
 * @fileoverview
 * @summary Axis-aligned bounding-box tests — pure collision primitives.
 *
 * @description
 * This module provides the overlap and containment predicates the games rely on for collision:
 * `rectsIntersect` for axis-aligned overlap and `pointInRect` for a single point. Both are pure
 * functions of immutable `Rect`/`Point2D` values — no state, no allocation, deterministic — so
 * they are trivially unit-testable and safe on the simulation hot path.
 *
 * @author MathAid
 */

import type { Point2D, Rect } from './types';

/**
 * @summary Test whether two axis-aligned rectangles overlap.
 *
 * @description
 * `rectsIntersect` uses the standard half-open AABB overlap test. Edges that merely touch
 * (share a boundary) do **not** count as an overlap, which is the convention games want for
 * adjacent grid cells. Both rectangles are treated as immutable; neither is modified.
 *
 * @param a - The first rectangle.
 * @param b - The second rectangle.
 * @return `true` when the rectangles share any interior area, `false` otherwise.
 *
 * @example
 * const hit = rectsIntersect(bulletBounds, invaderBounds);
 *
 * @see {@link pointInRect}
 * @author MathAid
 */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * @summary Test whether a point lies inside a rectangle.
 *
 * @description
 * `pointInRect` tests point-in-rectangle with a half-open convention: the top-left corner and
 * interior are inside, while the bottom and right edges are excluded. This matches the
 * `rectsIntersect` boundary convention and keeps adjacent cells from double-matching.
 *
 * @param point - The point to test.
 * @param rect - The rectangle to test against.
 * @return `true` when `point` is inside `rect`, `false` otherwise.
 *
 * @example
 * if (pointInRect(pointer, cellBounds)) select(cell);
 *
 * @see {@link rectsIntersect}
 * @author MathAid
 */
export function pointInRect(point: Point2D, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  );
}
