/**
 * @fileoverview Gradient and raster types.
 *
 * @summary
 * Re-exports the four gradient kinds and the shared sampler.
 *
 * @description
 * A gradient maps a 2D point to a color. Four kinds are provided.
 *
 * ```text
 *   linear    Two points define a direction. The color changes along it.
 *   radial    A center and two radii define a ring. Color changes from
 *             the inner to the outer radius.
 *   multi     An explicit list of stops. The other kinds are special
 *             cases of this one.
 *   pattern   An image plus a tile rule and an optional transform.
 * ```
 *
 * All four kinds share the `GradientStop` type and the `sampleStops`
 * helper. `sample` dispatches on the `kind` field.
 *
 * @author MathAid
 */

export * from './linear';
export * from './multi';
export * from './pattern';
export * from './radial';
export * from './sample';
export * from './types';
