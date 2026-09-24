/**
 * @fileoverview
 * @summary Structural diff between two serialized frames.
 *
 * @description
 * Compares two {@linkcode SerializedFrame} values command by command
 * and reports the first difference and the full change set. The diff
 * is by value. Two commands are equal when their fields are equal,
 * recursively.
 *
 * The function is used by trace tooling, by the conformance runner to
 * diagnose non-determinism, and by tests that want a precise failure
 * message.
 *
 * ```text
 *   frame A         frame B         diff
 *   -------         -------         ----
 *   [clear]         [clear]         equal
 *   [fill-shape]    [fill-shape]    equal
 *   [push]          [set-fill]      changed at index 2
 *   [pop]           [pop]           equal
 *   ---             [pop]           added at index 4
 * ```
 *
 * @example
 * Example 1: First difference between two frames
 * ```ts
 * const d = firstDifference(a, b);
 * if (d !== null) {
 *   console.log(`command ${d.index} changed: ${d.reason}`);
 * }
 * ```
 *
 * @example 2: Full diff
 * ```ts
 * const changes = diffFrames(a, b);
 * for (const c of changes) console.log(c.kind, c.index, c.reason);
 * ```
 *
 * @see {@linkcode SerializedFrame}
 * @author MathAid
 */

import type { SerializedCommand, SerializedFrame } from '../serialize';

/**
 * @summary One entry in a frame diff.
 *
 * @description
 * Carries the command index, the kind of change, the commands on each
 * side, and a short reason. The `a` field is `undefined` for an `added`
 * entry. The `b` field is `undefined` for a `removed` entry.
 *
 * @see {@linkcode diffFrames}
 * @author MathAid
 */
export interface FrameDiffEntry {
  /** The command index in the shorter frame. */
  readonly index: number;
  /** The kind of change. */
  readonly kind: 'changed' | 'added' | 'removed';
  /** The command from the first frame, when present. */
  readonly a?: SerializedCommand;
  /** The command from the second frame, when present. */
  readonly b?: SerializedCommand;
  /** A short reason that names the first differing field. */
  readonly reason: string;
}

/**
 * @summary Compute the full diff between two frames.
 *
 * @description
 * Compares commands index by index. A mismatch produces a `changed`
 * entry. Extra commands on either side produce `added` or `removed`
 * entries. The result is empty when the frames are equal.
 *
 * @example
 * Example 1: Two identical frames
 * ```ts
 * const changes = diffFrames(a, a);
 * changes.length; // 0
 * ```
 *
 * @example 2: Frames that differ by one command
 * ```ts
 * const changes = diffFrames(a, b);
 * changes[0]?.kind;    // 'changed'
 * changes[0]?.reason;  // 'kind differs'
 * ```
 *
 * @param {SerializedFrame} a The first frame.
 * @param {SerializedFrame} b The second frame.
 * @returns {readonly FrameDiffEntry[]} The diff entries.
 * @author MathAid
 */
export function diffFrames(a: SerializedFrame, b: SerializedFrame): readonly FrameDiffEntry[] {
  const out: FrameDiffEntry[] = [];
  const len = Math.max(a.commands.length, b.commands.length);
  for (let i = 0; i < len; i++) {
    const ca = a.commands[i];
    const cb = b.commands[i];
    if (ca === undefined && cb !== undefined) {
      out.push({ index: i, kind: 'added', b: cb, reason: 'command added' });
    } else if (ca !== undefined && cb === undefined) {
      out.push({ index: i, kind: 'removed', a: ca, reason: 'command removed' });
    } else if (ca !== undefined && cb !== undefined) {
      const reason = commandDiff(ca, cb);
      if (reason !== null) {
        out.push({ index: i, kind: 'changed', a: ca, b: cb, reason });
      }
    }
  }
  return out;
}

/**
 * @summary The first difference between two frames.
 *
 * @description
 * Returns the first entry from {@linkcode diffFrames}, or `null` when
 * the frames are equal. Use this when only the first difference matters.
 *
 * @example
 * Example 1: Frames equal
 * ```ts
 * firstDifference(a, a); // null
 * ```
 *
 * @example 2: Frames differ
 * ```ts
 * const d = firstDifference(a, b);
 * d?.index;  // 2
 * d?.reason; // 'shape.rect.width differs: 32 vs 16'
 * ```
 *
 * @param {SerializedFrame} a The first frame.
 * @param {SerializedFrame} b The second frame.
 * @returns {FrameDiffEntry | null} The first difference, or `null`.
 * @author MathAid
 */
export function firstDifference(a: SerializedFrame, b: SerializedFrame): FrameDiffEntry | null {
  const len = Math.max(a.commands.length, b.commands.length);
  for (let i = 0; i < len; i++) {
    const ca = a.commands[i];
    const cb = b.commands[i];
    if (ca === undefined && cb !== undefined) {
      return { index: i, kind: 'added', b: cb, reason: 'command added' };
    }
    if (ca !== undefined && cb === undefined) {
      return { index: i, kind: 'removed', a: ca, reason: 'command removed' };
    }
    if (ca !== undefined && cb !== undefined) {
      const reason = commandDiff(ca, cb);
      if (reason !== null) {
        return { index: i, kind: 'changed', a: ca, b: cb, reason };
      }
    }
  }
  return null;
}

/**
 * @summary Diff two commands by value.
 *
 * @description
 * Walks the commands field by field. Returns `null` when they are
 * equal. Returns a short reason when they differ. The reason names the
 * first field that differs.
 *
 * @param {SerializedCommand} a The first command.
 * @param {SerializedCommand} b The second command.
 * @returns {string | null} The reason, or `null` when equal.
 * @author MathAid
 */
function commandDiff(a: SerializedCommand, b: SerializedCommand): string | null {
  if (a.kind !== b.kind) return `kind differs: ${a.kind} vs ${b.kind}`;
  return deepDiff(a, b, '');
}

/**
 * @summary A structural diff between two JSON-compatible values.
 *
 * @description
 * Recurses into objects and arrays. Returns `null` when the values are
 * equal. Returns a message with the path to the first difference.
 *
 * @param {unknown} a The first value.
 * @param {unknown} b The second value.
 * @param {string} path The path so far.
 * @returns {string | null} The message, or `null` when equal.
 * @author MathAid
 */
function deepDiff(a: unknown, b: unknown, path: string): string | null {
  if (a === b) return null;
  if (typeof a !== typeof b) {
    return `${path} type differs: ${typeof a} vs ${typeof b}`;
  }
  if (a === null || b === null) {
    return `${path} ${String(a)} vs ${String(b)}`;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return `${path}.length differs: ${a.length} vs ${b.length}`;
    }
    for (let i = 0; i < a.length; i++) {
      const r = deepDiff(a[i], b[i], path === '' ? `[${i}]` : `${path}[${i}]`);
      if (r !== null) return r;
    }
    return null;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as Record<string, unknown>).sort();
    const kb = Object.keys(b as Record<string, unknown>).sort();
    if (ka.length !== kb.length) {
      return `${path} key count differs: ${ka.length} vs ${kb.length}`;
    }
    for (const k of ka) {
      const r = deepDiff(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
        path === '' ? k : `${path}.${k}`,
      );
      if (r !== null) return r;
    }
    return null;
  }
  return `${path} differs: ${String(a)} vs ${String(b)}`;
}
