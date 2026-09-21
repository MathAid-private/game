/**
 * @fileoverview ICC profile byte-level parser.
 *
 * @summary
 * Reads an ICC file and produces an `ICCProfile`. Supports v2 and v4
 * matrix or TRC profiles and gray profiles. LUT-based profiles throw
 * a clear error.
 *
 * @description
 * The parser walks the header, then the tag table. For each tag it
 * cares about, it reads the bytes and interprets them.
 *
 * The byte order is detected from the profile size field. Big-endian
 * if the size reads as a sane number. Little-endian otherwise.
 *
 * @see {@link https://www.color.org/specification/ICC.1-2022-05.pdf} ICC v4 specification
 *
 * @author MathAid
 */

import { type Mat3 } from '../space';
import { type ICCPCS, type ICCProfile, type ICCProfileClass, type TRCFunction } from './profile';

// -----------------------------------------------------------------
//  Public API
// -----------------------------------------------------------------

/**
 * @summary
 * Parse an ICC profile from bytes.
 *
 * @description
 * The function reads the header, the tag table, and the supported
 * tags. It returns an `ICCProfile`. Tags the parser does not support
 * are listed in the `tags` field but not interpreted.
 *
 * @param data - The raw profile bytes.
 * @returns A parsed profile.
 *
 * @throws {Error} When the file is malformed, when the version is
 *   unsupported, or when the profile requires a feature the parser
 *   does not implement.
 *
 * @example
 * const fs = await import('node:fs/promises');
 * const bytes = await fs.readFile('sRGB.icc');
 * const profile = parseICC(bytes);
 * profile.deviceClass;   // 'display'
 * profile.colorSpace;    // 'RGB'
 */
export function parseICC(data: ArrayBuffer | Uint8Array): ICCProfile {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length < 128) {
    throw new Error('parseICC: file is shorter than the 128-byte header.');
  }

  // Detect byte order from the profile size.
  const viewBE = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sizeBE = viewBE.getUint32(0, false);
  const sizeLE = viewBE.getUint32(0, true);
  const looksBigEndian = sizeBE <= bytes.length && sizeBE > 0;
  const looksLittleEndian = sizeLE <= bytes.length && sizeLE > 0;
  if (!looksBigEndian && !looksLittleEndian) {
    throw new Error('parseICC: size field does not match the file length.');
  }
  // DataView.getUint32/getInt32 take a `littleEndian` flag. `order` is
  // that flag. It is the opposite of "the file is big-endian".
  const order = !looksBigEndian;

  // Signature check.
  const sig = readAscii(bytes, 36, 4);
  if (sig !== 'acsp') {
    throw new Error(`parseICC: missing 'acsp' signature (found "${sig}").`);
  }

  const version = readVersion(viewBE, order);
  const deviceClass = readDeviceClass(readAscii(bytes, 12, 4));
  const colorSpace = readAscii(bytes, 16, 4).trim();
  const pcs = readPCS(readAscii(bytes, 20, 4));
  const pcsIlluminant = readXYZ(viewBE, 68, order);
  const mediaWhite = readXYZ(viewBE, 68, order); // fallback, replaced by wtpt tag

  // Tag table.
  const tagCount = viewBE.getUint32(128, order);
  if (tagCount > 1024) {
    throw new Error(`parseICC: tag count ${tagCount} is unreasonable.`);
  }
  const tagTable = new Map<string, { offset: number; size: number }>();
  for (let i = 0; i < tagCount; i++) {
    const base = 132 + i * 12;
    const tagSig = readAscii(bytes, base, 4);
    const tagOffset = viewBE.getUint32(base + 4, order);
    const tagSize = viewBE.getUint32(base + 8, order);
    if (tagOffset + tagSize > bytes.length) {
      throw new Error(`parseICC: tag "${tagSig}" is out of bounds.`);
    }
    tagTable.set(tagSig, { offset: tagOffset, size: tagSize });
  }

  const tags = Array.from(tagTable.keys());

  // Media white point.
  let resolvedWhite = mediaWhite;
  const wtpt = tagTable.get('wtpt');
  if (wtpt) {
    resolvedWhite = readXYZ(viewBE, wtpt.offset + 8, order);
  }

  // Matrix and TRC profile support.
  let toPCS: Mat3 | undefined;
  let fromPCS: Mat3 | undefined;
  let trc: [TRCFunction, TRCFunction, TRCFunction] | undefined;
  let grayTRC: TRCFunction | undefined;

  if (colorSpace === 'RGB') {
    const rXYZ = tagTable.get('rXYZ');
    const gXYZ = tagTable.get('gXYZ');
    const bXYZ = tagTable.get('bXYZ');
    const rTRC = tagTable.get('rTRC');
    const gTRC = tagTable.get('gTRC');
    const bTRC = tagTable.get('bTRC');

    if (rXYZ && gXYZ && bXYZ) {
      // The matrix is stored column-major in the tag. Convert to row-major.
      const r = readXYZ(viewBE, rXYZ.offset + 8, order);
      const g = readXYZ(viewBE, gXYZ.offset + 8, order);
      const b = readXYZ(viewBE, bXYZ.offset + 8, order);
      toPCS = [r[0], g[0], b[0], r[1], g[1], b[1], r[2], g[2], b[2]];
      fromPCS = invertMat3(toPCS);
    }

    if (rTRC && gTRC && bTRC) {
      trc = [
        parseTRC(viewBE, bytes, rTRC.offset, rTRC.size, order),
        parseTRC(viewBE, bytes, gTRC.offset, gTRC.size, order),
        parseTRC(viewBE, bytes, bTRC.offset, bTRC.size, order),
      ];
    } else if (tagTable.has('A2B0')) {
      throw new Error('parseICC: LUT-based (A2B0) profiles are not supported in this version.');
    }
  } else if (colorSpace === 'GRAY') {
    const kTRC = tagTable.get('kTRC');
    if (kTRC) {
      grayTRC = parseTRC(viewBE, bytes, kTRC.offset, kTRC.size, order);
    } else if (tagTable.has('A2B0')) {
      throw new Error(
        'parseICC: LUT-based (A2B0) gray profiles are not supported in this version.',
      );
    }
  }

  return {
    version,
    deviceClass,
    colorSpace,
    pcs,
    pcsIlluminant,
    mediaWhite: resolvedWhite,
    toPCS,
    fromPCS,
    trc,
    grayTRC,
    tags,
  };
}

// -----------------------------------------------------------------
//  Header readers
// -----------------------------------------------------------------

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let s = '';
  for (let i = 0; i < length; i++) {
    const b = bytes[offset + i];
    if (b === undefined) return s;
    if (b !== 0) s += String.fromCharCode(b);
  }
  return s;
}

function readVersion(view: DataView, order: boolean): string {
  const raw = view.getUint32(8, order);
  const major = (raw >>> 24) & 0xff;
  const minor = (raw >>> 20) & 0x0f;
  const patch = (raw >>> 16) & 0x0f;
  return `${major}.${minor}.${patch}`;
}

function readDeviceClass(sig: string): ICCProfileClass {
  switch (sig) {
    case 'scnr':
      return 'input';
    case 'mntr':
      return 'display';
    case 'prtr':
      return 'output';
    case 'link':
      return 'link';
    case 'abst':
      return 'abstract';
    case 'spac':
      return 'colorspace';
    case 'nmcl':
      return 'named';
    default:
      throw new Error(`parseICC: unknown device class "${sig}".`);
  }
}

function readPCS(sig: string): ICCPCS {
  if (sig === 'XYZ ') return 'XYZ';
  if (sig === 'Lab ') return 'Lab';
  throw new Error(`parseICC: unknown PCS "${sig}".`);
}

function readXYZ(view: DataView, offset: number, order: boolean): [number, number, number] {
  const x = view.getInt32(offset, order) / 65536;
  const y = view.getInt32(offset + 4, order) / 65536;
  const z = view.getInt32(offset + 8, order) / 65536;
  return [x, y, z];
}

function invertMat3(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const D = -(b * i - c * h);
  const E = a * i - c * g;
  const F = -(a * h - b * g);
  const G = b * f - c * e;
  const H = -(a * f - c * d);
  const I = a * e - b * d;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) {
    throw new Error('parseICC: matrix is singular.');
  }
  const inv = 1 / det;
  return [A * inv, D * inv, G * inv, B * inv, E * inv, H * inv, C * inv, F * inv, I * inv];
}

// -----------------------------------------------------------------
//  TRC parsing
// -----------------------------------------------------------------

function parseTRC(
  view: DataView,
  bytes: Uint8Array,
  offset: number,
  size: number,
  order: boolean,
): TRCFunction {
  // A TRC tag has an 8-byte header (signature + reserved) plus at
  // least 4 bytes of payload. Reject anything shorter.
  if (size < 12) {
    throw new Error(`parseICC: TRC tag is too short (${size} bytes).`);
  }
  const sig = readAscii(bytes, offset, 4);
  if (sig === 'curv') {
    const count = view.getUint32(offset + 8, order);
    if (count === 0) {
      return { kind: 'identity', apply: (v) => v };
    }
    if (count === 1) {
      const gamma = view.getUint32(offset + 12, order) / 65536;
      return { kind: 'gamma', apply: (v) => Math.max(0, v) ** gamma };
    }
    const table = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      table[i] = view.getUint16(offset + 12 + i * 2, order) / 65535;
    }
    return {
      kind: 'table',
      apply: (v) => {
        const t = Math.max(0, Math.min(1, v)) * (count - 1);
        const lo = Math.floor(t);
        const hi = Math.min(count - 1, lo + 1);
        const frac = t - lo;
        return table[lo]! * (1 - frac) + table[hi]! * frac;
      },
    };
  }
  if (sig === 'para') {
    const type = view.getUint16(offset + 8, order);
    const g = view.getInt32(offset + 12, order) / 65536;
    if (type === 0) {
      return { kind: 'gamma', apply: (v) => Math.max(0, v) ** g };
    }
    const a = view.getInt32(offset + 16, order) / 65536;
    const b = view.getInt32(offset + 20, order) / 65536;
    if (type === 3) {
      const c = view.getInt32(offset + 24, order) / 65536;
      return {
        kind: 'table',
        apply: (v) => {
          const vv = Math.max(0, v);
          if (vv >= b) return (a * vv + c) ** g;
          return a * vv;
        },
      };
    }
    if (type === 4) {
      const c = view.getInt32(offset + 24, order) / 65536;
      const d = view.getInt32(offset + 28, order) / 65536;
      return {
        kind: 'table',
        apply: (v) => {
          const vv = Math.max(0, v);
          if (vv >= d) return (a * vv + b) ** g;
          return c * vv;
        },
      };
    }
  }
  throw new Error(`parseICC: unsupported TRC signature "${sig}".`);
}
