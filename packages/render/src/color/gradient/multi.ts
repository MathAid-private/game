/**
 * @fileoverview Multi-stop gradient.
 *
 * @summary
 * Provides `MultiStopGradient` and `sampleMultiStop`. This is the
 * general form. The other kinds are special cases that compute the
 * sample parameter differently.
 *
 * @description
 * A multi-stop gradient is a sorted list of stops. The caller computes
 * the parameter `t`. This kind accepts `t` directly. Use it when the
 * gradient axis is not a simple line or circle.
 *
 * ```text
 *   stops:   [0.0 red] [0.25 yellow] [0.6 green] [1.0 blue]
 *             |          |            |           |
 *   t = 0 ....*          |            |           |
 *   t = 0.5 ..............*..........  |           |
 *   t = 1 .......................................  *
 * ```
 *
 * @author MathAid
 */

import { type ColorValue } from '../convert';
import { type ColorSpaceDef } from '../space';
import { type GradientStop, sampleStops } from './types';

// -----------------------------------------------------------------
//  Type
// -----------------------------------------------------------------

/**
 * @summary
 * A gradient defined by an explicit stop list.
 *
 * @template S - The color space of the stop colors.
 *
 * @example
 * const g: MultiStopGradient<typeof sRGB> = {
 *   kind: 'multi',
 *   stops: [
 *     { offset: 0,    color: make(sRGB, 1, 0, 0) },
 *     { offset: 0.5,  color: make(sRGB, 1, 1, 0) },
 *     { offset: 1,    color: make(sRGB, 0, 1, 0) },
 *   ],
 * };
 */
export interface MultiStopGradient<S extends ColorSpaceDef<string>> {
  /** The kind tag. Always `'multi'`. */
  readonly kind: 'multi';
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
 * Sample a multi-stop gradient at a parameter.
 *
 * @description
 * The function clamps the parameter to 0 to 1. It then calls the shared
 * stop sampler. Use this when the caller already has a parameter value.
 * Use `sampleLinear` or `sampleRadial` when the parameter comes from a
 * geometry.
 *
 * @template S - The color space of the stop colors.
 *
 * @param g - The gradient.
 * @param t - The sample parameter. Clamped to 0 to 1.
 * @returns The sampled color.
 *
 * @example
 * sampleMultiStop(g, 0.25);
 */
export function sampleMultiStop<S extends ColorSpaceDef<string>>(
  g: MultiStopGradient<S>,
  t: number,
): ColorValue<ColorSpaceDef<string>> {
  return sampleStops(g.stops, t, g.workingSpace);
}
