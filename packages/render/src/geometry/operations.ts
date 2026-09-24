/**
 * @fileoverview
 * @module
 * @summary Shape operations: bounds, area, containment, and transform.
 *
 * @description
 * Provides four free functions over the {@linkcode Shape} union. Each
 * function dispatches on the shape `kind`. The functions are pure. No
 * function mutates its input.
 *
 * ```text
 *   shapeBounds(shape)          the axis-aligned bounding rectangle
 *   shapeArea(shape)            the signed area
 *   shapeContains(shape, point) whether a point lies inside
 *   applyToShape(m, shape) apply a Mat2D to the shape
 * ```
 *
 * The operations are conservative where exact results would need a
 * tessellator. {@linkcode bounds} uses the actual extents for lines,
 * polygons, rects, and ellipses. For paths and groups, the function
 * unions the bounds of the parts. A curve contributes its control hull
 * bounds, which is a superset of the true bounds.
 *
 * {@linkcode area} returns the signed area for polygons and rects. For
 * curved shapes it uses the closed-form value. For paths it returns an
 * approximation. See the individual function docs for details.
 *
 * @example
 * Example 1: Bounding box of a shape
 * ```ts
 * import { makeCircle } from './shape';
 * import { point } from './point';
 * import { bounds } from './operations';
 *
 * shapeBounds(makeCircle(point(50, 50), 10));
 * // { x: 40, y: 40, width: 20, height: 20 }
 * ```
 *
 * @example
 * Example 2: Hit testing
 * ```ts
 * import { makeRect } from './shape';
 * import { rect, contains } from './rect';
 * import { point } from './point';
 *
 * const hit = containsShape(makeRect(rect(0, 0, 10, 10)), point(5, 5));
 * // true
 * ```
 *
 * @see {@linkcode Shape}
 * @author MathAid
 */

import { type Point2D, point } from './point';
import {
  type Rect,
  rectCenter,
  rectContains,
  rectUnion,
} from './rect';
import { type Shape } from './shape';
import { type Mat2D, applyToPoint } from './transform';

// -----------------------------------------------------------------
//  Bounds
// -----------------------------------------------------------------

/**
 * @summary The axis-aligned bounding rectangle of a shape.
 *
 * @description
 * The result is the smallest axis-aligned rectangle that contains every
 * point of the shape after it is drawn. The function dispatches on the
 * shape kind.
 *
 * For a path or a group, the function unions the bounds of the parts.
 * A curve segment contributes the bounds of its control hull. This is a
 * superset of the true curve bounds. The result is always at least as
 * large as the true bounds. It may be larger for curves with tight
 * control points.
 *
 * @example
 * Example 1: A rectangle
 * ```ts
 * import { makeRect } from './shape';
 * import { rect } from './rect';
 * import { bounds } from './operations';
 *
 * shapeBounds(makeRect(rect(10, 20, 30, 40)));
 * // { x: 10, y: 20, width: 30, height: 40 }
 * ```
 *
 * @example
 * Example 2: A circle
 * ```ts
 * import { makeCircle } from './shape';
 * import { point } from './point';
 * import { bounds } from './operations';
 *
 * shapeBounds(makeCircle(point(0, 0), 5));
 * // { x: -5, y: -5, width: 10, height: 10 }
 * ```
 *
 * @param {Shape} shape The shape to measure.
 * @returns {Rect} The bounding rectangle.
 * @author MathAid
 */
export function shapeBounds(shape: Shape): Rect {
  switch (shape.kind) {
    case 'line':
      return boundsOfLine(shape.from, shape.to);
    case 'polygon':
      return boundsOfPoints(shape.points);
    case 'rect':
      return shape.rect;
    case 'ellipse':
      return boundsOfEllipse(shape);
    case 'path':
      return boundsOfPath(shape);
    case 'group':
      return boundsOfGroup(shape);
  }
}

function boundsOfLine(a: Point2D, b: Point2D): Rect {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x, b.x);
  const maxY = Math.max(a.y, b.y);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function boundsOfPoints(points: readonly Point2D[]): Rect {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function boundsOfEllipse(shape: Extract<Shape, { kind: 'ellipse' }>): Rect {
  // For an unrotated ellipse the bounds are the axis-aligned box. For a
  // rotated ellipse the extent on each axis is a function of both radii
  // and the rotation.
  const rot = shape.rotation ?? 0;
  const start = shape.startAngle ?? 0;
  const end = shape.endAngle ?? 2 * Math.PI;
  // A full ellipse has a closed-form bound regardless of start and end.
  if (end - start >= 2 * Math.PI - 1e-9) {
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const halfX = Math.hypot(shape.radiusX * cos, shape.radiusY * sin);
    const halfY = Math.hypot(shape.radiusX * sin, shape.radiusY * cos);
    return {
      x: shape.center.x - halfX,
      y: shape.center.y - halfY,
      width: 2 * halfX,
      height: 2 * halfY,
    };
  }
  // An arc: sample the endpoints and the axis-aligned extremes within
  // the angular span. A small number of samples is enough.
  const samples = 16;
  const points: Point2D[] = [];
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  for (let i = 0; i <= samples; i++) {
    const t = start + (end - start) * (i / samples);
    const lx = shape.radiusX * Math.cos(t);
    const ly = shape.radiusY * Math.sin(t);
    points.push(point(
      shape.center.x + lx * cos - ly * sin,
      shape.center.y + lx * sin + ly * cos,
    ));
  }
  return boundsOfPoints(points);
}

function boundsOfPath(shape: Extract<Shape, { kind: 'path' }>): Rect {
  // Walk the path. Track the current point and a rectangle that grows
  // to contain every anchor and every control point.
  let current = point(0, 0);
  let start = point(0, 0);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let touched = false;
  const include = (p: Point2D): void => {
    touched = true;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  };
  for (const seg of shape.segments) {
    switch (seg.kind) {
      case 'move':
        current = seg.to;
        start = seg.to;
        include(current);
        break;
      case 'line':
        include(seg.to);
        current = seg.to;
        break;
      case 'quadratic':
        include(seg.control);
        include(seg.to);
        current = seg.to;
        break;
      case 'cubic':
        include(seg.c1);
        include(seg.c2);
        include(seg.to);
        current = seg.to;
        break;
      case 'arc':
        include(seg.to);
        current = seg.to;
        break;
      case 'close':
        current = start;
        break;
    }
  }
  if (!touched) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function boundsOfGroup(shape: Extract<Shape, { kind: 'group' }>): Rect {
  if (shape.shapes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  let acc = shapeBounds(shape.shapes[0]!);
  for (let i = 1; i < shape.shapes.length; i++) {
    acc = rectUnion(acc, shapeBounds(shape.shapes[i]!));
  }
  return acc;
}

// -----------------------------------------------------------------
//  Area
// -----------------------------------------------------------------

/**
 * @summary The signed area of a shape.
 *
 * @description
 * The result is the area enclosed by the shape. A positive value means
 * the vertices are ordered counter-clockwise in a math-oriented frame.
 * A negative value means clockwise. The caller may take the absolute
 * value when the winding direction is not important.
 *
 * For a line, the area is `0`. For a group, the area is the sum of the
 * areas of the parts. The sum may under-count overlapping shapes.
 *
 * For an arc, the area is the area of the pie slice. For a path with
 * curves, the area is approximated by flattening the curve into a
 * polygon. The approximation uses sixteen samples per curved segment.
 *
 * @example
 * Example 1: A square
 * ```ts
 * import { makeRect } from './shape';
 * import { rect } from './rect';
 * import { area } from './operations';
 *
 * shapeArea(makeRect(rect(0, 0, 10, 10))); // 100
 * ```
 *
 * @example
 * Example 2: A circle
 * ```ts
 * import { makeCircle } from './shape';
 * import { point } from './point';
 * import { area } from './operations';
 *
 * Math.abs(shapeArea(makeCircle(point(0, 0), 5))); // approximately 78.5
 * ```
 *
 * @param {Shape} shape The shape to measure.
 * @returns {number} The signed area.
 * @author MathAid
 */
export function shapeArea(shape: Shape): number {
  switch (shape.kind) {
    case 'line':
      return 0;
    case 'polygon':
      return areaOfPolygon(shape.points);
    case 'rect':
      return shape.rect.width * shape.rect.height;
    case 'ellipse':
      return areaOfEllipse(shape);
    case 'path':
      return areaOfPath(shape);
    case 'group':
      return areaOfGroup(shape);
  }
}

function areaOfPolygon(points: readonly Point2D[]): number {
  // The shoelace formula. The result is twice the signed area.
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function areaOfEllipse(shape: Extract<Shape, { kind: 'ellipse' }>): number {
  const start = shape.startAngle ?? 0;
  const end = shape.endAngle ?? 2 * Math.PI;
  const span = end - start;
  // Full ellipse: pi * rx * ry. Partial arc: fraction of the full area.
  if (span >= 2 * Math.PI - 1e-9) {
    return Math.PI * shape.radiusX * shape.radiusY;
  }
  return (span / (2 * Math.PI)) * Math.PI * shape.radiusX * shape.radiusY;
}

function areaOfPath(shape: Extract<Shape, { kind: 'path' }>): number {
  // Flatten the path into a polygon. Each curve contributes sixteen
  // points along its parameter range.
  const flat: Point2D[] = [];
  let current = point(0, 0);
  let start = point(0, 0);
  for (const seg of shape.segments) {
    switch (seg.kind) {
      case 'move':
        flat.push(seg.to);
        start = seg.to;
        current = seg.to;
        break;
      case 'line':
        flat.push(seg.to);
        current = seg.to;
        break;
      case 'quadratic': {
        const steps = 16;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const u = 1 - t;
          flat.push(point(
            u * u * current.x + 2 * u * t * seg.control.x + t * t * seg.to.x,
            u * u * current.y + 2 * u * t * seg.control.y + t * t * seg.to.y,
          ));
        }
        current = seg.to;
        break;
      }
      case 'cubic': {
        const steps = 16;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const u = 1 - t;
          flat.push(point(
            u * u * u * current.x + 3 * u * u * t * seg.c1.x +
              3 * u * t * t * seg.c2.x + t * t * t * seg.to.x,
            u * u * u * current.y + 3 * u * u * t * seg.c1.y +
              3 * u * t * t * seg.c2.y + t * t * t * seg.to.y,
          ));
        }
        current = seg.to;
        break;
      }
      case 'arc':
        flat.push(seg.to);
        current = seg.to;
        break;
      case 'close':
        current = start;
        break;
    }
  }
  return areaOfPolygon(flat);
}

function areaOfGroup(shape: Extract<Shape, { kind: 'group' }>): number {
  let sum = 0;
  for (const s of shape.shapes) sum += shapeArea(s);
  return sum;
}

// -----------------------------------------------------------------
//  Containment
// -----------------------------------------------------------------

/**
 * @summary Test whether a point lies inside a shape.
 *
 * @description
 * The test uses the drawn fill region. For a line, every point returns
 * `false`. For a group, a point returns `true` when any child contains
 * it. For a path, the test uses the even-odd rule.
 *
 * The test ignores the stroke. A point on the outline of a shape but
 * outside the fill returns `false`. Use {@linkcode bounds} for a looser
 * test that includes the stroke.
 *
 * @example
 * Example 1: A point inside a rectangle
 * ```ts
 * import { makeRect } from './shape';
 * import { rect } from './rect';
 * import { point } from './point';
 * import { contains } from './operations';
 *
 * shapeContains(makeRect(rect(0, 0, 10, 10)), point(5, 5)); // true
 * ```
 *
 * @example
 * Example 2: A point outside a circle
 * ```ts
 * import { makeCircle } from './shape';
 * import { point } from './point';
 * import { contains } from './operations';
 *
 * shapeContains(makeCircle(point(0, 0), 5), point(10, 0)); // false
 * ```
 *
 * @param {Shape} shape The shape to test.
 * @param {Point2D} p The point.
 * @returns {boolean} `true` when the point is inside the fill region.
 * @author MathAid
 */
export function shapeContains(shape: Shape, p: Point2D): boolean {
  switch (shape.kind) {
    case 'line':
      return false;
    case 'polygon':
      return pointInPolygon(p, shape.points);
    case 'rect':
      return rectContains(shape.rect, p);
    case 'ellipse':
      return pointInEllipse(p, shape);
    case 'path':
      return pointInPath(p, shape);
    case 'group':
      return shape.shapes.some((s) => shapeContains(s, p));
  }
}

function pointInPolygon(p: Point2D, points: readonly Point2D[]): boolean {
  // Ray casting. Count the number of edges crossed by a ray to the right.
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!;
    const b = points[j]!;
    const intersect =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInEllipse(
  p: Point2D,
  shape: Extract<Shape, { kind: 'ellipse' }>,
): boolean {
  const rot = shape.rotation ?? 0;
  const cos = Math.cos(-rot);
  const sin = Math.sin(-rot);
  const dx = p.x - shape.center.x;
  const dy = p.y - shape.center.y;
  // Rotate the point into the ellipse's local frame.
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  // Test the local frame against the ellipse equation.
  const rx = shape.radiusX;
  const ry = shape.radiusY;
  if (rx === 0 || ry === 0) return false;
  return (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1;
}

function pointInPath(p: Point2D, shape: Extract<Shape, { kind: 'path' }>): boolean {
  // Flatten the path into a polygon and apply the even-odd rule.
  const flat: Point2D[] = [];
  let current = point(0, 0);
  for (const seg of shape.segments) {
    switch (seg.kind) {
      case 'move':
        flat.push(seg.to);
        current = seg.to;
        break;
      case 'line':
        flat.push(seg.to);
        current = seg.to;
        break;
      case 'quadratic': {
        const steps = 16;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const u = 1 - t;
          flat.push(point(
            u * u * current.x + 2 * u * t * seg.control.x + t * t * seg.to.x,
            u * u * current.y + 2 * u * t * seg.control.y + t * t * seg.to.y,
          ));
        }
        current = seg.to;
        break;
      }
      case 'cubic': {
        const steps = 16;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const u = 1 - t;
          flat.push(point(
            u * u * u * current.x + 3 * u * u * t * seg.c1.x +
              3 * u * t * t * seg.c2.x + t * t * t * seg.to.x,
            u * u * u * current.y + 3 * u * u * t * seg.c1.y +
              3 * u * t * t * seg.c2.y + t * t * t * seg.to.y,
          ));
        }
        current = seg.to;
        break;
      }
      case 'arc':
        flat.push(seg.to);
        current = seg.to;
        break;
      case 'close':
        break;
    }
  }
  return pointInPolygon(p, flat);
}

// -----------------------------------------------------------------
//  Transform
// -----------------------------------------------------------------

/**
 * @summary Apply a matrix to every point of a shape.
 *
 * @description
 * Returns a new shape with the transform applied. The transform touches
 * every point of every shape, including the anchors, the control points
 * of a path, and the center of an ellipse. The matrix does not collapse
 * to a scalar. Every `Point2D` in the result is the transformed point.
 *
 * The function returns a new shape. It never mutates the input.
 *
 * @example
 * Example 1: Move a rectangle
 * ```ts
 * import { makeRect } from './shape';
 * import { rect } from './rect';
 * import { translation } from './transform';
 * import { applyToShape } from './operations';
 *
 * applyToShape(translation(10, 20), makeRect(rect(0, 0, 5, 5)));
 * // a rect at (10, 20) with the same size
 * ```
 *
 * @example
 * Example 2: Rotate a group
 * ```ts
 * import { makeGroup, makeLine } from './shape';
 * import { point } from './point';
 * import { rotation } from './transform';
 * import { applyToShape } from './operations';
 *
 * applyToShape(rotation(Math.PI / 2), makeGroup([
 *   makeLine(point(0, 0), point(10, 0)),
 * ]));
 * ```
 *
 * @param {Mat2D} m The matrix to apply.
 * @param {Shape} shape The shape to transform.
 * @returns {Shape} A new shape.
 * @author MathAid
 */
export function applyToShape(m: Mat2D, shape: Shape): Shape {
  switch (shape.kind) {
    case 'line':
      return {
        kind: 'line',
        from: applyToPoint(m, shape.from),
        to: applyToPoint(m, shape.to),
      };
    case 'polygon':
      return {
        kind: 'polygon',
        points: shape.points.map((p) => applyToPoint(m, p)),
        closed: shape.closed,
      };
    case 'rect':
      return applyToRect(m, shape);
    case 'ellipse':
      return applyToEllipse(m, shape);
    case 'path':
      return {
        kind: 'path',
        segments: shape.segments.map((s) => applyToSegment(m, s)),
      };
    case 'group':
      return {
        kind: 'group',
        shapes: shape.shapes.map((s) => applyToShape(m, s)),
      };
  }
}

function applyToRect(m: Mat2D, shape: Extract<Shape, { kind: 'rect' }>): Shape {
  // A rotated rect is no longer axis-aligned. Convert to a polygon when
  // the matrix has rotation or skew.
  const [_, b] = m;
  const isAxisAligned = b === 0 && m[2] === 0;
  if (isAxisAligned) {
    const topLeft = applyToPoint(m, point(shape.rect.x, shape.rect.y));
    const bottomRight = applyToPoint(m, point(
      shape.rect.x + shape.rect.width,
      shape.rect.y + shape.rect.height,
    ));
    const minX = Math.min(topLeft.x, bottomRight.x);
    const minY = Math.min(topLeft.y, bottomRight.y);
    const maxX = Math.max(topLeft.x, bottomRight.x);
    const maxY = Math.max(topLeft.y, bottomRight.y);
    if (shape.cornerRadius === undefined) {
      return {
        kind: 'rect',
        rect: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      };
    }
    // With rounded corners, fall through to the polygon path.
  }
  // Rotated or skewed rect. Emit a polygon.
  return {
    kind: 'polygon',
    points: [
      applyToPoint(m, point(shape.rect.x, shape.rect.y)),
      applyToPoint(m, point(shape.rect.x + shape.rect.width, shape.rect.y)),
      applyToPoint(m, point(
        shape.rect.x + shape.rect.width,
        shape.rect.y + shape.rect.height,
      )),
      applyToPoint(m, point(shape.rect.x, shape.rect.y + shape.rect.height)),
    ],
    closed: true,
  };
}

function applyToEllipse(
  m: Mat2D,
  shape: Extract<Shape, { kind: 'ellipse' }>,
): Shape {
  // A general matrix can turn an ellipse into a rotated ellipse. Extract
  // the linear part and measure its effect on the axes.
  const [a, b, c, d] = m;
  const rot = shape.rotation ?? 0;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  // The ellipse's local x-axis and y-axis in world space.
  const xAxis = point(a * cos + c * sin, b * cos + d * sin);
  const yAxis = point(a * -sin + c * cos, b * -sin + d * cos);
  const radiusX = Math.hypot(xAxis.x * shape.radiusX, yAxis.x * shape.radiusY);
  const radiusY = Math.hypot(xAxis.y * shape.radiusX, yAxis.y * shape.radiusY);
  const newCenter = applyToPoint(m, shape.center);
  return {
    kind: 'ellipse',
    center: newCenter,
    radiusX,
    radiusY,
    rotation: 0,
    startAngle: shape.startAngle,
    endAngle: shape.endAngle,
  };
}

function applyToSegment(m: Mat2D, seg: Extract<Shape, { kind: 'path' }>['segments'][number]): Extract<Shape, { kind: 'path' }>['segments'][number] {
  switch (seg.kind) {
    case 'move':
      return { kind: 'move', to: applyToPoint(m, seg.to) };
    case 'line':
      return { kind: 'line', to: applyToPoint(m, seg.to) };
    case 'quadratic':
      return {
        kind: 'quadratic',
        control: applyToPoint(m, seg.control),
        to: applyToPoint(m, seg.to),
      };
    case 'cubic':
      return {
        kind: 'cubic',
        c1: applyToPoint(m, seg.c1),
        c2: applyToPoint(m, seg.c2),
        to: applyToPoint(m, seg.to),
      };
    case 'arc':
      return {
        kind: 'arc',
        rx: seg.rx,
        ry: seg.ry,
        rotation: seg.rotation,
        largeArc: seg.largeArc,
        sweep: seg.sweep,
        to: applyToPoint(m, seg.to),
      };
    case 'close':
      return seg;
  }
}

// Keep the imported rect helpers in use.
void rectCenter;