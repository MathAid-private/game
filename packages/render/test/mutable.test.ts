/**
 * @fileoverview Tests for the mutable color type.
 *
 * @summary
 * Covers `toMutable`, `toImmutable`, and the aliasing rules.
 *
 * @description
 * The tests confirm that conversions copy values, not references. A
 * write to one object never changes another.
 *
 * @author MathAid
 */

import { make, sRGB, toImmutable, toMutable } from '@games/render';
import { describe, expect, it } from 'vitest';

describe('toMutable', () => {
  it('copies the channel values', () => {
    const src = make(sRGB, 0.1, 0.2, 0.3, 0.4);
    const m = toMutable(src);
    expect(m.r).toBe(0.1);
    expect(m.g).toBe(0.2);
    expect(m.b).toBe(0.3);
    expect(m.a).toBe(0.4);
  });

  it('keeps the space tag', () => {
    const m = toMutable(make(sRGB, 0, 0, 0));
    expect(m._space).toBe(sRGB);
  });

  it('does not alias the input', () => {
    const src = make(sRGB, 0.5, 0.5, 0.5);
    const m = toMutable(src);
    m.r = 1;
    expect(src.r).toBe(0.5);
  });
});

describe('toImmutable', () => {
  it('snapshots the current values', () => {
    const m = toMutable(make(sRGB, 0.1, 0.2, 0.3));
    const snap = toImmutable(m);
    m.r = 1;
    expect(snap.r).toBe(0.1);
  });

  it('keeps the space tag', () => {
    const snap = toImmutable(toMutable(make(sRGB, 0, 0, 0)));
    expect(snap._space).toBe(sRGB);
  });
});
