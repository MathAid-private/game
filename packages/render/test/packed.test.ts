/**
 * @fileoverview Tests for the packed integer formats.
 *
 * @summary
 * Covers `toRGBA8`, `fromRGBA8`, `toBGRA8`, `fromBGRA8`, `toRgb565`,
 * and `fromRgb565`.
 *
 * @description
 * The tests check the bit layout, the round-trip precision, and the
 * scaling.
 *
 * @author MathAid
 */

import {
  fromBGRA8,
  fromRGBA8,
  fromRgb565,
  make,
  sRGB,
  toBGRA8,
  toRGBA8,
  toRgb565,
} from '@games/render';
import { describe, expect, it } from 'vitest';

describe('RGBA8', () => {
  it('packs red as 0xFF0000FF', () => {
    expect(toRGBA8(make(sRGB, 1, 0, 0, 1))).toBe(0xff0000ff);
  });

  it('packs blue as 0x0000FFFF', () => {
    expect(toRGBA8(make(sRGB, 0, 0, 1, 1))).toBe(0x0000ffff);
  });

  it('unpacks to the original channels', () => {
    const packed = toRGBA8(make(sRGB, 1, 0, 0, 1));
    const c = fromRGBA8(packed);
    expect(c.r).toBe(1);
    expect(c.g).toBe(0);
    expect(c.b).toBe(0);
    expect(c.a).toBe(1);
  });

  it('round-trips within 1/255', () => {
    const src = make(sRGB, 0.5, 0.25, 0.75, 1);
    const back = fromRGBA8(toRGBA8(src));
    expect(back.r).toBeCloseTo(0.5, 2);
    expect(back.g).toBeCloseTo(0.25, 2);
    expect(back.b).toBeCloseTo(0.75, 2);
  });
});

describe('BGRA8', () => {
  it('packs red as 0x0000FFFF', () => {
    expect(toBGRA8(make(sRGB, 1, 0, 0, 1))).toBe(0x0000ffff);
  });

  it('packs blue as 0xFF0000FF', () => {
    expect(toBGRA8(make(sRGB, 0, 0, 1, 1))).toBe(0xff0000ff);
  });

  it('unpacks to the original channels', () => {
    const c = fromBGRA8(toBGRA8(make(sRGB, 1, 0, 0, 1)));
    expect(c.r).toBe(1);
    expect(c.b).toBe(0);
  });
});

describe('Rgb565', () => {
  it('packs pure red as 0xF800', () => {
    expect(toRgb565(make(sRGB, 1, 0, 0))).toBe(0xf800);
  });

  it('packs pure green as 0x07E0', () => {
    expect(toRgb565(make(sRGB, 0, 1, 0))).toBe(0x07e0);
  });

  it('packs pure blue as 0x001F', () => {
    expect(toRgb565(make(sRGB, 0, 0, 1))).toBe(0x001f);
  });

  it('unpacks red exactly', () => {
    const c = fromRgb565(0xf800);
    expect(c.r).toBe(1);
    expect(c.g).toBe(0);
    expect(c.b).toBe(0);
    expect(c.a).toBe(1);
  });

  it('unpacks green with 6-bit precision', () => {
    const c = fromRgb565(0x07e0);
    expect(c.g).toBe(1);
  });

  it('round-trips mid gray within 5-bit precision', () => {
    const src = make(sRGB, 0.5, 0.5, 0.5);
    const back = fromRgb565(toRgb565(src));
    expect(back.r).toBeCloseTo(0.5, 1);
    expect(back.g).toBeCloseTo(0.5, 1);
  });
});
