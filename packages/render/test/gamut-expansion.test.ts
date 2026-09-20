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

import { checkGamut, Display_P3, expandGamut, make, mapToGamut, OKLCh, sRGB } from '@games/render';
import { describe, expect, it } from 'vitest';

describe('expandGamut', () => {
  it('returns a gray unchanged', () => {
    const gray = make(sRGB, 0.5, 0.5, 0.5);
    const out = expandGamut(gray, Display_P3);
    expect(out.r).toBeCloseTo(gray.r, 4);
    expect(out.g).toBeCloseTo(gray.g, 4);
    expect(out.b).toBeCloseTo(gray.b, 4);
  });

  it('returns the input when amount is 0', () => {
    const red = make(sRGB, 1, 0, 0);
    const out = expandGamut(red, Display_P3, 0);
    expect(out.r).toBeCloseTo(red.r, 4);
    expect(out.g).toBeCloseTo(red.g, 4);
    expect(out.b).toBeCloseTo(red.b, 4);
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
    expect(after.g).toBeGreaterThan(before.g);
  });

  it('preserves hue within a small tolerance', () => {
    const red = make(sRGB, 1, 0, 0);
    const before = checkGamut(red, OKLCh).converted;
    const after = checkGamut(expandGamut(red, Display_P3), OKLCh).converted;
    expect(Math.abs(before.b - after.b)).toBeLessThan(2);
  });

  it('preserves lightness within a small tolerance', () => {
    const red = make(sRGB, 1, 0, 0);
    const before = checkGamut(red, OKLCh).converted;
    const after = checkGamut(expandGamut(red, Display_P3), OKLCh).converted;
    expect(Math.abs(before.r - after.r)).toBeLessThan(0.01);
  });

  it('amount 0.5 gives a smaller expansion than amount 1', () => {
    const red = make(sRGB, 1, 0, 0);
    const half = checkGamut(expandGamut(red, Display_P3, 0.5), OKLCh).converted;
    const full = checkGamut(expandGamut(red, Display_P3, 1), OKLCh).converted;
    expect(half.g).toBeLessThan(full.g);
  });

  it('returns the input when already outside the target gamut', () => {
    const wide = make(Display_P3, 0, 0.9, 0.5);
    const out = expandGamut(wide, sRGB);
    expect(out.r).toBeCloseTo(wide.r, 4);
    expect(out.g).toBeCloseTo(wide.g, 4);
  });

  it('round-trips with mapToGamut', () => {
    const p3 = make(Display_P3, 0, 0.9, 0.5);
    const safe = mapToGamut(p3, sRGB);
    const back = expandGamut(safe, Display_P3);
    expect(back.r).toBeCloseTo(p3.r, 2);
    expect(back.g).toBeCloseTo(p3.g, 2);
    expect(back.b).toBeCloseTo(p3.b, 2);
  });

  it('preserves alpha', () => {
    const src = make(sRGB, 1, 0, 0, 0.25);
    const out = expandGamut(src, Display_P3);
    expect(out.a).toBe(0.25);
  });
});
