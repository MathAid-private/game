/**
 * @fileoverview
 * @summary Capture options and helpers for pixel readback.
 *
 * @description
 * Defines {@linkcode CaptureOptions} and {@linkcode CaptureFormat}, and
 * the {@linkcode regionToRect} helper that normalizes a region argument
 * to a {@linkcode Rect}. Every renderer that supports capture uses these
 * types. A renderer that does not support capture ignores them and
 * throws from its capture methods.
 *
 * ```text
 *   capture format    output                      alpha
 *   --------------    ----------------------      -----
 *   raw               ImageData                   yes
 *   png               Uint8Array (PNG)            yes
 *   jpeg              Uint8Array (JPEG)           no
 *   webp              Uint8Array (WebP)           yes
 * ```
 *
 * The `format` option applies to `captureStream`. The `capture` and
 * `captureAsync` methods always return raw `ImageData`. Use
 * `captureStream` when the output must be encoded.
 *
 * @see {@linkcode IRenderer}
 * @author MathAid
 */

import { shapeBounds } from '../geometry/operations';
import { type Paint } from '../geometry/paint';
import { type Rect } from '../geometry/rect';
import { type Shape } from '../geometry/shape';

/**
 * @summary The output format for a pixel capture.
 *
 * @description
 * `'raw'` produces a raw RGBA byte stream. The other three produce an
 * encoded image. The choice affects `captureStream` only. The `capture`
 * and `captureAsync` methods always return raw `ImageData`.
 *
 * @example
 * Example 1: A PNG stream
 * ```ts
 * const stream = renderer.captureStream(region, { format: 'png' });
 * ```
 *
 * @example 2: A JPEG thumbnail
 * ```ts
 * const stream = renderer.captureStream(region, { format: 'jpeg', quality: 0.6 });
 * ```
 *
 * @see {@linkcode CaptureOptions}
 * @author MathAid
 */
export type CaptureFormat = 'raw' | 'png' | 'jpeg' | 'webp';

/**
 * @summary Options for a pixel capture.
 *
 * @description
 * Every field is optional. The defaults produce a full-resolution PNG
 * with no background fill.
 *
 * The `quality` field applies to `jpeg` and `webp`. The legal range is
 * `0` to `1`. A value outside the range is clamped. The value is ignored
 * for `png` and `raw`.
 *
 * The `scale` field multiplies the region's dimensions before capture.
 * A value of `2` doubles the output size. The result is a downsampled or
 * upsampled image, not a higher-resolution capture.
 *
 * The `background` field fills the region before encoding. This is
 * useful for formats that have no alpha channel (JPEG) or when a solid
 * backdrop is preferred over a checkerboard.
 *
 * @example
 * Example 1: A full-resolution PNG
 * ```ts
 * const stream = renderer.captureStream(region, { format: 'png' });
 * ```
 *
 * @example
 * Example 2: A half-size JPEG with a black backdrop
 * ```ts
 * const stream = renderer.captureStream(region, {
 *   format: 'jpeg',
 *   quality: 0.8,
 *   scale: 0.5,
 *   background: makeSolid(make(sRGB, 0, 0, 0)),
 * });
 * ```
 *
 * @see {@linkcode CaptureFormat}
 * @see {@linkcode IRenderer}
 * @author MathAid
 */
export interface CaptureOptions {
  /** The output format. Defaults to `'png'`. */
  readonly format?: CaptureFormat;
  /** The quality for lossy formats, `0` to `1`. Defaults to `0.92`. */
  readonly quality?: number;
  /** The output scale. Defaults to `1`. */
  readonly scale?: number;
  /** A paint to fill under transparent regions. Defaults to none. */
  readonly background?: Paint;
}

/**
 * @summary Normalize a capture region to a rectangle.
 *
 * @description
 * A capture region is a {@linkcode Rect} or a {@linkcode Shape}. A rect
 * is returned as-is. A shape is converted to its axis-aligned bounding
 * box with {@linkcode shapeBounds}. The result is always a rectangle.
 *
 * @example
 * Example 1: A rect
 * ```ts
 * regionToRect(rect(10, 10, 100, 100)); // { x: 10, y: 10, width: 100, height: 100 }
 * ```
 *
 * @example 2: A circle
 * ```ts
 * regionToRect(makeCircle(point(50, 50), 10));
 * // { x: 40, y: 40, width: 20, height: 20 }
 * ```
 *
 * @param {Rect | Shape} region The capture region.
 * @returns {Rect} The bounding rectangle.
 * @author MathAid
 */
export function regionToRect(region: Rect | Shape): Rect {
  if ('width' in region && 'height' in region && !('kind' in region)) {
    return region;
  }
  return shapeBounds(region as Shape);
}