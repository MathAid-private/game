/**
 * @fileoverview MessagePack serialization.
 *
 * @summary
 * Provides `toMsgPack` and `fromMsgPack`. The implementation covers
 * the subset of MessagePack the serializer uses. For a full-featured
 * library, use `@msgpack/msgpack` instead.
 *
 * @description
 * MessagePack is a binary format. It uses about 60 percent of the
 * space of JSON for the same data. The encoder writes only the types
 * the serializer produces: nil, booleans, numbers, strings, arrays,
 * and objects.
 *
 * ```text
 *   Type      First byte      Extra bytes
 *   ----      ----------      -----------
 *   nil       0xc0            none
 *   false     0xc2            none
 *   true      0xc3            none
 *   uint8     0xcc            1
 *   uint16    0xcd            2
 *   uint32    0xce            4
 *   int8      0xd0            1
 *   int16     0xd1            2
 *   int32     0xd2            4
 *   float64   0xcb            8
 *   fixstr    0xa0-0xbf       length bytes
 *   str8      0xd9            1 + length
 *   str16     0xda            2 + length
 *   fixarray  0x90-0x9f       elements
 *   array16   0xdc            2 + elements
 *   fixmap    0x80-0x8f       pairs
 *   map16     0xde            2 + pairs
 * ```
 *
 * @see {@link https://github.com/msgpack/msgpack/blob/master/spec.md} MessagePack spec
 *
 * @author MathAid
 */

import type { Serializable } from './types';

// -----------------------------------------------------------------
//  Encoder
// -----------------------------------------------------------------

/**
 * @summary
 * Encode a `Serializable` to a `Uint8Array`.
 *
 * @description
 * The encoder writes the value and returns the bytes.
 *
 * @param input - The palette or gradient.
 * @returns A `Uint8Array` with the MessagePack-encoded data.
 *
 * @example
 * const bytes = toMsgPack(packPalette([make(sRGB, 1, 0, 0)]));
 */
export function toMsgPack(input: Serializable): Uint8Array {
  const writer = new Writer(256);
  encodeValue(writer, input);
  return writer.toBytes();
}

class Writer {
  private buf: Uint8Array;
  private len = 0;

  constructor(capacity: number) {
    this.buf = new Uint8Array(capacity);
  }

  private ensure(n: number): void {
    if (this.len + n <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.len + n) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf);
    this.buf = next;
  }

  byte(b: number): void {
    this.ensure(1);
    this.buf[this.len++] = b & 0xff;
  }

  bytes(bs: Uint8Array): void {
    this.ensure(bs.length);
    this.buf.set(bs, this.len);
    this.len += bs.length;
  }

  u16(v: number): void {
    this.ensure(2);
    this.buf[this.len++] = (v >>> 8) & 0xff;
    this.buf[this.len++] = v & 0xff;
  }

  u32(v: number): void {
    this.ensure(4);
    this.buf[this.len++] = (v >>> 24) & 0xff;
    this.buf[this.len++] = (v >>> 16) & 0xff;
    this.buf[this.len++] = (v >>> 8) & 0xff;
    this.buf[this.len++] = v & 0xff;
  }

  f64(v: number): void {
    this.ensure(8);
    new DataView(this.buf.buffer, this.buf.byteOffset + this.len, 8).setFloat64(0, v, false);
    this.len += 8;
  }

  toBytes(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

function encodeValue(w: Writer, v: unknown): void {
  if (v === null || v === undefined) {
    w.byte(0xc0);
    return;
  }
  if (v === true) {
    w.byte(0xc3);
    return;
  }
  if (v === false) {
    w.byte(0xc2);
    return;
  }
  if (typeof v === 'number') {
    encodeNumber(w, v);
    return;
  }
  if (typeof v === 'string') {
    encodeString(w, v);
    return;
  }
  if (Array.isArray(v)) {
    encodeArray(w, v);
    return;
  }
  if (typeof v === 'object') {
    encodeMap(w, v as Record<string, unknown>);
    return;
  }
  throw new Error(`toMsgPack: cannot encode type ${typeof v}.`);
}

function encodeNumber(w: Writer, v: number): void {
  if (!Number.isFinite(v)) {
    throw new Error(`toMsgPack: non-finite number ${v}.`);
  }
  if (Number.isInteger(v)) {
    if (v >= 0 && v <= 0x7f) {
      w.byte(v);
      return;
    }
    if (v >= -32 && v < 0) {
      w.byte(0xe0 | (v + 32));
      return;
    }
    if (v >= 0 && v <= 0xff) {
      w.byte(0xcc);
      w.byte(v);
      return;
    }
    if (v >= 0 && v <= 0xffff) {
      w.byte(0xcd);
      w.u16(v);
      return;
    }
    if (v >= 0 && v <= 0xffffffff) {
      w.byte(0xce);
      w.u32(v);
      return;
    }
    if (v >= -0x80 && v <= 0x7f) {
      w.byte(0xd0);
      w.byte(v & 0xff);
      return;
    }
    if (v >= -0x8000 && v <= 0x7fff) {
      w.byte(0xd1);
      w.u16(v & 0xffff);
      return;
    }
    if (v >= -0x80000000 && v <= 0x7fffffff) {
      w.byte(0xd2);
      w.u32(v >>> 0);
      return;
    }
  }
  w.byte(0xcb);
  w.f64(v);
}

function encodeString(w: Writer, s: string): void {
  const bytes = new TextEncoder().encode(s);
  const len = bytes.length;
  if (len <= 31) {
    w.byte(0xa0 | len);
  } else if (len <= 0xff) {
    w.byte(0xd9);
    w.byte(len);
  } else if (len <= 0xffff) {
    w.byte(0xda);
    w.u16(len);
  } else {
    throw new Error(`toMsgPack: string too long (${len} bytes).`);
  }
  w.bytes(bytes);
}

function encodeArray(w: Writer, a: ReadonlyArray<unknown>): void {
  const len = a.length;
  if (len <= 15) {
    w.byte(0x90 | len);
  } else if (len <= 0xffff) {
    w.byte(0xdc);
    w.u16(len);
  } else {
    throw new Error(`toMsgPack: array too long (${len} elements).`);
  }
  for (const v of a) encodeValue(w, v);
}

function encodeMap(w: Writer, m: Record<string, unknown>): void {
  const keys = Object.keys(m).filter((k) => m[k] !== undefined);
  const len = keys.length;
  if (len <= 15) {
    w.byte(0x80 | len);
  } else if (len <= 0xffff) {
    w.byte(0xde);
    w.u16(len);
  } else {
    throw new Error(`toMsgPack: map too long (${len} pairs).`);
  }
  for (const k of keys) {
    encodeString(w, k);
    encodeValue(w, m[k]);
  }
}

// -----------------------------------------------------------------
//  Decoder
// -----------------------------------------------------------------

/**
 * @summary
 * Decode a MessagePack byte array back to a `Serializable`.
 *
 * @description
 * The decoder reads the bytes and rebuilds the value. The result is
 * the same shape as the input to `toMsgPack`.
 *
 * @param data - The MessagePack bytes.
 * @returns The parsed value.
 *
 * @throws {Error} When the bytes are malformed.
 *
 * @example
 * const parsed = fromMsgPack(toMsgPack(palette));
 */
export function fromMsgPack(data: Uint8Array): Serializable {
  const reader = new Reader(data);
  const value = decodeValue(reader);
  return value as Serializable;
}

// -----------------------------------------------------------------
//  Streaming encoder
// -----------------------------------------------------------------

/**
 * @summary
 * Options for the streaming encoder.
 *
 * @description
 * `chunkSize` sets the size of each yielded `Uint8Array`. The default
 * is 64 KiB. Smaller chunks give finer backpressure control at a
 * slight throughput cost. Larger chunks do the reverse.
 */
export interface MsgPackStreamOptions {
  /** The target chunk size in bytes. Defaults to 65536. */
  readonly chunkSize?: number;
}

/**
 * @summary
 * Stream-encode a `Serializable` to a sequence of `Uint8Array`.
 *
 * @description
 * The function yields the MessagePack bytes in chunks. The consumer
 * can pipe the chunks to a file, a socket, or any sink that accepts
 * `Uint8Array`.
 *
 * The encoder runs on a microtask. It pushes chunks onto a queue. The
 * generator yields from the queue. When the queue is empty and the
 * encoder is still running, the generator awaits the next chunk. This
 * gives the consumer backpressure without unbounded buffering in the
 * common case.
 *
 * @param input - The palette or gradient.
 * @param opts - Optional chunk size.
 * @returns An async generator of `Uint8Array` chunks.
 *
 * @throws {Error} When a channel value is not finite.
 *
 * @example
 * ```ts
 * for await (const chunk of toMsgPackStream(palette)) {
 *   await sink.write(chunk);
 * }
 * ```
 * 
 * #### Why async generator, not a sink function
 * An async generator composes with the platform's stream adapters.
 * @example
 * ```ts
 * // Node
 * import { Readable } from 'node:stream';
 * import { pipeline } from 'node:stream/promises';
 * import { createWriteStream } from 'node:fs';
 * 
 * await pipeline(
 *   Readable.from(toMsgPackStream(palette)),
 *   createWriteStream('palette.msgpack'),
 * );
 * 
 * // Browser (File System Access API)
 * const handle = await window.showSaveFilePicker();
 * const writable = await handle.createWritable();
 * for await (const chunk of toMsgPackStream(palette)) {
 *   await writable.write(chunk);
 * }
 * await writable.close();
 * 
 * // Decoder, Node
 * import { createReadStream } from 'node:fs';
 * const back = await fromMsgPackStream(createReadStream('palette.msgpack'));
 * 
 * // Decoder, browser
 * const file = await (await window.showOpenFilePicker())[0].getFile();
 * const back = await fromMsgPackStream(file.stream());
 * ```
 * A sink-function design `(await toMsgPackStream(input, writer))` would need
 * a Node-specific `Writable` shim or a Web Streams `WritableStream` shim.
 * The async generator works everywhere.
 */
export async function* toMsgPackStream(
  input: Serializable,
  opts: MsgPackStreamOptions = {},
): AsyncGenerator<Uint8Array, void, void> {
  const chunkSize = opts.chunkSize ?? 65536;
  if (chunkSize < 16) {
    throw new Error(`toMsgPackStream: chunkSize must be at least 16, got ${chunkSize}.`);
  }

  const queue: Uint8Array[] = [];
  let resolveWait: (() => void) | null = null;
  let encoderError: Error | null = null;
  let encoderDone = false;

  const notify = (): void => {
    if (resolveWait) {
      const r = resolveWait;
      resolveWait = null;
      r();
    }
  };
  
  const MAX_QUEUE = 64;
  // In the sink's write:
  const sink: StreamSink = {
    async write(chunk) {
      while (queue.length >= MAX_QUEUE) {
        await new Promise<void>((r) => {
          resolveWait = r;
        });
      }
      queue.push(chunk);
      notify();
    },
  };

  queueMicrotask(async () => {
    const cs = new ChunkedSink(chunkSize, sink);
    try {
      await encodeValueStream(cs, input);
      await cs.end();
    } catch (e) {
      encoderError = e as Error;
    } finally {
      encoderDone = true;
      notify();
    }
  });

  while (true) {
    if (queue.length > 0) {
      yield queue.shift()!;
      continue;
    }
    if (encoderError) throw encoderError;
    if (encoderDone) return;
    await new Promise<void>((r) => {
      resolveWait = r;
    });
  }
}

/**
 * @summary
 * A sink for streaming bytes.
 *
 * @description
 * The encoder calls `write` when its internal buffer fills. The write
 * may return a promise. The encoder awaits it before continuing.
 */
interface StreamSink {
  write(chunk: Uint8Array): void | Promise<void>;
}

/**
 * @summary
 * A buffered writer for the streaming encoder.
 *
 * @description
 * The writer accumulates bytes in a fixed-size buffer. When the buffer
 * fills, it flushes to the sink. The `end` method flushes the tail.
 */
class ChunkedSink {
  private buf: Uint8Array;
  private pos = 0;
  private readonly out: StreamSink;

  constructor(chunkSize: number, out: StreamSink) {
    this.buf = new Uint8Array(chunkSize);
    this.out = out;
  }

  async byte(b: number): Promise<void> {
    if (this.pos >= this.buf.length) await this.flush();
    this.buf[this.pos++] = b & 0xff;
  }

  async bytes(bs: Uint8Array): Promise<void> {
    let off = 0;
    while (off < bs.length) {
      if (this.pos >= this.buf.length) await this.flush();
      const room = this.buf.length - this.pos;
      const take = Math.min(room, bs.length - off);
      this.buf.set(bs.subarray(off, off + take), this.pos);
      this.pos += take;
      off += take;
    }
  }

  async u16(v: number): Promise<void> {
    await this.byte((v >>> 8) & 0xff);
    await this.byte(v & 0xff);
  }

  async u32(v: number): Promise<void> {
    await this.byte((v >>> 24) & 0xff);
    await this.byte((v >>> 16) & 0xff);
    await this.byte((v >>> 8) & 0xff);
    await this.byte(v & 0xff);
  }

  async f64(v: number): Promise<void> {
    const tmp = new Uint8Array(8);
    new DataView(tmp.buffer).setFloat64(0, v, false);
    await this.bytes(tmp);
  }

  private async flush(): Promise<void> {
    if (this.pos === 0) return;
    await this.out.write(this.buf.slice(0, this.pos));
    this.pos = 0;
  }

  async end(): Promise<void> {
    await this.flush();
  }
}

async function encodeValueStream(sink: ChunkedSink, v: unknown): Promise<void> {
  if (v === null || v === undefined) {
    await sink.byte(0xc0);
    return;
  }
  if (v === true) {
    await sink.byte(0xc3);
    return;
  }
  if (v === false) {
    await sink.byte(0xc2);
    return;
  }
  if (typeof v === 'number') {
    await encodeNumberStream(sink, v);
    return;
  }
  if (typeof v === 'string') {
    await encodeStringStream(sink, v);
    return;
  }
  if (Array.isArray(v)) {
    await encodeArrayStream(sink, v);
    return;
  }
  if (typeof v === 'object') {
    await encodeMapStream(sink, v as Record<string, unknown>);
    return;
  }
  throw new Error(`toMsgPackStream: cannot encode type ${typeof v}.`);
}

async function encodeNumberStream(sink: ChunkedSink, v: number): Promise<void> {
  if (!Number.isFinite(v)) {
    throw new Error(`toMsgPackStream: non-finite number ${v}.`);
  }
  if (Number.isInteger(v)) {
    if (v >= 0 && v <= 0x7f) {
      await sink.byte(v);
      return;
    }
    if (v >= -32 && v < 0) {
      await sink.byte(0xe0 | (v + 32));
      return;
    }
    if (v >= 0 && v <= 0xff) {
      await sink.byte(0xcc);
      await sink.byte(v);
      return;
    }
    if (v >= 0 && v <= 0xffff) {
      await sink.byte(0xcd);
      await sink.u16(v);
      return;
    }
    if (v >= 0 && v <= 0xffffffff) {
      await sink.byte(0xce);
      await sink.u32(v);
      return;
    }
    if (v >= -0x80 && v <= 0x7f) {
      await sink.byte(0xd0);
      await sink.byte(v & 0xff);
      return;
    }
    if (v >= -0x8000 && v <= 0x7fff) {
      await sink.byte(0xd1);
      await sink.u16(v & 0xffff);
      return;
    }
    if (v >= -0x80000000 && v <= 0x7fffffff) {
      await sink.byte(0xd2);
      await sink.u32(v >>> 0);
      return;
    }
  }
  await sink.byte(0xcb);
  await sink.f64(v);
}

async function encodeStringStream(sink: ChunkedSink, s: string): Promise<void> {
  const bytes = new TextEncoder().encode(s);
  const len = bytes.length;
  if (len <= 31) {
    await sink.byte(0xa0 | len);
  } else if (len <= 0xff) {
    await sink.byte(0xd9);
    await sink.byte(len);
  } else if (len <= 0xffff) {
    await sink.byte(0xda);
    await sink.u16(len);
  } else {
    throw new Error(`toMsgPackStream: string too long (${len} bytes).`);
  }
  await sink.bytes(bytes);
}

async function encodeArrayStream(sink: ChunkedSink, a: ReadonlyArray<unknown>): Promise<void> {
  const len = a.length;
  if (len <= 15) {
    await sink.byte(0x90 | len);
  } else if (len <= 0xffff) {
    await sink.byte(0xdc);
    await sink.u16(len);
  } else {
    throw new Error(`toMsgPackStream: array too long (${len} elements).`);
  }
  for (const v of a) await encodeValueStream(sink, v);
}

async function encodeMapStream(sink: ChunkedSink, m: Record<string, unknown>): Promise<void> {
  const keys = Object.keys(m).filter((k) => m[k] !== undefined);
  const len = keys.length;
  if (len <= 15) {
    await sink.byte(0x80 | len);
  } else if (len <= 0xffff) {
    await sink.byte(0xde);
    await sink.u16(len);
  } else {
    throw new Error(`toMsgPackStream: map too long (${len} pairs).`);
  }
  for (const k of keys) {
    await encodeStringStream(sink, k);
    await encodeValueStream(sink, m[k]);
  }
}

// -----------------------------------------------------------------
//  Streaming decoder
// -----------------------------------------------------------------

/**
 * @summary
 * Decode a MessagePack byte stream back to a `Serializable`.
 *
 * @description
 * The function accepts any `AsyncIterable<Uint8Array>`. That covers
 * Node `Readable` streams, Web `ReadableStream`, file handles on the
 * File System Access API, and any user-supplied async generator.
 *
 * The reader accumulates bytes as needed. It pulls the next chunk
 * only when its current buffer is exhausted.
 *
 * @param source - The input bytes.
 * @returns The parsed value.
 *
 * @throws {Error} When the stream ends mid-value or the bytes are
 *   malformed.
 *
 * @example
 * import { createReadStream } from 'node:fs';
 * const back = await fromMsgPackStream(createReadStream('palette.msgpack'));
 * 
 * @see {@linkcode toMsgPackStream}
 */
export async function fromMsgPackStream(source: AsyncIterable<Uint8Array>): Promise<Serializable> {
  const reader = new AsyncReader(source);
  const value = await decodeValueStream(reader);
  return value as Serializable;
}

/**
 * @summary
 * A pull-based reader over an async iterable of chunks.
 *
 * @description
 * The reader holds the current chunk and an offset. When the offset
 * reaches the end of the chunk, the reader pulls the next chunk from
 * the source. The source is not pulled until needed. This gives
 * natural backpressure.
 */
class AsyncReader {
  private iter: AsyncIterator<Uint8Array>;
  private current: Uint8Array | null = null;
  private pos = 0;

  constructor(source: AsyncIterable<Uint8Array>) {
    this.iter = source[Symbol.asyncIterator]();
  }

  async byte(): Promise<number> {
    if (!this.current || this.pos >= this.current.length) {
      await this.pull();
    }
    return this.current![this.pos++]!;
  }

/*   async peek(): Promise<number> {
    if (!this.current || this.pos >= this.current.length) {
      await this.pull();
    }
    return this.current![this.pos]!;
  } */

  async bytes(n: number): Promise<Uint8Array> {
    const out = new Uint8Array(n);
    let written = 0;
    while (written < n) {
      if (!this.current || this.pos >= this.current.length) {
        await this.pull();
      }
      const avail = this.current!.length - this.pos;
      const take = Math.min(avail, n - written);
      out.set(this.current!.subarray(this.pos, this.pos + take), written);
      this.pos += take;
      written += take;
    }
    return out;
  }

  async u16(): Promise<number> {
    const a = await this.byte();
    const b = await this.byte();
    return (a << 8) | b;
  }

  async u32(): Promise<number> {
    const a = await this.byte();
    const b = await this.byte();
    const c = await this.byte();
    const d = await this.byte();
    return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
  }

  async f64(): Promise<number> {
    const b = await this.bytes(8);
    return new DataView(b.buffer, b.byteOffset, 8).getFloat64(0, false);
  }

  private async pull(): Promise<void> {
    const r = await this.iter.next();
    if (r.done) {
      throw new Error('fromMsgPackStream: unexpected end of stream.');
    }
    this.current = r.value;
    this.pos = 0;
  }
}

async function decodeValueStream(r: AsyncReader): Promise<unknown> {
  const first = await r.byte();   // consumes the header byte

  if (first <= 0x7f) return first;
  if (first >= 0xe0) return first - 0x100;
  if (first >= 0x80 && first <= 0x8f) return decodeMapStream(r, first & 0x0f);
  if (first >= 0x90 && first <= 0x9f) return decodeArrayStream(r, first & 0x0f);
  if (first >= 0xa0 && first <= 0xbf) return decodeStringStream(r, first & 0x1f);

  switch (first) {
    case 0xc0: return null;
    case 0xc2: return false;
    case 0xc3: return true;
    case 0xcb: return r.f64();
    case 0xcc: return r.byte();
    case 0xcd: return r.u16();
    case 0xce: return r.u32();
    case 0xd0: {
      const v = await r.byte();
      return v < 0x80 ? v : v - 0x100;
    }
    case 0xd1: {
      const v = await r.u16();
      return v < 0x8000 ? v : v - 0x10000;
    }
    case 0xd2: return (await r.u32()) | 0;
    case 0xd9: return decodeStringStream(r, await r.byte());
    case 0xda: return decodeStringStream(r, await r.u16());
    case 0xdc: return decodeArrayStream(r, await r.u16());
    case 0xde: return decodeMapStream(r, await r.u16());
    default:
      throw new Error(`fromMsgPackStream: unknown byte 0x${first.toString(16)}.`);
  }
}

async function decodeStringStream(r: AsyncReader, len: number): Promise<string> {
  return new TextDecoder().decode(await r.bytes(len));
}

async function decodeArrayStream(r: AsyncReader, len: number): Promise<unknown[]> {
  const out: unknown[] = new Array(len);
  for (let i = 0; i < len; i++) out[i] = await decodeValueStream(r);
  return out;
}

async function decodeMapStream(r: AsyncReader, len: number): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < len; i++) {
    const k = await decodeValueStream(r);
    if (typeof k !== 'string') {
      throw new Error('fromMsgPackStream: map key is not a string.');
    }
    out[k] = await decodeValueStream(r);
  }
  return out;
}

class Reader {
  private pos = 0;
  constructor(private readonly buf: Uint8Array) {}

  byte(): number {
    if (this.pos >= this.buf.length) {
      throw new Error('fromMsgPack: unexpected end of data.');
    }
    return this.buf[this.pos++]!;
  }

/*   peek(): number {
    if (this.pos >= this.buf.length) {
      throw new Error('fromMsgPack: unexpected end of data.');
    }
    return this.buf[this.pos]!;
  } */

  bytes(n: number): Uint8Array {
    if (this.pos + n > this.buf.length) {
      throw new Error('fromMsgPack: unexpected end of data.');
    }
    const out = this.buf.slice(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }

  u16(): number {
    const a = this.byte();
    const b = this.byte();
    return (a << 8) | b;
  }

  u32(): number {
    const a = this.byte();
    const b = this.byte();
    const c = this.byte();
    const d = this.byte();
    return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
  }

  f64(): number {
    const b = this.bytes(8);
    return new DataView(b.buffer, b.byteOffset, 8).getFloat64(0, false);
  }
}

function decodeValue(r: Reader): unknown {
  const first = r.byte();   // consumes the header byte

  if (first <= 0x7f) return first;
  if (first >= 0xe0) return first - 0x100;
  if (first >= 0x80 && first <= 0x8f) return decodeMap(r, first & 0x0f);
  if (first >= 0x90 && first <= 0x9f) return decodeArray(r, first & 0x0f);
  if (first >= 0xa0 && first <= 0xbf) return decodeString(r, first & 0x1f);

  switch (first) {
    case 0xc0: return null;
    case 0xc2: return false;
    case 0xc3: return true;
    case 0xcb: return r.f64();
    case 0xcc: return r.byte();
    case 0xcd: return r.u16();
    case 0xce: return r.u32();
    case 0xd0: {
      const v = r.byte();
      return v < 0x80 ? v : v - 0x100;
    }
    case 0xd1: {
      const v = r.u16();
      return v < 0x8000 ? v : v - 0x10000;
    }
    case 0xd2: return r.u32() | 0;
    case 0xd9: return decodeString(r, r.byte());
    case 0xda: return decodeString(r, r.u16());
    case 0xdc: return decodeArray(r, r.u16());
    case 0xde: return decodeMap(r, r.u16());
    default:
      throw new Error(`fromMsgPack: unknown byte 0x${first.toString(16)}.`);
  }
}

function decodeString(r: Reader, len: number): string {
  return new TextDecoder().decode(r.bytes(len));
}

function decodeArray(r: Reader, len: number): unknown[] {
  const out: unknown[] = new Array(len);
  for (let i = 0; i < len; i++) out[i] = decodeValue(r);
  return out;
}

function decodeMap(r: Reader, len: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < len; i++) {
    const k = decodeValue(r);
    if (typeof k !== 'string') {
      throw new Error('fromMsgPack: map key is not a string.');
    }
    out[k] = decodeValue(r);
  }
  return out;
}
