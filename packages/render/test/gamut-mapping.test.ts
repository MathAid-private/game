/**
 * @fileoverview Tests for gamut mapping.
 *
 * @summary
 * Covers `checkGamut`, `mapToGamut`, `checkGamutAll`, and the two
 * mapping strategies.
 *
 * @description
 * The tests check that out-of-gamut colors move into the target gamut.
 * They also check that in-gamut colors pass through unchanged.
 *
 * @author MathAid
 */

import {
  checkGamut,
  checkGamutAll,
  Display_P3,
  Linear_Rec2020,
  make,
  mapToGamut,
  OKLab,
  OKLCh,
  sRGB,
} from '@games/render';
import { describe, expect, it } from 'vitest';

describe('checkGamut', () => {
  it('reports an in-gamut sRGB color', () => {
    const r = checkGamut(make(sRGB, 0.5, 0.5, 0.5), sRGB);
    expect(r.inGamut).toBe(true);
    expect(r.converted._space).toBe(sRGB);
  });

  it('reports a wide-gamut color outside sRGB', () => {
    const wide = make(Display_P3, 0.0, 0.9, 0.5);
    const r = checkGamut(wide, sRGB);
    expect(r.inGamut).toBe(false);
  });

  it('reports an HDR color outside sRGB', () => {
    const hdr = make(Linear_Rec2020, 2.0, 2.0, 2.0);
    const r = checkGamut(hdr, sRGB);
    expect(r.inGamut).toBe(false);
  });
});

describe('mapToGamut with css-chroma', () => {
  it('returns the input unchanged when already in gamut', () => {
    const c = make(sRGB, 0.5, 0.5, 0.5);
    const out = mapToGamut(c, sRGB);
    expect(out).toEqual(c);
  });

  it('moves a P3 color into sRGB', () => {
    const wide = make(Display_P3, 0.0, 0.9, 0.5);
    const out = mapToGamut(wide, sRGB);
    const check = checkGamut(out, sRGB);
    expect(check.inGamut).toBe(true);
  });

  it('preserves hue reasonably well', () => {
    const wide = make(Display_P3, 0.0, 0.9, 0.5);
    const before = checkGamut(wide, OKLCh).converted;
    const after = checkGamut(mapToGamut(wide, sRGB), OKLCh).converted;
    // Hue should be close.
    expect(Math.abs(before.b - after.b)).toBeLessThan(15);
  });

  it('handles the white pole', () => {
    const white = make(OKLab, 1.1, 0, 0);
    const out = mapToGamut(white, sRGB);
    // The OKLab to sRGB round-trip has about 1e-4 precision. Assert
    // "essentially white" instead of "exactly white".
    expect(out.r).toBeGreaterThan(0.999);
    expect(out.g).toBeGreaterThan(0.999);
    expect(out.b).toBeGreaterThan(0.999);
    expect(checkGamut(out, sRGB).inGamut).toBe(true);
  });

  it('handles the black pole', () => {
    const black = make(OKLab, -0.1, 0, 0);
    const out = mapToGamut(black, sRGB);
    expect(out.r).toBeLessThan(0.001);
    expect(out.g).toBeLessThan(0.001);
    expect(out.b).toBeLessThan(0.001);
    expect(checkGamut(out, sRGB).inGamut).toBe(true);
  });

  it('is the default method', () => {
    const wide = make(Display_P3, 0.0, 0.9, 0.5);
    const a = mapToGamut(wide, sRGB);
    const b = mapToGamut(wide, sRGB, 'css-chroma');
    expect(a.r).toBeCloseTo(b.r, 6);
    expect(a.g).toBeCloseTo(b.g, 6);
    expect(a.b).toBeCloseTo(b.b, 6);
  });
});

describe('mapToGamut with clamp', () => {
  it('clamps each channel to 0 to 1', () => {
    const hdr = make(Linear_Rec2020, 2.0, -0.5, 0.5);
    const out = mapToGamut(hdr, sRGB, 'clamp');
    expect(out.r).toBeLessThanOrEqual(1);
    expect(out.g).toBeGreaterThanOrEqual(0);
    expect(out.b).toBeGreaterThanOrEqual(0);
  });

  it('can produce a different result than css-chroma', () => {
    const wide = make(Display_P3, 0.0, 0.9, 0.5);
    const css = mapToGamut(wide, sRGB, 'css-chroma');
    const clamp = mapToGamut(wide, sRGB, 'clamp');
    const same = css.r === clamp.r && css.g === clamp.g && css.b === clamp.b;
    expect(same).toBe(false);
  });
});

describe('checkGamutAll', () => {
  it('returns a record keyed by space id', () => {
    const out = checkGamutAll(make(sRGB, 0.5, 0.5, 0.5), [sRGB, Display_P3]);
    expect(Object.keys(out).sort()).toEqual(['Display_P3', 'sRGB']);
  });

  it('reports false for spaces the color does not fit', () => {
    const wide = make(Display_P3, 0.0, 0.9, 0.5);
    const out = checkGamutAll(wide, [sRGB, Display_P3]);
    expect(out.sRGB!.inGamut).toBe(false);
    expect(out.Display_P3!.inGamut).toBe(true);
  });

  it('returns an empty record for an empty input', () => {
    const out = checkGamutAll(make(sRGB, 0.5, 0.5, 0.5), []);
    expect(out).toEqual({});
  });
});
