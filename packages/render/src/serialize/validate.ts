/**
 * @fileoverview
 * @summary Validation helpers for the frame schema.
 *
 * @description
 * Provides runtime validators for a {@linkcode SerializedFrame} and its
 * parts. The validators throw on malformed input with a message that
 * names the failing field.
 *
 * The validators are defensive. They reject unknown shape kinds, unknown
 * command kinds, non-finite numbers, and non-string space identifiers.
 * They do not verify that a color space ID exists in the registry. That
 * check happens when the codec rebuilds a {@linkcode ColorValue}.
 *
 * ```text
 *   validateSerializedFrame    top-level entry
 *   validateSerializedCommand  one command
 *   validateSerializedShape    recursive
 *   validateSerializedPaint    one paint
 *   validateSerializedColor    the five-element tuple
 * ```
 *
 * @example
 * Example 1: Reject an unknown command kind
 * ```ts
 * import { validateSerializedFrame } from './validate';
 *
 * try {
 *   validateSerializedFrame({ commands: [{ kind: 'nope' }] });
 * } catch (e) {
 *   // Error: validateSerializedFrame: unknown command kind "nope".
 * }
 * ```
 *
 * @example 2: Accept a valid frame
 * ```ts
 * validateSerializedFrame({ commands: [{ kind: 'push' }] });
 * // Returns void. No throw.
 * ```
 *
 * @see {@linkcode SerializedFrame}
 * @author MathAid
 */

import {
  type SerializedColor,
  type SerializedCommand,
  type SerializedFrame,
  type SerializedPaint,
  type SerializedPathSegment,
  type SerializedShape,
} from './frame-types';

/**
 * @summary Validate a {@linkcode SerializedFrame}.
 *
 * @description
 * Checks that the value is an object with a `commands` array. Checks
 * every command in the array with
 * {@linkcode validateSerializedCommand}.
 *
 * @example
 * Example 1: An empty frame
 * ```ts
 * validateSerializedFrame({ commands: [] });
 * ```
 *
 * @example 2: A malformed frame
 * ```ts
 * try {
 *   validateSerializedFrame({ commands: 'nope' as never });
 * } catch (e) {
 *   // Error: commands must be an array.
 * }
 * ```
 *
 * @param {unknown} value The value to validate.
 * @returns {void}
 * @throws {Error} When the value does not match the schema.
 * @author MathAid
 */
export function validateSerializedFrame(value: unknown): asserts value is SerializedFrame {
  if (value === null || typeof value !== 'object') {
    throw new Error('validateSerializedFrame: value must be an object.');
  }
  const v = value as { commands?: unknown };
  if (!Array.isArray(v.commands)) {
    throw new Error('validateSerializedFrame: commands must be an array.');
  }
  for (let i = 0; i < v.commands.length; i++) {
    try {
      validateSerializedCommand(v.commands[i]);
    } catch (err) {
      throw new Error(
        `validateSerializedFrame: command ${i}: ${(err as Error).message}`,
      );
    }
  }
}

/**
 * @summary Validate a {@linkcode SerializedCommand}.
 *
 * @description
 * Dispatches on the `kind` tag and validates the variant's fields.
 *
 * @example
 * Example 1: A push
 * ```ts
 * validateSerializedCommand({ kind: 'push' });
 * ```
 *
 * @example 2: An invalid kind
 * ```ts
 * try {
 *   validateSerializedCommand({ kind: 'bogus' });
 * } catch (e) {
 *   // Error: unknown command kind "bogus".
 * }
 * ```
 *
 * @param {unknown} value The value to validate.
 * @returns {void}
 * @throws {Error} When the value does not match the schema.
 * @author MathAid
 */
export function validateSerializedCommand(
  value: unknown,
): asserts value is SerializedCommand {
  if (value === null || typeof value !== 'object') {
    throw new Error('command must be an object.');
  }
  const v = value as { kind?: unknown };
  const kind = v.kind;
  if (typeof kind !== 'string') {
    throw new Error('command.kind must be a string.');
  }
  switch (kind) {
    case 'clear':
      validateOptionalPaint((value as { paint?: unknown }).paint);
      return;
    case 'set-background':
    case 'set-fill':
      validatePaintOrNull((value as { paint?: unknown }).paint);
      return;
    case 'set-stroke':
      validateStrokeOrNull((value as { stroke?: unknown }).stroke);
      return;
    case 'set-transform':
      validateMat2D((value as { transform?: unknown }).transform);
      return;
    case 'fill-shape':
      validateSerializedShape((value as { shape?: unknown }).shape);
      validateOptionalPaint((value as { paint?: unknown }).paint);
      return;
    case 'stroke-shape':
      validateSerializedShape((value as { shape?: unknown }).shape);
      validateOptionalStroke((value as { stroke?: unknown }).stroke);
      return;
    case 'clip':
      validateSerializedShape((value as { shape?: unknown }).shape);
      return;
    case 'text':
      validateTextCommand(value);
      return;
    case 'sprite':
      validateSpriteCommand(value);
      return;
    case 'push':
    case 'pop':
      return;
    default:
      throw new Error(`command.kind: unknown value "${kind}".`);
  }
}

/**
 * @summary Validate a {@linkcode SerializedShape}.
 *
 * @description
 * Dispatches on the `kind` tag. Recurses into groups and paths.
 *
 * @example
 * Example 1: A rect
 * ```ts
 * validateSerializedShape({
 *   kind: 'rect',
 *   rect: { x: 0, y: 0, width: 10, height: 10 },
 * });
 * ```
 *
 * @example 2: An unknown shape kind
 * ```ts
 * try {
 *   validateSerializedShape({ kind: 'hexagon' });
 * } catch (e) {
 *   // Error: shape.kind: unknown value "hexagon".
 * }
 * ```
 *
 * @param {unknown} value The value to validate.
 * @returns {void}
 * @throws {Error} When the value does not match the schema.
 * @author MathAid
 */
export function validateSerializedShape(
  value: unknown,
): asserts value is SerializedShape {
  if (value === null || typeof value !== 'object') {
    throw new Error('shape must be an object.');
  }
  const v = value as { kind?: unknown };
  if (typeof v.kind !== 'string') {
    throw new Error('shape.kind must be a string.');
  }
  switch (v.kind) {
    case 'line':
      validatePointField(value, 'from');
      validatePointField(value, 'to');
      return;
    case 'polygon':
      validatePolygonShape(value);
      return;
    case 'rect':
      validateRectShape(value);
      return;
    case 'ellipse':
      validateEllipseShape(value);
      return;
    case 'path':
      validatePathShape(value);
      return;
    case 'group':
      validateGroupShape(value);
      return;
    default:
      throw new Error(`shape.kind: unknown value "${v.kind}".`);
  }
}

/**
 * @summary Validate a {@linkcode SerializedColor} tuple.
 *
 * @description
 * Checks the five-element layout. The first element is a string. The
 * next four are finite numbers.
 *
 * @example
 * Example 1: A valid color
 * ```ts
 * validateSerializedColor(['sRGB', 1, 0, 0, 1]);
 * ```
 *
 * @example 2: A non-finite channel
 * ```ts
 * try {
 *   validateSerializedColor(['sRGB', NaN, 0, 0, 1]);
 * } catch (e) {
 *   // Error: color[1] is not a finite number.
 * }
 * ```
 *
 * @param {unknown} value The value to validate.
 * @returns {void}
 * @throws {Error} When the value does not match the schema.
 * @author MathAid
 */
export function validateSerializedColor(
  value: unknown,
): asserts value is SerializedColor {
  if (!Array.isArray(value)) {
    throw new Error('color must be an array.');
  }
  if (value.length !== 5) {
    throw new Error(`color must have 5 elements, got ${value.length}.`);
  }
  if (typeof value[0] !== 'string') {
    throw new Error('color[0] (spaceId) must be a string.');
  }
  for (let i = 1; i < 5; i++) {
    const n = value[i];
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      throw new Error(`color[${i}] is not a finite number.`);
    }
  }
}

/**
 * @summary Validate a {@linkcode SerializedPaint}.
 *
 * @description
 * Dispatches on the `kind` tag. Today only `'solid'` is supported.
 *
 * @example
 * Example 1: A solid
 * ```ts
 * validateSerializedPaint({ kind: 'solid', color: ['sRGB', 1, 0, 0, 1] });
 * ```
 *
 * @example 2: An unknown paint kind
 * ```ts
 * try {
 *   validateSerializedPaint({ kind: 'gradient' });
 * } catch (e) {
 *   // Error: paint.kind: unknown value "gradient".
 * }
 * ```
 *
 * @param {unknown} value The value to validate.
 * @returns {void}
 * @throws {Error} When the value does not match the schema.
 * @author MathAid
 */
export function validateSerializedPaint(
  value: unknown,
): asserts value is SerializedPaint {
  if (value === null || typeof value !== 'object') {
    throw new Error('paint must be an object.');
  }
  const v = value as { kind?: unknown };
  if (v.kind !== 'solid') {
    throw new Error(`paint.kind: unknown value "${String(v.kind)}".`);
  }
  validateSerializedColor((value as { color?: unknown }).color);
}

// -----------------------------------------------------------------
//  Private helpers
// -----------------------------------------------------------------

function validateOptionalPaint(value: unknown): void {
  if (value === undefined) return;
  validateSerializedPaint(value);
}

function validatePaintOrNull(value: unknown): void {
  if (value === null) return;
  validateSerializedPaint(value);
}

function validateOptionalStroke(value: unknown): void {
  if (value === undefined) return;
  validateStroke(value);
}

function validateStrokeOrNull(value: unknown): void {
  if (value === null) return;
  validateStroke(value);
}

function validateStroke(value: unknown): void {
  if (value === null || typeof value !== 'object') {
    throw new Error('stroke must be an object.');
  }
  const v = value as { paint?: unknown };
  validateSerializedPaint(v.paint);
  validateOptionalFiniteNumber((value as { width?: unknown }).width, 'stroke.width');
  validateOptionalFiniteNumber(
    (value as { miterLimit?: unknown }).miterLimit,
    'stroke.miterLimit',
  );
  validateOptionalFiniteNumber(
    (value as { dashOffset?: unknown }).dashOffset,
    'stroke.dashOffset',
  );
  validateOptionalStringEnum(
    (value as { cap?: unknown }).cap,
    'stroke.cap',
    ['butt', 'round', 'square'],
  );
  validateOptionalStringEnum(
    (value as { join?: unknown }).join,
    'stroke.join',
    ['miter', 'round', 'bevel'],
  );
  validateOptionalFiniteNumberArray((value as { dash?: unknown }).dash, 'stroke.dash');
}

function validateMat2D(value: unknown): void {
  if (!Array.isArray(value)) {
    throw new Error('transform must be an array.');
  }
  if (value.length !== 6) {
    throw new Error(`transform must have 6 elements, got ${value.length}.`);
  }
  for (let i = 0; i < 6; i++) {
    const n = value[i];
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      throw new Error(`transform[${i}] is not a finite number.`);
    }
  }
}

function validatePointField(shape: object, field: string): void {
  const p = (shape as Record<string, unknown>)[field];
  if (p === null || typeof p !== 'object') {
    throw new Error(`shape.${field} must be an object.`);
  }
  const pp = p as { x?: unknown; y?: unknown };
  if (typeof pp.x !== 'number' || !Number.isFinite(pp.x)) {
    throw new Error(`shape.${field}.x is not a finite number.`);
  }
  if (typeof pp.y !== 'number' || !Number.isFinite(pp.y)) {
    throw new Error(`shape.${field}.y is not a finite number.`);
  }
}

function validatePolygonShape(value: object): void {
  const pts = (value as { points?: unknown }).points;
  if (!Array.isArray(pts)) {
    throw new Error('shape.points must be an array.');
  }
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p === null || typeof p !== 'object') {
      throw new Error(`shape.points[${i}] must be an object.`);
    }
    validatePointField(p, 'x');
    // The point has x and y as siblings, not nested. Validate inline.
    const pp = p as { x?: unknown; y?: unknown };
    if (typeof pp.y !== 'number' || !Number.isFinite(pp.y)) {
      throw new Error(`shape.points[${i}].y is not a finite number.`);
    }
  }
  if (typeof (value as { closed?: unknown }).closed !== 'boolean') {
    throw new Error('shape.closed must be a boolean.');
  }
}

function validateRectShape(value: object): void {
  const r = (value as { rect?: unknown }).rect;
  if (r === null || typeof r !== 'object') {
    throw new Error('shape.rect must be an object.');
  }
  const rr = r as Record<string, unknown>;
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    if (typeof rr[key] !== 'number' || !Number.isFinite(rr[key] as number)) {
      throw new Error(`shape.rect.${key} is not a finite number.`);
    }
  }
}

function validateEllipseShape(value: object): void {
  validatePointField(value, 'center');
  const rr = value as Record<string, unknown>;
  for (const key of ['radiusX', 'radiusY', 'rotation', 'startAngle', 'endAngle'] as const) {
    const v = rr[key];
    if (v === undefined) continue;
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`shape.${key} is not a finite number.`);
    }
  }
  if (typeof rr.radiusX !== 'number') {
    throw new Error('shape.radiusX is required.');
  }
  if (typeof rr.radiusY !== 'number') {
    throw new Error('shape.radiusY is required.');
  }
}

function validatePathShape(value: object): void {
  const segs = (value as { segments?: unknown }).segments;
  if (!Array.isArray(segs)) {
    throw new Error('shape.segments must be an array.');
  }
  for (let i = 0; i < segs.length; i++) {
    validateSegment(segs[i], i);
  }
}

function validateSegment(seg: unknown, index: number): void {
  if (seg === null || typeof seg !== 'object') {
    throw new Error(`shape.segments[${index}] must be an object.`);
  }
  const s = seg as { kind?: unknown };
  if (typeof s.kind !== 'string') {
    throw new Error(`shape.segments[${index}].kind must be a string.`);
  }
  switch (s.kind) {
    case 'move':
    case 'line':
      validatePointField(seg, 'to');
      return;
    case 'quadratic':
      validatePointField(seg, 'control');
      validatePointField(seg, 'to');
      return;
    case 'cubic':
      validatePointField(seg, 'c1');
      validatePointField(seg, 'c2');
      validatePointField(seg, 'to');
      return;
    case 'arc':
      validateArcSegment(seg, index);
      return;
    case 'close':
      return;
    default:
      throw new Error(
        `shape.segments[${index}].kind: unknown value "${s.kind}".`,
      );
  }
}

function validateArcSegment(seg: object, index: number): void {
  const s = seg as Record<string, unknown>;
  for (const key of ['rx', 'ry', 'rotation'] as const) {
    if (typeof s[key] !== 'number' || !Number.isFinite(s[key] as number)) {
      throw new Error(`shape.segments[${index}].${key} is not a finite number.`);
    }
  }
  if (typeof s.largeArc !== 'boolean') {
    throw new Error(`shape.segments[${index}].largeArc must be a boolean.`);
  }
  if (typeof s.sweep !== 'boolean') {
    throw new Error(`shape.segments[${index}].sweep must be a boolean.`);
  }
  validatePointField(seg, 'to');
}

function validateGroupShape(value: object): void {
  const shapes = (value as { shapes?: unknown }).shapes;
  if (!Array.isArray(shapes)) {
    throw new Error('shape.shapes must be an array.');
  }
  for (let i = 0; i < shapes.length; i++) {
    try {
      validateSerializedShape(shapes[i]);
    } catch (err) {
      throw new Error(
        `shape.shapes[${i}]: ${(err as Error).message}`,
      );
    }
  }
}

function validateTextCommand(value: object): void {
  const v = value as Record<string, unknown>;
  if (typeof v.text !== 'string') {
    throw new Error('text.text must be a string.');
  }
  validatePointField(value, 'position');
  if (v.style === null || typeof v.style !== 'object') {
    throw new Error('text.style must be an object.');
  }
  const s = v.style as Record<string, unknown>;
  validateOptionalFiniteNumber(s.size, 'text.style.size');
  validateOptionalStringEnum(s.align, 'text.style.align', [
    'left',
    'center',
    'right',
  ]);
  validateOptionalStringEnum(s.baseline, 'text.style.baseline', [
    'top',
    'middle',
    'bottom',
    'alphabetic',
  ]);
  if (s.paint !== undefined) {
    validateSerializedPaint(s.paint);
  }
}

function validateSpriteCommand(value: object): void {
  const v = value as Record<string, unknown>;
  const sprite = v.sprite;
  if (sprite === null || typeof sprite !== 'object') {
    throw new Error('sprite.sprite must be an object.');
  }
  if (typeof (sprite as { id?: unknown }).id !== 'string') {
    throw new Error('sprite.sprite.id must be a string.');
  }
  validateMat2D(v.transform);
}

function validateOptionalFiniteNumber(
  value: unknown,
  name: string,
): void {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} is not a finite number.`);
  }
}

function validateOptionalFiniteNumberArray(
  value: unknown,
  name: string,
): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array.`);
  }
  for (let i = 0; i < value.length; i++) {
    const n = value[i];
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      throw new Error(`${name}[${i}] is not a finite number.`);
    }
  }
}

function validateOptionalStringEnum(
  value: unknown,
  name: string,
  allowed: readonly string[],
): void {
  if (value === undefined) return;
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error(`${name}: expected one of ${allowed.join(', ')}.`);
  }
}

// Silence the unused-type warning when the union is only used in asserts.
export type { SerializedPathSegment };
