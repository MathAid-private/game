/**
 * @fileoverview
 * @summary Ear-clipping triangulation for simple polygons.
 *
 * @description
 * Turns a simple polygon into a triangle list. The algorithm is ear
 * clipping. It is O(n^2) for the naive form. It is fast enough for the
 * shapes a game renders in a single frame.
 *
 * ```text
 *   Polygon                        Triangulated
 *
 *   *-----*                        *-----*
 *   |   / |                        |  /  |
 *   |  /  |      ----->            | /   |
 *   | /   |                        |/    |
 *   *-----*                        *-----*
 *
 *   An ear is a triangle whose interior is empty. Clip each ear.
 *   The remaining polygon shrinks by one vertex per step.
 * ```
 *
 * The algorithm assumes the polygon is simple. It does not handle
 * self-intersecting polygons. It does not handle holes. Both features
 * are deferred to a later milestone.
 *
 * @see {@linkcode tessellateFill}
 * @author MathAid
 */

import { type Point2D } from '../../geometry/point';

/**
 * @summary Triangulate a simple polygon with ear clipping.
 *
 * @description
 * Returns an array of indices into the input points. Every three
 * consecutive indices form one triangle. The winding matches the input.
 * A counter-clockwise input produces counter-clockwise triangles.
 *
 * The function allocates a working array of indices. It removes ears in
 * a loop until three vertices remain. The final three form the last
 * triangle.
 *
 * @example
 * Example 1: A square
 * ```ts
 * const tris = earcut([
 *   point(0, 0), point(10, 0), point(10, 10), point(0, 10),
 * ]);
 * // tris.length === 6 (two triangles)
 * ```
 *
 * @example
 * Example 2: A concave polygon
 * ```ts
 * const tris = earcut([
 *   point(0, 0), point(10, 0), point(5, 5), point(10, 10), point(0, 10),
 * ]);
 * // tris.length === 9 (three triangles)
 * ```
 *
 * @param {readonly Point2D[]} points The polygon vertices.
 * @returns {number[]} Triangle indices.
 * @throws {Error} When the polygon has fewer than three vertices.
 * @author MathAid
 */
export function earcut(points: readonly Point2D[]): number[] {
  const n = points.length;
  if (n < 3) {
    throw new Error('earcut: a polygon needs at least three vertices.');
  }
  if (n === 3) return [0, 1, 2];

  // Determine the winding. Ear clipping assumes counter-clockwise.
  const area = signedArea(points);
  const indices: number[] = [];
  const remaining: number[] = [];
  if (area >= 0) {
    for (let i = 0; i < n; i++) remaining.push(i);
  } else {
    for (let i = n - 1; i >= 0; i--) remaining.push(i);
  }

  let guard = n * n;
  while (remaining.length > 3) {
    let earFound = false;
    for (let i = 0; i < remaining.length; i++) {
      const prev = remaining[(i - 1 + remaining.length) % remaining.length]!;
      const cur = remaining[i]!;
      const next = remaining[(i + 1) % remaining.length]!;
      if (isEar(points, remaining, prev, cur, next)) {
        indices.push(prev, cur, next);
        remaining.splice(i, 1);
        earFound = true;
        break;
      }
    }
    if (!earFound) {
      // Degenerate polygon. Emit a fan from the first remaining vertex.
      for (let i = 1; i < remaining.length - 1; i++) {
        indices.push(remaining[0]!, remaining[i]!, remaining[i + 1]!);
      }
      return indices;
    }
    if (--guard <= 0) {
      for (let i = 1; i < remaining.length - 1; i++) {
        indices.push(remaining[0]!, remaining[i]!, remaining[i + 1]!);
      }
      return indices;
    }
  }
  indices.push(remaining[0]!, remaining[1]!, remaining[2]!);
  return indices;
}

function signedArea(points: readonly Point2D[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function isEar(
  points: readonly Point2D[],
  remaining: readonly number[],
  prev: number,
  cur: number,
  next: number,
): boolean {
  const a = points[prev]!;
  const b = points[cur]!;
  const c = points[next]!;
  // A reflex vertex cannot be an ear.
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (cross <= 0) return false;
  // No other vertex may lie inside the triangle.
  for (const idx of remaining) {
    if (idx === prev || idx === cur || idx === next) continue;
    if (pointInTriangle(points[idx]!, a, b, c)) return false;
  }
  return true;
}

function pointInTriangle(p: Point2D, a: Point2D, b: Point2D, c: Point2D): boolean {
  const d1 = (p.x - a.x) * (b.y - a.y) - (b.x - a.x) * (p.y - a.y);
  const d2 = (p.x - b.x) * (c.y - b.y) - (c.x - b.x) * (p.y - b.y);
  const d3 = (p.x - c.x) * (a.y - c.y) - (a.x - c.x) * (p.y - c.y);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}