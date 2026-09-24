/**
 * @fileoverview
 * @summary 2D affine transforms in matrix and decomposed forms.
 *
 * @description
 * Defines {@linkcode Mat2D} as the canonical 6-element affine matrix and
 * {@linkcode Transform2D} as a decomposed convenience type. Every render
 * command carries a `Mat2D`. Callers may author a {@linkcode Transform2D}
 * and normalize it with {@linkcode toMat2D}.
 *
 * The matrix layout matches Canvas2D and CSS. The last row is always
 * `[0, 0, 1]` and is implicit.
 *
 * ```text
 *   | a  c  e |
 *   | b  d  f |
 *   | 0  0  1 |
 * ```
 *
 * Composing matrices applies the rightmost first. `compose(translate, rotate)`
 * rotates a point around the origin and then translates the result. This
 * matches the reading order of a CSS transform list.
 *
 * The matrix is a value type. Every operation returns a new tuple. No
 * function mutates its input.
 *
 * @example
 * Example 1: Place a sprite at (100, 50) and rotate 45 degrees
 * ```ts
 * import { translation, rotation, compose, applyToPoint } from './transform';
 * import { point } from './point';
 *
 * const m = compose(translation(100, 50), rotation(Math.PI / 4));
 * const corner = applyToPoint(m, point(0, 0)); // (100, 50)
 * ```
 *
 * @example
 * Example 2: Convert a decomposed transform
 * ```ts
 * import { toMat2D, applyToPoint } from './transform';
 * import { point } from './point';
 *
 * const m = toMat2D({ x: 10, y: 20, rotation: Math.PI, scaleX: 2, scaleY: 2 });
 * applyToPoint(m, point(1, 0)); // approximately (10, 20)
 * ```
 *
 * @see {@linkcode Point2D}
 * @see {@linkcode Vector2D}
 * @author MathAid
 */

import { type Point2D, type Vector2D } from './point';

/**
 * @summary A 2D affine transform as a 6-element matrix.
 *
 * @description
 * The tuple stores `[a, b, c, d, e, f]`. Together they form the top two
 * rows of a 3 by 3 matrix whose third row is always `[0, 0, 1]`.
 *
 * The layout matches the arguments of `CanvasRenderingContext2D.transform`
 * and the CSS `matrix()` function. This means a value of this type can be
 * passed to any browser API without conversion.
 *
 * @example
 * Example 1: The identity
 * ```ts
 * const identity: Mat2D = [1, 0, 0, 1, 0, 0];
 * ```
 *
 * @example
 * Example 2: A translation
 * ```ts
 * const move: Mat2D = [1, 0, 0, 1, 100, 50];
 * ```
 *
 * @see {@linkcode Transform2D}
 * @author MathAid
 */
export type Mat2D = readonly [
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
];

/**
 * @summary A decomposed affine transform for authoring.
 *
 * @description
 * A {@linkcode Transform2D} carries a position, an optional rotation in
 * radians, and optional per-axis scales. It is convenient for authoring
 * because the fields are readable. It is not the canonical form. Convert
 * it with {@linkcode toMat2D} before handing it to a command.
 *
 * The composition order is scale, then rotate, then translate. A point in
 * the local frame is scaled about the origin, rotated about the origin,
 * and then moved to `(x, y)`.
 *
 * @example
 * Example 1: A translated, scaled sprite
 * ```ts
 * const t: Transform2D = { x: 100, y: 50, scaleX: 2, scaleY: 2 };
 * ```
 *
 * @example
 * Example 2: A rotated sprite
 * ```ts
 * const t: Transform2D = { x: 0, y: 0, rotation: Math.PI / 4 };
 * ```
 *
 * @see {@linkcode Mat2D}
 * @author MathAid
 */
export interface Transform2D {
  /** The horizontal translation. */
  readonly x: number;
  /** The vertical translation. */
  readonly y: number;
  /** The rotation in radians. Defaults to `0`. */
  readonly rotation?: number;
  /** The horizontal scale. Defaults to `1`. */
  readonly scaleX?: number;
  /** The vertical scale. Defaults to `1`. */
  readonly scaleY?: number;
}

/**
 * @summary The identity transform.
 *
 * @description
 * Applying the identity to a point returns the point unchanged. Applying
 * it to a vector returns the vector unchanged. The identity is the neutral
 * element of {@linkcode compose}.
 *
 * @example
 * Example 1: A starting matrix
 * ```ts
 * let m = identity();
 * m = compose(m, translation(10, 20));
 * ```
 *
 * @example
 * Example 2: A reset
 * ```ts
 * const reset = identity();
 * ```
 *
 * @returns {Mat2D} The identity matrix `[1, 0, 0, 1, 0, 0]`.
 * @author MathAid
 */
export function identity(): Mat2D {
  return [1, 0, 0, 1, 0, 0];
}

/**
 * @summary A translation matrix.
 *
 * @description
 * Applying the result to a point moves it by `(x, y)`. Applying it to a
 * vector returns the vector unchanged, because vectors have no position.
 *
 * @example
 * Example 1: Move right and down
 * ```ts
 * translation(10, 20); // [1, 0, 0, 1, 10, 20]
 * ```
 *
 * @example
 * Example 2: Compose with a rotation
 * ```ts
 * const m = compose(translation(100, 0), rotation(Math.PI / 2));
 * ```
 *
 * @param {number} x The horizontal shift.
 * @param {number} y The vertical shift.
 * @returns {Mat2D} A new matrix.
 * @author MathAid
 */
export function translation(x: number, y: number): Mat2D {
  return [1, 0, 0, 1, x, y];
}

/**
 * @summary A scaling matrix.
 *
 * @description
 * When `sy` is omitted, the function uses `sx` for both axes. This gives
 * a uniform scale. A negative scale mirrors across the corresponding axis.
 *
 * @example
 * Example 1: Uniform double
 * ```ts
 * scaling(2); // [2, 0, 0, 2, 0, 0]
 * ```
 *
 * @example
 * Example 2: Non-uniform stretch
 * ```ts
 * scaling(2, 0.5); // [2, 0, 0, 0.5, 0, 0]
 * ```
 *
 * @param {number} sx The horizontal scale factor.
 * @param {number} sy The vertical scale factor. Defaults to `sx`.
 * @default {sx}
 * @returns {Mat2D} A new matrix.
 * @author MathAid
 */
export function scaling(sx: number, sy: number = sx): Mat2D {
  return [sx, 0, 0, sy, 0, 0];
}

/**
 * @summary A rotation matrix.
 *
 * @description
 * Rotates about the origin by `rad` radians. A positive angle rotates
 * counter-clockwise in a math-oriented coordinate system and clockwise in
 * the screen-oriented system used by Canvas2D.
 *
 * @example
 * Example 1: Quarter turn
 * ```ts
 * rotation(Math.PI / 2);
 * // approximately [0, 1, -1, 0, 0, 0]
 * ```
 *
 * @example
 * Example 2: Half turn
 * ```ts
 * rotation(Math.PI); // approximately [-1, 0, 0, -1, 0, 0]
 * ```
 *
 * @param {number} rad The angle in radians.
 * @returns {Mat2D} A new matrix.
 * @author MathAid
 */
export function rotation(rad: number): Mat2D {
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [cos, sin, -sin, cos, 0, 0];
}

/**
 * @summary A skew matrix.
 *
 * @description
 * Shears the plane along both axes. The angles are in radians. A skew of
 * `(ax, 0)` shears horizontally. A skew of `(0, ay)` shears vertically.
 *
 * @example
 * Example 1: Horizontal shear
 * ```ts
 * skew(Math.PI / 8, 0);
 * ```
 *
 * @example
 * Example 2: Both axes
 * ```ts
 * skew(Math.PI / 8, Math.PI / 8);
 * ```
 *
 * @param {number} ax The horizontal skew angle in radians.
 * @param {number} ay The vertical skew angle in radians.
 * @returns {Mat2D} A new matrix.
 * @author MathAid
 */
export function skew(ax: number, ay: number): Mat2D {
  return [1, Math.tan(ay), Math.tan(ax), 1, 0, 0];
}

/**
 * @summary Compose two or more transforms into one.
 *
 * @description
 * Multiplies the matrices from left to right. Applying the result is the
 * same as applying the rightmost input first and the leftmost input last.
 *
 * The function is variadic. It returns the identity when called with no
 * arguments. It returns a shallow copy when called with one.
 *
 * @example
 * Example 1: Translate then rotate
 * ```ts
 * const m = compose(translation(100, 0), rotation(Math.PI / 2));
 * // A point at (1, 0) first rotates to (0, 1), then moves to (100, 1).
 * ```
 *
 * @example
 * Example 2: Build up over time
 * ```ts
 * let m = identity();
 * m = compose(m, translation(10, 0));
 * m = compose(m, scaling(2));
 * ```
 *
 * @param {Mat2D[]} ms The matrices to compose.
 * @returns {Mat2D} A new matrix.
 * @author MathAid
 */
export function compose(...ms: Mat2D[]): Mat2D {
  if (ms.length === 0) return identity();
  if (ms.length === 1) return ms[0]!;

  let result = ms[0]!;
  for (let i = 1; i < ms.length; i++) {
    const m = ms[i]!;
    const [a1, b1, c1, d1, e1, f1] = result;
    const [a2, b2, c2, d2, e2, f2] = m;
    result = [
      a1 * a2 + c1 * b2,
      b1 * a2 + d1 * b2,
      a1 * c2 + c1 * d2,
      b1 * c2 + d1 * d2,
      a1 * e2 + c1 * f2 + e1,
      b1 * e2 + d1 * f2 + f1,
    ];
  }
  return result;
}

/**
 * @summary Normalize a decomposed or matrix transform to a {@linkcode Mat2D}.
 *
 * @description
 * When the input is already a {@linkcode Mat2D}, the function returns it
 * unchanged. When the input is a {@linkcode Transform2D}, the function
 * applies scale, then rotation, then translation, and returns the
 * resulting matrix.
 *
 * Use this at the boundary between authoring code and the render commands.
 *
 * @example
 * Example 1: From a decomposed transform
 * ```ts
 * toMat2D({ x: 10, y: 20, rotation: 0, scaleX: 2, scaleY: 2 });
 * // [2, 0, 0, 2, 10, 20]
 * ```
 *
 * @example
 * Example 2: Pass-through
 * ```ts
 * const m: Mat2D = [1, 0, 0, 1, 0, 0];
 * toMat2D(m) === m; // true
 * ```
 *
 * @param {Transform2D | Mat2D} t The transform to normalize.
 * @returns {Mat2D} A new or original matrix.
 * @author MathAid
 */
export function toMat2D(t: Transform2D | Mat2D): Mat2D {
  if (Array.isArray(t)) return t as Mat2D;
  t = t as Transform2D;
  const sx = t.scaleX ?? 1;
  const sy = t.scaleY ?? 1;
  const rad = t.rotation ?? 0;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    cos * sx,
    sin * sx,
    -sin * sy,
    cos * sy,
    t.x,
    t.y,
  ];
}

/**
 * @summary The inverse of a matrix.
 *
 * @description
 * Returns the matrix that undoes the input. Applying a matrix and then
 * its inverse returns the identity. The function throws when the input is
 * singular, meaning the matrix collapses one or more dimensions.
 *
 * @example
 * Example 1: Invert a translation
 * ```ts
 * invertMatrix(translation(10, 20)); // [1, 0, 0, 1, -10, -20]
 * ```
 *
 * @example
 * Example 2: Invert a scale
 * ```ts
 * invertMatrix(scaling(2)); // [0.5, 0, 0, 0.5, 0, 0]
 * ```
 *
 * @param {Mat2D} m The matrix to invert.
 * @returns {Mat2D} A new matrix.
 * @throws {Error} When the matrix is singular.
 * @author MathAid
 */
export function invertMatrix(m: Mat2D): Mat2D {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c;
  if (det === 0) {
    throw new Error('invert: the matrix is singular.');
  }
  const inv = 1 / det;
  return [
    d * inv,
    -b * inv,
    -c * inv,
    a * inv,
    (c * f - d * e) * inv,
    (b * e - a * f) * inv,
  ];
}

/**
 * @summary Apply a matrix to a point.
 *
 * @description
 * Multiplies the augmented vector `[x, y, 1]` by the matrix. The
 * translation part of the matrix contributes to the result. This is the
 * right operation for anchors, vertex positions, and hit testing.
 *
 * @example
 * Example 1: Translate a point
 * ```ts
 * applyToPoint(translation(10, 20), point(1, 2)); // { x: 11, y: 22 }
 * ```
 *
 * @example
 * Example 2: Scale a point
 * ```ts
 * applyToPoint(scaling(2), point(3, 4)); // { x: 6, y: 8 }
 * ```
 *
 * @param {Mat2D} m The matrix.
 * @param {Point2D} p The point.
 * @returns {Point2D} A new point.
 * @author MathAid
 */
export function applyToPoint(m: Mat2D, p: Point2D): Point2D {
  return {
    x: m[0] * p.x + m[2] * p.y + m[4],
    y: m[1] * p.x + m[3] * p.y + m[5],
  };
}

/**
 * @summary Apply a matrix to a vector.
 *
 * @description
 * Multiplies the vector by the linear part of the matrix. The translation
 * part is ignored. This is the right operation for velocities, offsets,
 * and surface normals, because a displacement has no position to move.
 *
 * @example
 * Example 1: Translation does not affect a vector
 * ```ts
 * applyToVector(translation(10, 20), vector(1, 0)); // { dx: 1, dy: 0 }
 * ```
 *
 * @example
 * Example 2: Rotation affects a vector
 * ```ts
 * applyToVector(rotation(Math.PI / 2), vector(1, 0));
 * // approximately { dx: 0, dy: 1 }
 * ```
 *
 * @param {Mat2D} m The matrix.
 * @param {Vector2D} v The vector.
 * @returns {Vector2D} A new vector.
 * @author MathAid
 */
export function applyToVector(m: Mat2D, v: Vector2D): Vector2D {
  return {
    dx: m[0] * v.dx + m[2] * v.dy,
    dy: m[1] * v.dx + m[3] * v.dy,
  };
}

/**
 * @summary The determinant of a matrix.
 *
 * @description
 * Returns `a * d - b * c`. The determinant is the signed area scale factor
 * of the transform. A zero determinant means the matrix is singular. A
 * negative determinant means the transform mirrors the plane.
 *
 * @example
 * Example 1: The identity has determinant 1
 * ```ts
 * determinant(identity()); // 1
 * ```
 *
 * @example
 * Example 2: A uniform scale of 2 has determinant 4
 * ```ts
 * determinant(scaling(2)); // 4
 * ```
 *
 * @param {Mat2D} m The matrix.
 * @returns {number} The determinant.
 * @author MathAid
 */
export function determinant(m: Mat2D): number {
  return m[0] * m[3] - m[1] * m[2];
}

/**
 * @summary Compare two matrices for approximate equality.
 *
 * @description
 * Floating point composition accumulates rounding error. Two matrices that
 * represent the same transform may differ in the last few bits. The
 * function compares each element within `epsilon`.
 *
 * @example
 * Example 1: Exact match
 * ```ts
 * matrixEquals(identity(), identity()); // true
 * ```
 *
 * @example
 * Example 2: Composition round-trip
 * ```ts
 * const m = compose(translation(10, 20), invertMatrix(translation(10, 20)));
 * matrixEquals(m, identity(), 1e-9); // true
 * ```
 *
 * @param {Mat2D} a The first matrix.
 * @param {Mat2D} b The second matrix.
 * @param {number} epsilon The maximum per-element difference. Defaults to
 * `1e-9`.
 * @default {1e-9}
 * @returns {boolean} `true` when every element is within `epsilon`.
 * @author MathAid
 */
export function matrixEquals(a: Mat2D, b: Mat2D, epsilon: number = 1e-9): boolean {
  for (let i = 0; i < 6; i++) {
    if (Math.abs(a[i]! - b[i]!) > epsilon) return false;
  }
  return true;
}