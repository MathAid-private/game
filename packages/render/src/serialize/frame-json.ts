/**
 * @fileoverview
 * @summary JSON codec for render frames.
 *
 * @description
 * Provides the pair {@linkcode frameToSerialized} and
 * {@linkcode frameFromSerialized} that convert between a runtime
 * {@linkcode IFrame} and a {@linkcode SerializedFrame}. Provides the
 * pair {@linkcode toFrameJSON} and {@linkcode fromFrameJSON} that
 * convert between a serialized frame and a JSON string.
 *
 * The split matters. The serialized form is a plain, typed object. The
 * string form is what crosses a network or a disk boundary. A caller
 * that wants to inspect a frame without a string round trip uses the
 * object pair. A caller that wants to persist a frame uses the string
 * pair.
 *
 * ```text
 *   IFrame  --frameToSerialized-->  SerializedFrame  --toFrameJSON-->  string
 *   string  --fromFrameJSON-->      SerializedFrame  --frameFromSerialized-->  IFrame
 * ```
 *
 * Every command variant in the union has a serializer and a
 * deserializer. The codec is exhaustive. Adding a variant produces a
 * TypeScript error in the dispatch and forces the two functions to
 * handle it.
 *
 * @example
 * Example 1: Round trip through a string
 * ```ts
 * import { FrameBuilder, make, makeSolid, rect, sRGB, toFrameJSON, fromFrameJSON } from './index';
 *
 * const b = new FrameBuilder();
 * b.clear(makeSolid(make(sRGB, 0, 0, 0)));
 * b.fillRect(rect(0, 0, 32, 32), makeSolid(make(sRGB, 1, 0, 0)));
 *
 * const text = toFrameJSON(b);
 * const back = fromFrameJSON(text);
 * // back.commands.length === 2
 * ```
 *
 * @example
 * Example 2: Inspect a frame as JSON
 * ```ts
 * const text = toFrameJSON(builder);
 * console.log(JSON.parse(text));
 * ```
 *
 * @example
 * Example 3: Persist to disk
 * ```ts
 * import { writeFile } from 'node:fs/promises';
 * await writeFile('frame.json', toFrameJSON(builder));
 * ```
 *
 * @see {@linkcode SerializedFrame}
 * @see {@linkcode IFrame}
 * @author MathAid
 */

import { type ColorValue } from '../color/convert';
import { packColor, unpackColor } from '../color/serialize/palette';
import { type ColorSpaceDef } from '../color/space';
import { type RenderCommand, type SpriteRef } from '../command';
import { type IFrame } from '../frame';
import { type Paint } from '../geometry/paint';
import { type Point2D } from '../geometry/point';
import { type Rect } from '../geometry/rect';
import { type PathSegment, type Shape } from '../geometry/shape';
import { type StrokeStyle, type TextStyle } from '../geometry/style';
import { type Mat2D } from '../geometry/transform';
import {
  type SerializedColor,
  type SerializedCommand,
  type SerializedFrame,
  type SerializedMat2D,
  type SerializedPaint,
  type SerializedPathSegment,
  type SerializedPoint,
  type SerializedRect,
  type SerializedShape,
  type SerializedStrokeStyle,
  type SerializedTextStyle,
} from './frame-types';
import { validateSerializedFrame } from './validate';

// -----------------------------------------------------------------
//  Public API: object pair
// -----------------------------------------------------------------

/**
 * @summary Convert a runtime frame to its serialized form.
 *
 * @description
 * Walks the frame's commands and produces a plain, JSON-compatible
 * object. Colors are packed to five-element tuples. Shapes are nested
 * objects. Transforms are six-element arrays. No string encoding is
 * performed.
 *
 * @example
 * Example 1: A frame with one clear
 * ```ts
 * const b = new FrameBuilder();
 * b.clear(makeSolid(make(sRGB, 0, 0, 0)));
 * const s = frameToSerialized(b);
 * s.commands.length; // 1
 * ```
 *
 * @example 2: A frame with a filled rect
 * ```ts
 * const b = new FrameBuilder();
 * b.fillRect(rect(0, 0, 10, 10), makeSolid(make(sRGB, 1, 0, 0)));
 * const s = frameToSerialized(b);
 * s.commands[0]?.kind; // 'fill-shape'
 * ```
 *
 * @param {IFrame} frame The runtime frame.
 * @returns {SerializedFrame} The serialized frame.
 * @author MathAid
 */
export function frameToSerialized(frame: IFrame): SerializedFrame {
  return { commands: frame.commands.map(commandToSerialized) };
}

/**
 * @summary Convert a serialized frame back to its runtime form.
 *
 * @description
 * Rebuilds every command from its serialized form. Colors are unpacked
 * through the color registry. An unknown color space ID throws. A shape
 * kind that is not in the schema throws.
 *
 * The function does not validate the input. Callers that accept
 * untrusted data should run {@linkcode validateSerializedFrame} first.
 *
 * @example
 * Example 1: Round trip
 * ```ts
 * const s = frameToSerialized(builder);
 * const back = frameFromSerialized(s);
 * back.commands.length; // same as builder.commands.length
 * ```
 *
 * @example 2: With validation
 * ```ts
 * import { validateSerializedFrame } from './validate';
 * const s = JSON.parse(text);
 * validateSerializedFrame(s);
 * const back = frameFromSerialized(s);
 * ```
 *
 * @param {SerializedFrame} data The serialized frame.
 * @returns {IFrame} The runtime frame.
 * @throws {Error} When a color space ID or a shape kind is unknown.
 * @author MathAid
 */
export function frameFromSerialized(data: SerializedFrame): IFrame {
  return { commands: data.commands.map(commandFromSerialized) };
}

// -----------------------------------------------------------------
//  Public API: string pair
// -----------------------------------------------------------------

/**
 * @summary Encode a runtime frame to a JSON string.
 *
 * @description
 * Combines {@linkcode frameToSerialized} and `JSON.stringify`. The
 * output is a compact JSON string. A caller that needs pretty-printed
 * output can parse and re-serialize with their own options.
 *
 * @example
 * Example 1: Encode a frame
 * ```ts
 * const text = toFrameJSON(builder);
 * text.startsWith('{"commands":'); // true
 * ```
 *
 * @example 2: Include a frame in a larger payload
 * ```ts
 * const payload = { frame: toFrameJSON(builder), tick: 42 };
 * ```
 *
 * @param {IFrame} frame The runtime frame.
 * @returns {string} The JSON string.
 * @author MathAid
 */
export function toFrameJSON(frame: IFrame): string {
  return JSON.stringify(frameToSerialized(frame));
}

/**
 * @summary Decode a JSON string to a runtime frame.
 *
 * @description
 * Parses the string, validates the shape with
 * {@linkcode validateSerializedFrame}, and rebuilds the runtime frame.
 * A malformed string throws a `SyntaxError` from `JSON.parse`. A valid
 * JSON string with an invalid frame shape throws an `Error` from the
 * validator.
 *
 * @example
 * Example 1: Decode a frame
 * ```ts
 * const back = fromFrameJSON(text);
 * back.commands.length; // as many as were encoded
 * ```
 *
 * @example 2: Handle a malformed payload
 * ```ts
 * try {
 *   const back = fromFrameJSON(untrustedText);
 * } catch (e) {
 *   // SyntaxError or Error from the validator.
 * }
 * ```
 *
 * @param {string} text The JSON string.
 * @returns {IFrame} The runtime frame.
 * @throws {SyntaxError} When the string is not valid JSON.
 * @throws {Error} When the JSON is valid but the frame shape is invalid.
 * @author MathAid
 */
export function fromFrameJSON(text: string): IFrame {
  const parsed = JSON.parse(text) as unknown;
  validateSerializedFrame(parsed);
  return frameFromSerialized(parsed);
}

// -----------------------------------------------------------------
//  Command
// -----------------------------------------------------------------

function commandToSerialized(command: RenderCommand): SerializedCommand {
  switch (command.kind) {
    case 'clear':
      return command.paint === undefined
        ? { kind: 'clear' }
        : { kind: 'clear', paint: paintToSerialized(command.paint) };
    case 'set-background':
      return {
        kind: 'set-background',
        paint:
          command.paint === null ? null : paintToSerialized(command.paint),
      };
    case 'set-fill':
      return {
        kind: 'set-fill',
        paint:
          command.paint === null ? null : paintToSerialized(command.paint),
      };
    case 'set-stroke':
      return {
        kind: 'set-stroke',
        stroke:
          command.stroke === null ? null : strokeToSerialized(command.stroke),
      };
    case 'set-transform':
      return { kind: 'set-transform', transform: command.transform };
    case 'fill-shape':
      return command.paint === undefined
        ? { kind: 'fill-shape', shape: shapeToSerialized(command.shape) }
        : {
            kind: 'fill-shape',
            shape: shapeToSerialized(command.shape),
            paint: paintToSerialized(command.paint),
          };
    case 'stroke-shape':
      return command.stroke === undefined
        ? { kind: 'stroke-shape', shape: shapeToSerialized(command.shape) }
        : {
            kind: 'stroke-shape',
            shape: shapeToSerialized(command.shape),
            stroke: strokeToSerialized(command.stroke),
          };
    case 'clip':
      return { kind: 'clip', shape: shapeToSerialized(command.shape) };
    case 'text':
      return {
        kind: 'text',
        text: command.text,
        position: command.position,
        style: textStyleToSerialized(command.style),
      };
    case 'sprite':
      return {
        kind: 'sprite',
        sprite: command.sprite,
        transform: command.transform,
      };
    case 'push':
      return { kind: 'push' };
    case 'pop':
      return { kind: 'pop' };
  }
}

function commandFromSerialized(data: SerializedCommand): RenderCommand {
  switch (data.kind) {
    case 'clear':
      return data.paint === undefined
        ? { kind: 'clear' }
        : { kind: 'clear', paint: paintFromSerialized(data.paint) };
    case 'set-background':
      return {
        kind: 'set-background',
        paint:
          data.paint === null ? null : paintFromSerialized(data.paint),
      };
    case 'set-fill':
      return {
        kind: 'set-fill',
        paint:
          data.paint === null ? null : paintFromSerialized(data.paint),
      };
    case 'set-stroke':
      return {
        kind: 'set-stroke',
        stroke:
          data.stroke === null ? null : strokeFromSerialized(data.stroke),
      };
    case 'set-transform':
      return { kind: 'set-transform', transform: data.transform };
    case 'fill-shape':
      return data.paint === undefined
        ? { kind: 'fill-shape', shape: shapeFromSerialized(data.shape) }
        : {
            kind: 'fill-shape',
            shape: shapeFromSerialized(data.shape),
            paint: paintFromSerialized(data.paint),
          };
    case 'stroke-shape':
      return data.stroke === undefined
        ? { kind: 'stroke-shape', shape: shapeFromSerialized(data.shape) }
        : {
            kind: 'stroke-shape',
            shape: shapeFromSerialized(data.shape),
            stroke: strokeFromSerialized(data.stroke),
          };
    case 'clip':
      return { kind: 'clip', shape: shapeFromSerialized(data.shape) };
    case 'text':
      return {
        kind: 'text',
        text: data.text,
        position: data.position,
        style: textStyleFromSerialized(data.style),
      };
    case 'sprite':
      return {
        kind: 'sprite',
        sprite: data.sprite,
        transform: data.transform,
      };
    case 'push':
      return { kind: 'push' };
    case 'pop':
      return { kind: 'pop' };
  }
}

// -----------------------------------------------------------------
//  Paint
// -----------------------------------------------------------------

function paintToSerialized(paint: Paint): SerializedPaint {
  return { kind: 'solid', color: packColor(paint.color) };
}

function paintFromSerialized(data: SerializedPaint): Paint {
  return { kind: 'solid', color: unpackColor(data.color) };
}

// -----------------------------------------------------------------
//  Stroke style
// -----------------------------------------------------------------

function strokeToSerialized(stroke: StrokeStyle): SerializedStrokeStyle {
  const out: SerializedStrokeStyle = {
    paint: paintToSerialized(stroke.paint),
  };
  // Rebuild with only the fields that were set. This keeps the JSON
  // minimal and matches the "omit defaults" convention.
  const result: Record<string, unknown> = { paint: out.paint };
  if (stroke.width !== undefined) result.width = stroke.width;
  if (stroke.cap !== undefined) result.cap = stroke.cap;
  if (stroke.join !== undefined) result.join = stroke.join;
  if (stroke.miterLimit !== undefined) result.miterLimit = stroke.miterLimit;
  if (stroke.dash !== undefined) result.dash = stroke.dash;
  if (stroke.dashOffset !== undefined) result.dashOffset = stroke.dashOffset;
  return result as unknown as SerializedStrokeStyle;
}

function strokeFromSerialized(data: SerializedStrokeStyle): StrokeStyle {
  const out: {
    paint: Paint;
    width?: number;
    cap?: 'butt' | 'round' | 'square';
    join?: 'miter' | 'round' | 'bevel';
    miterLimit?: number;
    dash?: readonly number[];
    dashOffset?: number;
  } = { paint: paintFromSerialized(data.paint) };
  if (data.width !== undefined) out.width = data.width;
  if (data.cap !== undefined) out.cap = data.cap;
  if (data.join !== undefined) out.join = data.join;
  if (data.miterLimit !== undefined) out.miterLimit = data.miterLimit;
  if (data.dash !== undefined) out.dash = data.dash;
  if (data.dashOffset !== undefined) out.dashOffset = data.dashOffset;
  return out;
}

// -----------------------------------------------------------------
//  Text style
// -----------------------------------------------------------------

function textStyleToSerialized(style: TextStyle): SerializedTextStyle {
  const out: Record<string, unknown> = {};
  if (style.paint !== undefined) out.paint = paintToSerialized(style.paint);
  if (style.size !== undefined) out.size = style.size;
  if (style.family !== undefined) out.family = style.family;
  if (style.align !== undefined) out.align = style.align;
  if (style.baseline !== undefined) out.baseline = style.baseline;
  return out as unknown as SerializedTextStyle;
}

function textStyleFromSerialized(data: SerializedTextStyle): TextStyle {
  const out: {
    paint?: Paint;
    size?: number;
    family?: string;
    align?: 'left' | 'center' | 'right';
    baseline?: 'top' | 'middle' | 'bottom' | 'alphabetic';
  } = {};
  if (data.paint !== undefined) out.paint = paintFromSerialized(data.paint);
  if (data.size !== undefined) out.size = data.size;
  if (data.family !== undefined) out.family = data.family;
  if (data.align !== undefined) out.align = data.align;
  if (data.baseline !== undefined) out.baseline = data.baseline;
  return out;
}

// -----------------------------------------------------------------
//  Shape
// -----------------------------------------------------------------

function shapeToSerialized(shape: Shape): SerializedShape {
  switch (shape.kind) {
    case 'line':
      return { kind: 'line', from: shape.from, to: shape.to };
    case 'polygon':
      return {
        kind: 'polygon',
        points: shape.points,
        closed: shape.closed,
      };
    case 'rect':
      return shape.cornerRadius === undefined
        ? { kind: 'rect', rect: shape.rect }
        : {
            kind: 'rect',
            rect: shape.rect,
            cornerRadius: shape.cornerRadius,
          };
    case 'ellipse': {
      const out: Record<string, unknown> = {
        kind: 'ellipse',
        center: shape.center,
        radiusX: shape.radiusX,
        radiusY: shape.radiusY,
      };
      if (shape.rotation !== undefined) out.rotation = shape.rotation;
      if (shape.startAngle !== undefined) out.startAngle = shape.startAngle;
      if (shape.endAngle !== undefined) out.endAngle = shape.endAngle;
      return out as unknown as SerializedShape;
    }
    case 'path':
      return {
        kind: 'path',
        segments: shape.segments.map(segmentToSerialized),
      };
    case 'group':
      return {
        kind: 'group',
        shapes: shape.shapes.map(shapeToSerialized),
      };
  }
}

function shapeFromSerialized(data: SerializedShape): Shape {
  switch (data.kind) {
    case 'line':
      return { kind: 'line', from: data.from, to: data.to };
    case 'polygon':
      return {
        kind: 'polygon',
        points: data.points,
        closed: data.closed,
      };
    case 'rect':
      return data.cornerRadius === undefined
        ? { kind: 'rect', rect: data.rect }
        : {
            kind: 'rect',
            rect: data.rect,
            cornerRadius: data.cornerRadius,
          };
    case 'ellipse': {
      const out: {
        kind: 'ellipse';
        center: Point2D;
        radiusX: number;
        radiusY: number;
        rotation?: number;
        startAngle?: number;
        endAngle?: number;
      } = {
        kind: 'ellipse',
        center: data.center,
        radiusX: data.radiusX,
        radiusY: data.radiusY,
      };
      if (data.rotation !== undefined) out.rotation = data.rotation;
      if (data.startAngle !== undefined) out.startAngle = data.startAngle;
      if (data.endAngle !== undefined) out.endAngle = data.endAngle;
      return out;
    }
    case 'path':
      return {
        kind: 'path',
        segments: data.segments.map(segmentFromSerialized),
      };
    case 'group':
      return {
        kind: 'group',
        shapes: data.shapes.map(shapeFromSerialized),
      };
  }
}

// -----------------------------------------------------------------
//  Path segment
// -----------------------------------------------------------------

function segmentToSerialized(seg: PathSegment): SerializedPathSegment {
  return seg;
}

function segmentFromSerialized(data: SerializedPathSegment): PathSegment {
  return data;
}

// -----------------------------------------------------------------
//  Internal type re-exports
// -----------------------------------------------------------------

// Keep the unused-type imports referenced so consumers that import the
// runtime frame type from here do not trip on the tree-shaker.
export type {
  SerializedColor,
  SerializedFrame,
  SerializedMat2D,
  SerializedPaint,
  SerializedPoint,
  SerializedRect,
  SerializedShape,
  SerializedStrokeStyle,
  SerializedTextStyle
};

// The following imports are used in JSDoc references but not in code.
// Silence the unused-import linter.
  export type { ColorSpaceDef, ColorValue, Rect, SpriteRef };
void (null as unknown as Mat2D);