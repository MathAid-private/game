/**
 * @fileoverview
 * @summary Stroked shape tessellation.
 *
 * @description
 * Turns a {@linkcode Shape} and a {@linkcode StrokeStyle} into a
 * triangle list that represents the stroke outline as a filled region.
 * The output can be drawn with the same fill pipeline as any other
 * triangle list.
 *
 * The algorithm expands the flattened polyline of each shape into a
 * closed outline. Each segment becomes a rectangle. Joins and caps
 * fill the gaps at corners and ends.
 *
 * ```text
 *   Input polyline              Stroked outline
 *
 *   *-----*                     +-----+
 *   |                           |     |
 *   |                           |     |
 *   *                           +-----+
 *
 *   The outline is offset by width/2 on both sides of the polyline.
 * ```
 *
 * Joins and caps are handled by filling small polygons at each vertex
 * and each end. Miter joins extend the outer corner. Round joins and
 * caps use arc samples. Bevel joins clip the outer corner.
 *
 * @see {@linkcode TriangleList}
 * @see {@linkcode StrokeStyle}
 * @author MathAid
 */

import { type Point2D, point } from '../../geometry/point';
import { type PathSegment, type Shape } from '../../geometry/shape';
import { type StrokeStyle } from '../../geometry/style';
import { appendArc, appendCubic, appendQuadratic } from './flatten';
import {
  type TessellateOptions,
  type TriangleList,
  makeTriangleList,
} from './types';

const DEFAULT_TOLERANCE = 0.25;
const DEFAULT_MAX_SEGMENTS = 64;

/**
 * @summary Tessellate a shape's stroke outline into a triangle list.
 *
 * @description
 * The output covers the region within `stroke.width / 2` of the shape's
 * polyline. A dashed stroke splits the polyline into dash segments. Each
 * dash is tessellated independently with the configured cap style.
 *
 * The stroke is applied in the shape's own coordinate space. A transform
 * in the render command is applied at draw time, not during
 * tessellation.
 *
 * @example
 * Example 1: A thin outline
 * ```ts
 * const list = tessellateStroke(shape, {
 *   paint: makeSolid(make(sRGB, 1, 1, 1)),
 *   width: 1,
 * });
 * ```
 *
 * @example
 * Example 2: A thick dashed line
 * ```ts
 * const list = tessellateStroke(shape, {
 *   paint: makeSolid(make(sRGB, 1, 0, 0)),
 *   width: 4,
 *   cap: 'round',
 *   join: 'round',
 *   dash: [8, 4],
 * });
 * ```
 *
 * @example 3: A mitered polygon outline
 * ```ts
 * const list = tessellateStroke(
 *   makePolygon([point(0, 0), point(10, 0), point(5, 10)]),
 *   { paint: makeSolid(make(sRGB, 1, 1, 1)), width: 2, join: 'miter' },
 * );
 * ```
 *
 * @param {Shape} shape The shape whose outline is stroked.
 * @param {StrokeStyle} stroke The stroke style.
 * @param {TessellateOptions} options Tuning parameters.
 * @returns {TriangleList} The stroke triangle list.
 * @author MathAid
 */
export function tessellateStroke(
  shape: Shape,
  stroke: StrokeStyle,
  options: TessellateOptions = {},
): TriangleList {
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const maxSegments = options.maxCurveSegments ?? DEFAULT_MAX_SEGMENTS;
  const halfWidth = (stroke.width ?? 1) / 2;

  const positions: number[] = [];
  const indices: number[] = [];

  for (const polyline of shapePolylines(shape, tolerance, maxSegments)) {
    const segments = stroke.dash
      ? splitDashes(polyline.points, polyline.closed, stroke.dash, stroke.dashOffset ?? 0)
      : [{ points: polyline.points, closed: polyline.closed }];
    for (const s of segments) {
      strokePolyline(s.points, s.closed, halfWidth, stroke, positions, indices, tolerance);
    }
  }

  return makeTriangleList(
    new Float32Array(positions),
    new Uint32Array(indices),
  );
}

interface Polyline {
  readonly points: readonly Point2D[];
  readonly closed: boolean;
}

function shapePolylines(
  shape: Shape,
  tolerance: number,
  maxSegments: number,
): Polyline[] {
  switch (shape.kind) {
    case 'line':
      return [{ points: [shape.from, shape.to], closed: false }];
    case 'polygon':
      return [{ points: shape.points, closed: shape.closed }];
    case 'rect':
      return [{ points: rectPolygon(shape), closed: true }];
    case 'ellipse':
      return [{ points: ellipsePolygon(shape, tolerance, maxSegments), closed: true }];
    case 'path':
      return flattenSubpaths(shape.segments, tolerance, maxSegments).map((p) => ({
        points: p,
        closed: false,
      }));
    case 'group': {
      const out: Polyline[] = [];
      for (const child of shape.shapes) {
        out.push(...shapePolylines(child, tolerance, maxSegments));
      }
      return out;
    }
  }
}

function rectPolygon(shape: Extract<Shape, { kind: 'rect' }>): Point2D[] {
  const r = shape.rect;
  return [
    point(r.x, r.y),
    point(r.x + r.width, r.y),
    point(r.x + r.width, r.y + r.height),
    point(r.x, r.y + r.height),
  ];
}

function ellipsePolygon(
  shape: Extract<Shape, { kind: 'ellipse' }>,
  tolerance: number,
  maxSegments: number,
): Point2D[] {
  const rot = shape.rotation ?? 0;
  const start = shape.startAngle ?? 0;
  const end = shape.endAngle ?? Math.PI * 2;
  const span = end - start;
  const perim = Math.PI * (shape.radiusX + shape.radiusY);
  const arcLen = (span / (Math.PI * 2)) * perim;
  const steps = Math.min(
    maxSegments,
    Math.max(8, Math.ceil(Math.sqrt(arcLen / (4 * tolerance)))),
  );
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const out: Point2D[] = [];
  for (let i = 0; i < steps; i++) {
    const t = start + (span * i) / steps;
    const lx = shape.radiusX * Math.cos(t);
    const ly = shape.radiusY * Math.sin(t);
    out.push(point(
      shape.center.x + lx * cos - ly * sin,
      shape.center.y + lx * sin + ly * cos,
    ));
  }
  return out;
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

function splitDashes(
  points: readonly Point2D[],
  closed: boolean,
  dash: readonly number[],
  offset: number,
): Array<{ points: Point2D[]; closed: false }> {
  if (dash.length === 0) return [{ points: [...points], closed: false }];
  const out: Array<{ points: Point2D[]; closed: false }> = [];
  const pts = closed && points.length > 0 ? [...points, points[0]!] : [...points];
  let patternIndex = 0;
  let patternRemaining = dash[0]!;
  let on = true;
  let phase = offset;
  // Advance phase into the pattern.
  while (phase >= dash[patternIndex % dash.length]!) {
    phase -= dash[patternIndex % dash.length]!;
    patternIndex++;
    on = !on;
  }
  patternRemaining -= phase;

  let current: Point2D[] = [];
  if (on) current.push(pts[0]!);

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    let walked = 0;
    while (walked < segLen) {
      const remaining = segLen - walked;
      const take = Math.min(remaining, patternRemaining);
      const t0 = walked / segLen;
      const t1 = (walked + take) / segLen;
      const p0 = point(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0);
      const p1 = point(a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1);
      if (on) {
        if (current.length === 0) current.push(p0);
        current.push(p1);
      }
      walked += take;
      patternRemaining -= take;
      if (patternRemaining <= 1e-9) {
        if (on && current.length >= 2) {
          out.push({ points: current, closed: false });
        }
        current = [];
        on = !on;
        patternIndex++;
        patternRemaining = dash[patternIndex % dash.length]!;
      }
    }
  }
  if (on && current.length >= 2) out.push({ points: current, closed: false });
  return out;
}

function strokePolyline(
  points: readonly Point2D[],
  closed: boolean,
  halfWidth: number,
  stroke: StrokeStyle,
  positions: number[],
  indices: number[],
  tolerance: number,
): void {
  if (points.length < 2) return;

  const join = stroke.join ?? 'miter';
  const cap = stroke.cap ?? 'butt';

  const n = points.length;
  const edgeCount = closed ? n : n - 1;

  // Emit caps and joins first.
  for (let i = 0; i < n; i++) {
    const prev = i === 0 ? (closed ? points[n - 1]! : null) : points[i - 1]!;
    const cur = points[i]!;
    const next = i === n - 1 ? (closed ? points[0]! : null) : points[i + 1]!;
    const dirIn = prev ? normalizeDir(prev, cur) : null;
    const dirOut = next ? normalizeDir(cur, next) : null;

    if (i === 0 && !closed) {
      // Start cap.
      addCap(cur, dirOut!, halfWidth, cap, positions, indices, tolerance);
    }
    if (i === n - 1 && !closed) {
      // End cap.
      addCap(cur, dirIn!, halfWidth, cap, positions, indices, tolerance);
    }
    if (dirIn && dirOut) {
      addJoin(cur, dirIn, dirOut, halfWidth, join, positions, indices);
    }
  }

  // Emit each segment as a quad.
  for (let i = 0; i < edgeCount; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % n]!;
    const nx = -(b.y - a.y);
    const ny = b.x - a.x;
    const len = Math.hypot(nx, ny);
    if (len === 0) continue;
    const ox = (nx / len) * halfWidth;
    const oy = (ny / len) * halfWidth;
    addQuad(
      positions,
      indices,
      point(a.x + ox, a.y + oy),
      point(b.x + ox, b.y + oy),
      point(b.x - ox, b.y - oy),
      point(a.x - ox, a.y - oy),
    );
  }
}

function normalizeDir(a: Point2D, b: Point2D): Point2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return point(0, 0);
  return point(dx / len, dy / len);
}

function addQuad(
  positions: number[],
  indices: number[],
  a: Point2D,
  b: Point2D,
  c: Point2D,
  d: Point2D,
): void {
  const base = positions.length / 2;
  positions.push(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y);
  indices.push(base, base + 1, base + 2);
  indices.push(base, base + 2, base + 3);
}

function addTriangle(
  positions: number[],
  indices: number[],
  a: Point2D,
  b: Point2D,
  c: Point2D,
): void {
  const base = positions.length / 2;
  positions.push(a.x, a.y, b.x, b.y, c.x, c.y);
  indices.push(base, base + 1, base + 2);
}

function addCap(
  p: Point2D,
  dir: Point2D,
  halfWidth: number,
  cap: 'butt' | 'round' | 'square',
  positions: number[],
  indices: number[],
  tolerance: number,
): void {
  const nx = -dir.y * halfWidth;
  const ny = dir.x * halfWidth;
  if (cap === 'butt') return;
  if (cap === 'square') {
    const ex = dir.x * halfWidth;
    const ey = dir.y * halfWidth;
    addQuad(
      positions,
      indices,
      point(p.x + nx, p.y + ny),
      point(p.x + nx + ex, p.y + ny + ey),
      point(p.x - nx + ex, p.y - ny + ey),
      point(p.x - nx, p.y - ny),
    );
    return;
  }
  // Round.
  const steps = Math.max(
    4,
    Math.ceil(Math.sqrt(halfWidth / tolerance) * 2),
  );
  const startAngle = Math.atan2(dir.y, dir.x);
  const base = positions.length / 2;
  positions.push(p.x, p.y);
  for (let i = 0; i <= steps; i++) {
    const t = startAngle + Math.PI / 2 + (Math.PI * i) / steps;
    positions.push(p.x + halfWidth * Math.cos(t), p.y + halfWidth * Math.sin(t));
  }
  for (let i = 0; i < steps; i++) {
    indices.push(base, base + 1 + i, base + 2 + i);
  }
}

function addJoin(
  p: Point2D,
  dirIn: Point2D,
  dirOut: Point2D,
  halfWidth: number,
  join: 'miter' | 'round' | 'bevel',
  positions: number[],
  indices: number[],
): void {
  const cross = dirIn.x * dirOut.y - dirIn.y * dirOut.x;
  if (Math.abs(cross) < 1e-9) return;
  const side = cross > 0 ? -1 : 1;
  const outerIn = point(-dirIn.y * halfWidth * side, dirIn.x * halfWidth * side);
  const outerOut = point(-dirOut.y * halfWidth * side, dirOut.x * halfWidth * side);
  const a = point(p.x + outerIn.x, p.y + outerIn.y);
  const b = point(p.x + outerOut.x, p.y + outerOut.y);

  if (join === 'bevel') {
    addTriangle(positions, indices, p, a, b);
    return;
  }
  if (join === 'round') {
    // Fan from p to arc samples between a and b.
    const a1 = Math.atan2(outerIn.y, outerIn.x);
    let a2 = Math.atan2(outerOut.y, outerOut.x);
    // Shortest arc.
    while (a2 - a1 > Math.PI) a2 -= 2 * Math.PI;
    while (a1 - a2 > Math.PI) a2 += 2 * Math.PI;
    const steps = 6;
    const base = positions.length / 2;
    positions.push(p.x, p.y);
    for (let i = 0; i <= steps; i++) {
      const t = a1 + ((a2 - a1) * i) / steps;
      positions.push(p.x + halfWidth * Math.cos(t), p.y + halfWidth * Math.sin(t));
    }
    for (let i = 0; i < steps; i++) {
      indices.push(base, base + 1 + i, base + 2 + i);
    }
    return;
  }
  // Miter.
  const sinHalf = Math.abs(cross) / 2;
  const cosHalf = Math.sqrt(Math.max(0, 1 - sinHalf * sinHalf));
  const miterLen = halfWidth / Math.max(cosHalf, 1e-6);
  const bx = a.x + b.x - 2 * p.x;
  const by = a.y + b.y - 2 * p.y;
  const bLen = Math.hypot(bx, by);
  if (bLen === 0) {
    addTriangle(positions, indices, p, a, b);
    return;
  }
  const tip = point(
    p.x + (bx / bLen) * miterLen * Math.sign(cross) * -side * Math.sign(cross),
    p.y + (by / bLen) * miterLen * Math.sign(cross) * -side * Math.sign(cross),
  );
  addTriangle(positions, indices, p, a, tip);
  addTriangle(positions, indices, p, tip, b);
}