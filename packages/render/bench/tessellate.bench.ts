/**
 * @fileoverview
 * @summary Tessellation throughput benchmarks.
 *
 * @description
 * Measures the cost of {@linkcode tessellateFill} and
 * {@linkcode tessellateStroke} for common shapes and for high-vertex
 * inputs. The benchmark isolates the tessellator from dispatch so the
 * numbers reflect geometry cost, not the renderer.
 *
 * ```text
 *   fill-rect          fill a rectangle
 *   fill-circle-64     fill a circle at default tolerance
 *   fill-circle-256    fill a circle at high precision
 *   fill-path-curves   fill a cubic path
 *   fill-group-8       fill a group of 8 rects
 *   stroke-rect        stroke a rectangle
 *   stroke-dash        stroke a dashed line
 *   stroke-circle      stroke a circle
 * ```
 *
 * @see {@linkcode tessellateFill}
 * @see {@linkcode tessellateStroke}
 * @author MathAid
 */

import {
  make,
  makeCircle,
  makeGroup,
  makePath,
  makePolygon,
  makeRect,
  makeSolid,
  point,
  rect,
  sRGB,
  tessellateFill,
  tessellateStroke,
} from '@games/render';
import { bench, describe } from 'vitest';

const whiteStroke = { paint: makeSolid(make(sRGB, 1, 1, 1)), width: 2 };

const shapeRect = makeRect(rect(0, 0, 64, 64));
const shapeCircle64 = makeCircle(point(32, 32), 32);
const shapePath = makePath([
  { kind: 'move', to: point(0, 0) },
  { kind: 'cubic', c1: point(0, 40), c2: point(64, 40), to: point(64, 0) },
  { kind: 'close' },
]);
const shapeGroup = makeGroup([
  makeRect(rect(0, 0, 8, 8)),
  makeRect(rect(8, 0, 8, 8)),
  makeRect(rect(16, 0, 8, 8)),
  makeRect(rect(24, 0, 8, 8)),
  makeRect(rect(32, 0, 8, 8)),
  makeRect(rect(40, 0, 8, 8)),
  makeRect(rect(48, 0, 8, 8)),
  makeRect(rect(56, 0, 8, 8)),
]);
const shapePolygon = makePolygon(
  Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    return point(32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30);
  }),
  true,
);

describe('tessellateFill', () => {
  bench('fill-rect', () => {
    tessellateFill(shapeRect);
  });

  bench('fill-circle-64', () => {
    tessellateFill(shapeCircle64);
  });

  bench('fill-circle-256', () => {
    tessellateFill(shapeCircle64, { tolerance: 0.05 });
  });

  bench('fill-path-curves', () => {
    tessellateFill(shapePath);
  });

  bench('fill-polygon-64', () => {
    tessellateFill(shapePolygon);
  });

  bench('fill-group-8', () => {
    tessellateFill(shapeGroup);
  });
});

describe('tessellateStroke', () => {
  bench('stroke-rect', () => {
    tessellateStroke(shapeRect, whiteStroke);
  });

  bench('stroke-line', () => {
    tessellateStroke(
      {
        kind: 'line',
        from: point(0, 0),
        to: point(100, 0),
      },
      whiteStroke,
    );
  });

  bench('stroke-dash', () => {
    tessellateStroke(
      { kind: 'line', from: point(0, 0), to: point(100, 0) },
      { ...whiteStroke, dash: [4, 4] },
    );
  });

  bench('stroke-circle', () => {
    tessellateStroke(shapeCircle64, whiteStroke);
  });

  bench('stroke-polygon-64', () => {
    tessellateStroke(shapePolygon, { ...whiteStroke, join: 'round' });
  });
});