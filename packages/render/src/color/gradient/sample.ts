/**
 * @fileoverview Unified gradient sampler.
 *
 * @summary
 * Provides `AnyGradient` and `sample`. The sampler dispatches on the
 * `kind` field.
 *
 * @description
 * This is the entry point for code that does not know the gradient
 * kind at compile time. Use the specific samplers when the kind is
 * known. They have narrower types.
 *
 * @author MathAid
 */

import type { Point2D } from '@/geometry';
import { type ColorValue } from '../convert';
import { type ColorSpaceDef, sRGB } from '../space';
import { type LinearGradient, sampleLinear } from './linear';
import { type MultiStopGradient, sampleMultiStop } from './multi';
import { type PatternRaster, samplePattern } from './pattern';
import { type RadialGradient, sampleRadial } from './radial';

// -----------------------------------------------------------------
//  Union
// -----------------------------------------------------------------

/**
 * @summary
 * The union of every gradient kind.
 *
 * @template S - The color space of the stop colors or pixels.
 */
export type AnyGradient<S extends ColorSpaceDef<string>> =
  LinearGradient<S> | RadialGradient<S> | MultiStopGradient<S> | PatternRaster<S>;

// -----------------------------------------------------------------
//  Dispatcher
// -----------------------------------------------------------------

/**
 * @summary
 * Sample any gradient at a point.
 *
 * @description
 * The function inspects the `kind` field. It calls the matching
 * specific sampler. Use this when the gradient kind is not known at
 * the call site.
 *
 * The return type is widened because the sampled color may be in a
 * different space when the gradient has no working space set.
 *
 * @template S - The color space of the stop colors or pixels.
 *
 * @param g - The gradient.
 * @param point - The point to sample.
 * @returns The sampled color.
 *
 * @example
 * const c = sample(gradient, { x: 0.5, y: 0.5 });
 */
export function sample<S extends ColorSpaceDef<string>>(
  g: AnyGradient<S>,
  point: Point2D,
): ColorValue<ColorSpaceDef<string> | typeof sRGB> {
  switch (g.kind) {
    case 'linear':
      return sampleLinear(g, point);
    case 'radial':
      return sampleRadial(g, point);
    case 'multi':
      return sampleMultiStop(g, 0);
    case 'pattern':
      return samplePattern(g, point);
  }
}
