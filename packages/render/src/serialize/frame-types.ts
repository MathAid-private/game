/**
 * @fileoverview
 * @summary The JSON-compatible shape of every render command.
 *
 * @description
 * Defines the serialized form of an {@linkcode IFrame}. Every command
 * variant has a matching serialized shape with a `kind` tag. The shapes
 * use only JSON-compatible values. Numbers are finite. Strings are
 * plain. Objects are nested. Arrays are fixed-length where the runtime
 * shape is a tuple.
 *
 * The schema reuses {@linkcode SerializedColor} from the color module.
 * A serialized color is a five-element tuple `[spaceId, c1, c2, c3,
 * alpha]`. A frame and a palette share the same color encoding.
 *
 * ```text
 *   Runtime shape                 Serialized shape
 *   -------------                 ----------------
 *   ColorValue                    [spaceId, c1, c2, c3, alpha]
 *   Mat2D                         [a, b, c, d, e, f]
 *   Transform2D                   { x, y, rotation?, scaleX?, scaleY? }
 *   Point2D                       { x, y }
 *   Rect                          { x, y, width, height }
 *   Paint                         { kind: 'solid', color }
 *   StrokeStyle                   { paint, width?, cap?, join?, ... }
 *   TextStyle                     { paint?, size?, family?, align?, baseline? }
 *   Shape                         { kind, ... variant fields }
 *   RenderCommand                 { kind, ... variant fields }
 *   IFrame                        { commands: [...] }
 * ```
 *
 * The schema is deliberately permissive. Unknown fields on any object
 * are ignored by the codec. This lets a future version add fields
 * without breaking older decoders.
 *
 * @example
 * Example 1: A serialized frame with a clear command
 * ```ts
 * const frame: SerializedFrame = {
 *   commands: [
 *     { kind: 'clear', paint: { kind: 'solid', color: ['sRGB', 0, 0, 0, 1] } },
 *   ],
 * };
 * ```
 *
 * @example 2: A serialized frame with a filled shape
 * ```ts
 * const frame: SerializedFrame = {
 *   commands: [
 *     {
 *       kind: 'fill-shape',
 *       shape: { kind: 'rect', rect: { x: 0, y: 0, width: 32, height: 32 } },
 *       paint: { kind: 'solid', color: ['sRGB', 1, 0, 0, 1] },
 *     },
 *   ],
 * };
 * ```
 *
 * @see {@linkcode SerializedCommand}
 * @see {@linkcode SerializedColor}
 * @author MathAid
 */

import { type SerializedColor } from '../color/serialize/types';

// Re-export for consumers of the schema.
export type { SerializedColor };

// -----------------------------------------------------------------
//  Geometry
// -----------------------------------------------------------------

/**
 * @summary The serialized form of a {@linkcode Point2D}.
 *
 * @description
 * A plain object with `x` and `y`. The runtime type is structurally
 * identical. The codec accepts and produces this shape without
 * conversion.
 *
 * @example
 * Example 1: A point
 * ```ts
 * const p: SerializedPoint = { x: 10, y: 20 };
 * ```
 *
 * @example 2: Inside a polygon
 * ```ts
 * const points: SerializedPoint[] = [
 *   { x: 0, y: 0 },
 *   { x: 10, y: 0 },
 *   { x: 5, y: 10 },
 * ];
 * ```
 *
 * @see {@linkcode SerializedShape}
 * @author MathAid
 */
export interface SerializedPoint {
  /** The horizontal coordinate. */
  readonly x: number;
  /** The vertical coordinate. */
  readonly y: number;
}

/**
 * @summary The serialized form of a {@linkcode Rect}.
 *
 * @description
 * A plain object with four numeric fields. The runtime type is
 * structurally identical.
 *
 * @example
 * Example 1: A rectangle
 * ```ts
 * const r: SerializedRect = { x: 0, y: 0, width: 32, height: 32 };
 * ```
 *
 * @example 2: A viewport
 * ```ts
 * const viewport: SerializedRect = {
 *   x: 0, y: 0, width: 1920, height: 1080,
 * };
 * ```
 *
 * @see {@linkcode SerializedShape}
 * @author MathAid
 */
export interface SerializedRect {
  /** The left edge. */
  readonly x: number;
  /** The top edge. */
  readonly y: number;
  /** The horizontal extent. */
  readonly width: number;
  /** The vertical extent. */
  readonly height: number;
}

/**
 * @summary The serialized form of a {@linkcode Mat2D}.
 *
 * @description
 * A six-element tuple `[a, b, c, d, e, f]`. The runtime shape is a
 * readonly tuple. The serialized form is a plain array of six numbers.
 *
 * @example
 * Example 1: The identity
 * ```ts
 * const m: SerializedMat2D = [1, 0, 0, 1, 0, 0];
 * ```
 *
 * @example 2: A translation
 * ```ts
 * const m: SerializedMat2D = [1, 0, 0, 1, 100, 50];
 * ```
 *
 * @see {@linkcode SerializedCommand}
 * @author MathAid
 */
export type SerializedMat2D = readonly [
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
];

// -----------------------------------------------------------------
//  Style
// -----------------------------------------------------------------

/**
 * @summary The serialized form of a {@linkcode Paint}.
 *
 * @description
 * A discriminated union keyed by `kind`. Today the union has one
 * variant, `'solid'`, which wraps a {@linkcode SerializedColor}. A
 * future gradient or pattern variant extends the union without a
 * breaking change.
 *
 * @example
 * Example 1: A solid paint
 * ```ts
 * const p: SerializedPaint = {
 *   kind: 'solid',
 *   color: ['sRGB', 1, 0, 0, 1],
 * };
 * ```
 *
 * @example 2: Inside a stroke style
 * ```ts
 * const stroke: SerializedStrokeStyle = {
 *   paint: { kind: 'solid', color: ['sRGB', 1, 1, 1, 1] },
 *   width: 2,
 * };
 * ```
 *
 * @see {@linkcode SerializedColor}
 * @author MathAid
 */
export interface SerializedSolidPaint {
  /** The kind tag. */
  readonly kind: 'solid';
  /** The color. */
  readonly color: SerializedColor;
}

/**
 * @summary The union of every serialized paint variant.
 *
 * @description
 * Today the union has one variant. A future gradient or pattern variant
 * extends the union without a breaking change.
 *
 * @see {@linkcode SerializedSolidPaint}
 * @author MathAid
 */
export type SerializedPaint = SerializedSolidPaint;

/**
 * @summary The serialized form of a {@linkcode StrokeStyle}.
 *
 * @description
 * The `paint` field is required. Every other field is optional. A field
 * that matches the runtime default is omitted.
 *
 * @example
 * Example 1: A minimal stroke
 * ```ts
 * const s: SerializedStrokeStyle = {
 *   paint: { kind: 'solid', color: ['sRGB', 1, 1, 1, 1] },
 * };
 * ```
 *
 * @example 2: A dashed stroke with round joins
 * ```ts
 * const s: SerializedStrokeStyle = {
 *   paint: { kind: 'solid', color: ['sRGB', 1, 0, 0, 1] },
 *   width: 4,
 *   cap: 'round',
 *   join: 'round',
 *   dash: [8, 4],
 * };
 * ```
 *
 * @see {@linkcode SerializedPaint}
 * @author MathAid
 */
export interface SerializedStrokeStyle {
  /** The stroke color. */
  readonly paint: SerializedPaint;
  /** The line thickness. */
  readonly width?: number;
  /** The cap style. */
  readonly cap?: 'butt' | 'round' | 'square';
  /** The join style. */
  readonly join?: 'miter' | 'round' | 'bevel';
  /** The miter cut-off. */
  readonly miterLimit?: number;
  /** The dash pattern. */
  readonly dash?: readonly number[];
  /** The phase into the dash pattern. */
  readonly dashOffset?: number;
}

/**
 * @summary The serialized form of a {@linkcode TextStyle}.
 *
 * @description
 * Every field is optional. The codec omits a field when it matches the
 * runtime default.
 *
 * @example
 * Example 1: A minimal style
 * ```ts
 * const s: SerializedTextStyle = { size: 16 };
 * ```
 *
 * @example 2: A centered title
 * ```ts
 * const s: SerializedTextStyle = {
 *   paint: { kind: 'solid', color: ['sRGB', 1, 1, 1, 1] },
 *   size: 32,
 *   align: 'center',
 *   baseline: 'middle',
 * };
 * ```
 *
 * @see {@linkcode SerializedPaint}
 * @author MathAid
 */
export interface SerializedTextStyle {
  /** The fill color. */
  readonly paint?: SerializedPaint;
  /** The point size. */
  readonly size?: number;
  /** The font family. */
  readonly family?: string;
  /** The horizontal alignment. */
  readonly align?: 'left' | 'center' | 'right';
  /** The vertical baseline. */
  readonly baseline?: 'top' | 'middle' | 'bottom' | 'alphabetic';
}

// -----------------------------------------------------------------
//  Shape
// -----------------------------------------------------------------

/**
 * @summary The serialized form of a {@linkcode LineShape}.
 *
 * @description
 * Two points and the `'line'` tag.
 *
 * @example
 * Example 1: A segment
 * ```ts
 * const s: SerializedLineShape = {
 *   kind: 'line',
 *   from: { x: 0, y: 0 },
 *   to: { x: 10, y: 10 },
 * };
 * ```
 *
 * @see {@linkcode SerializedShape}
 * @author MathAid
 */
export interface SerializedLineShape {
  /** The kind tag. */
  readonly kind: 'line';
  /** The start point. */
  readonly from: SerializedPoint;
  /** The end point. */
  readonly to: SerializedPoint;
}

/**
 * @summary The serialized form of a {@linkcode PolygonShape}.
 *
 * @example
 * Example 1: A triangle
 * ```ts
 * const s: SerializedPolygonShape = {
 *   kind: 'polygon',
 *   points: [
 *     { x: 0, y: 0 },
 *     { x: 10, y: 0 },
 *     { x: 5, y: 10 },
 *   ],
 *   closed: true,
 * };
 * ```
 *
 * @see {@linkcode SerializedShape}
 * @author MathAid
 */
export interface SerializedPolygonShape {
  /** The kind tag. */
  readonly kind: 'polygon';
  /** The vertices in drawing order. */
  readonly points: readonly SerializedPoint[];
  /** Whether the last vertex connects back to the first. */
  readonly closed: boolean;
}

/**
 * @summary The serialized form of a {@linkcode RectShape}.
 *
 * @example
 * Example 1: A pill
 * ```ts
 * const s: SerializedRectShape = {
 *   kind: 'rect',
 *   rect: { x: 0, y: 0, width: 100, height: 30 },
 *   cornerRadius: 15,
 * };
 * ```
 *
 * @example 2: Per-corner radii
 * ```ts
 * const s: SerializedRectShape = {
 *   kind: 'rect',
 *   rect: { x: 0, y: 0, width: 100, height: 30 },
 *   cornerRadius: [8, 0, 8, 0],
 * };
 * ```
 *
 * @see {@linkcode SerializedShape}
 * @author MathAid
 */
export interface SerializedRectShape {
  /** The kind tag. */
  readonly kind: 'rect';
  /** The rectangle geometry. */
  readonly rect: SerializedRect;
  /** The corner radii. */
  readonly cornerRadius?:
    | number
    | readonly [number, number, number, number];
}

/**
 * @summary The serialized form of an {@linkcode EllipseShape}.
 *
 * @example
 * Example 1: A circle
 * ```ts
 * const s: SerializedEllipseShape = {
 *   kind: 'ellipse',
 *   center: { x: 50, y: 50 },
 *   radiusX: 20,
 *   radiusY: 20,
 * };
 * ```
 *
 * @example 2: A rotated arc
 * ```ts
 * const s: SerializedEllipseShape = {
 *   kind: 'ellipse',
 *   center: { x: 0, y: 0 },
 *   radiusX: 10,
 *   radiusY: 10,
 *   rotation: 0.7853981633974483,
 *   startAngle: 0,
 *   endAngle: 3.141592653589793,
 * };
 * ```
 *
 * @see {@linkcode SerializedShape}
 * @author MathAid
 */
export interface SerializedEllipseShape {
  /** The kind tag. */
  readonly kind: 'ellipse';
  /** The center point. */
  readonly center: SerializedPoint;
  /** The horizontal radius. */
  readonly radiusX: number;
  /** The vertical radius. */
  readonly radiusY: number;
  /** The rotation in radians. */
  readonly rotation?: number;
  /** The start angle in radians. */
  readonly startAngle?: number;
  /** The end angle in radians. */
  readonly endAngle?: number;
}

/**
 * @summary The serialized form of a {@linkcode PathSegment}.
 *
 * @description
 * A discriminated union keyed by `kind`. Every variant matches the
 * runtime shape with the points replaced by {@linkcode SerializedPoint}
 * values.
 *
 * @example
 * Example 1: A move
 * ```ts
 * const s: SerializedPathSegment = { kind: 'move', to: { x: 0, y: 0 } };
 * ```
 *
 * @example 2: A cubic
 * ```ts
 * const s: SerializedPathSegment = {
 *   kind: 'cubic',
 *   c1: { x: 0, y: 10 },
 *   c2: { x: 10, y: 10 },
 *   to: { x: 10, y: 0 },
 * };
 * ```
 *
 * @see {@linkcode SerializedPathShape}
 * @author MathAid
 */
export type SerializedPathSegment =
  | { readonly kind: 'move'; readonly to: SerializedPoint }
  | { readonly kind: 'line'; readonly to: SerializedPoint }
  | {
      readonly kind: 'quadratic';
      readonly control: SerializedPoint;
      readonly to: SerializedPoint;
    }
  | {
      readonly kind: 'cubic';
      readonly c1: SerializedPoint;
      readonly c2: SerializedPoint;
      readonly to: SerializedPoint;
    }
  | {
      readonly kind: 'arc';
      readonly rx: number;
      readonly ry: number;
      readonly rotation: number;
      readonly largeArc: boolean;
      readonly sweep: boolean;
      readonly to: SerializedPoint;
    }
  | { readonly kind: 'close' };

/**
 * @summary The serialized form of a {@linkcode PathShape}.
 *
 * @example
 * Example 1: A triangle path
 * ```ts
 * const s: SerializedPathShape = {
 *   kind: 'path',
 *   segments: [
 *     { kind: 'move', to: { x: 0, y: 0 } },
 *     { kind: 'line', to: { x: 10, y: 0 } },
 *     { kind: 'line', to: { x: 5, y: 10 } },
 *     { kind: 'close' },
 *   ],
 * };
 * ```
 *
 * @see {@linkcode SerializedPathSegment}
 * @author MathAid
 */
export interface SerializedPathShape {
  /** The kind tag. */
  readonly kind: 'path';
  /** The segments in drawing order. */
  readonly segments: readonly SerializedPathSegment[];
}

/**
 * @summary The serialized form of a {@linkcode GroupShape}.
 *
 * @example
 * Example 1: A group of two shapes
 * ```ts
 * const s: SerializedGroupShape = {
 *   kind: 'group',
 *   shapes: [
 *     { kind: 'rect', rect: { x: 0, y: 0, width: 10, height: 10 } },
 *     { kind: 'line', from: { x: 0, y: 0 }, to: { x: 10, y: 10 } },
 *   ],
 * };
 * ```
 *
 * @see {@linkcode SerializedShape}
 * @author MathAid
 */
export interface SerializedGroupShape {
  /** The kind tag. */
  readonly kind: 'group';
  /** The child shapes. */
  readonly shapes: readonly SerializedShape[];
}

/**
 * @summary The union of every serialized shape variant.
 *
 * @description
 * A discriminated union keyed by `kind`. The union is closed. The codec
 * throws on an unknown kind.
 *
 * @example
 * Example 1: A polygon
 * ```ts
 * const s: SerializedShape = {
 *   kind: 'polygon',
 *   points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
 *   closed: true,
 * };
 * ```
 *
 * @example 2: A nested group
 * ```ts
 * const s: SerializedShape = {
 *   kind: 'group',
 *   shapes: [
 *     { kind: 'ellipse', center: { x: 0, y: 0 }, radiusX: 5, radiusY: 5 },
 *   ],
 * };
 * ```
 *
 * @see {@linkcode SerializedLineShape}
 * @see {@linkcode SerializedPolygonShape}
 * @see {@linkcode SerializedRectShape}
 * @see {@linkcode SerializedEllipseShape}
 * @see {@linkcode SerializedPathShape}
 * @see {@linkcode SerializedGroupShape}
 * @author MathAid
 */
export type SerializedShape =
  | SerializedLineShape
  | SerializedPolygonShape
  | SerializedRectShape
  | SerializedEllipseShape
  | SerializedPathShape
  | SerializedGroupShape;

// -----------------------------------------------------------------
//  Commands
// -----------------------------------------------------------------

/**
 * @summary The serialized form of a {@linkcode ClearCommand}.
 *
 * @example
 * Example 1: A clear to black
 * ```ts
 * const c: SerializedCommand = {
 *   kind: 'clear',
 *   paint: { kind: 'solid', color: ['sRGB', 0, 0, 0, 1] },
 * };
 * ```
 *
 * @example 2: A transparent clear
 * ```ts
 * const c: SerializedCommand = { kind: 'clear' };
 * ```
 *
 * @see {@linkcode SerializedCommand}
 * @author MathAid
 */
export interface SerializedClearCommand {
  /** The kind tag. */
  readonly kind: 'clear';
  /** The fill paint. Optional. */
  readonly paint?: SerializedPaint;
}

/**
 * @summary The serialized form of a `set-background` command.
 *
 * @example
 * Example 1: A solid background
 * ```ts
 * const c: SerializedCommand = {
 *   kind: 'set-background',
 *   paint: { kind: 'solid', color: ['sRGB', 0.1, 0.1, 0.1, 1] },
 * };
 * ```
 *
 * @example 2: Disable the background
 * ```ts
 * const c: SerializedCommand = { kind: 'set-background', paint: null };
 * ```
 *
 * @see {@linkcode SerializedCommand}
 * @author MathAid
 */
export interface SerializedSetBackgroundCommand {
  /** The kind tag. */
  readonly kind: 'set-background';
  /** The paint, or `null` to disable. */
  readonly paint: SerializedPaint | null;
}

/**
 * @summary The serialized form of a `set-fill` command.
 *
 * @example
 * Example 1: A red fill
 * ```ts
 * const c: SerializedCommand = {
 *   kind: 'set-fill',
 *   paint: { kind: 'solid', color: ['sRGB', 1, 0, 0, 1] },
 * };
 * ```
 *
 * @example 2: Disable the fill
 * ```ts
 * const c: SerializedCommand = { kind: 'set-fill', paint: null };
 * ```
 *
 * @see {@linkcode SerializedCommand}
 * @author MathAid
 */
export interface SerializedSetFillCommand {
  /** The kind tag. */
  readonly kind: 'set-fill';
  /** The paint, or `null` to disable. */
  readonly paint: SerializedPaint | null;
}

/**
 * @summary The serialized form of a `set-stroke` command.
 *
 * @example
 * Example 1: A white outline
 * ```ts
 * const c: SerializedCommand = {
 *   kind: 'set-stroke',
 *   stroke: { paint: { kind: 'solid', color: ['sRGB', 1, 1, 1, 1] }, width: 2 },
 * };
 * ```
 *
 * @example 2: Disable the stroke
 * ```ts
 * const c: SerializedCommand = { kind: 'set-stroke', stroke: null };
 * ```
 *
 * @see {@linkcode SerializedCommand}
 * @author MathAid
 */
export interface SerializedSetStrokeCommand {
  /** The kind tag. */
  readonly kind: 'set-stroke';
  /** The stroke style, or `null` to disable. */
  readonly stroke: SerializedStrokeStyle | null;
}

/**
 * @summary The serialized form of a `set-transform` command.
 *
 * @example
 * Example 1: A translation
 * ```ts
 * const c: SerializedCommand = {
 *   kind: 'set-transform',
 *   transform: [1, 0, 0, 1, 100, 50],
 * };
 * ```
 *
 * @example 2: A rotation
 * ```ts
 * const s = Math.SQRT1_2;
 * const c: SerializedCommand = {
 *   kind: 'set-transform',
 *   transform: [s, s, -s, s, 0, 0],
 * };
 * ```
 *
 * @see {@linkcode SerializedCommand}
 * @author MathAid
 */
export interface SerializedSetTransformCommand {
  /** The kind tag. */
  readonly kind: 'set-transform';
  /** The matrix. */
  readonly transform: SerializedMat2D;
}

/**
 * @summary The serialized form of a `fill-shape` command.
 *
 * @example
 * Example 1: Fill a rectangle
 * ```ts
 * const c: SerializedCommand = {
 *   kind: 'fill-shape',
 *   shape: { kind: 'rect', rect: { x: 0, y: 0, width: 32, height: 32 } },
 *   paint: { kind: 'solid', color: ['sRGB', 1, 0, 0, 1] },
 * };
 * ```
 *
 * @example 2: Fill with the current state
 * ```ts
 * const c: SerializedCommand = {
 *   kind: 'fill-shape',
 *   shape: { kind: 'ellipse', center: { x: 50, y: 50 }, radiusX: 10, radiusY: 10 },
 * };
 * ```
 *
 * @see {@linkcode SerializedCommand}
 * @author MathAid
 */
export interface SerializedFillShapeCommand {
  /** The kind tag. */
  readonly kind: 'fill-shape';
  /** The shape geometry. */
  readonly shape: SerializedShape;
  /** The fill paint override. Optional. */
  readonly paint?: SerializedPaint;
}

/**
 * @summary The serialized form of a `stroke-shape` command.
 *
 * @example
 * Example 1: Stroke a polygon
 * ```ts
 * const c: SerializedCommand = {
 *   kind: 'stroke-shape',
 *   shape: {
 *     kind: 'polygon',
 *     points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }],
 *     closed: true,
 *   },
 *   stroke: { paint: { kind: 'solid', color: ['sRGB', 1, 1, 1, 1] } },
 * };
 * ```
 *
 * @example 2: Stroke with the current state
 * ```ts
 * const c: SerializedCommand = {
 *   kind: 'stroke-shape',
 *   shape: { kind: 'rect', rect: { x: 0, y: 0, width: 32, height: 32 } },
 * };
 * ```
 *
 * @see {@linkcode SerializedCommand}
 * @author MathAid
 */
export interface SerializedStrokeShapeCommand {
  /** The kind tag. */
  readonly kind: 'stroke-shape';
  /** The shape geometry. */
  readonly shape: SerializedShape;
  /** The stroke style override. Optional. */
  readonly stroke?: SerializedStrokeStyle;
}

/**
 * @summary The serialized form of a `clip` command.
 *
 * @example
 * Example 1: Clip to a rectangle
 * ```ts
 * const c: SerializedCommand = {
 *   kind: 'clip',
 *   shape: { kind: 'rect', rect: { x: 0, y: 0, width: 100, height: 100 } },
 * };
 * ```
 *
 * @example 2: Clip to a circle
 * ```ts
 * const c: SerializedCommand = {
 *   kind: 'clip',
 *   shape: { kind: 'ellipse', center: { x: 50, y: 50 }, radiusX: 25, radiusY: 25 },
 * };
 * ```
 *
 * @see {@linkcode SerializedCommand}
 * @author MathAid
 */
export interface SerializedClipCommand {
  /** The kind tag. */
  readonly kind: 'clip';
  /** The clip shape. */
  readonly shape: SerializedShape;
}

/**
 * @summary The serialized form of a `text` command.
 *
 * @example
 * Example 1: A score
 * ```ts
 * const c: SerializedCommand = {
 *   kind: 'text',
 *   text: 'SCORE 42',
 *   position: { x: 10, y: 10 },
 *   style: { size: 16 },
 * };
 * ```
 *
 * @example 2: A centered title
 * ```ts
 * const c: SerializedCommand = {
 *   kind: 'text',
 *   text: 'GAME OVER',
 *   position: { x: 320, y: 200 },
 *   style: { size: 32, align: 'center', baseline: 'middle' },
 * };
 * ```
 *
 * @see {@linkcode SerializedCommand}
 * @author MathAid
 */
export interface SerializedTextCommand {
  /** The kind tag. */
  readonly kind: 'text';
  /** The string to draw. */
  readonly text: string;
  /** The anchor position. */
  readonly position: SerializedPoint;
  /** The text style. */
  readonly style: SerializedTextStyle;
}

/**
 * @summary The serialized form of a `sprite` command.
 *
 * @example
 * Example 1: A sprite at a position
 * ```ts
 * const c: SerializedCommand = {
 *   kind: 'sprite',
 *   sprite: { id: 'ship' },
 *   transform: [1, 0, 0, 1, 100, 50],
 * };
 * ```
 *
 * @example 2: A scaled sprite
 * ```ts
 * const c: SerializedCommand = {
 *   kind: 'sprite',
 *   sprite: { id: 'invader-a' },
 *   transform: [2, 0, 0, 2, 200, 100],
 * };
 * ```
 *
 * @see {@linkcode SerializedCommand}
 * @author MathAid
 */
export interface SerializedSpriteCommand {
  /** The kind tag. */
  readonly kind: 'sprite';
  /** The sprite reference. */
  readonly sprite: { readonly id: string };
  /** The matrix. */
  readonly transform: SerializedMat2D;
}

/**
 * @summary The serialized form of a `push` command.
 *
 * @example
 * Example 1: A push
 * ```ts
 * const c: SerializedCommand = { kind: 'push' };
 * ```
 *
 * @see {@linkcode SerializedCommand}
 * @author MathAid
 */
export interface SerializedPushCommand {
  /** The kind tag. */
  readonly kind: 'push';
}

/**
 * @summary The serialized form of a `pop` command.
 *
 * @example
 * Example 1: A pop
 * ```ts
 * const c: SerializedCommand = { kind: 'pop' };
 * ```
 *
 * @see {@linkcode SerializedCommand}
 * @author MathAid
 */
export interface SerializedPopCommand {
  /** The kind tag. */
  readonly kind: 'pop';
}

/**
 * @summary The union of every serialized command variant.
 *
 * @description
 * A discriminated union keyed by `kind`. The union is closed. The codec
 * throws on an unknown kind.
 *
 * @example
 * Example 1: A complete frame
 * ```ts
 * const commands: SerializedCommand[] = [
 *   { kind: 'clear', paint: { kind: 'solid', color: ['sRGB', 0, 0, 0, 1] } },
 *   { kind: 'set-fill', paint: { kind: 'solid', color: ['sRGB', 1, 0, 0, 1] } },
 *   {
 *     kind: 'fill-shape',
 *     shape: { kind: 'rect', rect: { x: 0, y: 0, width: 32, height: 32 } },
 *   },
 *   { kind: 'push' },
 *   { kind: 'pop' },
 * ];
 * ```
 *
 * @see {@linkcode SerializedClearCommand}
 * @see {@linkcode SerializedFillShapeCommand}
 * @author MathAid
 */
export type SerializedCommand =
  | SerializedClearCommand
  | SerializedSetBackgroundCommand
  | SerializedSetFillCommand
  | SerializedSetStrokeCommand
  | SerializedSetTransformCommand
  | SerializedFillShapeCommand
  | SerializedStrokeShapeCommand
  | SerializedClipCommand
  | SerializedTextCommand
  | SerializedSpriteCommand
  | SerializedPushCommand
  | SerializedPopCommand;

/**
 * @summary The serialized form of an {@linkcode IFrame}.
 *
 * @description
 * A plain object with a single `commands` array. Every entry is a
 * {@linkcode SerializedCommand}.
 *
 * @example
 * Example 1: An empty frame
 * ```ts
 * const frame: SerializedFrame = { commands: [] };
 * ```
 *
 * @example 2: A frame with one clear
 * ```ts
 * const frame: SerializedFrame = {
 *   commands: [
 *     { kind: 'clear', paint: { kind: 'solid', color: ['sRGB', 0, 0, 0, 1] } },
 *   ],
 * };
 * ```
 *
 * @see {@linkcode SerializedCommand}
 * @author MathAid
 */
export interface SerializedFrame {
  /** The commands in draw order. */
  readonly commands: readonly SerializedCommand[];
}