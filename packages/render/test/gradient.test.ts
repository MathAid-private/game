/**
 * @fileoverview Tests for the gradient and raster types.
 *
 * @summary
 * Covers `sampleStops`, `sampleLinear`, `sampleRadial`,
 * `sampleMultiStop`, and `samplePattern`.
 *
 * @description
 * The tests check each gradient kind at the boundary and at the middle.
 * The pattern tests cover every tile rule.
 *
 * @author MathAid
 */

import {
  LinearGradient,
  make,
  MultiStopGradient,
  PatternRaster,
  RadialGradient,
  sampleLinear,
  sampleMultiStop,
  samplePattern,
  sampleRadial,
  sampleStops,
  sRGB,
} from '@games/render';
import { describe, expect, it } from 'vitest';

const red = make(sRGB, 1, 0, 0);
const blue = make(sRGB, 0, 0, 1);
const green = make(sRGB, 0, 1, 0);
const white = make(sRGB, 1, 1, 1);
const transparent = make(sRGB, 0, 0, 0, 0);

describe('sampleStops', () => {
  it('returns the first stop at t=0', () => {
    const c = sampleStops(
      [
        { offset: 0, color: red },
        { offset: 1, color: blue },
      ],
      0,
    );
    expect(c.r).toBeCloseTo(1, 3);
  });

  it('returns the last stop at t=1', () => {
    const c = sampleStops(
      [
        { offset: 0, color: red },
        { offset: 1, color: blue },
      ],
      1,
      sRGB,
    );
    expect(c.b).toBeCloseTo(1, 3);
  });

  it('interpolates in the working space', () => {
    const c = sampleStops(
      [
        { offset: 0, color: red },
        { offset: 1, color: blue },
      ],
      0.5,
      sRGB,
    );
    expect(c.r).toBeCloseTo(0.5, 3);
    expect(c.b).toBeCloseTo(0.5, 3);
  });

  it('handles a single stop', () => {
    const c = sampleStops([{ offset: 0, color: red }], 0.5);
    expect(c).toBe(red);
  });

  it('throws on an empty stop list', () => {
    expect(() => sampleStops([], 0.5)).toThrow(/empty/);
  });
});

describe('sampleLinear', () => {
  const g: LinearGradient<typeof sRGB> = {
    kind: 'linear',
    from: { x: 0, y: 0 },
    to: { x: 1, y: 0 },
    stops: [
      { offset: 0, color: red },
      { offset: 1, color: blue },
    ],
    workingSpace: sRGB,
  };

  it('returns the first stop at the start', () => {
    const c = sampleLinear(g, { x: 0, y: 0 });
    expect(c.r).toBeCloseTo(1, 3);
  });

  it('returns the last stop at the end', () => {
    const c = sampleLinear(g, { x: 1, y: 0 });
    expect(c.b).toBeCloseTo(1, 3);
  });

  it('clamps beyond the end', () => {
    const c = sampleLinear(g, { x: 2, y: 0 });
    expect(c.b).toBeCloseTo(1, 3);
  });

  it('projects correctly off-axis', () => {
    const c = sampleLinear(g, { x: 0.5, y: 10 });
    expect(c.r).toBeCloseTo(0.5, 3);
  });
});

describe('sampleRadial', () => {
  const g: RadialGradient<typeof sRGB> = {
    kind: 'radial',
    center: { x: 0, y: 0 },
    innerRadius: 0,
    outerRadius: 1,
    stops: [
      { offset: 0, color: white },
      { offset: 1, color: transparent },
    ],
    workingSpace: sRGB,
  };

  it('returns the first stop at the center', () => {
    const c = sampleRadial(g, { x: 0, y: 0 });
    expect(c.r).toBeCloseTo(1, 3);
    expect(c.a).toBeCloseTo(1, 3);
  });

  it('returns the last stop at the outer radius', () => {
    const c = sampleRadial(g, { x: 1, y: 0 });
    expect(c.a).toBeCloseTo(0, 3);
  });

  it('clamps beyond the outer radius', () => {
    const c = sampleRadial(g, { x: 10, y: 0 });
    expect(c.a).toBeCloseTo(0, 3);
  });

  it('interpolates at the midpoint', () => {
    const c = sampleRadial(g, { x: 0.5, y: 0 });
    expect(c.a).toBeCloseTo(0.5, 2);
  });
});

describe('sampleMultiStop', () => {
  const g: MultiStopGradient<typeof sRGB> = {
    kind: 'multi',
    stops: [
      { offset: 0, color: red },
      { offset: 0.5, color: green },
      { offset: 1, color: blue },
    ],
    workingSpace: sRGB,
  };

  it('returns red at t=0', () => {
    const c = sampleMultiStop(g, 0);
    expect(c.r).toBeCloseTo(1, 3);
  });

  it('returns green at t=0.5', () => {
    const c = sampleMultiStop(g, 0.5);
    expect(c.g).toBeCloseTo(1, 2);
  });

  it('returns blue at t=1', () => {
    const c = sampleMultiStop(g, 1);
    expect(c.b).toBeCloseTo(1, 3);
  });

  it('interpolates between adjacent stops', () => {
    const c = sampleMultiStop(g, 0.25);
    expect(c.r).toBeGreaterThan(0);
    expect(c.g).toBeGreaterThan(0);
    expect(c.b).toBeLessThan(0.1);
  });
});

describe('samplePattern', () => {
  const image = [
    make(sRGB, 1, 0, 0),
    make(sRGB, 0, 1, 0),
    make(sRGB, 0, 0, 1),
    make(sRGB, 1, 1, 1),
  ];

  const base: Omit<PatternRaster<typeof sRGB>, 'tile'> = {
    kind: 'pattern',
    image,
    width: 2,
    height: 2,
  };

  it('reads the top-left pixel', () => {
    const r: PatternRaster<typeof sRGB> = { ...base, tile: 'repeat' };
    const c = samplePattern(r, { x: 0, y: 0 });
    expect(c.r).toBe(1);
    expect(c.g).toBe(0);
  });

  it('reads the top-right pixel', () => {
    const r: PatternRaster<typeof sRGB> = { ...base, tile: 'repeat' };
    const c = samplePattern(r, { x: 1, y: 0 });
    expect(c.g).toBe(1);
  });

  it('wraps with repeat', () => {
    const r: PatternRaster<typeof sRGB> = { ...base, tile: 'repeat' };
    const c = samplePattern(r, { x: 2, y: 0 });
    expect(c.r).toBe(1);
  });

  it('wraps on x only with repeat-x', () => {
    const r: PatternRaster<typeof sRGB> = { ...base, tile: 'repeat-x' };
    const c1 = samplePattern(r, { x: 3, y: 0 });
    expect(c1.g).toBe(1); // green, not red
    const c2 = samplePattern(r, { x: 0, y: 2 });
    expect(c2.a).toBe(0); // outside the y range, so transparent
  });

  it('wraps on y only with repeat-y', () => {
    const r: PatternRaster<typeof sRGB> = { ...base, tile: 'repeat-y' };
    const c1 = samplePattern(r, { x: 0, y: 3 });
    expect(c1.b).toBe(1); // blue, not red
    const c2 = samplePattern(r, { x: 3, y: 0 });
    expect(c2.a).toBe(0); // outside the x range, so transparent
  });

  it('returns transparent outside with no-repeat', () => {
    const r: PatternRaster<typeof sRGB> = { ...base, tile: 'no-repeat' };
    const c = samplePattern(r, { x: 2, y: 2 });
    expect(c.a).toBe(0);
  });

  it('applies a translation transform', () => {
    const r: PatternRaster<typeof sRGB> = {
      ...base,
      tile: 'repeat',
      transform: [1, 0, -1, 0, 1, 0, 0, 0, 1],
    };
    const c = samplePattern(r, { x: 1, y: 0 });
    expect(c.r).toBe(1);
  });
});
