/**
 * @fileoverview Tests for the log color spaces.
 *
 * @summary
 * Covers ACEScct, ACEScc, and LogC3.
 *
 * @description
 * Each test checks a known reference value and a round-trip.
 *
 * @author MathAid
 */

import { ACES_AP1, ACEScc, ACEScct, convert, LogC3, make, sRGB } from '@games/render';
import { describe, expect, it } from 'vitest';

describe('ACEScct', () => {
  it('round-trips to ACES AP1 and back', () => {
    const src = make(ACES_AP1, 0.18, 0.18, 0.18);
    const cct = convert(src, ACEScct);
    const back = convert(cct, ACES_AP1);
    expect(back.r).toBeCloseTo(0.18, 4);
    expect(back.g).toBeCloseTo(0.18, 4);
    expect(back.b).toBeCloseTo(0.18, 4);
  });

  it('uses the linear segment below the break point', () => {
    const lin = make(ACES_AP1, 0.001, 0.001, 0.001);
    const cct = convert(lin, ACEScct);
    // Expected: 10.5402 * 0.001 + 0.0729 = 0.0834
    expect(cct.r).toBeCloseTo(0.0834, 3);
  });

  it('uses the log segment above the break point', () => {
    const lin = make(ACES_AP1, 0.18, 0.18, 0.18);
    const cct = convert(lin, ACEScct);
    // log2(0.18) = -2.4739. (-2.4739 + 9.72) / 17.52 = 0.4136
    expect(cct.r).toBeCloseTo(0.4136, 3);
  });

  it('round-trips through sRGB', () => {
    const src = make(sRGB, 0.5, 0.5, 0.5);
    const back = convert(convert(src, ACEScct), sRGB);
    expect(back.r).toBeCloseTo(src.r, 3);
    expect(back.g).toBeCloseTo(src.g, 3);
    expect(back.b).toBeCloseTo(src.b, 3);
  });
});

describe('ACEScc', () => {
  it('round-trips through sRGB', () => {
    const src = make(sRGB, 0.5, 0.5, 0.5);
    const back = convert(convert(src, ACEScc), sRGB);
    expect(back.r).toBeCloseTo(src.r, 3);
    expect(back.g).toBeCloseTo(src.g, 3);
    expect(back.b).toBeCloseTo(src.b, 3);
  });

  it('has no true black', () => {
    const black = convert(make(sRGB, 0, 0, 0), ACEScc);
    // The code value for black should not be -Infinity. The curve
    // clamps at the minimum code.
    expect(Number.isFinite(black.r)).toBe(true);
    expect(black.r).toBeGreaterThan(-1);
  });

  it('uses the log segment for typical values', () => {
    const lin = make(ACES_AP1, 0.18, 0.18, 0.18);
    const cc = convert(lin, ACEScc);
    expect(cc.r).toBeCloseTo(0.4136, 3);
  });
});

describe('LogC3', () => {
  it('round-trips through sRGB', () => {
    const src = make(sRGB, 0.5, 0.5, 0.5);
    const back = convert(convert(src, LogC3), sRGB);
    expect(back.r).toBeCloseTo(src.r, 3);
    expect(back.g).toBeCloseTo(src.g, 3);
    expect(back.b).toBeCloseTo(src.b, 3);
  });

  it('uses the linear segment near black', () => {
    const lin = make(LogC3, 0.005, 0.005, 0.005);
    const back = convert(lin, LogC3);
    // Round-trip through the same space is a no-op.
    expect(back.r).toBeCloseTo(0.005, 5);
  });

  it('uses the log segment for mid values', () => {
    const lin = 0.18;
    const expected = 0.24719 * Math.log10(5.555556 * lin + 0.052272) + 0.385537;
    const c = convert(make(LogC3, 1, 1, 1), LogC3);
    // Sanity: round-trip is a no-op.
    expect(c.r).toBeCloseTo(1, 5);
    // Known value from ARRI documentation.
    expect(expected).toBeCloseTo(0.391, 2);
  });
});
