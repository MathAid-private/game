/**
 * @fileoverview
 * @summary Curve flattening: turns curved segments into line segments.
 *
 * @description
 * Provides the flattening functions the tessellator uses to convert
 * quadratic Beziers, cubic Beziers, and SVG arcs into polyline
 * approximations. Each function appends its output points to an array
 * the caller provides.
 *
 * The flattening tolerance is in logical pixels. The number of segments
 * per curve is chosen so that the maximum deviation between the curve
 * and its polyline stays within the tolerance. The formula uses the
 * control polygon length as a proxy for the curve's extent.
 *
 * ```text
 *   Bezier curve and its flattened polyline:
 *
 *   control points                flattened polyline
 *      *  *                       *--*
 *    *      *                     |  |
 *   *        *                    *--*
 *   start    end                  start end
 *
 *   The tolerance is the maximum distance from the curve to the line.
 * ```
 *
 * @see {@linkcode tessellateFill}
 * @author MathAid
 */

import { type Point2D, point } from '../../geometry/point';
import { type PathSegment } from '../../geometry/shape';

/**
 * @summary The default flattening tolerance in logical pixels.
 * @author MathAid
 */
const DEFAULT_TOLERANCE = 0.25;

/**
 * @summary The default maximum number of segments per curve.
 * @author MathAid
 */
const DEFAULT_MAX_SEGMENTS = 64;

/**
 * @summary Append the points of a quadratic Bezier to an array.
 *
 * @description
 * Uses uniform parametric stepping. The number of steps is derived from
 * the control polygon length and the tolerance. The end point is always
 * appended. The start point is assumed to be the last point already in
 * the array.
 *
 * @example
 * Example 1: Flatten a single quadratic
 * ```ts
 * const out: Point2D[] = [point(0, 0)];
 * appendQuadratic(out, point(5, -10), point(10, 0), 0.25, 64);
 * // out contains the start and the flattened curve points
 * ```
 *
 * @param {Point2D[]} out The array to append to. The last entry is the
 * start point.
 * @param {Point2D} control The control point.
 * @param {Point2D} to The end point.
 * @param {number} tolerance The flattening tolerance.
 * @param {number} maxSegments The maximum number of line segments.
 * @returns {void}
 * @author MathAid
 */
export function appendQuadratic(
  out: Point2D[],
  control: Point2D,
  to: Point2D,
  tolerance: number,
  maxSegments: number,
): void {
  const from = out[out.length - 1]!;
  const polyLen =
    Math.hypot(control.x - from.x, control.y - from.y) +
    Math.hypot(to.x - control.x, to.y - control.y);
  const steps = Math.min(
    maxSegments,
    Math.max(2, Math.ceil(Math.sqrt(polyLen / (8 * tolerance)))),
  );
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push(
      point(
        u * u * from.x + 2 * u * t * control.x + t * t * to.x,
        u * u * from.y + 2 * u * t * control.y + t * t * to.y,
      ),
    );
  }
}

/**
 * @summary Append the points of a cubic Bezier to an array.
 *
 * @description
 * Uses uniform parametric stepping. The number of steps is derived from
 * the control polygon length and the tolerance. The end point is always
 * appended.
 *
 * @example
 * Example 1: Flatten a single cubic
 * ```ts
 * const out: Point2D[] = [point(0, 0)];
 * appendCubic(out, point(0, 10), point(10, 10), point(10, 0), 0.25, 64);
 * ```
 *
 * @param {Point2D[]} out The array to append to.
 * @param {Point2D} c1 The first control point.
 * @param {Point2D} c2 The second control point.
 * @param {Point2D} to The end point.
 * @param {number} tolerance The flattening tolerance.
 * @param {number} maxSegments The maximum number of line segments.
 * @returns {void}
 * @author MathAid
 */
export function appendCubic(
  out: Point2D[],
  c1: Point2D,
  c2: Point2D,
  to: Point2D,
  tolerance: number,
  maxSegments: number,
): void {
  const from = out[out.length - 1]!;
  const polyLen =
    Math.hypot(c1.x - from.x, c1.y - from.y) +
    Math.hypot(c2.x - c1.x, c2.y - c1.y) +
    Math.hypot(to.x - c2.x, to.y - c2.y);
  const steps = Math.min(
    maxSegments,
    Math.max(3, Math.ceil(Math.cbrt(polyLen / tolerance) * 2)),
  );
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const u2 = u * u;
    const t2 = t * t;
    out.push(
      point(
        u2 * u * from.x + 3 * u2 * t * c1.x + 3 * u * t2 * c2.x + t2 * t * to.x,
        u2 * u * from.y + 3 * u2 * t * c1.y + 3 * u * t2 * c2.y + t2 * t * to.y,
      ),
    );
  }
}

/**
 * @summary Append the points of an SVG arc to an array.
 *
 * @description
 * Converts the SVG arc parameters to an elliptical center
 * parametrization, then samples the ellipse. The full algorithm follows
 * the SVG 1.1 specification.
 *
 * The arc is defined by the current point (the last entry of `out`), the
 * two radii, an x-axis rotation, two boolean flags, and an end point.
 * The radii are scaled up automatically when they are too small to
 * reach the end point.
 *
 * @example
 * Example 1: A quarter circle
 * ```ts
 * const out: Point2D[] = [point(10, 0)];
 * appendArc(out, 10, 10, 0, false, true, point(0, 10), 0.25, 64);
 * ```
 *
 * @param {Point2D[]} out The array to append to.
 * @param {number} rx The horizontal radius.
 * @param {number} ry The vertical radius.
 * @param {number} rotation The x-axis rotation in radians.
 * @param {boolean} largeArc Whether to take the large arc.
 * @param {boolean} sweep Whether to sweep in the positive angle direction.
 * @param {Point2D} to The end point.
 * @param {number} tolerance The flattening tolerance.
 * @param {number} maxSegments The maximum number of line segments.
 * @returns {void}
 * @author MathAid
 */
export function appendArc(
  out: Point2D[],
  rx: number,
  ry: number,
  rotation: number,
  largeArc: boolean,
  sweep: boolean,
  to: Point2D,
  tolerance: number,
  maxSegments: number,
): void {
  const from = out[out.length - 1]!;
  const x1 = from.x;
  const y1 = from.y;
  const x2 = to.x;
  const y2 = to.y;

  if (x1 === x2 && y1 === y2) return;
  if (rx === 0 || ry === 0) {
    out.push(to);
    return;
  }

  const phi = rotation;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Step 1: compute (x1', y1').
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  // Step 2: correct out-of-range radii.
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  let rxAdj = rx;
  let ryAdj = ry;
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rxAdj = s * rx;
    ryAdj = s * ry;
  }

  // Step 3: compute the center.
  const rx2 = rxAdj * rxAdj;
  const ry2 = ryAdj * ryAdj;
  const num = rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p;
  const den = rx2 * y1p * y1p + ry2 * x1p * x1p;
  const sign = largeArc === sweep ? -1 : 1;
  const co = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * (rxAdj * y1p)) / ryAdj;
  const cyp = (co * (-ryAdj * x1p)) / rxAdj;
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  // Step 4: compute the angles.
  const ux = (x1p - cxp) / rxAdj;
  const uy = (y1p - cyp) / ryAdj;
  const vx = (-x1p - cxp) / rxAdj;
  const vy = (-y1p - cyp) / ryAdj;
  const theta1 = Math.atan2(uy, ux);
  let dTheta = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep && dTheta < 0) dTheta += 2 * Math.PI;

  // Step 5: sample.
  const arcLen = Math.abs(dTheta) * Math.max(rxAdj, ryAdj);
  const steps = Math.min(
    maxSegments,
    Math.max(2, Math.ceil(Math.sqrt(arcLen / (8 * tolerance)))),
  );
  for (let i = 1; i <= steps; i++) {
    const t = theta1 + (dTheta * i) / steps;
    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    out.push(
      point(
        cx + rxAdj * cosT * cosPhi - ryAdj * sinT * sinPhi,
        cy + rxAdj * cosT * sinPhi + ryAdj * sinT * cosPhi,
      ),
    );
  }
}

/**
 * @summary Flatten a path into a polyline of subpaths.
 *
 * @description
 * Walks a list of {@linkcode PathSegment} values. Returns an array of
 * subpaths. Each subpath is a closed or open list of points. A `move`
 * segment starts a new subpath. A `close` segment ends the current
 * subpath and starts a new one at the start point of the closed subpath.
 *
 * @example
 * Example 1: A triangle
 * ```ts
 * const subpaths = flattenPath([
 *   { kind: 'move', to: point(0, 0) },
 *   { kind: 'line', to: point(10, 0) },
 *   { kind: 'line', to: point(5, 10) },
 *   { kind: 'close' },
 * ]);
 * subpaths.length;            // 1
 * subpaths[0]!.points.length; // 3
 * subpaths[0]!.closed;        // true
 * ```
 *
 * @example
 * Example 2: Two subpaths
 * ```ts
 * const subpaths = flattenPath([
 *   { kind: 'move', to: point(0, 0) },
 *   { kind: 'line', to: point(10, 0) },
 *   { kind: 'move', to: point(20, 0) },
 *   { kind: 'line', to: point(30, 0) },
 * ]);
 * subpaths.length; // 2
 * ```
 *
 * @param {readonly PathSegment[]} segments The path segments.
 * @param {number} tolerance The flattening tolerance.
 * @param {number} maxSegments The maximum segments per curve.
 * @returns {ReadonlyArray<Subpath>} The flattened subpaths.
 * @author MathAid
 */
export function flattenPath(
  segments: readonly PathSegment[],
  tolerance: number = DEFAULT_TOLERANCE,
  maxSegments: number = DEFAULT_MAX_SEGMENTS,
): Subpath[] {
  const out: Subpath[] = [];
  let current: Point2D[] = [];
  let start: Point2D = point(0, 0);

  const flush = (closed: boolean): void => {
    if (current.length >= 2) {
      out.push({ points: current, closed });
    }
    current = [];
  };

  for (const seg of segments) {
    switch (seg.kind) {
      case 'move':
        flush(false);
        current.push(seg.to);
        start = seg.to;
        break;
      case 'line':
        if (current.length === 0) current.push(start);
        current.push(seg.to);
        break;
      case 'quadratic':
        if (current.length === 0) current.push(start);
        appendQuadratic(current, seg.control, seg.to, tolerance, maxSegments);
        break;
      case 'cubic':
        if (current.length === 0) current.push(start);
        appendCubic(current, seg.c1, seg.c2, seg.to, tolerance, maxSegments);
        break;
      case 'arc':
        if (current.length === 0) current.push(start);
        appendArc(
          current,
          seg.rx,
          seg.ry,
          seg.rotation,
          seg.largeArc,
          seg.sweep,
          seg.to,
          tolerance,
          maxSegments,
        );
        break;
      case 'close':
        if (current.length >= 2) {
          flush(true);
        } else {
          current = [];
        }
        current.push(start);
        break;
    }
  }
  flush(false);
  return out;
}

/**
 * @summary A flattened subpath.
 *
 * @description
 * A list of points and a flag. The flag is `true` when the subpath
 * closes back to the first point.
 */
export interface Subpath {
  /** The points of the subpath. */
  readonly points: Point2D[];
  /** Whether the subpath closes back to the first point. */
  readonly closed: boolean;
}