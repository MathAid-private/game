/**
 * @fileoverview Tests for the typed-array bridge.
 *
 * @summary
 * Covers `toFloat32Array`, `fromFloat32Array`, `toUint8Array`,
 * `fromUint8Array`, and `convertBatch`.
 *
 * @description
 * The tests check the interleaved RGBA layout, the round-trip
 * precision, and the byte scaling.
 *
 * @author MathAid
 */

import {
    convertBatch,
    fromFloat32Array,
    fromUint8Array,
    Linear_sRGB,
    make,
    sRGB,
    toFloat32Array,
    toUint8Array,
} from '@games/render';
import { describe, expect, it } from 'vitest';

describe('toFloat32Array', () => {
  it('packs four floats per color in RGBA order', () => {
    const data = toFloat32Array([make(sRGB, 0.1, 0.2, 0.3, 0.4)]);
    expect(data.length).toBe(4);
    expect(data[0]).toBeCloseTo(0.1, 6);
    expect(data[1]).toBeCloseTo(0.2, 6);
    expect(data[2]).toBeCloseTo(0.3, 6);
    expect(data[3]).toBeCloseTo(0.4, 6);
  });

  it('handles an empty input', () => {
    expect(toFloat32Array([]).length).toBe(0);
  });

  it('packs many colors back to back', () => {
    const data = toFloat32Array([make(sRGB, 1, 0, 0, 1), make(sRGB, 0, 1, 0, 1)]);
    expect(data.length).toBe(8);
    expect(data[4]).toBe(0);
    expect(data[5]).toBe(1);
  });
});

describe('fromFloat32Array', () => {
  it('unpacks the interleaved layout', () => {
    const data = new Float32Array([1, 0, 0, 1, 0, 0, 1, 1]);
    const colors = fromFloat32Array(data, sRGB);
    expect(colors.length).toBe(2);
    expect(colors[0]!.c1).toBe(1);
    expect(colors[1]!.c3).toBe(1);
  });

  it('throws on a wrong data length', () => {
    expect(() => fromFloat32Array(new Float32Array(3), sRGB)).toThrow(/multiple of 4/);
  });

  it('round-trips through toFloat32Array', () => {
    const src = [make(sRGB, 0.1, 0.2, 0.3, 0.4)];
    const back = fromFloat32Array(toFloat32Array(src), sRGB);
    expect(back[0]!.c1).toBeCloseTo(0.1, 5);
    expect(back[0]!.alpha).toBeCloseTo(0.4, 5);
  });
});

describe('toUint8Array', () => {
  it('scales to 0 to 255 with rounding', () => {
    const data = toUint8Array([make(sRGB, 1, 0, 0, 1)]);
    expect(Array.from(data)).toEqual([255, 0, 0, 255]);
  });

  it('clamps out-of-range values', () => {
    const data = toUint8Array([make(sRGB, 2, -1, 0.5, 1)]);
    expect(data[0]).toBe(255);
    expect(data[1]).toBe(0);
  });
});

describe('fromUint8Array', () => {
  it('divides each byte by 255', () => {
    const data = new Uint8Array([255, 128, 0, 255]);
    const colors = fromUint8Array(data, sRGB);
    expect(colors[0]!.c1).toBeCloseTo(1, 5);
    expect(colors[0]!.c2).toBeCloseTo(128 / 255, 5);
    expect(colors[0]!.c3).toBe(0);
  });
});

describe('convertBatch', () => {
  it('matches a per-color convert loop', () => {
    const src = [make(sRGB, 0.5, 0.2, 0.8), make(sRGB, 0.1, 0.9, 0.3)];
    const batch = convertBatch(src, Linear_sRGB);
    expect(batch.length).toBe(2);
    expect(batch[0]!._space).toBe(Linear_sRGB);
  });

  it('returns an empty array for an empty input', () => {
    expect(convertBatch([], Linear_sRGB).length).toBe(0);
  });
});
