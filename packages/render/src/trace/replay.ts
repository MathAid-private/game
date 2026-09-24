/**
 * @fileoverview
 * @summary Replay a serialized frame on any renderer.
 *
 * @description
 * Provides three helpers. {@linkcode replayJSON} reads a JSON string and
 * renders it. {@linkcode replayMsgPack} reads a MessagePack byte array
 * and renders it. {@linkcode replayFile} inspects the byte prefix and
 * dispatches to the right codec.
 *
 * The helpers wrap {@linkcode fromFrameJSON} and
 * {@linkcode fromFrameMsgPack}. The caller supplies the renderer.
 *
 * ```text
 *   JSON string      --fromFrameJSON-->      IFrame  --renderer.render-->  pixels
 *   MessagePack      --fromFrameMsgPack-->   IFrame  --renderer.render-->  pixels
 *   Uint8Array       --detect-->             one of the above
 * ```
 *
 * @example
 * Example 1: Replay a JSON frame
 * ```ts
 * import { replayJSON } from './trace';
 * replayJSON(text, renderer);
 * ```
 *
 * @example 2: Replay a MessagePack frame
 * ```ts
 * import { replayMsgPack } from './trace';
 * replayMsgPack(bytes, renderer);
 * ```
 *
 * @example 3: Replay from a file
 * ```ts
 * import { readFileSync } from 'node:fs';
 * import { replayFile } from './trace';
 * const bytes = readFileSync('frame.msgpack');
 * replayFile(new Uint8Array(bytes), renderer);
 * ```
 *
 * @see {@linkcode fromFrameJSON}
 * @see {@linkcode fromFrameMsgPack}
 * @author MathAid
 */

import type { IRenderer } from '../renderer';
import { fromFrameJSON, fromFrameMsgPack } from '../serialize';

/**
 * @summary Replay a JSON-encoded frame.
 *
 * @description
 * Parses the text, validates the frame shape, and renders it. A
 * malformed string throws from the codec.
 *
 * @example
 * Example 1: Replay from a string
 * ```ts
 * replayJSON(toFrameJSON(builder), renderer);
 * ```
 *
 * @example 2: Replay from a file
 * ```ts
 * import { readFileSync } from 'node:fs';
 * replayJSON(readFileSync('frame.json', 'utf8'), renderer);
 * ```
 *
 * @param {string} text The JSON string.
 * @param {IRenderer} renderer The renderer.
 * @returns {void}
 * @throws {SyntaxError} When the string is not valid JSON.
 * @throws {Error} When the frame shape is invalid.
 * @author MathAid
 */
export function replayJSON(text: string, renderer: IRenderer): void {
  renderer.render(fromFrameJSON(text));
}

/**
 * @summary Replay a MessagePack-encoded frame.
 *
 * @description
 * Decodes the bytes, validates the frame shape, and renders it. A
 * malformed byte sequence throws from the codec.
 *
 * @example
 * Example 1: Replay from bytes
 * ```ts
 * replayMsgPack(toFrameMsgPack(builder), renderer);
 * ```
 *
 * @example 2: Replay from a file
 * ```ts
 * import { readFileSync } from 'node:fs';
 * replayMsgPack(new Uint8Array(readFileSync('frame.msgpack')), renderer);
 * ```
 *
 * @param {Uint8Array} bytes The MessagePack bytes.
 * @param {IRenderer} renderer The renderer.
 * @returns {void}
 * @throws {Error} When the bytes are malformed or the frame shape is
 * invalid.
 * @author MathAid
 */
export function replayMsgPack(bytes: Uint8Array, renderer: IRenderer): void {
  renderer.render(fromFrameMsgPack(bytes));
}

/**
 * @summary Replay a frame from a byte array, detecting the codec.
 *
 * @description
 * Inspects the leading bytes. A leading `{` (0x7b) is treated as JSON.
 * A MessagePack map header (0x80 to 0x8f or 0xde) is treated as
 * MessagePack. Any other prefix throws with a message that names the
 * leading byte.
 *
 * @example
 * Example 1: Replay a JSON blob stored as bytes
 * ```ts
 * const bytes = new TextEncoder().encode('{"commands":[]}');
 * replayFile(bytes, renderer);
 * ```
 *
 * @example 2: Replay a MessagePack blob
 * ```ts
 * const bytes = toFrameMsgPack(builder);
 * replayFile(bytes, renderer);
 * ```
 *
 * @param {Uint8Array} bytes The encoded frame.
 * @param {IRenderer} renderer The renderer.
 * @returns {void}
 * @throws {Error} When the leading byte does not match a known codec.
 * @author MathAid
 */
export function replayFile(bytes: Uint8Array, renderer: IRenderer): void {
  if (bytes.length === 0) {
    throw new Error('replayFile: the input is empty.');
  }
  const first = bytes[0]!;
  if (first === 0x7b) {
    replayJSON(new TextDecoder().decode(bytes), renderer);
    return;
  }
  if ((first >= 0x80 && first <= 0x8f) || first === 0xde) {
    replayMsgPack(bytes, renderer);
    return;
  }
  throw new Error(
    `replayFile: unknown codec. Leading byte 0x${first.toString(16)}.`,
  );
}