/**
 * @fileoverview Gradient packing and unpacking.
 *
 * @summary
 * Provides `packGradient` and `unpackGradient` for the three gradient
 * kinds the serializer supports. Pattern rasters are not serialized
 * here. Use a palette plus your own geometry for those.
 *
 * @description
 * A serialized gradient has a `kind` tag, geometry fields, an optional
 * `workingSpace` ID, and a stop list. Each stop carries an offset and
 * a serialized color.
 *
 * ```text
 *   {
 *     "kind": "linear",
 *     "from": { "x": 0, "y": 0 },
 *     "to":   { "x": 1, "y": 0 },
 *     "workingSpace": "OKLab",
 *     "stops": [
 *       { "offset": 0, "color": ["sRGB", 1, 0, 0, 1] },
 *       { "offset": 1, "color": ["sRGB", 0, 0, 1, 1] }
 *     ]
 *   }
 * ```
 *
 * @author MathAid
 */

import type { LinearGradient } from '../gradient/linear';
import type { MultiStopGradient } from '../gradient/multi';
import type { RadialGradient } from '../gradient/radial';
import { type GradientStop } from '../gradient/types';
import { type ColorSpaceDef } from '../space';
import { getSpaceById, packColor, unpackColor } from './palette';
import type {
  SerializedGradient,
  SerializedGradientStop,
} from './types';

// -----------------------------------------------------------------
//  Pack
// -----------------------------------------------------------------

/**
 * @summary
 * Convert a gradient to its serialized form.
 *
 * @description
 * The function accepts the three serializable gradient kinds. It
 * packs the geometry, the optional working space ID, and the stop
 * list.
 *
 * @template S - The color space of the stop colors.
 * @param g - The gradient to pack.
 * @returns A serialized gradient.
 *
 * @example
 * const g: LinearGradient<typeof sRGB> = { ... };
 * packGradient(g);
 */
export function packGradient<S extends ColorSpaceDef<string>>(
  g: LinearGradient<S> | RadialGradient<S> | MultiStopGradient<S>,
): SerializedGradient {
  const stops = g.stops.map(packStop);
  const workingSpace = g.workingSpace?.id;

  switch (g.kind) {
    case 'linear':
      return {
        kind: 'linear',
        from: { x: g.from.x, y: g.from.y },
        to: { x: g.to.x, y: g.to.y },
        workingSpace,
        stops,
      };
    case 'radial':
      return {
        kind: 'radial',
        center: { x: g.center.x, y: g.center.y },
        innerRadius: g.innerRadius,
        outerRadius: g.outerRadius,
        workingSpace,
        stops,
      };
    case 'multi':
      return {
        kind: 'multi',
        workingSpace,
        stops,
      };
  }
}

function packStop<S extends ColorSpaceDef<string>>(
  stop: GradientStop<S>,
): SerializedGradientStop {
  return {
    offset: stop.offset,
    color: packColor(stop.color),
  };
}

// -----------------------------------------------------------------
//  Unpack
// -----------------------------------------------------------------

/**
 * @summary
 * Convert a serialized gradient back to its runtime form.
 *
 * @description
 * The function reads the kind tag and rebuilds the matching gradient.
 * The optional working space ID is looked up in the registry.
 *
 * @param g - The serialized gradient.
 * @returns A gradient in the runtime shape. The color space is
 *   widened to `ColorSpaceDef<string>` because different stops may
 *   live in different spaces.
 *
 * @throws {Error} When a stop's space ID is unknown or the working
 *   space ID is unknown.
 *
 * @example
 * const g = unpackGradient({ kind: 'multi', stops: [...], ... });
 */
export function unpackGradient(
  g: SerializedGradient,
): LinearGradient<ColorSpaceDef<string>>
  | RadialGradient<ColorSpaceDef<string>>
  | MultiStopGradient<ColorSpaceDef<string>> {
  const stops = g.stops.map(unpackStop);
  const workingSpace = g.workingSpace
    ? getSpaceOrThrow(g.workingSpace)
    : undefined;

  switch (g.kind) {
    case 'linear':
      return {
        kind: 'linear',
        from: g.from,
        to: g.to,
        workingSpace,
        stops,
      };
    case 'radial':
      return {
        kind: 'radial',
        center: g.center,
        innerRadius: g.innerRadius,
        outerRadius: g.outerRadius,
        workingSpace,
        stops,
      };
    case 'multi':
      return {
        kind: 'multi',
        workingSpace,
        stops,
      };
  }
}

function unpackStop(
  stop: SerializedGradientStop,
): GradientStop<ColorSpaceDef<string>> {
  return {
    offset: stop.offset,
    color: unpackColor(stop.color),
  };
}

function getSpaceOrThrow(id: string): ColorSpaceDef<string> {
  return getSpaceById(id);
}