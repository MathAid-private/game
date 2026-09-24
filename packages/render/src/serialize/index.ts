/**
 * @fileoverview
 * @summary Serialization barrel for the render frame.
 *
 * @description
 * Re-exports the frame schema, the validators, the JSON codec, and the
 * MessagePack codec.
 *
 * ```text
 *   serialize/
 *     frame-types.ts    SerializedFrame, SerializedCommand, ...
 *     validate.ts       validateSerializedFrame, ...
 *     frame-json.ts     toFrameJSON, fromFrameJSON, ...
 *     frame-msgpack.ts  toFrameMsgPack, fromFrameMsgPack, ...
 *     index.ts          this file
 * ```
 *
 * @example
 * Example 1: Encode to JSON
 * ```ts
 * import { toFrameJSON } from './serialize';
 * const text = toFrameJSON(builder);
 * ```
 *
 * @example 2: Encode to MessagePack
 * ```ts
 * import { toFrameMsgPack } from './serialize';
 * const bytes = toFrameMsgPack(builder);
 * ```
 *
 * @see {@linkcode SerializedFrame}
 * @see {@linkcode toFrameJSON}
 * @see {@linkcode toFrameMsgPack}
 * @author MathAid
 */

export * from './frame-json';
export * from './frame-msgpack';
export * from './frame-types';
export * from './validate';
