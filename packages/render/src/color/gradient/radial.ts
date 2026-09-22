/**
 * @fileoverview Radial gradient.
 *
 * @summary
 * Provides `RadialGradient` and `sampleRadial`.
 *
 * @description
 * A radial gradient changes color from a center point outward. The
 * inner radius holds the first stop. The outer radius holds the last
 * stop. Points closer than the inner radius get the first stop. Points
 * beyond the outer radius get the last stop.
 *
 * ```text
 *         inner radius    outer radius
 *              |               |
 *              v               v
 *         ......|...............|........
 *         .     |               |      .
 *         .     |   gradient    |      .
 *         .     |   region      |      .
 *         .     |               |      .
 *         ......|...............|........
 *              center
 * ```
 *
 * @author MathAid
 */

import { type ColorValue } from '../convert';
import { type ColorSpaceDef } from '../space';
import { type GradientStop, type Point2D, sampleStops } from './types';

// -----------------------------------------------------------------
//  Type
// -----------------------------------------------------------------

/**
 * @summary
 * A radial gradient around a center point.
 *
 * @template S - The color space of the stop colors.
 *
 * @example
 * const g: RadialGradient<typeof sRGB> = {
 *   kind: 'radial',
 *   center: { x: 0.5, y: 0.5 },
 *   innerRadius: 0.1,
 *   outerRadius: 0.5,
 *   stops: [
 *     { offset: 0, color: make(sRGB, 1, 1, 1) },
 *     { offset: 1, color: make(sRGB, 0, 0, 0) },
 *   ],
 * };
 */
export interface RadialGradient<S extends ColorSpaceDef<string>> {
  /** The kind tag. Always `'radial'`. */
  readonly kind: 'radial';
  /** The center point. */
  readonly center: Point2D;
  /** The radius at which the first stop sits. */
  readonly innerRadius: number;
  /** The radius at which the last stop sits. */
  readonly outerRadius: number;
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
 * Sample a radial gradient at a point.
 *
 * @description
 * The function computes the distance from the point to the center. It
 * maps that distance to a sample parameter with the two radii. The
 * parameter is clamped to 0 to 1. The stop list is then sampled.
 *
 * When the two radii are equal, the parameter is 0.
 *
 * @template S - The color space of the stop colors.
 *
 * @param g - The gradient.
 * @param p - The point to sample.
 * @returns The sampled color.
 *
 * @example
 * sampleRadial(g, { x: 0.5, y: 0.5 });  // at the center, the first stop
 * sampleRadial(g, { x: 1.0, y: 0.5 });  // at the edge, the last stop
 */
export function sampleRadial<S extends ColorSpaceDef<string>>(
  g: RadialGradient<S>,
  p: Point2D,
): ColorValue<ColorSpaceDef<string>> {
  const dx = p.x - g.center.x;
  const dy = p.y - g.center.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const span = g.outerRadius - g.innerRadius;
  const t = span === 0 ? 0 : (dist - g.innerRadius) / span;
  return sampleStops(g.stops, t, g.workingSpace);
}
