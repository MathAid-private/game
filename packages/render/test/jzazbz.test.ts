/**
 * @fileoverview Tests for Jzazbz and JzCzHz.
 *
 * @summary
 * Covers the XYZ round-trips and the known reference points.
 *
 * @description
 * Jzazbz is an HDR perceptual space. It uses an absolute luminance
 * reference of 10000 cd/m^2. The tests check that the conversion
 * round-trips and that the light and dark poles behave.
 *
 * @author MathAid
 */

import { convert, Jzazbz, JzCzHz, make, sRGB, XYZ_D65 } from '@games/render';
import { describe, expect, it } from 'vitest';


describe('Jzazbz', () => {
  it('round-trips sRGB through Jzazbz', () => {
    const src = make(sRGB, 0.5, 0.3, 0.7);
    const back = convert(convert(src, Jzazbz), sRGB);
    expect(back.c1).toBeCloseTo(src.c1, 3);
    expect(back.c2).toBeCloseTo(src.c2, 3);
    expect(back.c3).toBeCloseTo(src.c3, 3);
  });

  it('round-trips XYZ through Jzazbz', () => {
    const src = make(XYZ_D65, 0.5, 0.5, 0.5);
    const back = convert(convert(src, Jzazbz), XYZ_D65);
    expect(back.c1).toBeCloseTo(src.c1, 4);
    expect(back.c2).toBeCloseTo(src.c2, 4);
    expect(back.c3).toBeCloseTo(src.c3, 4);
  });

  it('black is near the origin', () => {
    const c = convert(make(sRGB, 0, 0, 0), Jzazbz);
    expect(c.c1).toBeCloseTo(0, 4);
    expect(c.c2).toBeCloseTo(0, 4);
    expect(c.c3).toBeCloseTo(0, 4);
  });

  it('D65 white has a positive Jz', () => {
    const c = convert(make(XYZ_D65, 0.95047, 1, 1.08883), Jzazbz);
    expect(c.c1).toBeGreaterThan(0.2);
    expect(Math.abs(c.c2)).toBeLessThan(0.02);
    expect(Math.abs(c.c3)).toBeLessThan(0.02);
  });

  it('red has positive az', () => {
    const c = convert(make(sRGB, 1, 0, 0), Jzazbz);
    expect(c.c2).toBeGreaterThan(0);
  });

  it('blue has negative bz', () => {
    const c = convert(make(sRGB, 0, 0, 1), Jzazbz);
    expect(c.c3).toBeLessThan(0);
  });

  it('preserves alpha', () => {
    const c = convert(make(sRGB, 0.5, 0.5, 0.5, 0.25), Jzazbz);
    expect(c.alpha).toBe(0.25);
  });
});

describe('JzCzHz', () => {
  it('round-trips through Jzazbz', () => {
    const src = make(sRGB, 0.4, 0.7, 0.2);
    const back = convert(convert(src, JzCzHz), sRGB);
    expect(back.c1).toBeCloseTo(src.c1, 3);
    expect(back.c2).toBeCloseTo(src.c2, 3);
    expect(back.c3).toBeCloseTo(src.c3, 3);
  });

  it('a gray has near-zero chroma', () => {
    const c = convert(make(sRGB, 0.5, 0.5, 0.5), JzCzHz);
    expect(c.c2).toBeCloseTo(0, 3);
  });

  it('hue is in 0 to 360', () => {
    const c = convert(make(sRGB, 1, 0.5, 0), JzCzHz);
    expect(c.c3).toBeGreaterThanOrEqual(0);
    expect(c.c3).toBeLessThan(360);
  });

  it('the polar form matches the rectangular form', () => {
    const src = make(sRGB, 0.3, 0.6, 0.9);
    const rect = convert(src, Jzazbz);
    const polar = convert(src, JzCzHz);
    expect(polar.c1).toBeCloseTo(rect.c1, 5);
    const expectedC = Math.sqrt(rect.c2 ** 2 + rect.c3 ** 2);
    expect(polar.c2).toBeCloseTo(expectedC, 5);
  });
});

it('D65 white is near Jz = 1', () => {
  const c = convert(make(XYZ_D65, 0.95047, 1, 1.08883), Jzazbz);
  expect(c.c1).toBeGreaterThan(0.9);
  expect(c.c1).toBeLessThan(1.05);
  expect(Math.abs(c.c2)).toBeLessThan(0.02);
  expect(Math.abs(c.c3)).toBeLessThan(0.02);
});