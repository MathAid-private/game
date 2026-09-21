/**
 * @fileoverview Tests for CSS parsing and serialization.
 *
 * @summary
 * Covers every supported input form and every output format.
 *
 * @description
 * The tests check both directions. Parsing tests assert the resulting
 * space and channels. Serialization tests check the exact string.
 *
 * @author MathAid
 */

import { Display_P3, fromCSS, HSL, make, OKLCh, sRGB, toCSS } from '@games/render';
import { describe, expect, it } from 'vitest';

describe('fromCSS hex', () => {
  it('parses #f80', () => {
    const c = fromCSS('#f80');
    expect(c._space).toBe(sRGB);
    expect(c.c1).toBeCloseTo(1, 3);
    expect(c.c2).toBeCloseTo(0.533, 2);
  });

  it('parses #ff8800', () => {
    const c = fromCSS('#ff8800');
    expect(c.c1).toBeCloseTo(1, 3);
    expect(c.c2).toBeCloseTo(0.533, 2);
  });

  it('parses #ff880080 with alpha', () => {
    const c = fromCSS('#ff880080');
    expect(c.alpha).toBeCloseTo(0.502, 2);
  });
});

describe('fromCSS named colors', () => {
  it('parses "red"', () => {
    const c = fromCSS('red');
    expect(c.c1).toBeCloseTo(1, 3);
    expect(c.c2).toBe(0);
  });

  it('parses "rebeccapurple" case-insensitively', () => {
    const c = fromCSS('REBECCAPURPLE');
    expect(c.c1).toBeCloseTo(0.4, 2);
    expect(c.c3).toBeCloseTo(0.6, 2);
  });
});

describe('fromCSS rgb', () => {
  it('parses comma-separated form', () => {
    const c = fromCSS('rgb(255, 128, 0)');
    expect(c.c1).toBeCloseTo(1, 3);
    expect(c.c2).toBeCloseTo(0.502, 2);
  });

  it('parses space-separated form with slash alpha', () => {
    const c = fromCSS('rgb(255 128 0 / 0.5)');
    expect(c.alpha).toBeCloseTo(0.5, 3);
  });

  it('parses percentage form', () => {
    const c = fromCSS('rgb(100% 50% 0%)');
    expect(c.c1).toBeCloseTo(1, 3);
    expect(c.c2).toBeCloseTo(0.5, 3);
  });
});

describe('fromCSS hsl', () => {
  it('parses hsl(0, 100%, 50%)', () => {
    const c = fromCSS('hsl(0, 100%, 50%)');
    expect(c.c1).toBeCloseTo(1, 3);
    expect(c.c2).toBeCloseTo(0, 3);
  });

  it('parses hsl with deg suffix', () => {
    const c = fromCSS('hsl(120deg 100% 50%)');
    expect(c.c2).toBeCloseTo(1, 3);
  });
});

describe('fromCSS oklch', () => {
  it('returns an OKLCh color', () => {
    const c = fromCSS('oklch(0.7 0.15 60)');
    expect(c._space).toBe(OKLCh);
    expect(c.c1).toBeCloseTo(0.7, 3);
    expect(c.c2).toBeCloseTo(0.15, 3);
    expect(c.c3).toBeCloseTo(60, 1);
  });

  it('accepts alpha', () => {
    const c = fromCSS('oklch(0.7 0.15 60 / 0.5)');
    expect(c.alpha).toBeCloseTo(0.5, 3);
  });
});

describe('fromCSS color()', () => {
  it('parses display-p3', () => {
    const c = fromCSS('color(display-p3 1 0.5 0)');
    expect(c._space).toBe(Display_P3);
    expect(c.c1).toBeCloseTo(1, 3);
  });

  it('parses rec2020', () => {
    const c = fromCSS('color(rec2020 0.5 0.5 0.5)');
    expect(c._space.id).toBe('Linear_Rec2020');
  });

  it('throws on unknown space', () => {
    expect(() => fromCSS('color(unknown 1 0 0)')).toThrow(/unknown color space/);
  });
});

describe('fromCSS errors', () => {
  it('throws on empty input', () => {
    expect(() => fromCSS('')).toThrow(/empty/);
  });

  it('throws on an unknown function', () => {
    expect(() => fromCSS('lab(50 0 0)')).toThrow(/unknown function/);
  });
});

describe('toCSS', () => {
  it('emits hex for sRGB with alpha 1 by default', () => {
    expect(toCSS(make(sRGB, 1, 0, 0))).toBe('#ff0000');
  });

  it('emits rgb with alpha by default', () => {
    expect(toCSS(make(sRGB, 1, 0, 0, 0.5))).toMatch(/^rgb\(255 0 0 \/ 0\.5\)$/);
  });

  it('emits hsl on request', () => {
    const s = toCSS(make(sRGB, 1, 0, 0), 'hsl');
    expect(s).toMatch(/^hsl\(0 100% 50%\)$/);
  });

  it('emits oklch on request', () => {
    const s = toCSS(make(OKLCh, 0.7, 0.15, 60), 'oklch');
    expect(s).toMatch(/^oklch\(0\.7 0\.15 60\)$/);
  });

  it('emits color(display-p3 ...) on request', () => {
    const s = toCSS(make(Display_P3, 1, 0.5, 0), 'color-display-p3');
    expect(s).toMatch(/^color\(display-p3 /);
  });
});

describe('CSS round-trip', () => {
  it('hex to sRGB and back', () => {
    const c = fromCSS('#ff8000');
    const s = toCSS(c, 'hex');
    expect(s).toBe('#ff8000');
  });

  it('oklch round-trips within precision', () => {
    const c = fromCSS('oklch(0.7 0.15 60)');
    const s = toCSS(c, 'oklch');
    const back = fromCSS(s);
    expect(back.c1).toBeCloseTo(0.7, 3);
  });
});

// Quiet the unused import warning.
void HSL;
