/**
 * @fileoverview
 * @summary Mapping from C result codes to TypeScript exceptions.
 *
 * @description
 * Defines {@linkcode GfxError}, the exception class the binding layer
 * throws. Provides {@linkcode throwForResult}, the function that
 * converts a {@linkcode GfxResult} code into a throw or a return.
 *
 * Every public method on the binding layer calls `throwForResult` and
 * either returns the value or throws. Callers never see a raw integer
 * error code.
 *
 * ```text
 *   GfxResult.Ok            -> no throw, return the value
 *   GfxResult.Unsupported   -> GfxError with code 1
 *   GfxResult.DeviceLost    -> GfxError with code 2
 *   GfxResult.OutOfMemory   -> GfxError with code 3
 *   GfxResult.InvalidArg    -> GfxError with code 4
 *   GfxResult.Internal      -> GfxError with code 5
 * ```
 *
 * @example
 * Example 1: Check the error code in a catch block
 * ```ts
 * import { GfxError } from './errors';
 * import { GfxResult } from './api';
 *
 * try {
 *   binding.createDevice(api, null);
 * } catch (err) {
 *   if (err instanceof GfxError && err.code === GfxResult.Unsupported) {
 *     console.log('this API is not supported');
 *   }
 * }
 * ```
 *
 * @example 2: Inspect the message
 * ```ts
 * try {
 *   binding.createDevice(api, null);
 * } catch (err) {
 *   console.log((err as Error).message);
 *   // "gfx_create_device: the API is not supported by this shim (code 1)."
 * }
 * ```
 *
 * @see {@linkcode GfxResult}
 * @author MathAid
 */

import { GfxResult } from './api';

/**
 * @summary The exception the binding layer throws.
 *
 * @description
 * Carries the raw {@linkcode GfxResult} code so a caller can switch on
 * it. The message names the failing function and the code's meaning.
 *
 * @example
 * Example 1: Throw and catch
 * ```ts
 * import { GfxError } from './errors';
 * import { GfxResult } from './api';
 *
 * try {
 *   binding.draw(device, pipeline, vbuf, ibuf, uniform);
 * } catch (err) {
 *   if (err instanceof GfxError) {
 *     console.log(err.code, err.message);
 *   }
 * }
 * ```
 *
 * @example 2: Build a custom error
 * ```ts
 * const err = new GfxError(GfxResult.DeviceLost, 'gfx_draw');
 * err.code; // GfxResult.DeviceLost
 * ```
 *
 * @see {@linkcode throwForResult}
 * @author MathAid
 */
export class GfxError extends Error {
  /** The raw result code from the C shim. */
  readonly code: GfxResult;

  /** The name of the failing function. */
  readonly fnName: string;

  constructor(code: GfxResult, fnName: string) {
    super(`${fnName}: ${describe(code)} (code ${code}).`);
    this.name = 'GfxError';
    this.code = code;
    this.fnName = fnName;
  }
}

/**
 * @summary Throw a {@linkcode GfxError} unless the result is `Ok`.
 *
 * @description
 * Every binding method calls this after a C function returns. The call
 * either returns normally or throws. The caller never inspects a raw
 * code.
 *
 * @example
 * Example 1: Guard a call
 * ```ts
 * const result = shim.gfx_create_device(api, null, outPtr);
 * throwForResult(result, 'gfx_create_device');
 * ```
 *
 * @example 2: In a try block
 * ```ts
 * try {
 *   throwForResult(result, 'gfx_draw');
 * } catch (err) {
 *   console.log((err as GfxError).code);
 * }
 * ```
 *
 * @param {GfxResult} result The result code.
 * @param {string} fnName The function name, for the error message.
 * @returns {void}
 * @throws {GfxError} When the code is not `GfxResult.Ok`.
 * @author MathAid
 */
export function throwForResult(result: GfxResult, fnName: string): void {
  if (result === GfxResult.Ok) return;
  throw new GfxError(result, fnName);
}

/**
 * @summary A human-readable description of a result code.
 *
 * @description
 * Used by the error constructor. A code outside the enum returns a
 * generic message.
 *
 * @param {GfxResult} code The result code.
 * @returns {string} The description.
 * @author MathAid
 */
export function describe(code: GfxResult): string {
  switch (code) {
    case GfxResult.Ok:
      return 'the call succeeded';
    case GfxResult.Unsupported:
      return 'the API is not supported by this shim';
    case GfxResult.DeviceLost:
      return 'the GPU device was lost or reset';
    case GfxResult.OutOfMemory:
      return 'the shim could not allocate memory';
    case GfxResult.InvalidArg:
      return 'an argument failed validation';
    case GfxResult.Internal:
      return 'an internal shim error';
    default:
      return 'an unknown error';
  }
}
