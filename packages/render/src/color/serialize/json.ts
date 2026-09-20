/**
 * @fileoverview JSON serialization.
 *
 * @summary
 * Provides `toJSON` and `fromJSON`. The format is compact and
 * human-readable.
 *
 * @description
 * The JSON encoder writes the serialized shape directly. The decoder
 * validates the input and rebuilds the runtime objects.
 *
 * The encoder rejects `NaN` and `Infinity`. JSON cannot round-trip
 * these values. The decoder throws on unknown space IDs.
 *
 * @author MathAid
 */

import type { Serializable } from './types';

/**
 * @summary
 * Serialize a palette or gradient to a JSON string.
 *
 * @description
 * The function stringifies the input. It validates every number in
 * the input first. `NaN` and `Infinity` are rejected because JSON
 * cannot carry them.
 *
 * @param input - The palette or gradient.
 * @returns A JSON string.
 *
 * @throws {Error} When a channel value is not finite.
 *
 * @example
 * toJSON(packPalette([make(sRGB, 1, 0, 0)], 'reds'));
 * // '{"kind":"palette","name":"reds","colors":[["sRGB",1,0,0,1]]}'
 */
export function toJSON(input: Serializable): string {
  assertFinite(input);
  return JSON.stringify(input);
}

/**
 * @summary
 * Parse a JSON string back to a `Serializable`.
 *
 * @description
 * The function parses the string and validates the shape. It does not
 * rebuild runtime objects. Use `unpackGradient` or `unpackPalette`
 * for that.
 *
 * @param text - The JSON string.
 * @returns The parsed data.
 *
 * @throws {Error} When the string is not valid JSON, the shape is
 *   not recognized or the internal limits are breached.
 *
 * @example
 * const data = fromJSON('{"kind":"palette","colors":[["sRGB",1,0,0,1]]}');
 */
export function fromJSON(text: string): Serializable {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`fromJSON: invalid JSON: ${(err as Error).message}`);
  }
  return validateSerializable(parsed);
}

// -----------------------------------------------------------------
//  Validation
// -----------------------------------------------------------------

const ARRAY_LIMIT = 1_000_000;
const RECURSE_LIMIT = 7;

function assertFinite(value: unknown, recurse = 0): void {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`toJSON: non-finite number ${value}.`);
    }
    return;
  }

  if (recurse > RECURSE_LIMIT) {
    throw new Error(`toJSON: Recursion limit reached, object too deep`)
  }

  if (Array.isArray(value)) {
    if (value.length > ARRAY_LIMIT) throw new Error(`toJSON: array length ${value.length} exceeds limit ${ARRAY_LIMIT}`);
    for (const v of value) assertFinite(v, recurse + 1);
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value)) assertFinite(v, recurse + 1);
  }
}

function validateSerializable(value: unknown): Serializable {
  if (value === null || typeof value !== 'object') {
    throw new Error('fromJSON: top-level value must be an object.');
  }
  const v = value as { kind?: unknown };
  if (v.kind === 'palette' || v.kind === 'linear' || v.kind === 'radial' || v.kind === 'multi') {
    return value as Serializable;
  }
  throw new Error(`fromJSON: unknown kind "${String(v.kind)}".`);
}