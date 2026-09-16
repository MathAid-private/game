/**
 * @fileoverview Tests for the conversion engine.
 *
 * @summary
 * Covers `make`, `fromHex`, `convert`, `clampToRange`, `isInRange`,
 * `isInSRGBGamut`, `format`, and `mix`.
 *
 * @description
 * The tests check known color conversions against reference values.
 * They also check round-trips and boundary cases.
 *
 * @author MathAid
 */

import {
  clampToRange,
  convert,
  Display_P3,
  format,
  fromHex,
  isInRange,
  isInSRGBGamut,
  make,
  mix,
  OKLab,
  OKLCh,
  sRGB,
  XYZ_D65,
} from '@games/render';
import { describe, expect, it } from 'vitest';

describe('make', () => {
  it('creates a color value with the space attached', () => {
    const c = make(sRGB, 1, 0, 0);
    expect(c.r).toBe(1);
    expect(c.g).toBe(0);
    expect(c.b).toBe(0);
    expect(c.a).toBe(1);
    expect(c._space).toBe(sRGB);
  });

  it('uses alpha 1 by default', () => {
    expect(make(sRGB, 0, 0, 0).a).toBe(1);
  });

  it('accepts a custom alpha', () => {
    expect(make(sRGB, 0, 0, 0, 0.5).a).toBe(0.5);
  });
});

describe('fromHex', () => {
  it('parses #RRGGBB', () => {
    const c = fromHex('#FF8000');
    expect(c.r).toBeCloseTo(1, 5);
    expect(c.g).toBeCloseTo(0.50196, 4);
    expect(c.b).toBeCloseTo(0, 5);
    expect(c.a).toBe(1);
  });

  it('parses #RRGGBBAA', () => {
    const c = fromHex('#FF000080');
    expect(c.a).toBeCloseTo(0.50196, 4);
  });

  it('parses #RGB shorthand', () => {
    const c = fromHex('#F80');
    const ref = fromHex('#FF8800');
    expect(c.r).toBeCloseTo(ref.r, 5);
    expect(c.g).toBeCloseTo(ref.g, 5);
    expect(c.b).toBeCloseTo(ref.b, 5);
  });

  it('parses #RGBA shorthand', () => {
    const c = fromHex('#F808');
    const ref = fromHex('#FF880088');
    expect(c.a).toBeCloseTo(ref.a, 5);
  });

  it('accepts input without a leading #', () => {
    const c = fromHex('FF0000');
    expect(c.r).toBeCloseTo(1, 5);
  });

  it('throws on a wrong length', () => {
    expect(() => fromHex('#FF')).toThrow(/not a valid hex/);
    expect(() => fromHex('#FFFFF')).toThrow(/not a valid hex/);
    expect(() => fromHex('#FFFFFFFFF')).toThrow(/not a valid hex/);
  });

  it('throws on non-hex characters', () => {
    expect(() => fromHex('#ZZZZZZ')).toThrow(/non-hex/);
  });
});

describe('convert', () => {
  it('returns the same object for a no-op conversion', () => {
    const c = make(sRGB, 0.5, 0.5, 0.5);
    expect(convert(c, sRGB)).toBe(c);
  });

  it('converts sRGB white to XYZ D65 white', () => {
    const white = make(sRGB, 1, 1, 1);
    const xyz = convert(white, XYZ_D65);
    expect(xyz.r).toBeCloseTo(0.9505, 3);
    expect(xyz.g).toBeCloseTo(1.0, 3);
    expect(xyz.b).toBeCloseTo(1.089, 3);
  });

  it('converts sRGB red to XYZ D65 red', () => {
    const red = make(sRGB, 1, 0, 0);
    const xyz = convert(red, XYZ_D65);
    expect(xyz.r).toBeCloseTo(0.4124, 3);
    expect(xyz.g).toBeCloseTo(0.2126, 3);
    expect(xyz.b).toBeCloseTo(0.0193, 3);
  });

  it('round-trips sRGB to OKLab to sRGB', () => {
    const src = make(sRGB, 0.3, 0.6, 0.9);
    const lab = convert(src, OKLab);
    const back = convert(lab, sRGB);
    expect(back.r).toBeCloseTo(src.r, 4);
    expect(back.g).toBeCloseTo(src.g, 4);
    expect(back.b).toBeCloseTo(src.b, 4);
  });

  it('round-trips sRGB to OKLCh to sRGB', () => {
    const src = make(sRGB, 0.7, 0.2, 0.4);
    const lch = convert(src, OKLCh);
    const back = convert(lch, sRGB);
    expect(back.r).toBeCloseTo(src.r, 4);
    expect(back.g).toBeCloseTo(src.g, 4);
    expect(back.b).toBeCloseTo(src.b, 4);
  });

  it('copies alpha through every conversion', () => {
    const src = make(sRGB, 0.5, 0.5, 0.5, 0.25);
    const dst = convert(src, OKLab);
    expect(dst.a).toBe(0.25);
  });

  it('converts black to the OKLab origin', () => {
    const black = make(sRGB, 0, 0, 0);
    const lab = convert(black, OKLab);
    expect(lab.r).toBeCloseTo(0, 5);
    expect(lab.g).toBeCloseTo(0, 5);
    expect(lab.b).toBeCloseTo(0, 5);
  });
});

describe('clampToRange', () => {
  it('clamps each channel to its own range', () => {
    const c = make(sRGB, 1.5, -0.2, 0.5);
    const out = clampToRange(c);
    expect(out.r).toBe(1);
    expect(out.g).toBe(0);
    expect(out.b).toBe(0.5);
  });

  it('clamps alpha to 0 to 1', () => {
    const c = make(sRGB, 0, 0, 0, 2);
    expect(clampToRange(c).a).toBe(1);
  });

  it('does not clamp the OKLCh hue channel', () => {
    const c = make(OKLCh, 0.5, 0.2, 720);
    expect(clampToRange(c).b).toBe(720);
  });

  it('leaves an in-range color unchanged', () => {
    const c = make(sRGB, 0.5, 0.5, 0.5);
    expect(clampToRange(c)).toEqual(c);
  });
});

describe('isInRange', () => {
  it('returns true for an in-range color', () => {
    expect(isInRange(make(sRGB, 0.5, 0.5, 0.5))).toBe(true);
  });

  it('returns false for an out-of-range color', () => {
    expect(isInRange(make(sRGB, 1.5, 0.5, 0.5))).toBe(false);
    expect(isInRange(make(sRGB, -0.1, 0.5, 0.5))).toBe(false);
  });

  it('allows a small epsilon', () => {
    expect(isInRange(make(sRGB, 1.00001, 1.00001, 1.00001))).toBe(true);
  });

  it('uses per-channel ranges on OKLCh', () => {
    expect(isInRange(make(OKLCh, 0.5, 0.2, 720))).toBe(true);
    expect(isInRange(make(OKLCh, 1.5, 0.2, 720))).toBe(false);
  });

  it('admits HDR XYZ values', () => {
    expect(isInRange(make(XYZ_D65, 5, 5, 5))).toBe(true);
  });
});

describe('isInSRGBGamut', () => {
  it('returns true for a standard sRGB color', () => {
    expect(isInSRGBGamut(make(sRGB, 0.5, 0.5, 0.5))).toBe(true);
  });

  it('returns false for a P3 color outside sRGB', () => {
    const wide = make(Display_P3, 0.0, 0.9, 0.5);
    expect(isInSRGBGamut(wide)).toBe(false);
  });
});

describe('format', () => {
  it('formats with four decimals by default', () => {
    expect(format(make(sRGB, 0.5, 0.2, 0.8))).toBe('sRGB(0.5000, 0.2000, 0.8000, 1.0000)');
  });

  it('accepts a custom number of decimals', () => {
    expect(format(make(OKLab, 0.6, 0.2, 0.1), 2)).toBe('OKLab(0.60, 0.20, 0.10, 1.00)');
  });
});

describe('mix', () => {
  it('returns the first color when t=0 in the working space', () => {
    const a = make(sRGB, 1, 0, 0);
    const b = make(sRGB, 0, 0, 1);
    const out = mix(a, b, 0, sRGB);
    expect(out.r).toBeCloseTo(1, 4);
    expect(out.g).toBeCloseTo(0, 4);
    expect(out.b).toBeCloseTo(0, 4);
  });

  it('returns the second color when t=1 in the working space', () => {
    const a = make(sRGB, 1, 0, 0);
    const b = make(sRGB, 0, 0, 1);
    const out = mix(a, b, 1, sRGB);
    expect(out.r).toBeCloseTo(0, 4);
    expect(out.g).toBeCloseTo(0, 4);
    expect(out.b).toBeCloseTo(1, 4);
  });

  it('defaults to the OKLab working space', () => {
    const a = make(sRGB, 1, 0, 0);
    const b = make(sRGB, 0, 0, 1);
    const out = mix(a, b, 0.5);
    expect(out._space).toBe(OKLab);
  });

  it('produces the OKLab L value for red at t=0', () => {
    // Red in OKLab has L about 0.628. The exact value depends on the
    // sRGB to OKLab matrix.
    const a = make(sRGB, 1, 0, 0);
    const b = make(sRGB, 0, 0, 1);
    const out = mix(a, b, 0);
    expect(out.r).toBeCloseTo(0.628, 3);
    expect(out._space).toBe(OKLab);
  });

  it('blends in sRGB when sRGB is the working space', () => {
    const red = make(sRGB, 1, 0, 0);
    const blue = make(sRGB, 0, 0, 1);
    const mid = mix(red, blue, 0.5, sRGB);
    expect(mid._space).toBe(sRGB);
    expect(mid.r).toBeCloseTo(0.5, 4);
    expect(mid.b).toBeCloseTo(0.5, 4);
  });

  it('interpolates alpha', () => {
    const a = make(sRGB, 0, 0, 0, 0);
    const b = make(sRGB, 0, 0, 0, 1);
    const mid = mix(a, b, 0.5, sRGB);
    expect(mid.a).toBeCloseTo(0.5, 4);
  });
});
