/**
 * @fileoverview Linear gradient.
 *
 * @summary
 * Provides `LinearGradient` and `sampleLinear`.
 *
 * @description
 * A linear gradient changes color along a line. The line runs from
 * `from` to `to`. Points before `from` get the first stop. Points after
 * `to` get the last stop.
 *
 * ```text
 *   from -------- direction ---------> to
 *     |                                 |
 *     v                                 v
 *   first stop                     last stop
 *
 *   A point P projects onto the line. The projection becomes t.
 *   t=0 at `from`. t=1 at `to`. Beyond the ends, t is clamped.
 * ```
 *
 * @author MathAid
 */

import type { Point2D } from '@/geometry';
import { type ColorValue } from '../convert';
import { type ColorSpaceDef } from '../space';
import { type GradientStop, sampleStops } from './types';

// -----------------------------------------------------------------
//  Type
// -----------------------------------------------------------------

/**
 * @summary
 * A linear gradient between two points.
 *
 * @template S - The color space of the stop colors.
 *
 * @example
 * const g: LinearGradient<typeof sRGB> = {
 *   kind: 'linear',
 *   from: { x: 0, y: 0 },
 *   to: { x: 1, y: 0 },
 *   stops: [
 *     { offset: 0, color: make(sRGB, 1, 0, 0) },
 *     { offset: 1, color: make(sRGB, 0, 0, 1) },
 *   ],
 * };
 */
export interface LinearGradient<S extends ColorSpaceDef<string>> {
  /** The kind tag. Always `'linear'`. */
  readonly kind: 'linear';
  /** The start point. */
  readonly from: Point2D;
  /** The end point. */
  readonly to: Point2D;
  /** The stop list. Must be sorted by offset. Must not be empty. */
  readonly stops: ReadonlyArray<GradientStop<S>>;
  /** The space to interpolate in. Defaults to OKLab in `sampleStops`. */
  readonly workingSpace?: ColorSpaceDef<string>;
}

// -----------------------------------------------------------------
//  Sampler
// -----------------------------------------------------------------

/**
 * @summary
 * Sample a linear gradient at a point.
 *
 * @description
 * The function projects the point onto the line from `from` to `to`.
 * The projection becomes the sample parameter. It is clamped to 0 to 1.
 * The stop list is then sampled at that parameter.
 *
 * When `from` and `to` are the same point, the parameter is 0.
 *
 * @template S - The color space of the stop colors.
 *
 * @param g - The gradient.
 * @param p - The point to sample.
 * @returns The sampled color.
 *
 * @example
 * sampleLinear(g, { x: 0.5, y: 0 });  // midway between the two stops
 */
export function sampleLinear<S extends ColorSpaceDef<string>>(
  g: LinearGradient<S>,
  p: Point2D,
): ColorValue<ColorSpaceDef<string>> {
  const dx = g.to.x - g.from.x;
  const dy = g.to.y - g.from.y;
  const lenSq = dx * dx + dy * dy;
  let t: number;
  if (lenSq === 0) {
    t = 0;
  } else {
    t = ((p.x - g.from.x) * dx + (p.y - g.from.y) * dy) / lenSq;
  }
  return sampleStops(g.stops, t, g.workingSpace);
}
