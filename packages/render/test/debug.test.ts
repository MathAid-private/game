/**
 * @fileoverview Tests for the development tools.
 *
 * @summary
 * Covers `warnOutOfGamut`, `debugFormat`, and `clearWarningCache`.
 *
 * @description
 * The tests use a fake `console.warn` to check the warning path. They
 * also check the `debugFormat` output shape.
 *
 * @author MathAid
 */

import {
  clearWarningCache,
  debugFormat,
  Display_P3,
  make,
  OKLab,
  sRGB,
  warnOutOfGamut,
} from '@games/render';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('warnOutOfGamut', () => {
  beforeEach(() => {
    clearWarningCache();
    vi.restoreAllMocks();
  });

  it('warns for an out-of-gamut color', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    warnOutOfGamut(make(Display_P3, 0, 0.9, 0.5), sRGB);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toMatch(/out of gamut/);
  });

  it('does not warn for an in-gamut color', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    warnOutOfGamut(make(sRGB, 0.5, 0.5, 0.5), sRGB);
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not warn twice for the same color', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const c = make(Display_P3, 0, 0.9, 0.5);
    warnOutOfGamut(c, sRGB);
    warnOutOfGamut(c, sRGB);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('warns again after clearWarningCache', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const c = make(Display_P3, 0, 0.9, 0.5);
    warnOutOfGamut(c, sRGB);
    clearWarningCache();
    warnOutOfGamut(c, sRGB);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('accepts a context label', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    warnOutOfGamut(make(Display_P3, 0, 0.9, 0.5), sRGB, 'sprite.tint');
    expect(spy.mock.calls[0]![0]).toMatch(/^\[sprite\.tint\]/);
  });
});

describe('debugFormat', () => {
  it('includes the space name and channel names', () => {
    const s = debugFormat(make(sRGB, 1, 0, 0));
    expect(s).toContain('sRGB');
    expect(s).toContain('R, G, B');
  });

  it('shows channel values', () => {
    const s = debugFormat(make(sRGB, 0.5, 0.5, 0.5));
    expect(s).toContain('0.5000');
  });

  it('marks out-of-range values', () => {
    const s = debugFormat(make(OKLab, 2, 0, 0));
    expect(s).toContain('high');
  });

  it('reports the sRGB gamut status', () => {
    const s = debugFormat(make(sRGB, 0.5, 0.5, 0.5));
    expect(s).toContain('in sRGB gamut: yes');
  });

  it('reports out of gamut correctly', () => {
    const s = debugFormat(make(Display_P3, 0, 0.9, 0.5));
    expect(s).toContain('in sRGB gamut: no');
  });
});
