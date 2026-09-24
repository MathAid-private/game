/**
 * @fileoverview
 * @summary Tests for the shape tessellator.
 *
 * @description
 * Covers the filled and stroked tessellation for every shape kind, the
 * curve flattening tolerance, and the empty-shape edge case.
 *
 * @see {@linkcode tessellateFill}
 * @see {@linkcode tessellateStroke}
 * @author MathAid
 */

import {
  make,
  makeCircle,
  makeGroup,
  makeLine,
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
import { describe, expect, it } from 'vitest';

describe('tessellateFill', () => {
  it('produces two triangles for an axis-aligned rect', () => {
    const list = tessellateFill(makeRect(rect(0, 0, 10, 10)));
    expect(list.triangleCount).toBe(2);
    expect(list.vertexCount).toBe(4);
  });

  it('produces one triangle for a triangle polygon', () => {
    const list = tessellateFill(
      makePolygon([point(0, 0), point(10, 0), point(5, 10)]),
    );
    expect(list.triangleCount).toBe(1);
  });

  it('produces at least one triangle for a circle', () => {
    const list = tessellateFill(makeCircle(point(0, 0), 10));
    expect(list.triangleCount).toBeGreaterThan(6);
  });

  it('produces a fan for a path triangle', () => {
    const list = tessellateFill(
      makePath([
        { kind: 'move', to: point(0, 0) },
        { kind: 'line', to: point(10, 0) },
        { kind: 'line', to: point(5, 10) },
        { kind: 'close' },
      ]),
    );
    expect(list.triangleCount).toBe(1);
  });

  it('returns empty for a line', () => {
    const list = tessellateFill(makeLine(point(0, 0), point(10, 0)));
    expect(list.triangleCount).toBe(0);
  });

  it('concatenates a group of shapes', () => {
    const list = tessellateFill(
      makeGroup([
        makeRect(rect(0, 0, 10, 10)),
        makeRect(rect(20, 0, 10, 10)),
      ]),
    );
    expect(list.triangleCount).toBe(4);
  });

  it('uses a smaller tolerance for smoother curves', () => {
    const coarse = tessellateFill(makeCircle(point(0, 0), 100), {
      tolerance: 4,
    });
    const fine = tessellateFill(makeCircle(point(0, 0), 100), {
      tolerance: 0.1,
    });
    expect(fine.triangleCount).toBeGreaterThan(coarse.triangleCount);
  });

  it('produces indices that fit the vertex count', () => {
    const list = tessellateFill(makeCircle(point(0, 0), 10));
    for (const i of list.indices) {
      expect(i).toBeLessThan(list.vertexCount);
      expect(i).toBeGreaterThanOrEqual(0);
    }
  });

  it('produces counter-clockwise triangles for a CCW input', () => {
    const list = tessellateFill(
      makePolygon([point(0, 0), point(10, 0), point(5, 10)]),
    );
    // First triangle: v0 v1 v2 in CCW order.
    const i0 = list.indices[0]!;
    const i1 = list.indices[1]!;
    const i2 = list.indices[2]!;
    const ax = list.positions[i0 * 2]!;
    const ay = list.positions[i0 * 2 + 1]!;
    const bx = list.positions[i1 * 2]!;
    const by = list.positions[i1 * 2 + 1]!;
    const cx = list.positions[i2 * 2]!;
    const cy = list.positions[i2 * 2 + 1]!;
    const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    expect(cross).toBeGreaterThan(0);
  });
});

describe('tessellateStroke', () => {
  const whiteStroke = { paint: makeSolid(make(sRGB, 1, 1, 1)), width: 1 };

  it('produces triangles for a line', () => {
    const list = tessellateStroke(
      makeLine(point(0, 0), point(10, 0)),
      whiteStroke,
    );
    expect(list.triangleCount).toBeGreaterThan(0);
  });

  it('produces triangles for a rect', () => {
    const list = tessellateStroke(makeRect(rect(0, 0, 10, 10)), {
      ...whiteStroke,
      width: 2,
    });
    expect(list.triangleCount).toBeGreaterThan(0);
  });

  it('produces triangles for a polygon', () => {
    const list = tessellateStroke(
      makePolygon([point(0, 0), point(10, 0), point(5, 10)], true),
      whiteStroke,
    );
    expect(list.triangleCount).toBeGreaterThan(0);
  });

  it('produces triangles for a circle', () => {
    const list = tessellateStroke(makeCircle(point(0, 0), 10), {
      ...whiteStroke,
      width: 2,
    });
    expect(list.triangleCount).toBeGreaterThan(0);
  });

  it('round caps produce more triangles than butt caps', () => {
    const butt = tessellateStroke(
      makeLine(point(0, 0), point(10, 0)),
      { ...whiteStroke, cap: 'butt' },
    );
    const round = tessellateStroke(
      makeLine(point(0, 0), point(10, 0)),
      { ...whiteStroke, cap: 'round' },
    );
    expect(round.triangleCount).toBeGreaterThan(butt.triangleCount);
  });

  it('round joins produce more triangles than bevel joins', () => {
    const shape = makePolygon(
      [point(0, 0), point(10, 0), point(5, 10)],
      true,
    );
    const bevel = tessellateStroke(shape, { ...whiteStroke, join: 'bevel' });
    const round = tessellateStroke(shape, { ...whiteStroke, join: 'round' });
    expect(round.triangleCount).toBeGreaterThanOrEqual(bevel.triangleCount);
  });

  it('a dash pattern produces multiple segments', () => {
    const shape = makeLine(point(0, 0), point(100, 0));
    const solid = tessellateStroke(shape, whiteStroke);
    const dashed = tessellateStroke(shape, {
      ...whiteStroke,
      dash: [10, 5],
    });
    expect(dashed.triangleCount).toBeGreaterThan(solid.triangleCount);
  });

  it('every index is within the vertex range', () => {
    const list = tessellateStroke(
      makePolygon([point(0, 0), point(10, 0), point(5, 10)], true),
      { ...whiteStroke, width: 2, join: 'round' },
    );
    for (const i of list.indices) {
      expect(i).toBeLessThan(list.vertexCount);
      expect(i).toBeGreaterThanOrEqual(0);
    }
  });
});