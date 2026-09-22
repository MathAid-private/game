/**
 * @fileoverview Tests for the tuple view and the conversions.
 *
 * @summary
 * Covers `asTuple`, `fromTuple`, `makeTuple`, `isColorValue`, and
 * the tuple overloads on `convert`, `mapToGamut`, `checkGamut`, and
 * `checkGamutAll`.
 *
 * @description
 * The tests confirm the boundary rule. Every tuple that enters a
 * public function is converted to a `ColorValue` first. The object
 * shape carries the runtime tag. The tuple does not.
 *
 * @author MathAid
 */

import {
  asTuple,
  checkGamut,
  checkGamutAll,
  convert,
  Display_P3,
  fromTuple,
  isColorValue,
  Linear_sRGB,
  make,
  makeTuple,
  mapToGamut,
  sRGB
} from '@games/render';
import { describe, expect, it } from 'vitest';

describe('asTuple', () => {
  it('projects the four channels in order', () => {
    const t = asTuple(make(sRGB, 1, 0.5, 0.25, 0.75));
    expect(Array.from(t)).toEqual([1, 0.5, 0.25, 0.75]);
  });

  it('does not alias the input', () => {
    const c = make(sRGB, 1, 0, 0);
    const t = asTuple(c);
    expect(t).not.toBe(c);
  });

  it('produces a plain 4-tuple', () => {
    const t = asTuple(make(sRGB, 1, 0, 0));
    expect(Array.isArray(t)).toBe(true);
    expect(t.length).toBe(4);
  });
});

describe('fromTuple', () => {
  it('produces an object with the space tag', () => {
    const t = makeTuple(sRGB, 1, 0, 0);
    const c = fromTuple(t, sRGB);
    expect(c.c1).toBe(1);
    expect(c._space).toBe(sRGB);
  });

  it('reads alpha from the fourth slot', () => {
    const c = fromTuple(makeTuple(sRGB, 0, 0, 0, 0.5), sRGB);
    expect(c.alpha).toBe(0.5);
  });
});

describe('makeTuple', () => {
  it('defaults alpha to 1', () => {
    const t = makeTuple(sRGB, 1, 0, 0);
    expect(t[3]).toBe(1);
  });
});

describe('isColorValue', () => {
  it('returns true for a ColorValue', () => {
    expect(isColorValue(make(sRGB, 1, 0, 0))).toBe(true);
  });

  it('returns false for a tuple', () => {
    expect(isColorValue([1, 0, 0, 1])).toBe(false);
  });

  it('returns false for null', () => {
    expect(isColorValue(null)).toBe(false);
  });

  it('returns false for a plain object', () => {
    expect(isColorValue({ c1: 1, c2: 0, c3: 0, alpha: 1 })).toBe(false);
  });
});

describe('convert with tuples', () => {
  it('accepts a tuple plus a from-space', () => {
    const out = convert(makeTuple(sRGB, 1, 0, 0), sRGB, Linear_sRGB);
    expect(out._space).toBe(Linear_sRGB);
  });

  it('accepts an object without a from-space', () => {
    const out = convert(make(sRGB, 1, 0, 0), Linear_sRGB);
    expect(out._space).toBe(Linear_sRGB);
  });

  it('produces the same result for both paths', () => {
    const a = convert(make(sRGB, 0.5, 0.2, 0.8), Linear_sRGB);
    const b = convert(makeTuple(sRGB, 0.5, 0.2, 0.8), sRGB, Linear_sRGB);
    expect(b.c1).toBeCloseTo(a.c1, 6);
    expect(b.c2).toBeCloseTo(a.c2, 6);
    expect(b.c3).toBeCloseTo(a.c3, 6);
  });
});

describe('mapToGamut with tuples', () => {
  it('accepts a tuple plus a from-space', () => {
    const out = mapToGamut(makeTuple(Display_P3, 0, 0.9, 0.5), Display_P3, sRGB);
    expect(out._space).toBe(sRGB);
    expect(checkGamut(out, sRGB).inGamut).toBe(true);
  });

  it('accepts the method argument in the tuple form', () => {
    const out = mapToGamut(makeTuple(Display_P3, 0, 0.9, 0.5), Display_P3, sRGB, 'clamp');
    expect(out._space).toBe(sRGB);
  });

  it('produces the same result as the object form', () => {
    const viaObj = mapToGamut(make(Display_P3, 0, 0.9, 0.5), sRGB);
    const viaTup = mapToGamut(makeTuple(Display_P3, 0, 0.9, 0.5), Display_P3, sRGB);
    expect(viaTup.c1).toBeCloseTo(viaObj.c1, 8);
    expect(viaTup.c2).toBeCloseTo(viaObj.c2, 8);
    expect(viaTup.c3).toBeCloseTo(viaObj.c3, 8);
  });
});

describe('checkGamut with tuples', () => {
  it('accepts a tuple plus a from-space', () => {
    const r = checkGamut(makeTuple(Display_P3, 0, 0.9, 0.5), Display_P3, sRGB);
    expect(r.inGamut).toBe(false);
  });

  it('accepts an object without a from-space', () => {
    const r = checkGamut(make(Display_P3, 0, 0.9, 0.5), sRGB);
    expect(r.inGamut).toBe(false);
  });
});

describe('checkGamutAll with tuples', () => {
  it('accepts a tuple plus a from-space', () => {
    const r = checkGamutAll(makeTuple(Display_P3, 0, 0.9, 0.5), Display_P3, [sRGB, Display_P3]);
    expect(r.sRGB!.inGamut).toBe(false);
    expect(r.Display_P3!.inGamut).toBe(true);
  });

  it('accepts an object without a from-space', () => {
    const r = checkGamutAll(make(Display_P3, 0, 0.9, 0.5), [sRGB, Display_P3]);
    expect(r.sRGB!.inGamut).toBe(false);
  });
});

describe('tuple boundary rule', () => {
  it('the tuple carries no runtime space tag', () => {
    const t = makeTuple(sRGB, 1, 0, 0);
    expect((t as unknown as Record<string, unknown>)['_space']).toBeUndefined();
  });

  it('the object carries the space tag', () => {
    const c = make(sRGB, 1, 0, 0);
    expect(c._space).toBe(sRGB);
  });

  it('a tuple survives array methods without the tag', () => {
    const t = makeTuple(sRGB, 1, 0, 0);
    const spread = [...t];
    expect(spread).toEqual([1, 0, 0, 1]);
    expect((spread as unknown as Record<string, unknown>)['_space']).toBeUndefined();
  });
});

describe('field names', () => {
  it('has c1, c2, c3, alpha fields', () => {
    const c = make(sRGB, 1, 0.5, 0.25, 0.75);
    expect(c.c1).toBe(1);
    expect(c.c2).toBe(0.5);
    expect(c.c3).toBe(0.25);
    expect(c.alpha).toBe(0.75);
  });

  it('does not have r, g, b, a fields', () => {
    const c = make(sRGB, 1, 0, 0) as unknown as Record<string, unknown>;
    expect(c['r']).toBeUndefined();
    expect(c['g']).toBeUndefined();
    expect(c['b']).toBeUndefined();
    expect(c['a']).toBeUndefined();
  });
});
