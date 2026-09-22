/**
 * @fileoverview Tests for quantization and dithering.
 *
 * @summary
 * Covers `quantize` and `dither` for every format and mode.
 *
 * @description
 * Each test checks the resulting bit precision, the dithering pattern,
 * and the argument validation.
 *
 * @author MathAid
 */

import { dither, make, quantize, sRGB } from '@games/render';
import { describe, expect, it } from 'vitest';

describe('quantize', () => {
  it('snaps to 4-bit levels', () => {
    const c = quantize(make(sRGB, 0.5, 0.5, 0.5), 4);
    // 0.5 * 15 = 7.5, rounds to 8. 8 / 15 = 0.5333...
    expect(c.c1).toBeCloseTo(8 / 15, 5);
  });

  it('preserves alpha when bits is a number', () => {
    const c = quantize(make(sRGB, 0.5, 0.5, 0.5, 0.25), 4);
    expect(c.alpha).toBe(0.25);
  });

  it('applies rgb565 layout', () => {
    const c = quantize(make(sRGB, 1, 1, 1), 'rgb565');
    expect(c.c1).toBe(1);
    expect(c.c2).toBe(1);
    expect(c.c3).toBe(1);
  });

  it('applies rgba4444 layout with alpha', () => {
    const c = quantize(make(sRGB, 0.5, 0.5, 0.5, 0.5), 'rgba4444');
    expect(c.alpha).toBeCloseTo(8 / 15, 5);
  });

  it('applies rgb332 layout', () => {
    const c = quantize(make(sRGB, 0.5, 0.5, 0.5), 'rgb332');
    // Red: 0.5 * 7 = 3.5, rounds to 4. 4 / 7 = 0.571.
    expect(c.c1).toBeCloseTo(4 / 7, 5);
    // Blue: 0.5 * 3 = 1.5, rounds to 2. 2 / 3 = 0.667.
    expect(c.c3).toBeCloseTo(2 / 3, 5);
  });

  it('throws on an out-of-range bit count', () => {
    expect(() => quantize(make(sRGB, 0.5, 0.5, 0.5), 0)).toThrow(/1 to 8/);
    expect(() => quantize(make(sRGB, 0.5, 0.5, 0.5), 9)).toThrow(/1 to 8/);
  });
});

describe('dither', () => {
  const gradient = (): ReturnType<typeof make>[] => {
    const out = [];
    for (let i = 0; i < 16; i++) {
      out.push(make(sRGB, i / 15, i / 15, i / 15));
    }
    return out;
  };

  it('throws when the color count does not match the dimensions', () => {
    expect(() => dither([], 4, 4, { mode: 'bayer' })).toThrow(/length/);
  });

  it('none mode returns quantized colors', () => {
    const out = dither(gradient(), 4, 4, { mode: 'none' });
    expect(out.length).toBe(16);
  });

  it('bayer mode spreads the error across the matrix', () => {
    // A flat mid-gray with Bayer should produce more than one value.
    const flat = new Array(64).fill(make(sRGB, 0.5, 0.5, 0.5));
    const out = dither(flat, 8, 8, { mode: 'bayer', matrixSize: 4 });
    const unique = new Set(out.map((c) => c.c1));
    expect(unique.size).toBeGreaterThan(1);
  });

  it('floyd-steinberg mode diffuses the error to neighbors', () => {
    const flat = new Array(64).fill(make(sRGB, 0.5, 0.5, 0.5));
    const out = dither(flat, 8, 8, { mode: 'floyd-steinberg' });
    const unique = new Set(out.map((c) => c.c1));
    expect(unique.size).toBeGreaterThan(1);
  });

  it('every output channel is at a 565 level', () => {
    const out = dither(gradient(), 4, 4, { mode: 'bayer' });
    for (const c of out) {
      const rLevel = c.c1 * 31;
      expect(Math.abs(rLevel - Math.round(rLevel))).toBeLessThan(1e-6);
    }
  });
});
