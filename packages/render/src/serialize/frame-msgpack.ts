/**
 * @fileoverview
 * @summary MessagePack codec for render frames.
 *
 * @description
 * Provides the pair {@linkcode toFrameMsgPack} and
 * {@linkcode fromFrameMsgPack} for the byte form, and
 * {@linkcode toFrameMsgPackStream} and {@linkcode fromFrameMsgPackStream}
 * for the streaming form. The codec reuses the MessagePack encoder from
 * the color module so the two modules share one wire format.
 *
 * ```text
 *   IFrame  --frameToSerialized-->  SerializedFrame  --toMsgPack-->  Uint8Array
 *   Uint8Array  --decodeAny-->  unknown  --validate-->  SerializedFrame
 *              --frameFromSerialized-->  IFrame
 * ```
 *
 * The output is smaller than JSON for the same frame. The saving comes
 * from three sources. Short strings share a one-byte header. Small
 * integers use one byte instead of up to fifteen characters. Object keys
 * are encoded once. A frame with many repeated commands sees the largest
 * saving.
 *
 * @example
 * Example 1: Round trip through bytes
 * ```ts
 * import { FrameBuilder, make, makeSolid, rect, sRGB, toFrameMsgPack, fromFrameMsgPack } from './index';
 *
 * const b = new FrameBuilder();
 * b.clear(makeSolid(make(sRGB, 0, 0, 0)));
 * b.fillRect(rect(0, 0, 32, 32), makeSolid(make(sRGB, 1, 0, 0)));
 *
 * const bytes = toFrameMsgPack(b);
 * const back = fromFrameMsgPack(bytes);
 * back.commands.length; // 2
 * ```
 *
 * @example
 * Example 2: Stream to a file
 * ```ts
 * import { createWriteStream } from 'node:fs';
 * import { Readable } from 'node:stream';
 * import { pipeline } from 'node:stream/promises';
 *
 * await pipeline(
 *   Readable.from(toFrameMsgPackStream(builder)),
 *   createWriteStream('frame.msgpack'),
 * );
 * ```
 *
 * @example
 * Example 3: Read a frame from the network
 * ```ts
 * const response = await fetch('/frame.msgpack');
 * const frame = await fromFrameMsgPackStream(response.body!);
 * ```
 *
 * @see {@linkcode SerializedFrame}
 * @see {@linkcode IFrame}
 * @author MathAid
 */

import {
  decodeAny,
  decodeAnyStream,
  toMsgPack,
  toMsgPackStream,
  type MsgPackStreamOptions,
} from '../color/serialize/msgpack';
import { type IFrame } from '../frame';
import {
  frameFromSerialized,
  frameToSerialized,
} from './frame-json';
import { validateSerializedFrame } from './validate';

export type { MsgPackStreamOptions };

/**
 * @summary Encode a runtime frame to MessagePack bytes.
 *
 * @description
 * Serializes the frame to its JSON-compatible form, then encodes that
 * form with the MessagePack encoder from the color module. The output is
 * a single `Uint8Array` that holds the entire frame.
 *
 * @example
 * Example 1: Encode a frame
 * ```ts
 * const bytes = toFrameMsgPack(builder);
 * bytes.length; // smaller than the JSON equivalent
 * ```
 *
 * @example 2: Store in a `Blob`
 * ```ts
 * const blob = new Blob([toFrameMsgPack(builder)]);
 * ```
 *
 * @example 3: Compare against JSON
 * ```ts
 * const json = toFrameJSON(builder).length;
 * const pack = toFrameMsgPack(builder).length;
 * console.log(pack < json); // true
 * ```
 *
 * @param {IFrame} frame The runtime frame.
 * @returns {Uint8Array} The MessagePack bytes.
 * @author MathAid
 */
export function toFrameMsgPack(frame: IFrame): Uint8Array {
  return toMsgPack(frameToSerialized(frame));
}

/**
 * @summary Decode MessagePack bytes to a runtime frame.
 *
 * @description
 * Decodes the bytes to an unknown value, validates the value against
 * the frame schema, and rebuilds the runtime frame. A malformed byte
 * sequence throws from the decoder. A valid byte sequence with an
 * invalid frame shape throws from the validator.
 *
 * @example
 * Example 1: Decode a frame
 * ```ts
 * const back = fromFrameMsgPack(bytes);
 * back.commands.length;
 * ```
 *
 * @example 2: Handle a malformed payload
 * ```ts
 * try {
 *   const back = fromFrameMsgPack(untrustedBytes);
 * } catch (e) {
 *   // Error from the decoder or the validator.
 * }
 * ```
 *
 * @param {Uint8Array} data The MessagePack bytes.
 * @returns {IFrame} The runtime frame.
 * @throws {Error} When the bytes are malformed or the frame shape is
 * invalid.
 * @author MathAid
 */
export function fromFrameMsgPack(data: Uint8Array): IFrame {
  const raw = decodeAny(data);
  validateSerializedFrame(raw);
  return frameFromSerialized(raw);
}

/**
 * @summary Stream-encode a runtime frame to MessagePack bytes.
 *
 * @description
 * Yields the encoded frame in chunks. The consumer can pipe the chunks
 * to a file, a socket, or any sink that accepts `Uint8Array`. The
 * `chunkSize` option sets the target chunk size. The default is 64 KiB.
 *
 * @example
 * Example 1: Consume with a for-await loop
 * ```ts
 * for await (const chunk of toFrameMsgPackStream(builder)) {
 *   await sink.write(chunk);
 * }
 * ```
 *
 * @example 2: Pipe to a Node stream
 * ```ts
 * import { Readable } from 'node:stream';
 * import { pipeline } from 'node:stream/promises';
 * import { createWriteStream } from 'node:fs';
 *
 * await pipeline(
 *   Readable.from(toFrameMsgPackStream(builder)),
 *   createWriteStream('frame.msgpack'),
 * );
 * ```
 *
 * @example 3: Custom chunk size
 * ```ts
 * const gen = toFrameMsgPackStream(builder, { chunkSize: 32 * 1024 });
 * ```
 *
 * @param {IFrame} frame The runtime frame.
 * @param {MsgPackStreamOptions} opts Optional chunk size.
 * @returns {AsyncGenerator<Uint8Array, void, void>} The chunks.
 * @author MathAid
 */
export async function* toFrameMsgPackStream(
  frame: IFrame,
  opts?: MsgPackStreamOptions,
): AsyncGenerator<Uint8Array, void, void> {
  yield* toMsgPackStream(frameToSerialized(frame), opts);
}

/**
 * @summary Stream-decode a MessagePack source to a runtime frame.
 *
 * @description
 * Accepts any `AsyncIterable<Uint8Array>`. That covers Node `Readable`
 * streams, Web `ReadableStream` values, file handles on the File System
 * Access API, and user-supplied async generators. The reader pulls the
 * next chunk only when its buffer is exhausted. This gives natural
 * backpressure.
 *
 * @example
 * Example 1: Decode a Node stream
 * ```ts
 * import { createReadStream } from 'node:fs';
 * const back = await fromFrameMsgPackStream(createReadStream('frame.msgpack'));
 * ```
 *
 * @example 2: Decode a Web stream
 * ```ts
 * const response = await fetch('/frame.msgpack');
 * const back = await fromFrameMsgPackStream(response.body!);
 * ```
 *
 * @example 3: Decode a byte-by-byte source
 * ```ts
 * async function* fromBytes(bytes: Uint8Array, size: number) {
 *   for (let i = 0; i < bytes.length; i += size) {
 *     yield bytes.subarray(i, Math.min(i + size, bytes.length));
 *   }
 * }
 * const back = await fromFrameMsgPackStream(fromBytes(bytes, 1));
 * ```
 *
 * @param {AsyncIterable<Uint8Array>} source The input bytes.
 * @returns {Promise<IFrame>} The runtime frame.
 * @throws {Error} When the stream ends mid-value or the bytes are
 * malformed.
 * @author MathAid
 */
export async function fromFrameMsgPackStream(
  source: AsyncIterable<Uint8Array>,
): Promise<IFrame> {
  const raw = await decodeAnyStream(source);
  validateSerializedFrame(raw);
  return frameFromSerialized(raw);
}