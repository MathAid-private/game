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
    expect(back.r).toBeCloseTo(src.r, 3);
    expect(back.g).toBeCloseTo(src.g, 3);
    expect(back.b).toBeCloseTo(src.b, 3);
  });

  it('round-trips XYZ through Jzazbz', () => {
    const src = make(XYZ_D65, 0.5, 0.5, 0.5);
    const back = convert(convert(src, Jzazbz), XYZ_D65);
    expect(back.r).toBeCloseTo(src.r, 4);
    expect(back.g).toBeCloseTo(src.g, 4);
    expect(back.b).toBeCloseTo(src.b, 4);
  });

  it('black is near the origin', () => {
    const c = convert(make(sRGB, 0, 0, 0), Jzazbz);
    expect(c.r).toBeCloseTo(0, 4);
    expect(c.g).toBeCloseTo(0, 4);
    expect(c.b).toBeCloseTo(0, 4);
  });

  it('D65 white has a positive Jz', () => {
    const c = convert(make(XYZ_D65, 0.95047, 1, 1.08883), Jzazbz);
    expect(c.r).toBeGreaterThan(0.2);
    expect(Math.abs(c.g)).toBeLessThan(0.02);
    expect(Math.abs(c.b)).toBeLessThan(0.02);
  });

  it('red has positive az', () => {
    const c = convert(make(sRGB, 1, 0, 0), Jzazbz);
    expect(c.g).toBeGreaterThan(0);
  });

  it('blue has negative bz', () => {
    const c = convert(make(sRGB, 0, 0, 1), Jzazbz);
    expect(c.b).toBeLessThan(0);
  });

  it('preserves alpha', () => {
    const c = convert(make(sRGB, 0.5, 0.5, 0.5, 0.25), Jzazbz);
    expect(c.a).toBe(0.25);
  });
});

describe('JzCzHz', () => {
  it('round-trips through Jzazbz', () => {
    const src = make(sRGB, 0.4, 0.7, 0.2);
    const back = convert(convert(src, JzCzHz), sRGB);
    expect(back.r).toBeCloseTo(src.r, 3);
    expect(back.g).toBeCloseTo(src.g, 3);
    expect(back.b).toBeCloseTo(src.b, 3);
  });

  it('a gray has near-zero chroma', () => {
    const c = convert(make(sRGB, 0.5, 0.5, 0.5), JzCzHz);
    expect(c.g).toBeCloseTo(0, 3);
  });

  it('hue is in 0 to 360', () => {
    const c = convert(make(sRGB, 1, 0.5, 0), JzCzHz);
    expect(c.b).toBeGreaterThanOrEqual(0);
    expect(c.b).toBeLessThan(360);
  });

  it('the polar form matches the rectangular form', () => {
    const src = make(sRGB, 0.3, 0.6, 0.9);
    const rect = convert(src, Jzazbz);
    const polar = convert(src, JzCzHz);
    expect(polar.r).toBeCloseTo(rect.r, 5);
    const expectedC = Math.sqrt(rect.g ** 2 + rect.b ** 2);
    expect(polar.g).toBeCloseTo(expectedC, 5);
  });
});
