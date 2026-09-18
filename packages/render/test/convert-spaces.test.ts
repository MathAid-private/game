/**
 * @fileoverview Tests for the Milestone 3 color spaces.
 *
 * @summary
 * Covers HSL, HSV, HWB, CIE_Lab, CIE_LCh, YCbCr, and ICtCp conversions.
 *
 * @description
 * Each test checks a known reference value. Round-trip tests confirm
 * that the conversions compose cleanly.
 *
 * @author MathAid
 */

import { CIE_Lab, CIE_LCh, convert, HSL, HSV, HWB, ICtCp, make, sRGB, YCbCr } from '@games/render';
import { describe, expect, it } from 'vitest';

describe('HSL', () => {
  it('converts hsl(0, 1, 0.5) to red', () => {
    const c = convert(make(HSL, 0, 1, 0.5), sRGB);
    expect(c.r).toBeCloseTo(1, 4);
    expect(c.g).toBeCloseTo(0, 4);
    expect(c.b).toBeCloseTo(0, 4);
  });

  it('converts hsl(120, 1, 0.5) to green', () => {
    const c = convert(make(HSL, 120, 1, 0.5), sRGB);
    expect(c.g).toBeCloseTo(1, 4);
  });

  it('round-trips sRGB through HSL', () => {
    const src = make(sRGB, 0.3, 0.6, 0.9);
    const back = convert(convert(src, HSL), sRGB);
    expect(back.r).toBeCloseTo(src.r, 4);
    expect(back.g).toBeCloseTo(src.g, 4);
    expect(back.b).toBeCloseTo(src.b, 4);
  });

  it('a zero-saturation color has no hue', () => {
    const c = convert(make(sRGB, 0.5, 0.5, 0.5), HSL);
    expect(c.g).toBe(0);
  });
});

describe('HSV', () => {
  it('converts hsv(0, 1, 1) to red', () => {
    const c = convert(make(HSV, 0, 1, 1), sRGB);
    expect(c.r).toBeCloseTo(1, 4);
  });

  it('round-trips sRGB through HSV', () => {
    const src = make(sRGB, 0.4, 0.7, 0.2);
    const back = convert(convert(src, HSV), sRGB);
    expect(back.r).toBeCloseTo(src.r, 4);
    expect(back.g).toBeCloseTo(src.g, 4);
    expect(back.b).toBeCloseTo(src.b, 4);
  });
});

describe('HWB', () => {
  it('hwb(0, 0, 0) is red', () => {
    const c = convert(make(HWB, 0, 0, 0), sRGB);
    expect(c.r).toBeCloseTo(1, 4);
    expect(c.g).toBeCloseTo(0, 4);
    expect(c.b).toBeCloseTo(0, 4);
  });

  it('hwb(0, 1, 0) is white', () => {
    const c = convert(make(HWB, 0, 1, 0), sRGB);
    expect(c.r).toBeCloseTo(1, 4);
    expect(c.g).toBeCloseTo(1, 4);
    expect(c.b).toBeCloseTo(1, 4);
  });

  it('round-trips sRGB through HWB for saturated colors', () => {
    const src = make(sRGB, 0.8, 0.2, 0.4);
    const back = convert(convert(src, HWB), sRGB);
    expect(back.r).toBeCloseTo(src.r, 3);
    expect(back.g).toBeCloseTo(src.g, 3);
  });
});

describe('CIE_Lab', () => {
  it('D65 white is (100, 0, 0)', () => {
    const c = convert(make(sRGB, 1, 1, 1), CIE_Lab);
    expect(c.r).toBeCloseTo(100, 1);
    expect(c.g).toBeCloseTo(0, 1);
    expect(c.b).toBeCloseTo(0, 1);
  });

  it('black is (0, 0, 0)', () => {
    const c = convert(make(sRGB, 0, 0, 0), CIE_Lab);
    expect(c.r).toBeCloseTo(0, 3);
    expect(c.g).toBeCloseTo(0, 3);
    expect(c.b).toBeCloseTo(0, 3);
  });

  it('round-trips sRGB through CIE Lab', () => {
    const src = make(sRGB, 0.5, 0.2, 0.8);
    const back = convert(convert(src, CIE_Lab), sRGB);
    expect(back.r).toBeCloseTo(src.r, 4);
    expect(back.g).toBeCloseTo(src.g, 4);
    expect(back.b).toBeCloseTo(src.b, 4);
  });
});

describe('CIE_LCh', () => {
  it('round-trips through CIE Lab', () => {
    const src = make(sRGB, 0.3, 0.7, 0.5);
    const lch = convert(src, CIE_LCh);
    const back = convert(lch, sRGB);
    expect(back.r).toBeCloseTo(src.r, 4);
    expect(back.g).toBeCloseTo(src.g, 4);
    expect(back.b).toBeCloseTo(src.b, 4);
  });
});

describe('YCbCr', () => {
  it('sRGB white is (1, 0, 0)', () => {
    const c = convert(make(sRGB, 1, 1, 1), YCbCr);
    expect(c.r).toBeCloseTo(1, 3);
    expect(c.g).toBeCloseTo(0, 3);
    expect(c.b).toBeCloseTo(0, 3);
  });

  it('sRGB red has positive Cr', () => {
    const c = convert(make(sRGB, 1, 0, 0), YCbCr);
    expect(c.b).toBeGreaterThan(0);
  });

  it('sRGB blue has positive Cb', () => {
    const c = convert(make(sRGB, 0, 0, 1), YCbCr);
    expect(c.g).toBeGreaterThan(0);
  });
});

describe('ICtCp', () => {
  it('black is near (0, 0, 0)', () => {
    const c = convert(make(sRGB, 0, 0, 0), ICtCp);
    expect(c.r).toBeCloseTo(0, 3);
    expect(c.g).toBeCloseTo(0, 3);
    expect(c.b).toBeCloseTo(0, 3);
  });

  it('round-trips sRGB through ICtCp', () => {
    const src = make(sRGB, 0.5, 0.5, 0.5);
    const back = convert(convert(src, ICtCp), sRGB);
    expect(back.r).toBeCloseTo(src.r, 3);
    expect(back.g).toBeCloseTo(src.g, 3);
    expect(back.b).toBeCloseTo(src.b, 3);
  });
});
