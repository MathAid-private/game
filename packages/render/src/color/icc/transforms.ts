/**
 * @fileoverview Apply an ICC profile to a color.
 *
 * @summary
 * Provides `applyProfile` and `toProfileSpace`. The first converts a
 * color from a device space to the profile connection space. The
 * second goes the other way.
 *
 * @description
 * The module supports matrix or TRC profiles. It does not yet support
 * LUT-based profiles.
 *
 * @author MathAid
 */

import { adapt } from '../adaptation';
import { type ColorValue, make } from '../convert';
import { type ColorSpaceDef, XYZ_D65 } from '../space';
import { type ICCProfile } from './profile';

// -----------------------------------------------------------------
//  Public API
// -----------------------------------------------------------------

/**
 * @summary
 * Convert a device-encoded color to the PCS.
 *
 * @description
 * The function reads the TRC curves and the primary matrix from the
 * profile. It applies the curves, then the matrix. The result is in
 * XYZ D65.
 *
 * The profile's PCS uses a D50 white point. The result is adapted to
 * D65 to match the engine's interchange space.
 *
 * @template S - The source color space type.
 *
 * @param color - The source color. Channels must be 0 to 1.
 * @param profile - The parsed profile.
 * @returns A new `ColorValue<typeof XYZ_D65>`.
 *
 * @throws {Error} When the profile lacks a matrix or a TRC.
 */
export function applyProfile<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  profile: ICCProfile,
): ColorValue<typeof XYZ_D65> {
  if (!profile.toPCS) {
    throw new Error('applyProfile: the profile has no toPCS matrix.');
  }
  if (!profile.trc) {
    throw new Error('applyProfile: the profile has no TRC curves.');
  }

  const [rT, gT, bT] = profile.trc;
  const rl = rT.apply(color.c1);
  const gl = gT.apply(color.c2);
  const bl = bT.apply(color.c3);

  const m = profile.toPCS;
  const X = m[0] * rl + m[1] * gl + m[2] * bl;
  const Y = m[3] * rl + m[4] * gl + m[5] * bl;
  const Z = m[6] * rl + m[7] * gl + m[8] * bl;

  // The profile's PCS is D50. Adapt to D65 for the engine.
  const d50 = make(XYZ_D65, X, Y, Z, color.alpha);
  return adapt(d50, 'D50', 'D65');
}

/**
 * @summary
 * Convert a PCS color to the device space.
 *
 * @description
 * The function inverts `applyProfile`. It adapts D65 to D50, applies
 * the inverse matrix, then applies the inverse TRC curves.
 *
 * @template S - The source color space type.
 *
 * @param color - The source color in XYZ D65.
 * @param profile - The parsed profile.
 * @param outSpace - The device output space.
 * @returns A new `ColorValue<S>`.
 *
 * @throws {Error} When the profile lacks a matrix or a TRC.
 */
export function toProfileSpace<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  profile: ICCProfile,
  outSpace: S,
): ColorValue<S> {
  if (!profile.fromPCS) {
    throw new Error('toProfileSpace: the profile has no fromPCS matrix.');
  }
  if (!profile.trc) {
    throw new Error('toProfileSpace: the profile has no TRC curves.');
  }

  const d50 = adapt(color, 'D65', 'D50');

  const m = profile.fromPCS;
  const rl = m[0] * d50.c1 + m[1] * d50.c2 + m[2] * d50.c3;
  const gl = m[3] * d50.c1 + m[4] * d50.c2 + m[5] * d50.c3;
  const bl = m[6] * d50.c1 + m[7] * d50.c2 + m[8] * d50.c3;

  const [rT, gT, bT] = profile.trc;
  const rEnc = invertTRC(rT, rl);
  const gEnc = invertTRC(gT, gl);
  const bEnc = invertTRC(bT, bl);

  return make(outSpace, rEnc, gEnc, bEnc, color.alpha);
}

/**
 * @summary
 * Numerically invert a TRC curve at a value.
 *
 * @description
 * The function does a small binary search. It finds `x` such that
 * `trc.apply(x) = v`. The search is accurate to about 1e-6.
 *
 * @param trc - The TRC curve.
 * @param v - The target value.
 * @returns The decoded value.
 */
function invertTRC(trc: { apply: (v: number) => number }, v: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (trc.apply(mid) < v) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
