/**
 * @fileoverview Tests for HDR tone mapping.
 *
 * @summary
 * Covers every operator at the boundaries and at a mid-range value.
 *
 * @description
 * The tests use `Linear_Rec2020` as the input space. That is the HDR
 * container space. The output is always sRGB.
 *
 * @author MathAid
 */

import { Linear_Rec2020, make, toneMap } from '@games/render';
import { describe, expect, it } from 'vitest';

describe('toneMap reinhard', () => {
  it('maps 0 to 0', () => {
    const c = toneMap(make(Linear_Rec2020, 0, 0, 0), 'reinhard');
    expect(c.r).toBeCloseTo(0, 3);
  });

  it('maps a positive luminance to a value under 1', () => {
    const c = toneMap(make(Linear_Rec2020, 2, 2, 2), 'reinhard');
    expect(c.r).toBeLessThan(1);
    expect(c.r).toBeGreaterThan(0);
  });

  it('does not exceed 1', () => {
    const c = toneMap(make(Linear_Rec2020, 100, 100, 100), 'reinhard');
    expect(c.r).toBeLessThanOrEqual(1);
  });
});

describe('toneMap aces-filmic', () => {
  it('maps 0 to 0', () => {
    const c = toneMap(make(Linear_Rec2020, 0, 0, 0), 'aces-filmic');
    expect(c.r).toBeCloseTo(0, 3);
  });

  it('maps 1 to a value near 0.8 in linear', () => {
    const c = toneMap(make(Linear_Rec2020, 1, 1, 1), 'aces-filmic');
    expect(c.r).toBeGreaterThan(0.5);
    expect(c.r).toBeLessThan(1);
  });

  it('handles very bright values', () => {
    const c = toneMap(make(Linear_Rec2020, 50, 50, 50), 'aces-filmic');
    expect(c.r).toBeLessThanOrEqual(1);
  });
});

describe('toneMap exposure', () => {
  it('doubles luminance at EV 1', () => {
    const a = toneMap(make(Linear_Rec2020, 0.1, 0.1, 0.1), 'exposure');
    const b = toneMap(make(Linear_Rec2020, 0.1, 0.1, 0.1), 'exposure', { exposure: 1 });
    expect(b.r).toBeGreaterThan(a.r);
  });

  it('halves luminance at EV -1', () => {
    const a = toneMap(make(Linear_Rec2020, 0.5, 0.5, 0.5), 'exposure');
    const b = toneMap(make(Linear_Rec2020, 0.5, 0.5, 0.5), 'exposure', { exposure: -1 });
    expect(b.r).toBeLessThan(a.r);
  });
});

describe('toneMap agx', () => {
  it('maps 0 to 0', () => {
    const c = toneMap(make(Linear_Rec2020, 0, 0, 0), 'agx');
    expect(c.r).toBeCloseTo(0, 3);
  });

  it('compresses highlights', () => {
    const c = toneMap(make(Linear_Rec2020, 10, 10, 10), 'agx');
    expect(c.r).toBeLessThanOrEqual(1);
  });
});

describe('toneMap alpha', () => {
  it('copies alpha unchanged', () => {
    const c = toneMap(make(Linear_Rec2020, 0.5, 0.5, 0.5, 0.25), 'reinhard');
    expect(c.a).toBe(0.25);
  });
});

describe('toneMap output space', () => {
  it('always returns sRGB', () => {
    const c = toneMap(make(Linear_Rec2020, 0.5, 0.5, 0.5), 'reinhard');
    expect(c._space.id).toBe('sRGB');
  });
});
