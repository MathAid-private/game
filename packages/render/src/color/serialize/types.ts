/**
 * @fileoverview Serialization types.
 *
 * @summary
 * Defines `Serializable`, `Palette`, and the three gradient shapes
 * the serializer supports.
 *
 * @description
 * Serialized colors use a five-element tuple. The first element is the
 * space ID. The next four are the channel values.
 *
 * ```text
 *   [spaceId, c1, c2, c3, alpha]
 *      |       |   |   |    |
 *      |       |   |   |    +-- alpha, 0 to 1
 *      |       |   |   +------- third channel
 *      |       |   +----------- second channel
 *      |       +--------------- first channel
 *      +----------------------- space ID, e.c2. "sRGB"
 * ```
 *
 * A palette groups colors by their space. A gradient carries a stop
 * list plus its geometry.
 *
 * @author MathAid
 */

/**
 * @summary
 * A serialized color as a five-element tuple.
 *
 * @description
 * The first element is the space ID. The next four are the channels.
 * The channels are stored as plain numbers.
 */
export type SerializedColor = readonly [
  spaceId: string,
  c1: number,
  c2: number,
  c3: number,
  alpha: number,
];

/**
 * @summary
 * A named palette of colors.
 *
 * @description
 * The palette groups colors into a flat list. Each color carries its
 * own space ID. The `name` field is optional.
 */
export interface Palette {
  /** The kind tag. Always `'palette'`. */
  readonly kind: 'palette';
  /** An optional human-readable name. */
  readonly name?: string;
  /** The colors in the palette. */
  readonly colors: ReadonlyArray<SerializedColor>;
}

/**
 * @summary
 * One gradient stop.
 *
 * @description
 * A stop pairs a normalized offset with a serialized color. The
 * `offset` runs 0 to 1. The `color` is the same five-element tuple.
 */
export interface SerializedGradientStop {
  /** The position, 0 to 1. */
  readonly offset: number;
  /** The color at this position. */
  readonly color: SerializedColor;
}

/**
 * @summary
 * A serialized linear gradient.
 *
 * @description
 * The two points define the axis. The stops define the color ramp.
 */
export interface SerializedLinearGradient {
  readonly kind: 'linear';
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
  readonly workingSpace?: string;
  readonly stops: ReadonlyArray<SerializedGradientStop>;
}

/**
 * @summary
 * A serialized radial gradient.
 *
 * @description
 * The center and the two radii define the ring. The stops define the
 * color ramp.
 */
export interface SerializedRadialGradient {
  readonly kind: 'radial';
  readonly center: { readonly x: number; readonly y: number };
  readonly innerRadius: number;
  readonly outerRadius: number;
  readonly workingSpace?: string;
  readonly stops: ReadonlyArray<SerializedGradientStop>;
}

/**
 * @summary
 * A serialized multi-stop gradient.
 *
 * @description
 * No geometry. The caller supplies the sample parameter.
 */
export interface SerializedMultiStopGradient {
  readonly kind: 'multi';
  readonly workingSpace?: string;
  readonly stops: ReadonlyArray<SerializedGradientStop>;
}

/**
 * @summary
 * The union of the three gradient shapes.
 */
export type SerializedGradient =
  | SerializedLinearGradient
  | SerializedRadialGradient
  | SerializedMultiStopGradient;

/**
 * @summary
 * The union of everything the serializer accepts.
 */
export type Serializable = Palette | SerializedGradient;