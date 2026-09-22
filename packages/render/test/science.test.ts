/**
 * @fileoverview Tests for the color science helpers.
 *
 * @summary
 * Covers `chromaticityCoordinates`, `dominantWavelength`,
 * `colorTemperature`, and `metamerCheck`.
 *
 * @description
 * Each test uses a known reference value. The metamer test uses two
 * colors that are close in appearance but not identical.
 *
 * @author MathAid
 */

import {
  chromaticityCoordinates,
  colorTemperature,
  dominantWavelength,
  make,
  metamerCheck,
  sRGB,
  XYZ_D65,
} from '@games/render';
import { describe, expect, it } from 'vitest';

describe('chromaticityCoordinates', () => {
  it('returns near the D65 white point for white', () => {
    const c = chromaticityCoordinates(make(XYZ_D65, 0.95047, 1, 1.08883));
    expect(c.x).toBeCloseTo(0.3127, 3);
    expect(c.y).toBeCloseTo(0.329, 3);
  });

  it('returns the D65 white for black', () => {
    const c = chromaticityCoordinates(make(sRGB, 0, 0, 0));
    expect(c.x).toBeCloseTo(0.3127, 3);
    expect(c.y).toBeCloseTo(0.329, 3);
  });

  it('red is at a higher x than blue', () => {
    const red = chromaticityCoordinates(make(sRGB, 1, 0, 0));
    const blue = chromaticityCoordinates(make(sRGB, 0, 0, 1));
    expect(red.x).toBeGreaterThan(blue.x);
  });

  it('x + y is at most 1', () => {
    const c = chromaticityCoordinates(make(sRGB, 0.5, 0.3, 0.7));
    expect(c.x + c.y).toBeLessThanOrEqual(1.001);
  });
});

describe('dominantWavelength', () => {
  it('red is near 610 nm', () => {
    const wl = dominantWavelength(make(sRGB, 1, 0, 0));
    expect(wl).toBeGreaterThan(590);
    expect(wl).toBeLessThan(630);
  });

  it('blue is near 465 nm', () => {
    const wl = dominantWavelength(make(sRGB, 0, 0, 1));
    expect(wl).toBeGreaterThan(440);
    expect(wl).toBeLessThan(480);
  });

  it('green is near 550 nm', () => {
    const wl = dominantWavelength(make(sRGB, 0, 1, 0));
    expect(wl).toBeGreaterThan(520);
    expect(wl).toBeLessThan(560);
  });

  it('gray returns any wavelength in range', () => {
    const wl = dominantWavelength(make(sRGB, 0.5, 0.5, 0.5));
    expect(wl).toBeGreaterThanOrEqual(380);
    expect(wl).toBeLessThanOrEqual(780);
  });
});

describe('colorTemperature', () => {
  it('D65 white is near 6500 K', () => {
    const t = colorTemperature(make(XYZ_D65, 0.95047, 1, 1.08883));
    expect(t).toBeGreaterThan(6000);
    expect(t).toBeLessThan(7000);
  });

  it('warm colors are below 5000 K', () => {
    const t = colorTemperature(make(sRGB, 1, 0.8, 0.6));
    expect(t).toBeLessThan(5000);
    expect(t).toBeGreaterThan(1500);
  });

  it('cool colors are above 7000 K', () => {
    const t = colorTemperature(make(sRGB, 0.6, 0.8, 1));
    expect(t).toBeGreaterThan(7000);
  });

  it('output is clamped to 1000 to 25000', () => {
    const t = colorTemperature(make(sRGB, 1, 0, 0));
    expect(t).toBeGreaterThanOrEqual(1000);
    expect(t).toBeLessThanOrEqual(25000);
  });
});

describe('metamerCheck', () => {
  it('two identical colors are not metamers', () => {
    const a = make(sRGB, 0.5, 0.5, 0.5);
    const b = make(sRGB, 0.5, 0.5, 0.5);
    expect(metamerCheck(a, b)).toBe(false);
  });

  it('visually different colors are not metamers', () => {
    const a = make(sRGB, 1, 0, 0);
    const b = make(sRGB, 0, 0, 1);
    expect(metamerCheck(a, b)).toBe(false);
  });

  it('respects the threshold option', () => {
    const a = make(sRGB, 0.5, 0.5, 0.5);
    const b = make(sRGB, 0.52, 0.5, 0.5);
    // With a huge threshold, no pair counts as metamers.
    expect(metamerCheck(a, b, { threshold: 1000 })).toBe(false);
  });
});
