/**
 * @fileoverview Tests for gamut expansion.
 *
 * @summary
 * Covers `expandGamut` for gray inputs, in-gamut inputs, and the
 * round-trip with `mapToGamut`.
 *
 * @description
 * Expansion moves chroma toward the target gamut boundary. It never
 * leaves the gamut. The tests check the boundary, the amount scaling,
 * and the hue preservation.
 *
 * @author MathAid
 */

import {
  checkGamut,
  type ColorSpaceDef,
  type ColorValue,
  convert,
  Display_P3,
  expandGamut,
  make,
  mapToGamut,
  OKLCh,
  sRGB,
} from '@games/render';
import { describe, expect, it } from 'vitest';

describe('expandGamut', () => {
  it('returns a gray unchanged', () => {
    const gray = make(sRGB, 0.5, 0.5, 0.5);
    const out = expandGamut(gray, Display_P3);
    expectSameColor(out, convert(gray, Display_P3));
  });

  it('returns the input when amount is 0', () => {
    const red = make(sRGB, 1, 0, 0);
    const expected = convert(red, Display_P3);
    const out = expandGamut(red, Display_P3, 0);
    expect(out.c1).toBeCloseTo(expected.c1, 4);
    expect(out.c2).toBeCloseTo(expected.c2, 4);
    expect(out.c3).toBeCloseTo(expected.c3, 4);
  });

  it('keeps the result in the target gamut', () => {
    const red = make(sRGB, 1, 0, 0);
    const out = expandGamut(red, Display_P3);
    expect(checkGamut(out, Display_P3).inGamut).toBe(true);
  });

  it('increases chroma for a saturated sRGB color', () => {
    const red = make(sRGB, 1, 0, 0);
    const before = checkGamut(red, OKLCh).converted;
    const after = checkGamut(expandGamut(red, Display_P3), OKLCh).converted;
    expect(after.c2).toBeGreaterThan(before.c2);
  });

  it('preserves hue within a small tolerance', () => {
    const red = make(sRGB, 1, 0, 0);
    const before = checkGamut(red, OKLCh).converted;
    const after = checkGamut(expandGamut(red, Display_P3), OKLCh).converted;
    expect(Math.abs(before.c3 - after.c3)).toBeLessThan(2);
  });

  it('preserves lightness within a small tolerance', () => {
    const red = make(sRGB, 1, 0, 0);
    const before = checkGamut(red, OKLCh).converted;
    const after = checkGamut(expandGamut(red, Display_P3), OKLCh).converted;
    expect(Math.abs(before.c1 - after.c1)).toBeLessThan(0.01);
  });

  it('amount 0.5 gives a smaller expansion than amount 1', () => {
    const red = make(sRGB, 1, 0, 0);
    const half = checkGamut(expandGamut(red, Display_P3, 0.5), OKLCh).converted;
    const full = checkGamut(expandGamut(red, Display_P3, 1), OKLCh).converted;
    expect(half.c2).toBeLessThan(full.c2);
  });

  it('returns the input when already outside the target gamut', () => {
    const wide = make(Display_P3, 0, 0.9, 0.5);
    const expected = convert(wide, sRGB);
    const out = expandGamut(wide, sRGB);
    expect(out.c1).toBeCloseTo(expected.c1, 4);
    expect(out.c2).toBeCloseTo(expected.c2, 4);
    expect(out.c3).toBeCloseTo(expected.c3, 4);
  });

  it('round-trips with mapToGamut', () => {
    const p3 = make(Display_P3, 0, 0.9, 0.5);
    const safe = mapToGamut(p3, sRGB);
    const back = expandGamut(safe, Display_P3);
    expect(back.c1).toBeCloseTo(p3.c1, 2);
    expect(back.c2).toBeCloseTo(p3.c2, 2);
    expect(back.c3).toBeCloseTo(p3.c3, 2);
  });

  it('preserves alpha', () => {
    const src = make(sRGB, 1, 0, 0, 0.25);
    const out = expandGamut(src, Display_P3);
    expect(out.alpha).toBe(0.25);
  });
});

function expectSameColor<S extends ColorSpaceDef<string>>(
  actual: ColorValue<S>,
  expected: ColorValue<S>,
  decimals = 6,
): void {
  expect(actual._space).toBe(expected._space);
  expect(actual.c1).toBeCloseTo(expected.c1, decimals);
  expect(actual.c2).toBeCloseTo(expected.c2, decimals);
  expect(actual.c3).toBeCloseTo(expected.c3, decimals);
  expect(actual.alpha).toBeCloseTo(expected.alpha, decimals);
}
