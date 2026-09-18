/**
 * @fileoverview Tests for chromatic adaptation.
 *
 * @summary
 * Covers `adapt` and `whitePointXYZ`.
 *
 * @description
 * The tests use known D65 and D50 white points and check the
 * round-trip and identity cases.
 *
 * @author MathAid
 */

import { adapt, make, sRGB, whitePointXYZ, XYZ_D65 } from '@games/render';
import { describe, expect, it } from 'vitest';

describe('whitePointXYZ', () => {
  it('returns the D65 value used by the engine', () => {
    expect(whitePointXYZ('D65')).toEqual([0.95047, 1.0, 1.08883]);
  });

  it('returns Y = 1 for every white', () => {
    const names = ['D50', 'D55', 'D65', 'D93', 'E', 'A', 'C'] as const;
    for (const n of names) {
      expect(whitePointXYZ(n)[1]).toBe(1);
    }
  });
});

describe('adapt', () => {
  it('returns the input when the whites are equal', () => {
    const c = make(sRGB, 1, 0, 0);
    expect(adapt(c, 'D65', 'D65')).toBe(c);
  });

  it('round-trips D65 to D50 and back with Bradford', () => {
    const src = make(sRGB, 0.5, 0.3, 0.8);
    const d50 = adapt(src, 'D65', 'D50');
    const back = adapt(d50, 'D50', 'D65');
    expect(back.r).toBeCloseTo(src.r, 3);
    expect(back.g).toBeCloseTo(src.g, 3);
    expect(back.b).toBeCloseTo(src.b, 3);
  });

  it('preserves alpha', () => {
    const src = make(sRGB, 0.5, 0.5, 0.5, 0.25);
    const out = adapt(src, 'D65', 'D50');
    expect(out.a).toBe(0.25);
  });

  it('adapts D65 white to the D50 white point', () => {
    const xyz = make(XYZ_D65, 0.95047, 1.0, 1.08883);
    const d50 = adapt(xyz, 'D65', 'D50');
    expect(d50.r).toBeCloseTo(0.96422, 3);
    expect(d50.g).toBeCloseTo(1.0, 3);
    expect(d50.b).toBeCloseTo(0.82521, 3);
  });

  it('every method produces the same white point', () => {
    const xyz = make(XYZ_D65, 0.95047, 1.0, 1.08883);
    const methods = ['bradford', 'von-kries', 'cat02', 'xyz-scaling'] as const;
    for (const m of methods) {
      const out = adapt(xyz, 'D65', 'D50', m);
      expect(out.r).toBeCloseTo(0.96422, 2);
      expect(out.g).toBeCloseTo(1.0, 2);
      expect(out.b).toBeCloseTo(0.82521, 2);
    }
  });
});
