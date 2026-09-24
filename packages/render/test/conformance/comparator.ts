/**
 * @fileoverview
 * @summary Pixel comparison helpers for the conformance suite.
 *
 * @description
 * Provides the functions that compare an {@linkcode ImageData} against
 * a known-pixel assertion. The comparison is per-channel with a
 * tolerance. A mismatch produces a message that names the pixel, the
 * expected value, and the actual value.
 *
 * ```text
 *   expected [255, 0, 0, 255]
 *   actual   [250, 3, 2, 255]
 *   tolerance 5
 *   diff     [5, 3, 2, 0]
 *   max diff 5
 *   result   pass
 * ```
 *
 * @example
 * Example 1: Compare one pixel
 * ```ts
 * import { comparePixel } from './comparator';
 * const result = comparePixel(imageData, 16, 16, [255, 0, 0, 255], 2);
 * result.passed; // true
 * ```
 *
 * @example 2: Compare a whole region
 * ```ts
 * const result = compareRegion(a, b, 2);
 * result.maxDiff; // the worst per-channel difference
 * ```
 *
 * @see {@linkcode KnownPixel}
 * @author MathAid
 */

import type { KnownPixel } from './types';

/**
 * @summary The result of a pixel comparison.
 *
 * @description
 * Carries a boolean and the diagnostic values that produced it. A
 * passed comparison still reports the actual values so a test can log
 * them.
 *
 * @see {@linkcode comparePixel}
 * @author MathAid
 */
export interface PixelCompareResult {
  /** True when the pixel is within tolerance. */
  readonly passed: boolean;
  /** The expected RGBA. */
  readonly expected: readonly [number, number, number, number];
  /** The actual RGBA. */
  readonly actual: readonly [number, number, number, number];
  /** The per-channel absolute difference. */
  readonly diff: readonly [number, number, number, number];
  /** The maximum per-channel difference. */
  readonly maxDiff: number;
}

/**
 * @summary Compare one pixel against an expected value.
 *
 * @description
 * Reads the pixel from the image data and compares each channel to the
 * expected value. A channel is within tolerance when the absolute
 * difference is at most `tolerance`. The pixel passes when every
 * channel is within tolerance.
 *
 * @example
 * Example 1: A passing comparison
 * ```ts
 * const result = comparePixel(imageData, 16, 16, [255, 0, 0, 255], 2);
 * result.passed;  // true
 * result.maxDiff; // 0
 * ```
 *
 * @example 2: A failing comparison
 * ```ts
 * const result = comparePixel(imageData, 16, 16, [255, 0, 0, 255], 0);
 * result.passed;  // false when the pixel is not exactly red
 * ```
 *
 * @param {ImageData} imageData The rendered image.
 * @param {number} x The pixel column.
 * @param {number} y The pixel row.
 * @param {readonly [number, number, number, number]} expected The expected RGBA.
 * @param {number} tolerance The maximum per-channel difference, 0 to 255.
 * @returns {PixelCompareResult} The comparison result.
 * @throws {Error} When the coordinates are outside the image bounds.
 * @author MathAid
 */
export function comparePixel(
  imageData: ImageData,
  x: number,
  y: number,
  expected: readonly [number, number, number, number],
  tolerance: number,
): PixelCompareResult {
  if (x < 0 || y < 0 || x >= imageData.width || y >= imageData.height) {
    throw new Error(
      `comparePixel: (${x}, ${y}) is outside ${imageData.width}x${imageData.height}.`,
    );
  }
  const offset = (y * imageData.width + x) * 4;
  const data = imageData.data;
  const actual: [number, number, number, number] = [
    data[offset]!,
    data[offset + 1]!,
    data[offset + 2]!,
    data[offset + 3]!,
  ];
  const diff: [number, number, number, number] = [
    Math.abs(actual[0] - expected[0]),
    Math.abs(actual[1] - expected[1]),
    Math.abs(actual[2] - expected[2]),
    Math.abs(actual[3] - expected[3]),
  ];
  const maxDiff = Math.max(diff[0], diff[1], diff[2], diff[3]);
  return {
    passed: maxDiff <= tolerance,
    expected,
    actual,
    diff,
    maxDiff,
  };
}

/**
 * @summary Compare a fixture's known pixels against a rendered image.
 *
 * @description
 * Iterates the fixture's pixel list. Returns the first failing
 * comparison, or a passing result when all pixels match. The runner
 * uses this to produce a diagnostic that names the fixture and the
 * backend.
 *
 * @example
 * Example 1: Compare all known pixels
 * ```ts
 * const result = compareKnownPixels(imageData, fixture.knownPixels, 2);
 * result.passed; // true when every pixel is within tolerance
 * ```
 *
 * @param {ImageData} imageData The rendered image.
 * @param {readonly KnownPixel[]} known The known-pixel list.
 * @param {number} tolerance The maximum per-channel difference.
 * @returns {{ passed: boolean; failedAt: KnownPixel | null; result: PixelCompareResult | null }}
 *   The aggregate result. `failedAt` is the first failing pixel.
 * @author MathAid
 */
export function compareKnownPixels(
  imageData: ImageData,
  known: readonly KnownPixel[],
  tolerance: number,
): {
  readonly passed: boolean;
  readonly failedAt: KnownPixel | null;
  readonly result: PixelCompareResult | null;
} {
  for (const kp of known) {
    const result = comparePixel(imageData, kp.x, kp.y, kp.rgba, tolerance);
    if (!result.passed) {
      return { passed: false, failedAt: kp, result };
    }
  }
  return { passed: true, failedAt: null, result: null };
}

/**
 * @summary Compare two images with a per-channel tolerance.
 *
 * @description
 * Walks both images in lockstep. Returns the worst per-channel
 * difference and the coordinates of the worst pixel. A quick exit is
 * available when only the pass or fail is needed.
 *
 * @example
 * Example 1: Compare two images
 * ```ts
 * const cmp = compareRegion(a, b, 2);
 * cmp.passed;   // true when every channel is within 2
 * cmp.maxDiff;  // the worst per-channel difference found
 * ```
 *
 * @example 2: Locate the worst pixel
 * ```ts
 * const cmp = compareRegion(a, b, 0);
 * cmp.worstAt; // { x, y } of the first failing pixel
 * ```
 *
 * @param {ImageData} a The reference image.
 * @param {ImageData} b The image to compare.
 * @param {number} tolerance The maximum per-channel difference.
 * @returns {{
 *   passed: boolean;
 *   maxDiff: number;
 *   worstAt: { x: number; y: number } | null;
 *   worstChannels: readonly [number, number, number, number] | null;
 * }} The comparison result.
 * @throws {Error} When the two images have different dimensions.
 * @author MathAid
 */
export function compareRegion(
  a: ImageData,
  b: ImageData,
  tolerance: number,
): {
  readonly passed: boolean;
  readonly maxDiff: number;
  readonly worstAt: { readonly x: number; readonly y: number } | null;
  readonly worstChannels: readonly [number, number, number, number] | null;
} {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `compareRegion: dimensions differ. ${a.width}x${a.height} vs ${b.width}x${b.height}.`,
    );
  }
  let maxDiff = 0;
  let worstAt: { x: number; y: number } | null = null;
  let worstChannels: [number, number, number, number] | null = null;
  const ad = a.data;
  const bd = b.data;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const off = (y * a.width + x) * 4;
      const d0 = Math.abs(ad[off]! - bd[off]!);
      const d1 = Math.abs(ad[off + 1]! - bd[off + 1]!);
      const d2 = Math.abs(ad[off + 2]! - bd[off + 2]!);
      const d3 = Math.abs(ad[off + 3]! - bd[off + 3]!);
      const d = Math.max(d0, d1, d2, d3);
      if (d > maxDiff) {
        maxDiff = d;
        worstAt = { x, y };
        worstChannels = [d0, d1, d2, d3];
        if (d > tolerance) {
          // The first worst-case failure is enough to diagnose.
          return { passed: false, maxDiff, worstAt, worstChannels };
        }
      }
    }
  }
  return { passed: maxDiff <= tolerance, maxDiff, worstAt, worstChannels };
}