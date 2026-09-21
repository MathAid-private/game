/**
 * @fileoverview Tests for the fast batch conversion path.
 *
 * @summary
 * Covers `convertBatchFast` and `convertBatchSIMD`.
 *
 * @description
 * The tests check that the fast path produces the same result as the
 * standard `convertBatch` from `bridge.ts`. The tests also check the
 * empty-input and same-space cases.
 *
 * @author MathAid
 */

import {
    convertBatch,
    convertBatchFast,
    convertBatchSIMD,
    Display_P3,
    Linear_sRGB,
    make,
    sRGB,
} from '@games/render';
import { describe, expect, it } from 'vitest';

describe('convertBatchFast', () => {
  it('matches convertBatch for a small input', () => {
    const src = [make(sRGB, 0.5, 0.2, 0.8), make(sRGB, 0.1, 0.9, 0.3)];
    const a = convertBatch(src, Linear_sRGB);
    const b = convertBatchFast(src, Linear_sRGB);
    expect(b.length).toBe(a.length);
    for (let i = 0; i < a.length; i++) {
      expect(b[i]!.c1).toBeCloseTo(a[i]!.c1, 8);
      expect(b[i]!.c2).toBeCloseTo(a[i]!.c2, 8);
      expect(b[i]!.c3).toBeCloseTo(a[i]!.c3, 8);
    }
  });

  it('returns the colors unchanged when the destination is the source', () => {
    const src = [make(sRGB, 0.5, 0.5, 0.5), make(sRGB, 0.1, 0.2, 0.3)];
    const out = convertBatchFast(src, sRGB);
    expect(out[0]).toBe(src[0]);
    expect(out[1]).toBe(src[1]);
  });

  it('returns an empty array for empty input', () => {
    expect(convertBatchFast([], Linear_sRGB).length).toBe(0);
  });

  it('preserves alpha', () => {
    const src = [make(Display_P3, 0.0, 0.9, 0.5, 0.25)];
    const out = convertBatchFast(src, sRGB);
    expect(out[0]!.alpha).toBe(0.25);
  });

  it('handles a large input', () => {
    const src = Array.from({ length: 1000 }, (_, i) => make(sRGB, i / 1000, 1 - i / 1000, 0.5));
    const out = convertBatchFast(src, Linear_sRGB);
    expect(out.length).toBe(1000);
    expect(out[0]!._space).toBe(Linear_sRGB);
  });
});

describe('convertBatchSIMD', () => {
  it('matches convertBatch', () => {
    const src = [make(sRGB, 0.5, 0.5, 0.5)];
    const a = convertBatch(src, Linear_sRGB);
    const b = convertBatchSIMD(src, Linear_sRGB);
    expect(b[0]!.c1).toBeCloseTo(a[0]!.c1, 8);
  });
});
