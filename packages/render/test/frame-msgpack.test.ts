/**
 * @fileoverview
 * @summary Tests for the MessagePack frame codec.
 *
 * @description
 * Covers the round trip through bytes, the size comparison against JSON,
 * the streaming encoder and decoder, the byte-by-byte decoder, the
 * golden bytes for an empty frame, and the error cases.
 *
 * @see {@linkcode toFrameMsgPack}
 * @see {@linkcode fromFrameMsgPack}
 * @author MathAid
 */

import {
  Display_P3,
  FrameBuilder,
  fromFrameMsgPack,
  fromFrameMsgPackStream,
  make,
  makeCircle,
  makePath,
  makeSolid,
  point,
  rect,
  sRGB,
  toFrameJSON,
  toFrameMsgPack,
  toFrameMsgPackStream,
} from '@games/render';
import { describe, expect, it } from 'vitest';

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

async function* fromBytes(bytes: Uint8Array, size: number): AsyncGenerator<Uint8Array> {
  for (let i = 0; i < bytes.length; i += size) {
    yield bytes.subarray(i, Math.min(i + size, bytes.length));
  }
}

describe('round trip through bytes', () => {
  it('handles an empty frame', () => {
    const b = new FrameBuilder();
    const back = fromFrameMsgPack(toFrameMsgPack(b));
    expect(back.commands).toEqual([]);
  });

  it('handles a clear with a paint', () => {
    const b = new FrameBuilder();
    b.clear(makeSolid(make(sRGB, 0, 0, 0)));
    const back = fromFrameMsgPack(toFrameMsgPack(b));
    expect(back.commands[0]?.kind).toBe('clear');
  });

  it('handles a clear with no paint', () => {
    const b = new FrameBuilder();
    b.clear();
    const back = fromFrameMsgPack(toFrameMsgPack(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'clear') {
      expect(cmd.paint).toBeUndefined();
    }
  });

  it('handles set-fill with null', () => {
    const b = new FrameBuilder();
    b.setFill(null);
    const back = fromFrameMsgPack(toFrameMsgPack(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'set-fill') {
      expect(cmd.paint).toBeNull();
    }
  });

  it('handles set-stroke with a full style', () => {
    const b = new FrameBuilder();
    b.setStroke({
      paint: makeSolid(make(sRGB, 1, 1, 1)),
      width: 2,
      cap: 'round',
      join: 'round',
      miterLimit: 5,
      dash: [4, 4],
      dashOffset: 2,
    });
    const back = fromFrameMsgPack(toFrameMsgPack(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'set-stroke' && cmd.stroke) {
      expect(cmd.stroke.width).toBe(2);
      expect(cmd.stroke.cap).toBe('round');
      expect(cmd.stroke.join).toBe('round');
      expect(cmd.stroke.miterLimit).toBe(5);
      expect(cmd.stroke.dash).toEqual([4, 4]);
      expect(cmd.stroke.dashOffset).toBe(2);
    }
  });

  it('handles set-transform', () => {
    const b = new FrameBuilder();
    b.setTransform([1, 0, 0, 1, 100, 50]);
    const back = fromFrameMsgPack(toFrameMsgPack(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'set-transform') {
      expect(cmd.transform).toEqual([1, 0, 0, 1, 100, 50]);
    }
  });

  it('handles a filled rect', () => {
    const b = new FrameBuilder();
    b.fillRect(rect(0, 0, 32, 32), makeSolid(make(sRGB, 1, 0, 0)));
    const back = fromFrameMsgPack(toFrameMsgPack(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'fill-shape' && cmd.shape.kind === 'rect') {
      expect(cmd.shape.rect.width).toBe(32);
    }
  });

  it('handles a circle', () => {
    const b = new FrameBuilder();
    b.fillCircle(point(50, 50), 10, makeSolid(make(sRGB, 1, 0, 0)));
    const back = fromFrameMsgPack(toFrameMsgPack(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'fill-shape' && cmd.shape.kind === 'ellipse') {
      expect(cmd.shape.radiusX).toBe(10);
    }
  });

  it('handles a path with every segment kind', () => {
    const b = new FrameBuilder();
    b.fill(
      makePath([
        { kind: 'move', to: point(0, 0) },
        { kind: 'line', to: point(10, 0) },
        { kind: 'quadratic', control: point(15, 10), to: point(20, 0) },
        {
          kind: 'cubic',
          c1: point(0, 5),
          c2: point(10, 5),
          to: point(20, 10),
        },
        {
          kind: 'arc',
          rx: 5,
          ry: 5,
          rotation: 0,
          largeArc: false,
          sweep: true,
          to: point(30, 10),
        },
        { kind: 'close' },
      ]),
      makeSolid(make(sRGB, 0, 0, 1)),
    );
    const back = fromFrameMsgPack(toFrameMsgPack(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'fill-shape' && cmd.shape.kind === 'path') {
      expect(cmd.shape.segments.length).toBe(6);
    }
  });

  it('handles a group of shapes', () => {
    const b = new FrameBuilder();
    b.fill(
      {
        kind: 'group',
        shapes: [{ kind: 'rect', rect: rect(0, 0, 10, 10) }, makeCircle(point(20, 5), 5)],
      },
      makeSolid(make(sRGB, 1, 1, 1)),
    );
    const back = fromFrameMsgPack(toFrameMsgPack(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'fill-shape' && cmd.shape.kind === 'group') {
      expect(cmd.shape.shapes.length).toBe(2);
    }
  });

  it('handles text', () => {
    const b = new FrameBuilder();
    b.text('HELLO', point(10, 20), {
      size: 16,
      family: 'sans-serif',
      align: 'center',
      paint: makeSolid(make(sRGB, 1, 1, 1)),
    });
    const back = fromFrameMsgPack(toFrameMsgPack(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'text') {
      expect(cmd.text).toBe('HELLO');
      expect(cmd.style.size).toBe(16);
    }
  });

  it('handles sprite', () => {
    const b = new FrameBuilder();
    b.sprite({ id: 'ship' }, { x: 100, y: 50 });
    const back = fromFrameMsgPack(toFrameMsgPack(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'sprite') {
      expect(cmd.sprite.id).toBe('ship');
      expect(cmd.transform[4]).toBe(100);
    }
  });

  it('handles push and pop', () => {
    const b = new FrameBuilder();
    b.push();
    b.pop();
    const back = fromFrameMsgPack(toFrameMsgPack(b));
    expect(back.commands.map((c) => c.kind)).toEqual(['push', 'pop']);
  });

  it('handles a wide-gamut color', () => {
    const b = new FrameBuilder();
    b.fillRect(rect(0, 0, 10, 10), makeSolid(make(Display_P3, 1, 0.5, 0)));
    const back = fromFrameMsgPack(toFrameMsgPack(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'fill-shape' && cmd.paint) {
      expect(cmd.paint.color._space.id).toBe('Display_P3');
    }
  });

  it('handles a full frame with every command kind', () => {
    const b = new FrameBuilder();
    b.clear(makeSolid(make(sRGB, 0, 0, 0)));
    b.setBackground(makeSolid(make(sRGB, 0.1, 0.1, 0.1)));
    b.setFill(makeSolid(make(sRGB, 1, 0, 0)));
    b.setStroke({ paint: makeSolid(make(sRGB, 1, 1, 1)), width: 2 });
    b.setTransform([1, 0, 0, 1, 10, 20]);
    b.fillRect(rect(0, 0, 10, 10));
    b.strokeRect(rect(0, 0, 10, 10));
    b.clipRect(rect(0, 0, 100, 100));
    b.text('HI', point(0, 0), {});
    b.sprite({ id: 'x' }, { x: 0, y: 0 });
    b.push();
    b.pop();
    const back = fromFrameMsgPack(toFrameMsgPack(b));
    expect(back.commands.map((c) => c.kind)).toEqual([
      'clear',
      'set-background',
      'set-fill',
      'set-stroke',
      'set-transform',
      'fill-shape',
      'stroke-shape',
      'clip',
      'text',
      'sprite',
      'push',
      'pop',
    ]);
  });
});

describe('size comparison against JSON', () => {
  it('is smaller than JSON for an empty frame', () => {
    const b = new FrameBuilder();
    const json = toFrameJSON(b).length;
    const pack = toFrameMsgPack(b).length;
    expect(pack).toBeLessThan(json);
  });

  it('is smaller than JSON for a frame with many repeated commands', () => {
    const b = new FrameBuilder();
    for (let i = 0; i < 20; i++) {
      b.fillRect(rect(i, i, 10, 10), makeSolid(make(sRGB, 1, 0, 0)));
    }
    const json = toFrameJSON(b).length;
    const pack = toFrameMsgPack(b).length;
    expect(pack).toBeLessThan(json * 0.5);
  });

  it('is smaller than JSON for a frame with repeated sprite ids', () => {
    const b = new FrameBuilder();
    for (let i = 0; i < 20; i++) {
      b.sprite({ id: 'invader-a' }, { x: i * 10, y: 0 });
    }
    const json = toFrameJSON(b).length;
    const pack = toFrameMsgPack(b).length;
    expect(pack).toBeLessThan(json * 0.6);
  });
});

describe('streaming encoder', () => {
  it('produces the same bytes as the batch encoder', async () => {
    const b = new FrameBuilder();
    b.clear(makeSolid(make(sRGB, 0, 0, 0)));
    b.fillRect(rect(0, 0, 32, 32), makeSolid(make(sRGB, 1, 0, 0)));
    const sync = toFrameMsgPack(b);
    const streamed = await collect(toFrameMsgPackStream(b));
    expect(streamed).toEqual(sync);
  });

  it('yields multiple chunks for a large frame', async () => {
    const b = new FrameBuilder();
    for (let i = 0; i < 500; i++) {
      b.fillRect(rect(i, 0, 10, 10), makeSolid(make(sRGB, 1, 0, 0)));
    }
    const streamed = await collect(toFrameMsgPackStream(b, { chunkSize: 256 }));
    const sync = toFrameMsgPack(b);
    expect(streamed).toEqual(sync);
  });

  it('throws on a chunk size below the minimum', async () => {
    const b = new FrameBuilder();
    await expect(collect(toFrameMsgPackStream(b, { chunkSize: 4 }))).rejects.toThrow(
      /chunkSize must be at least/,
    );
  });

  it('throws on a non-finite number', async () => {
    const b = new FrameBuilder();
    b.setTransform([1, 0, 0, 1, NaN, 0]);
    await expect(collect(toFrameMsgPackStream(b))).rejects.toThrow(/finite/);
  });
});

describe('streaming decoder', () => {
  it('decodes a single-chunk source', async () => {
    const b = new FrameBuilder();
    b.clear(makeSolid(make(sRGB, 0, 0, 0)));
    const bytes = toFrameMsgPack(b);
    const back = await fromFrameMsgPackStream(fromBytes(bytes, bytes.length));
    expect(back.commands[0]?.kind).toBe('clear');
  });

  it('decodes a byte-by-byte source', async () => {
    const b = new FrameBuilder();
    b.clear(makeSolid(make(sRGB, 0, 0, 0)));
    b.fillRect(rect(0, 0, 32, 32), makeSolid(make(sRGB, 1, 0, 0)));
    b.push();
    b.pop();
    const bytes = toFrameMsgPack(b);
    const back = await fromFrameMsgPackStream(fromBytes(bytes, 1));
    expect(back.commands.map((c) => c.kind)).toEqual(['clear', 'fill-shape', 'push', 'pop']);
  });

  it('decodes a seven-byte-chunk source', async () => {
    const b = new FrameBuilder();
    b.clear(makeSolid(make(sRGB, 0.5, 0.5, 0.5)));
    b.text('HI', point(0, 0), { size: 16 });
    const bytes = toFrameMsgPack(b);
    const back = await fromFrameMsgPackStream(fromBytes(bytes, 7));
    expect(back.commands.length).toBe(2);
  });

  it('round-trips through the stream API', async () => {
    const b = new FrameBuilder();
    b.sprite({ id: 'ship' }, { x: 100, y: 50 });
    const bytes = await collect(toFrameMsgPackStream(b, { chunkSize: 32 }));
    const back = await fromFrameMsgPackStream(fromBytes(bytes, 5));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'sprite') {
      expect(cmd.sprite.id).toBe('ship');
    }
  });

  it('throws on a truncated stream', async () => {
    const b = new FrameBuilder();
    b.clear();
    const bytes = toFrameMsgPack(b);
    const truncated = bytes.subarray(0, bytes.length - 2);
    await expect(fromFrameMsgPackStream(fromBytes(truncated, 4))).rejects.toThrow(
      /unexpected end of stream/,
    );
  });

  it('throws on an empty stream', async () => {
    await expect(fromFrameMsgPackStream(fromBytes(new Uint8Array(0), 4))).rejects.toThrow(
      /unexpected end of stream/,
    );
  });
});

describe('golden bytes', () => {
  it('produces the expected bytes for an empty frame', () => {
    const b = new FrameBuilder();
    const bytes = toFrameMsgPack(b);
    // The encoding of `{ commands: [] }`:
    //   0x81            fixmap with 1 key
    //   0xa8  "commands"  fixstr of length 8
    //   0x90            fixarray with 0 elements
    const expected = new Uint8Array([
      0x81, 0xa8, 0x63, 0x6f, 0x6d, 0x6d, 0x61, 0x6e, 0x64, 0x73, 0x90,
    ]);
    expect(bytes).toEqual(expected);
  });

  it('produces the expected bytes for a single push', () => {
    const b = new FrameBuilder();
    b.push();
    const bytes = toFrameMsgPack(b);
    // { commands: [ { kind: "push" } ] }
    const expected = new Uint8Array([
      0x81, 0xa8, 0x63, 0x6f, 0x6d, 0x6d, 0x61, 0x6e, 0x64, 0x73, 0x91, 0x81, 0xa4, 0x6b, 0x69,
      0x6e, 0x64, 0xa4, 0x70, 0x75, 0x73, 0x68,
    ]);
    expect(bytes).toEqual(expected);
  });
});

describe('error cases', () => {
  it('throws on malformed bytes', () => {
    const bytes = new Uint8Array([0xff, 0xff, 0xff]);
    expect(() => fromFrameMsgPack(bytes)).toThrow();
  });

  it('throws on a valid encoding of an invalid frame', () => {
    // MessagePack for `{ commands: [ { kind: "bogus" } ] }`.
    const bogus = new Uint8Array([
      0x81, 0xa8, 0x63, 0x6f, 0x6d, 0x6d, 0x61, 0x6e, 0x64, 0x73, 0x91, 0x81, 0xa4, 0x6b, 0x69,
      0x6e, 0x64, 0xa5, 0x62, 0x6f, 0x67, 0x75, 0x73,
    ]);
    expect(() => fromFrameMsgPack(bogus)).toThrow(/unknown/);
  });

  it('throws on a color with an unknown space ID', () => {
    const b = new FrameBuilder();
    b.fillRect(rect(0, 0, 10, 10), makeSolid(make(sRGB, 1, 0, 0)));
    const bytes = toFrameMsgPack(b);
    // Flip the space ID by hand. This is not a realistic test but it
    // exercises the codec's color unpack path.
    const text = new TextDecoder().decode(bytes);
    void text;
    // Simpler: pass an already-bad serialized frame through the
    // encoder. The encoder accepts anything the JSON codec produces.
    // Force the error by hand on the decode side.
    const bad = new Uint8Array([
      // { commands: [ { kind: "clear", paint: { kind: "solid",
      //   color: ["NotASpace", 0, 0, 0, 1] } } ] }
      0x81, 0xa8, 0x63, 0x6f, 0x6d, 0x6d, 0x61, 0x6e, 0x64, 0x73, 0x91, 0x84, 0xa4, 0x6b, 0x69,
      0x6e, 0x64, 0xa5, 0x63, 0x6c, 0x65, 0x61, 0x72, 0xa5, 0x70, 0x61, 0x69, 0x6e, 0x74, 0x82,
      0xa4, 0x6b, 0x69, 0x6e, 0x64, 0xa5, 0x73, 0x6f, 0x6c, 0x69, 0x64, 0xa5, 0x63, 0x6f, 0x6c,
      0x6f, 0x72, 0x95, 0xa9, 0x4e, 0x6f, 0x74, 0x41, 0x53, 0x70, 0x61, 0x63, 0x65, 0x00, 0x00,
      0x00, 0x01,
    ]);
    expect(() => fromFrameMsgPack(bad)).toThrow(/space/);
  });
});
