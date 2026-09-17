/**
 * @fileoverview Shared gradient types.
 *
 * @summary
 * Defines `GradientStop`, `Point2D`, and the shared stop sampler.
 *
 * @description
 * A gradient stop pairs an offset in 0 to 1 with a color. The stops are
 * sorted by offset. The sampler interpolates between the bracketing
 * stops.
 *
 * ```text
 *   offset:  0.0        0.5          1.0
 *            |           |            |
 *   stops:   [red ...  green ...     blue]
 *            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 *            sample(t) interpolates here
 * ```
 *
 * @author MathAid
 */

import { type ColorValue, convert, make } from '../convert';
import { type ColorSpaceDef, OKLab } from '../space';

// -----------------------------------------------------------------
//  Point
// -----------------------------------------------------------------

/**
 * @summary
 * A 2D point in gradient space.
 *
 * @description
 * The coordinates are in the same space as the sample call. For UI
 * gradients, this is often pixels or normalized UV. For sprite work,
 * it is texture coordinates.
 */
export interface Point2D {
  /** The horizontal coordinate. */
  readonly x: number;
  /** The vertical coordinate. */
  readonly y: number;
}

// -----------------------------------------------------------------
//  Stop
// -----------------------------------------------------------------

/**
 * @summary
 * One color stop in a gradient.
 *
 * @description
 * The offset runs from 0 to 1. The sampler clamps the sample parameter
 * to this range. The color can be in any space. The sampler converts
 * when it mixes.
 *
 * @template S - The color space of the stop color.
 */
export interface GradientStop<S extends ColorSpaceDef<string>> {
  /** The position, 0 to 1. */
  readonly offset: number;
  /** The color at this offset. */
  readonly color: ColorValue<S>;
}

// -----------------------------------------------------------------
//  Shared sampler
// -----------------------------------------------------------------

/**
 * @summary
 * Sample a sorted stop list at a parameter.
 *
 * @description
 * The function clamps `t` to 0 to 1. It finds the two stops that
 * bracket `t`. It interpolates between them with `mix`.
 *
 * When the list has one stop, that stop is returned. When `t` is before
 * the first stop, the first stop is returned. When `t` is after the
 * last stop, the last stop is returned.
 *
 * The function assumes the list is sorted by offset. Sort the list once
 * before sampling in a loop.
 *
 * @template S - The color space of the stop colors.
 *
 * @param stops - The sorted stop list. Must not be empty.
 * @param t - The sample parameter. Clamped to 0 to 1.
 * @param workingSpace - The space to interpolate in. Defaults to OKLab.
 * @returns The sampled color.
 *
 * @throws {Error} When the stop list is empty.
 *
 * @example
 * const stops = [
 *   { offset: 0, color: make(sRGB, 1, 0, 0) },
 *   { offset: 1, color: make(sRGB, 0, 0, 1) },
 * ];
 * sampleStops(stops, 0.5);
 */
export function sampleStops<S extends ColorSpaceDef<string>>(
  stops: ReadonlyArray<GradientStop<S>>,
  t: number,
  workingSpace: ColorSpaceDef<string> = OKLab,
): ColorValue<ColorSpaceDef<string>> {
  if (stops.length === 0) {
    throw new Error('sampleStops: the stop list is empty.');
  }
  if (stops.length === 1) {
    return stops[0]!.color as ColorValue<ColorSpaceDef<string>>;
  }
  const tt = t < 0 ? 0 : t > 1 ? 1 : t;
  if (tt <= stops[0]!.offset) {
    return stops[0]!.color as ColorValue<ColorSpaceDef<string>>;
  }
  const last = stops.length - 1;
  if (tt >= stops[last]!.offset) {
    return stops[last]!.color as ColorValue<ColorSpaceDef<string>>;
  }
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    if (stops[mid]!.offset <= tt) lo = mid;
    else hi = mid;
  }
  const a = stops[lo]!;
  const b = stops[hi]!;
  const span = b.offset - a.offset;
  const local = span === 0 ? 0 : (tt - a.offset) / span;
  const ca = convert(a.color, workingSpace);
  const cb = convert(b.color, workingSpace);
  const lerp = (x: number, y: number) => x + (y - x) * local;
  return make(
    workingSpace,
    lerp(ca.r, cb.r),
    lerp(ca.g, cb.g),
    lerp(ca.b, cb.b),
    lerp(ca.a, cb.a),
  );
}