/**
 * @fileoverview
 * @summary The trace and replay barrel.
 *
 * @description
 * Re-exports the structural diff helpers and the replay helpers. The
 * frame codec lives in `../serialize`. The trace layer sits on top of
 * it.
 *
 * ```text
 *   trace/
 *     diff.ts    diffFrames, firstDifference
 *     replay.ts  replayJSON, replayMsgPack, replayFile
 *     index.ts   this file
 * ```
 *
 * @example
 * Example 1: Diff two frames
 * ```ts
 * import { firstDifference } from './trace';
 * const d = firstDifference(a, b);
 * ```
 *
 * @example 2: Replay a frame
 * ```ts
 * import { replayFile } from './trace';
 * replayFile(bytes, renderer);
 * ```
 *
 * @see {@linkcode diffFrames}
 * @see {@linkcode replayFile}
 * @author MathAid
 */

export * from './diff';
export * from './replay';
