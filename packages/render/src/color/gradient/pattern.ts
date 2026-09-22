/**
 * @fileoverview Pattern raster.
 *
 * @summary
 * Provides `PatternRaster` and `samplePattern`. A pattern raster is a
 * small image plus a tile rule and an optional transform.
 *
 * @description
 * The sampler maps a world point to a pixel in the source image. The
 * tile rule decides what happens when the mapped point falls outside
 * the image.
 *
 * ```text
 *   Tile rules:
 *
 *   repeat       repeat-x       repeat-y       no-repeat
 *   +----+       +----+----+    +----+         +----+
 *   |abcd|       |abcd|abcd|    |abcd|         |abcd|    (transparent
 *   |efgh|       |efgh|efgh|    |efgh|         |efgh|     outside)
 *   |abcd|       +----+----+    |abcd|
 *   |efgh|                      |efgh|
 *   +----+                      +----+
 * ```
 *
 * The transform is a 3 by 3 matrix. It maps the world point to source
 * image coordinates. When omitted, the world point is used directly.
 *
 * @author MathAid
 */

import { type ColorValue, make } from '../convert';
import { type ColorSpaceDef, type Mat3, sRGB } from '../space';
import { type Point2D } from './types';

// -----------------------------------------------------------------
//  Type
// -----------------------------------------------------------------

/**
 * @summary
 * The tile rule for a pattern raster.
 *
 * @description
 * `'repeat'` tiles on both axes. `'repeat-x'` tiles on the x axis
 * only. `'repeat-y'` tiles on the y axis only. `'no-repeat'` returns
 * a transparent color outside the image.
 */
export type PatternTile = 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';

/**
 * @summary
 * A pattern raster.
 *
 * @template S - The color space of the image pixels.
 *
 * @example
 * const raster: PatternRaster<typeof sRGB> = {
 *   kind: 'pattern',
 *   image: [make(sRGB, 1, 0, 0), make(sRGB, 0, 1, 0),
 *           make(sRGB, 0, 0, 1), make(sRGB, 1, 1, 1)],
 *   width: 2,
 *   height: 2,
 *   tile: 'repeat',
 * };
 */
export interface PatternRaster<S extends ColorSpaceDef<string>> {
  /** The kind tag. Always `'pattern'`. */
  readonly kind: 'pattern';
  /** The image pixels in row-major order. Length is width * height. */
  readonly image: ReadonlyArray<ColorValue<S>>;
  /** The image width in pixels. */
  readonly width: number;
  /** The image height in pixels. */
  readonly height: number;
  /** The tile rule for points outside the image. */
  readonly tile: PatternTile;
  /** The transform from world space to image space. Optional. */
  readonly transform?: Mat3;
}

// -----------------------------------------------------------------
//  Sampler
// -----------------------------------------------------------------

/**
 * @summary
 * Sample a pattern raster at a point.
 *
 * @description
 * The function applies the transform to the point. It then applies the
 * tile rule. It then reads the pixel at the resulting integer
 * coordinates.
 *
 * When the tile rule is `'no-repeat'` and the point falls outside the
 * image, the function returns transparent black.
 *
 * The transform is a 3 by 3 matrix in row-major order. It multiplies
 * the point as a column vector `[x, y, 1]`. The third row is ignored.
 * Only the first two components of the product are used.
 *
 * @template S - The color space of the image pixels.
 *
 * @param p - The raster.
 * @param point - The world point to sample.
 * @returns The pixel color, or transparent black.
 *
 * @example
 * samplePattern(raster, { x: 0, y: 0 });  // top-left pixel
 * samplePattern(raster, { x: 5, y: 0 });  // with repeat, wraps
 */
export function samplePattern<S extends ColorSpaceDef<string>>(
  p: PatternRaster<S>,
  point: Point2D,
): ColorValue<S | typeof sRGB> {
  let sx = point.x;
  let sy = point.y;

  if (p.transform) {
    const m = p.transform;
    const nx = m[0] * sx + m[1] * sy + m[2];
    const ny = m[3] * sx + m[4] * sy + m[5];
    sx = nx;
    sy = ny;
  }

  let ix = Math.floor(sx);
  let iy = Math.floor(sy);

  const wrapX = () => ((ix % p.width) + p.width) % p.width;
  const wrapY = () => ((iy % p.height) + p.height) % p.height;

  if (p.tile === 'repeat') {
    ix = wrapX();
    iy = wrapY();
  } else if (p.tile === 'repeat-x') {
    if (iy < 0 || iy >= p.height) return make(sRGB, 0, 0, 0, 0);
    ix = wrapX();
  } else if (p.tile === 'repeat-y') {
    if (ix < 0 || ix >= p.width) return make(sRGB, 0, 0, 0, 0);
    iy = wrapY();
  } else {
    if (ix < 0 || ix >= p.width || iy < 0 || iy >= p.height) {
      return make(sRGB, 0, 0, 0, 0);
    }
  }

  const index = iy * p.width + ix;
  const pixel = p.image[index];
  if (!pixel) return make(sRGB, 0, 0, 0, 0);
  return pixel;
}
