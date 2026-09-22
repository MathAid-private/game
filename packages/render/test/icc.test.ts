/**
 * @fileoverview Tests for the ICC profile reader.
 *
 * @summary
 * Covers `parseICC`, `applyProfile`, and `toProfileSpace`.
 *
 * @description
 * The tests use a synthetic sRGB matrix or TRC profile built in the
 * test. Real ICC files are binary blobs. Building one in code makes
 * the test deterministic and self-contained.
 *
 * @author MathAid
 */

import {
  applyProfile,
  convert,
  make,
  parseICC,
  sRGB,
  toProfileSpace,
  XYZ_D65,
} from '@games/render';
import { describe, expect, it } from 'vitest';

/**
 * @summary
 * Build a minimal v4 matrix or TRC sRGB profile.
 *
 * @description
 * The profile has a header, a tag table with six tags, and the tag
 * data. This is the smallest profile the parser will accept. It is
 * not a full conformant file. It is enough to exercise the parser.
 */
function buildSRGBProfile(): Uint8Array {
  const buf = new ArrayBuffer(512);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  const writeAscii = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) bytes[offset + i] = s.charCodeAt(i);
  };
  const writeXYZ = (offset: number, x: number, y: number, z: number): void => {
    view.setInt32(offset, Math.round(x * 65536), false);
    view.setInt32(offset + 4, Math.round(y * 65536), false);
    view.setInt32(offset + 8, Math.round(z * 65536), false);
  };

  // Header.
  view.setUint32(0, 512, false);
  view.setUint32(8, 0x04300000, false);
  writeAscii(12, 'mntr');
  writeAscii(16, 'RGB ');
  writeAscii(20, 'XYZ ');
  writeAscii(36, 'acsp');
  writeXYZ(68, 0.96422, 1.0, 0.82521);

  // Tag table. Six tags.
  view.setUint32(128, 6, false);
  const tagEntries: Array<[string, number, number]> = [
    ['rXYZ', 256, 20],
    ['gXYZ', 276, 20],
    ['bXYZ', 296, 20],
    ['rTRC', 316, 14],
    ['gTRC', 330, 14],
    ['bTRC', 344, 14],
  ];
  tagEntries.forEach(([sig, off, size], i) => {
    const base = 132 + i * 12;
    writeAscii(base, sig);
    view.setUint32(base + 4, off, false);
    view.setUint32(base + 8, size, false);
  });

  // sRGB to XYZ D50 matrix columns.
  writeAscii(256, 'XYZ ');
  writeXYZ(256 + 8, 0.4360747, 0.2225045, 0.0139322);
  writeAscii(276, 'XYZ ');
  writeXYZ(276 + 8, 0.3850649, 0.7168786, 0.0971045);
  writeAscii(296, 'XYZ ');
  writeXYZ(296 + 8, 0.1430804, 0.0606169, 0.7141733);

  // TRC curves. Gamma 2.2 with one value.
  const writeTRC = (off: number): void => {
    writeAscii(off, 'curv');
    view.setUint32(off + 8, 1, false);
    view.setUint32(off + 12, Math.round(2.2 * 65536), false);
  };
  writeTRC(316);
  writeTRC(330);
  writeTRC(344);

  return bytes;
}

describe('parseICC', () => {
  it('parses a minimal sRGB profile', () => {
    const profile = parseICC(buildSRGBProfile());
    expect(profile.version).toBe('4.3.0');
    expect(profile.deviceClass).toBe('display');
    expect(profile.colorSpace).toBe('RGB');
    expect(profile.pcs).toBe('XYZ');
  });

  it('reads the RGB primaries', () => {
    const profile = parseICC(buildSRGBProfile());
    expect(profile.toPCS).toBeDefined();
  });

  it('reads the TRC curves', () => {
    const profile = parseICC(buildSRGBProfile());
    expect(profile.trc).toBeDefined();
    expect(profile.trc![0].kind).toBe('gamma');
  });

  it('throws on a file without the acsp signature', () => {
    const bytes = buildSRGBProfile();
    bytes[36] = 0;
    expect(() => parseICC(bytes)).toThrow(/acsp/);
  });

  it('throws on a short file', () => {
    expect(() => parseICC(new Uint8Array(10))).toThrow(/128-byte header/);
  });
});

describe('applyProfile', () => {
  it('converts sRGB white to the profile PCS', () => {
    const profile = parseICC(buildSRGBProfile());
    const xyz = applyProfile(make(sRGB, 1, 1, 1), profile);
    expect(xyz._space).toBe(XYZ_D65);
    // D65 white after adaptation from D50. X near 0.95.
    expect(xyz.c1).toBeGreaterThan(0.9);
    expect(xyz.c2).toBeCloseTo(1, 1);
  });

  it('produces a different XYZ for red and blue', () => {
    const profile = parseICC(buildSRGBProfile());
    const red = applyProfile(make(sRGB, 1, 0, 0), profile);
    const blue = applyProfile(make(sRGB, 0, 0, 1), profile);
    expect(red.c1).not.toBeCloseTo(blue.c1, 2);
    expect(red.c3).not.toBeCloseTo(blue.c3, 2);
  });

  it('throws when the profile has no matrix', () => {
    const profile = parseICC(buildSRGBProfile());
    const noMatrix = { ...profile, toPCS: undefined };
    expect(() => applyProfile(make(sRGB, 1, 0, 0), noMatrix)).toThrow(/toPCS/);
  });
});

describe('round-trip', () => {
  it('matches the module sRGB after adaptation', () => {
    const profile = parseICC(buildSRGBProfile());
    const viaIcc = applyProfile(make(sRGB, 0.5, 0.5, 0.5), profile);
    const direct = convert(make(sRGB, 0.5, 0.5, 0.5), XYZ_D65);
    // The profile uses gamma 2.2, which is close to the sRGB curve
    // but not identical. Expect a small difference.
    expect(Math.abs(viaIcc.c1 - direct.c1)).toBeLessThan(0.05);
  });
});

describe('toProfileSpace', () => {
  it('round-trips through applyProfile', () => {
    const profile = parseICC(buildSRGBProfile());
    const original = make(sRGB, 0.5, 0.3, 0.7);
    const xyz = applyProfile(original, profile);
    const back = toProfileSpace(xyz, profile, sRGB);
    expect(back.c1).toBeCloseTo(original.c1, 2);
    expect(back.c2).toBeCloseTo(original.c2, 2);
    expect(back.c3).toBeCloseTo(original.c3, 2);
  });

  it('throws when the profile has no fromPCS matrix', () => {
    const profile = parseICC(buildSRGBProfile());
    const noMatrix = { ...profile, fromPCS: undefined };
    expect(() => toProfileSpace(make(XYZ_D65, 0.5, 0.5, 0.5), noMatrix, sRGB)).toThrow(/fromPCS/);
  });
});
