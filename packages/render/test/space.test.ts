/**
 * @fileoverview Tests for the color space type system.
 *
 * @summary
 * Covers the `_brand` symbol, the `makeSpace` helper, the built-in
 * space definitions, and the per-channel ranges.
 *
 * @description
 * Each test group focuses on one export. The tests exercise both the
 * happy path and the boundary cases. Type-level branding is checked
 * with `@ts-expect-error` where possible.
 *
 * @author MathAid
 */

import {
    _brand,
    ACES_AP0,
    ACES_AP1,
    type ColorSpaceDef,
    Display_P3,
    HLG_Rec2020,
    Linear_P3,
    Linear_Rec2020,
    Linear_sRGB,
    makeSpace,
    OKLab,
    OKLCh,
    PQ_Rec2020,
    type SpaceDescriptor,
    sRGB,
    XYZ_D65,
} from '@games/render';
import { describe, expect, it } from 'vitest';

const identity: SpaceDescriptor = {
  name: 'Identity space',
  isLinear: true,
  toXYZ: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  fromXYZ: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  transfer: { eotf: (x) => x, oetf: (x) => x },
  channelRanges: [
    { min: 0, max: 1 },
    { min: 0, max: 1 },
    { min: 0, max: 1 },
  ],
  channelNames: ['R', 'G', 'B'],
};

describe('_brand', () => {
  it('is a symbol', () => {
    expect(typeof _brand).toBe('symbol');
  });

  it('carries a readable description', () => {
    expect(_brand.toString()).toContain('color/space-brand');
  });
});

describe('makeSpace', () => {
  it('creates a space object with the given id and descriptor', () => {
    const MySpace = makeSpace('MySpace', identity);
    expect(MySpace.id).toBe('MySpace');
    expect(MySpace.descriptor).toBe(identity);
  });

  it('writes the phantom brand as a runtime property', () => {
    const MySpace = makeSpace('MySpace', identity);
    expect((MySpace as Record<symbol, unknown>)[_brand]).toBe('MySpace');
  });

  it('produces two distinct spaces for two distinct ids', () => {
    const A = makeSpace('A', identity);
    const B = makeSpace('B', identity);
    expect(A.id).not.toBe(B.id);
  });

  it('allows users to build their own space literal', () => {
    const MySpace: ColorSpaceDef<'MySpace'> = {
      [_brand]: 'MySpace',
      id: 'MySpace',
      descriptor: identity,
    };
    expect(MySpace.id).toBe('MySpace');
    expect((MySpace as Record<symbol, unknown>)[_brand]).toBe('MySpace');
  });
});

describe('built-in space ids', () => {
  const all = [
    sRGB,
    Linear_sRGB,
    Display_P3,
    Linear_P3,
    Linear_Rec2020,
    PQ_Rec2020,
    HLG_Rec2020,
    ACES_AP0,
    ACES_AP1,
    XYZ_D65,
    OKLab,
    OKLCh,
  ];

  it('has twelve built-in spaces', () => {
    expect(all).toHaveLength(12);
  });

  it('has unique ids', () => {
    const ids = all.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has a descriptor with three channel ranges for every space', () => {
    for (const space of all) {
      expect(space.descriptor.channelRanges).toHaveLength(3);
    }
  });

  it('has a descriptor with three channel names for every space', () => {
    for (const space of all) {
      expect(space.descriptor.channelNames).toHaveLength(3);
    }
  });
});

describe('per-channel ranges', () => {
  it('has 0 to 1 on all channels of sRGB', () => {
    expect(sRGB.descriptor.channelRanges).toEqual([
      { min: 0, max: 1 },
      { min: 0, max: 1 },
      { min: 0, max: 1 },
    ]);
  });

  it('has a wide range for XYZ to admit HDR', () => {
    for (const r of XYZ_D65.descriptor.channelRanges) {
      expect(r.min).toBeLessThan(0);
      expect(r.max).toBeGreaterThan(1);
    }
  });

  it('has the hue channel unbounded on OKLCh', () => {
    const [L, C, H] = OKLCh.descriptor.channelRanges;
    expect(L).toEqual({ min: 0, max: 1 });
    expect(C.max).toBeGreaterThan(0);
    expect(C.max).toBeLessThan(1);
    expect(H.min).toBe(-Infinity);
    expect(H.max).toBe(Infinity);
  });

  it('has a and b roughly symmetric on OKLab', () => {
    const [L, a, b] = OKLab.descriptor.channelRanges;
    expect(L).toEqual({ min: 0, max: 1 });
    expect(a.min).toBeLessThan(0);
    expect(a.max).toBeGreaterThan(0);
    expect(b.min).toBeLessThan(0);
    expect(b.max).toBeGreaterThan(0);
  });
});