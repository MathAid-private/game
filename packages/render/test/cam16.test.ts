/**
 * @fileoverview Tests for CAM16.
 *
 * @summary
 * Covers the forward and reverse directions, the viewing environment,
 * and the round-trip.
 *
 * @description
 * CAM16 is an appearance model. The output is a set of perceptual
 * attributes. The round-trip test is the primary correctness check.
 *
 * @author MathAid
 */

import { cam16FromXYZ, convert, make, sRGB, XYZ_D65, xyzFromCAM16 } from '@games/render';
import { describe, expect, it } from 'vitest';

describe('cam16FromXYZ', () => {
  it('returns a J between 0 and 100 for typical colors', () => {
    const cam = cam16FromXYZ(make(sRGB, 0.5, 0.5, 0.5));
    expect(cam.J).toBeGreaterThan(0);
    expect(cam.J).toBeLessThan(100);
  });

  it('returns J near 100 for white', () => {
    const white = make(XYZ_D65, 0.95047, 1, 1.08883);
    const cam = cam16FromXYZ(white);
    expect(cam.J).toBeGreaterThan(95);
    expect(cam.J).toBeLessThanOrEqual(100);
  });

  it('returns J near 0 for black', () => {
    const cam = cam16FromXYZ(make(sRGB, 0, 0, 0));
    expect(cam.J).toBeLessThan(1);
  });

  it('a neutral gray has very low chroma', () => {
    const cam = cam16FromXYZ(make(sRGB, 0.5, 0.5, 0.5));
    expect(cam.C).toBeLessThan(2);
  });

  it('a saturated color has positive chroma', () => {
    const cam = cam16FromXYZ(make(sRGB, 1, 0, 0));
    expect(cam.C).toBeGreaterThan(40);
  });

  it('hue angle is in 0 to 360', () => {
    const colors = [
      make(sRGB, 1, 0, 0),
      make(sRGB, 0, 1, 0),
      make(sRGB, 0, 0, 1),
      make(sRGB, 1, 1, 0),
    ];
    for (const c of colors) {
      const cam = cam16FromXYZ(c);
      expect(cam.h).toBeGreaterThanOrEqual(0);
      expect(cam.h).toBeLessThan(360);
    }
  });

  it('different hues have different h values', () => {
    const red = cam16FromXYZ(make(sRGB, 1, 0, 0));
    const blue = cam16FromXYZ(make(sRGB, 0, 0, 1));
    expect(Math.abs(red.h - blue.h)).toBeGreaterThan(90);
  });

  it('accepts a custom viewing environment', () => {
    const c = make(sRGB, 0.5, 0.5, 0.5);
    const bright = cam16FromXYZ(c, { adaptingLuminance: 100 });
    const dim = cam16FromXYZ(c, { adaptingLuminance: 5 });
    // J is normalized against the reference white, so it is nearly
    // invariant under LA. Q depends on FL, which is a function of LA.
    expect(Math.abs(bright.Q - dim.Q)).toBeGreaterThan(1);
  });

  it('throws on a non-positive adapting luminance', () => {
    expect(() => cam16FromXYZ(make(sRGB, 0.5, 0.5, 0.5), { adaptingLuminance: 0 })).toThrow(
      /adapting luminance/,
    );
  });

  it('throws on an out-of-range background luminance', () => {
    expect(() => cam16FromXYZ(make(sRGB, 0.5, 0.5, 0.5), { backgroundLuminance: 0 })).toThrow(
      /background luminance/,
    );
  });
});

describe('xyzFromCAM16', () => {
  it('round-trips a mid gray', () => {
    const src = make(sRGB, 0.5, 0.5, 0.5);
    const cam = cam16FromXYZ(src);
    const back = xyzFromCAM16(cam);
    const expected = convert(src, XYZ_D65);
    expect(back.c1).toBeCloseTo(expected.c1, 3);
    expect(back.c2).toBeCloseTo(expected.c2, 3);
    expect(back.c3).toBeCloseTo(expected.c3, 3);
  });

  it('round-trips a saturated red', () => {
    const src = make(sRGB, 1, 0, 0);
    const cam = cam16FromXYZ(src);
    const back = xyzFromCAM16(cam);
    const expected = convert(src, XYZ_D65);
    expect(back.c1).toBeCloseTo(expected.c1, 2);
    expect(back.c2).toBeCloseTo(expected.c2, 2);
    expect(back.c3).toBeCloseTo(expected.c3, 2);
  });

  it('round-trips white', () => {
    const src = make(XYZ_D65, 0.95047, 1, 1.08883);
    const cam = cam16FromXYZ(src);
    const back = xyzFromCAM16(cam);
    expect(back.c1).toBeCloseTo(src.c1, 2);
    expect(back.c2).toBeCloseTo(src.c2, 2);
    expect(back.c3).toBeCloseTo(src.c3, 2);
  });

  it('round-trips black', () => {
    const src = make(sRGB, 0, 0, 0);
    const cam = cam16FromXYZ(src);
    const back = xyzFromCAM16(cam);
    expect(back.c1).toBeCloseTo(0, 4);
    expect(back.c2).toBeCloseTo(0, 4);
    expect(back.c3).toBeCloseTo(0, 4);
  });

  it('round-trips with a custom environment', () => {
    const env = { adaptingLuminance: 50, backgroundLuminance: 0.3 };
    const src = make(sRGB, 0.4, 0.7, 0.2);
    const cam = cam16FromXYZ(src, env);
    const back = xyzFromCAM16(cam, env);
    const expected = convert(src, XYZ_D65);
    expect(back.c1).toBeCloseTo(expected.c1, 2);
    expect(back.c2).toBeCloseTo(expected.c2, 2);
    expect(back.c3).toBeCloseTo(expected.c3, 2);
  });

  it('the environment must match between forward and reverse', () => {
    const src = make(sRGB, 0.5, 0.5, 0.5);

    // The forward attributes depend on LA. Q and M are the two
    // attributes that scale with the adapting luminance. J is
    // normalized against the reference white and is nearly invariant.
    const camBright = cam16FromXYZ(src, { adaptingLuminance: 100 });
    const camDim = cam16FromXYZ(src, { adaptingLuminance: 10 });
    expect(Math.abs(camBright.Q - camDim.Q)).toBeGreaterThan(1);
    expect(Math.abs(camBright.M - camDim.M)).toBeGreaterThan(0.1);

    // The reverse with the right environment round-trips.
    const right = xyzFromCAM16(camBright, { adaptingLuminance: 100 });
    const expected = convert(src, XYZ_D65);
    expect(right.c1).toBeCloseTo(expected.c1, 2);
    expect(right.c2).toBeCloseTo(expected.c2, 2);
    expect(right.c3).toBeCloseTo(expected.c3, 2);

    // The reverse with the wrong environment is close but not exact.
    // CAM16 compensates for LA in the reverse, so the difference is
    // small. Assert that the wrong path is measurably off, not that it
    // is wildly different.
    const wrong = xyzFromCAM16(camBright, { adaptingLuminance: 10 });
    const diff = Math.abs(wrong.c1 - expected.c1) + Math.abs(wrong.c2 - expected.c2);
    expect(diff).toBeGreaterThan(1e-4);
  });

  it('the environment matters more for saturated colors', () => {
    const src = make(sRGB, 1, 0, 0);
    const cam = cam16FromXYZ(src, { adaptingLuminance: 100 });
    const right = xyzFromCAM16(cam, { adaptingLuminance: 100 });
    const wrong = xyzFromCAM16(cam, { adaptingLuminance: 10 });
    const expected = convert(src, XYZ_D65);
    const rightDiff = Math.abs(right.c1 - expected.c1);
    const wrongDiff = Math.abs(wrong.c1 - expected.c1);
    expect(rightDiff).toBeLessThan(1e-3);
    expect(wrongDiff).toBeGreaterThan(rightDiff * 10);
  });

  it('higher adapting luminance raises Q', () => {
    const c = make(sRGB, 0.5, 0.5, 0.5);
    const bright = cam16FromXYZ(c, { adaptingLuminance: 500 });
    const dim = cam16FromXYZ(c, { adaptingLuminance: 5 });
    expect(bright.Q).toBeGreaterThan(dim.Q);
  });

  it('J is nearly invariant to the adapting luminance', () => {
    const c = make(sRGB, 0.5, 0.5, 0.5);
    const bright = cam16FromXYZ(c, { adaptingLuminance: 500 });
    const dim = cam16FromXYZ(c, { adaptingLuminance: 5 });
    // J is normalized against the reference white. The compensation
    // in the model cancels most of the LA dependence.
    expect(Math.abs(bright.J - dim.J)).toBeLessThan(1);
  });
});

describe('CAM16 attributes', () => {
  it('every attribute is a finite number', () => {
    const cam = cam16FromXYZ(make(sRGB, 0.4, 0.6, 0.8));
    for (const key of ['J', 'C', 'h', 'M', 's', 'Q'] as const) {
      expect(Number.isFinite(cam[key])).toBe(true);
    }
  });

  it('M and C have the same sign', () => {
    const cam = cam16FromXYZ(make(sRGB, 1, 0, 0));
    expect(Math.sign(cam.M)).toBe(Math.sign(cam.C));
  });

  it('Q is positive for a non-black color', () => {
    const cam = cam16FromXYZ(make(sRGB, 0.5, 0.5, 0.5));
    expect(cam.Q).toBeGreaterThan(0);
  });
});
