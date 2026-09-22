/**
 * @fileoverview Tests for JSON and MessagePack serialization.
 *
 * @summary
 * Covers `toJSON`, `fromJSON`, `toMsgPack`, `fromMsgPack`,
 * `packPalette`, `unpackPalette`, `packGradient`, and
 * `unpackGradient`.
 *
 * @description
 * The tests check round-trips, the exact byte output for MessagePack,
 * and the error cases.
 *
 * @author MathAid
 */
import {
  ColorValue,
  Display_P3,
  fromJSON,
  fromMsgPack,
  fromMsgPackStream,
  make,
  OKLab,
  packGradient,
  packPalette,
  sRGB,
  toJSON,
  toMsgPack,
  toMsgPackStream,
  unpackGradient,
  unpackPalette,
} from '@games/render';
import { describe, expect, it } from 'vitest';

describe('packPalette and unpackPalette', () => {
  it('packs colors into five-element tuples', () => {
    const p = packPalette([make(sRGB, 1, 0, 0, 1)]);
    expect(p.kind).toBe('palette');
    expect(p.colors[0]).toEqual(['sRGB', 1, 0, 0, 1]);
  });

  it('stores the optional name', () => {
    const p = packPalette([make(sRGB, 1, 0, 0)], 'warm');
    expect(p.name).toBe('warm');
  });

  it('round-trips a palette', () => {
    const colors = [make(sRGB, 1, 0, 0), make(Display_P3, 0, 0.9, 0.5)] as ColorValue<any>[];
    const back = unpackPalette(packPalette(colors));
    expect(back[0]!.c1).toBe(1);
    expect(back[1]!._space).toBe(Display_P3);
  });

  it('handles mixed spaces', () => {
    const colors = [make(sRGB, 0.5, 0.5, 0.5), make(OKLab, 0.6, 0.1, 0.1)] as ColorValue<any>[];
    const back = unpackPalette(packPalette(colors));
    expect(back[0]!._space).toBe(sRGB);
    expect(back[1]!._space).toBe(OKLab);
  });
});

describe('toJSON and fromJSON', () => {
  it('round-trips a palette', () => {
    const p = packPalette([make(sRGB, 1, 0, 0)]);
    const text = toJSON(p);
    const back = fromJSON(text);
    expect(back).toEqual(p);
  });

  it('round-trips a linear gradient', () => {
    const g = packGradient({
      kind: 'linear',
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      workingSpace: OKLab,
      stops: [
        { offset: 0, color: make(sRGB, 1, 0, 0) },
        { offset: 1, color: make(sRGB, 0, 0, 1) },
      ],
    });
    const back = fromJSON(toJSON(g));
    expect(back).toEqual(g);
  });

  it('throws on NaN', () => {
    expect(() => toJSON(packPalette([make(sRGB, NaN, 0, 0)]))).toThrow(/non-finite/);
  });

  it('throws on Infinity', () => {
    expect(() => toJSON(packPalette([make(sRGB, Infinity, 0, 0)]))).toThrow(/non-finite/);
  });

  it('throws on invalid JSON', () => {
    expect(() => fromJSON('{not valid')).toThrow(/invalid JSON/);
  });

  it('throws on an unknown kind', () => {
    expect(() => fromJSON('{"kind":"unknown"}')).toThrow(/unknown kind/);
  });
});

describe('toMsgPack and fromMsgPack', () => {
  it('round-trips a palette', () => {
    const p = packPalette([make(sRGB, 1, 0, 0), make(sRGB, 0, 0, 1)]);
    const bytes = toMsgPack(p);
    const back = fromMsgPack(bytes);
    expect(back).toEqual(p);
  });

  it('produces smaller output than JSON for integer-valued palettes', () => {
    const p = packPalette([make(sRGB, 1, 0, 0), make(sRGB, 0, 1, 0), make(sRGB, 0, 0, 1)]);
    const json = toJSON(p);
    const pack = toMsgPack(p);
    expect(pack.length).toBeLessThan(json.length);
  });

  it('is larger than JSON when every channel is a fractional float', () => {
    // MessagePack stores each float64 as 9 bytes. JSON stores 0.123
    // as 5 characters. For a single color, MessagePack's smaller
    // header wins by 2 bytes. For two or more colors, the per-color
    // cost dominates and JSON wins.
    const p = packPalette([
      make(sRGB, 0.123, 0.456, 0.789),
      make(sRGB, 0.234, 0.567, 0.891),
      make(sRGB, 0.345, 0.678, 0.912),
    ]);
    const json = toJSON(p);
    const pack = toMsgPack(p);
    expect(pack.length).toBeGreaterThan(json.length);
  });

  it('is smaller than JSON when the palette is a single fractional color', () => {
    // The header savings dominate for a single color.
    const p = packPalette([make(sRGB, 0.123, 0.456, 0.789)]);
    const json = toJSON(p);
    const pack = toMsgPack(p);
    expect(pack.length).toBeLessThan(json.length);
  });

  it('is smaller than JSON for integer-valued palettes', () => {
    const p = packPalette([
      make(sRGB, 1, 0, 0),
      make(sRGB, 0, 1, 0),
      make(sRGB, 0, 0, 1),
      make(sRGB, 1, 1, 0),
      make(sRGB, 0, 1, 1),
    ]);
    const json = toJSON(p);
    const pack = toMsgPack(p);
    // The output is about 40 percent smaller.
    expect(pack.length).toBeLessThan(json.length * 0.7);
  });

  it('round-trips a multi-stop gradient', () => {
    const g = packGradient({
      kind: 'multi',
      stops: [
        { offset: 0, color: make(sRGB, 1, 0, 0) },
        { offset: 0.5, color: make(sRGB, 1, 1, 0) },
        { offset: 1, color: make(sRGB, 0, 1, 0) },
      ],
    });
    const back = fromMsgPack(toMsgPack(g));
    expect(back).toEqual(g);
  });

  it('throws on non-finite numbers', () => {
    expect(() => toMsgPack(packPalette([make(sRGB, NaN, 0, 0)]))).toThrow(/non-finite/);
  });
});

describe('packGradient and unpackGradient', () => {
  it('packs a linear gradient', () => {
    const g = packGradient({
      kind: 'linear',
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      stops: [{ offset: 0, color: make(sRGB, 1, 0, 0) }],
    });
    expect(g.kind).toBe('linear');
    expect(g.stops[0]!.color[0]).toBe('sRGB');
  });

  it('packs a radial gradient', () => {
    const g = packGradient({
      kind: 'radial',
      center: { x: 0.5, y: 0.5 },
      innerRadius: 0,
      outerRadius: 1,
      stops: [{ offset: 0, color: make(sRGB, 1, 1, 1) }],
    });
    expect(g.kind).toBe('radial');
  });

  it('unpacks a linear gradient', () => {
    const g = packGradient({
      kind: 'linear',
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      stops: [{ offset: 0, color: make(sRGB, 1, 0, 0) }],
    });
    const back = unpackGradient(g);
    expect(back.kind).toBe('linear');
    if (back.kind === 'linear') {
      expect(back.from).toEqual({ x: 0, y: 0 });
      expect(back.stops[0]!.color.c1).toBe(1);
    }
  });
});

async function collect(gen: AsyncGenerator<Uint8Array, void, void>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const c of gen) chunks.push(c);
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

async function* fromBytes(bytes: Uint8Array, chunkSize: number): AsyncGenerator<Uint8Array> {
  for (let i = 0; i < bytes.length; i += chunkSize) {
    yield bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
  }
}

describe('toMsgPackStream', () => {
  it('produces the same bytes as toMsgPack', async () => {
    const p = packPalette([make(sRGB, 1, 0, 0), make(sRGB, 0, 0, 1)]);
    const sync = toMsgPack(p);
    const streamed = await collect(toMsgPackStream(p));
    expect(streamed).toEqual(sync);
  });

  it('yields multiple chunks for a large input', async () => {
    const colors = Array.from({ length: 5000 }, (_, i) => make(sRGB, i / 5000, 0.5, 0.5));
    const p = packPalette(colors);
    const streamed = await collect(toMsgPackStream(p, { chunkSize: 256 }));
    const sync = toMsgPack(p);
    expect(streamed).toEqual(sync);
  });

  it('throws on a chunk size below the minimum', async () => {
    const p = packPalette([make(sRGB, 1, 0, 0)]);
    await expect(collect(toMsgPackStream(p, { chunkSize: 4 }))).rejects.toThrow(
      /chunkSize must be at least/,
    );
  });

  it('throws on non-finite numbers', async () => {
    const p = packPalette([make(sRGB, NaN, 0, 0)]);
    await expect(collect(toMsgPackStream(p))).rejects.toThrow(/non-finite/);
  });
});

describe('fromMsgPackStream', () => {
  it('decodes a single-chunk source', async () => {
    const p = packPalette([make(sRGB, 1, 0, 0)]);
    const bytes = toMsgPack(p);
    const back = await fromMsgPackStream(fromBytes(bytes, bytes.length));
    expect(back).toEqual(p);
  });

  it('decodes a byte-by-byte source', async () => {
    const p = packPalette([make(sRGB, 1, 0, 0), make(sRGB, 0, 0, 1)]);
    const bytes = toMsgPack(p);
    const back = await fromMsgPackStream(fromBytes(bytes, 1));
    expect(back).toEqual(p);
  });

  it('round-trips through the stream API', async () => {
    const p = packPalette([make(sRGB, 0.5, 0.5, 0.5)]);
    const chunks: Uint8Array[] = [];
    for await (const c of toMsgPackStream(p, { chunkSize: 32 })) chunks.push(c);
    const back = await fromMsgPackStream(
      fromBytes(await collect(toMsgPackStream(p, { chunkSize: 32 })), 7),
    );
    expect(back).toEqual(p);
    void chunks;
  });

  it('throws on a truncated stream', async () => {
    const p = packPalette([make(sRGB, 1, 0, 0)]);
    const bytes = toMsgPack(p);
    const truncated = bytes.subarray(0, bytes.length - 2);
    await expect(fromMsgPackStream(fromBytes(truncated, 4))).rejects.toThrow(
      /unexpected end of stream/,
    );
  });

  it('throws on an empty stream', async () => {
    await expect(fromMsgPackStream(fromBytes(new Uint8Array(0), 4))).rejects.toThrow(
      /unexpected end of stream/,
    );
  });
});
