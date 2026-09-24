/**
 * @fileoverview
 * @summary Filled shape tessellation.
 *
 * @description
 * Turns a {@linkcode Shape} into a filled {@linkcode TriangleList}.
 * Handles every shape kind. Dispatches on the `kind` field. A group
 * recurses into its children and concatenates the results.
 *
 * Each shape kind uses a specific strategy.
 *
 * ```text
 *   line       no fill. An empty list is returned.
 *   polygon    earcut for the triangulation.
 *   rect       two triangles, or a rounded-rect polygon.
 *   ellipse    a triangle fan around the center.
 *   path       flatten each subpath, then earcut.
 *   group      concatenate the children.
 * ```
 *
 * @example
 * Example 1: Fill a rectangle
 * ```ts
 * const list = tessellateFill(makeRect(rect(0, 0, 10, 10)));
 * list.triangleCount; // 2
 * ```
 *
 * @example
 * Example 2: Fill a circle
 * ```ts
 * const list = tessellateFill(makeCircle(point(0, 0), 10));
 * list.triangleCount; // many
 * ```
 *
 * @see {@linkcode TriangleList}
 * @author MathAid
 */

import { type Point2D, point } from '../../geometry/point';
import { type PathSegment, type Shape } from '../../geometry/shape';
import { earcut } from './earcut';
import { appendArc, appendCubic, appendQuadratic } from './flatten';
import {
  type TessellateOptions,
  type TriangleList,
  emptyTriangleList,
  makeTriangleList,
} from './types';

const DEFAULT_TOLERANCE = 0.25;
const DEFAULT_MAX_SEGMENTS = 64;

/**
 * @summary Tessellate a shape into a filled triangle list.
 *
 * @description
 * The output is a triangle soup in logical pixel space. The shape is
 * not scaled or transformed. Callers that need a transform apply it to
 * the vertex positions after tessellation, or set a transform uniform
 * in the shader.
 *
 * @example
 * Example 1: A rectangle
 * ```ts
 * const list = tessellateFill(makeRect(rect(0, 0, 10, 10)));
 * ```
 *
 * @example
 * Example 2: A circle with higher precision
 * ```ts
 * const list = tessellateFill(makeCircle(point(0, 0), 10), {
 *   tolerance: 0.1,
 * });
 * ```
 *
 * @example
 * Example 3: A group of shapes
 * ```ts
 * const list = tessellateFill(makeGroup([
 *   makeRect(rect(0, 0, 10, 10)),
 *   makeCircle(point(20, 5), 5),
 * ]));
 * ```
 *
 * @param {Shape} shape The shape to tessellate.
 * @param {TessellateOptions} options Tuning parameters.
 * @returns {TriangleList} The filled triangle list.
 * @author MathAid
 */
export function tessellateFill(
  shape: Shape,
  options: TessellateOptions = {},
): TriangleList {
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const maxSegments = options.maxCurveSegments ?? DEFAULT_MAX_SEGMENTS;

  const positions: number[] = [];
  const indices: number[] = [];

  fillShape(shape, positions, indices, tolerance, maxSegments);

  return makeTriangleList(
    new Float32Array(positions),
    new Uint32Array(indices),
  );
}

function fillShape(
  shape: Shape,
  positions: number[],
  indices: number[],
  tolerance: number,
  maxSegments: number,
): void {
  switch (shape.kind) {
    case 'line':
      // A line has no fill.
      return;
    case 'rect':
      fillRect(shape, positions, indices);
      return;
    case 'polygon':
      fillPolygon(shape.points, positions, indices);
      return;
    case 'ellipse':
      fillEllipse(shape, positions, indices, tolerance, maxSegments);
      return;
    case 'path':
      fillPath(shape.segments, positions, indices, tolerance, maxSegments);
      return;
    case 'group':
      for (const child of shape.shapes) {
        fillShape(child, positions, indices, tolerance, maxSegments);
      }
      return;
  }
}

function fillRect(
  shape: Extract<Shape, { kind: 'rect' }>,
  positions: number[],
  indices: number[],
): void {
  const r = shape.rect;
  if (shape.cornerRadius === undefined) {
    const base = positions.length / 2;
    positions.push(
      r.x, r.y,
      r.x + r.width, r.y,
      r.x + r.width, r.y + r.height,
      r.x, r.y + r.height,
    );
    indices.push(base, base + 1, base + 2);
    indices.push(base, base + 2, base + 3);
    return;
  }
  // A rounded rect is a polygon of arc samples.
  const radius = shape.cornerRadius;
  const [tl, tr, br, bl] = Array.isArray(radius)
    ? radius
    : [radius, radius, radius, radius];
  const points: Point2D[] = [];
  const arc = (
    cx: number,
    cy: number,
    r: number,
    start: number,
    end: number,
  ): void => {
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const t = start + ((end - start) * i) / steps;
      points.push(point(cx + r * Math.cos(t), cy + r * Math.sin(t)));
    }
  };
  // Top-left, top-right, bottom-right, bottom-left, in CCW order.
  points.push(point(r.x + tl, r.y));
  points.push(point(r.x + r.width - tr, r.y));
  if (tr > 0) arc(r.x + r.width - tr, r.y + tr, tr, -Math.PI / 2, 0);
  points.push(point(r.x + r.width, r.y + r.height - br));
  if (br > 0) arc(r.x + r.width - br, r.y + r.height - br, br, 0, Math.PI / 2);
  points.push(point(r.x + bl, r.y + r.height));
  if (bl > 0) arc(r.x + bl, r.y + r.height - bl, bl, Math.PI / 2, Math.PI);
  points.push(point(r.x, r.y + tl));
  if (tl > 0) arc(r.x + tl, r.y + tl, tl, Math.PI, 3 * Math.PI / 2);
  fillPolygon(points, positions, indices);
}

function fillPolygon(
  points: readonly Point2D[],
  positions: number[],
  indices: number[],
): void {
  if (points.length < 3) return;
  const base = positions.length / 2;
  for (const p of points) positions.push(p.x, p.y);
  const tris = earcut(points);
  for (const i of tris) indices.push(base + i);
}

function fillEllipse(
  shape: Extract<Shape, { kind: 'ellipse' }>,
  positions: number[],
  indices: number[],
  tolerance: number,
  maxSegments: number,
): void {
  // A full ellipse uses a fan from the center. A partial arc uses a fan
  // from the center to the arc endpoints.
  const rot = shape.rotation ?? 0;
  const start = shape.startAngle ?? 0;
  const end = shape.endAngle ?? Math.PI * 2;
  const span = end - start;
  const full = span >= Math.PI * 2 - 1e-9;

  const perim = Math.PI * (shape.radiusX + shape.radiusY);
  const arcLen = full ? perim : (span / (Math.PI * 2)) * perim;
  const steps = Math.min(
    maxSegments,
    Math.max(8, Math.ceil(Math.sqrt(arcLen / (4 * tolerance)))),
  );

  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  const base = positions.length / 2;
  // Center vertex.
  positions.push(shape.center.x, shape.center.y);
  // Rim vertices.
  for (let i = 0; i <= steps; i++) {
    const t = start + (span * i) / steps;
    const lx = shape.radiusX * Math.cos(t);
    const ly = shape.radiusY * Math.sin(t);
    positions.push(
      shape.center.x + lx * cos - ly * sin,
      shape.center.y + lx * sin + ly * cos,
    );
  }
  for (let i = 0; i < steps; i++) {
    indices.push(base, base + 1 + i, base + 2 + i);
  }
}

function fillPath(
  segments: readonly PathSegment[],
  positions: number[],
  indices: number[],
  tolerance: number,
  maxSegments: number,
): void {
  const subpaths = flattenSubpaths(segments, tolerance, maxSegments);
  for (const sp of subpaths) {
    if (sp.length >= 3) fillPolygon(sp, positions, indices);
  }
}

function flattenSubpaths(
  segments: readonly PathSegment[],
  tolerance: number,
  maxSegments: number,
): Point2D[][] {
  const out: Point2D[][] = [];
  let current: Point2D[] = [];
  let start: Point2D = point(0, 0);
  const flush = (): void => {
    if (current.length >= 2) out.push(current);
    current = [];
  };
  for (const seg of segments) {
    switch (seg.kind) {
      case 'move':
        flush();
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
        flush();
        current.push(start);
        break;
    }
  }
  flush();
  return out;
}

// Unused export guard. The `emptyTriangleList` import is here for
// callers that need it.
export { emptyTriangleList };
