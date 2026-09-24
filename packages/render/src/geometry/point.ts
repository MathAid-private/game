/**
 * @fileoverview
 * @summary 2D point and vector value types with pure arithmetic.
 *
 * @description
 * Defines {@linkcode Point2D} as a location and {@linkcode Vector2D} as a
 * displacement. The two are distinct types even though both carry two
 * numbers. Keeping them apart prevents a class of bugs where two locations
 * are added together, or a position is mistaken for a direction.
 *
 * The arithmetic rules that follow from the distinction:
 *
 * ```text
 *   Point2D  + Vector2D  -->  Point2D     translate
 *   Point2D  - Point2D   -->  Vector2D    displacement
 *   Vector2D + Vector2D  -->  Vector2D    sum
 *   Vector2D - Vector2D  -->  Vector2D    difference
 *   Vector2D * number    -->  Vector2D    scale
 * ```
 *
 * Every operation in this module is pure. No function mutates its input.
 * Every return value is a fresh object.
 *
 * The module is the base of the render geometry stack. {@linkcode Rect},
 * {@linkcode Mat2D}, and every shape in `shape.ts` build on these two
 * types.
 *
 * @example
 * Example 1: Move a point by a velocity
 * ```ts
 * import { point, vector, add } from './point';
 *
 * const position = point(0, 0);
 * const velocity = vector(1, -2);
 * const next = add(position, velocity); // { x: 1, y: -2 }
 * ```
 *
 * @example
 * Example 2: Measure the distance between two points
 * ```ts
 * import { point, distance } from './point';
 *
 * const a = point(3, 4);
 * const b = point(0, 0);
 * distance(a, b); // 5
 * ```
 *
 * @see {@linkcode Rect}
 * @see {@linkcode Mat2D}
 * @author MathAid
 */

/**
 * @summary A location in 2D space.
 *
 * @description
 * A {@linkcode Point2D} is a position. It is not a direction. Adding two
 * points has no meaning in this module. Adding a vector to a point moves
 * the point.
 *
 * The fields use `x` and `y` to make the location intent obvious at every
 * use site. Contrast with {@linkcode Vector2D}, which uses `dx` and `dy`.
 *
 * @example
 * Example 1: An origin
 * ```ts
 * const origin: Point2D = { x: 0, y: 0 };
 * ```
 *
 * @example
 * Example 2: A cursor position from a pointer event
 * ```ts
 * const cursor: Point2D = { x: event.clientX, y: event.clientY };
 * ```
 *
 * @see {@linkcode Vector2D}
 * @author MathAid
 */
export interface Point2D {
  /** The horizontal coordinate. */
  readonly x: number;
  /** The vertical coordinate. */
  readonly y: number;
}

/**
 * @summary A displacement in 2D space.
 *
 * @description
 * A {@linkcode Vector2D} is a direction and a magnitude. It is not a
 * position. The field names `dx` and `dy` make the distinction from
 * {@linkcode Point2D} visible at every use site.
 *
 * The type carries no origin. Two vectors with the same `dx` and `dy` are
 * equal even if they describe motion at different points in space.
 *
 * @example
 * Example 1: A velocity
 * ```ts
 * const velocity: Vector2D = { dx: 1, dy: -2 };
 * ```
 *
 * @example
 * Example 2: A unit direction
 * ```ts
 * const up: Vector2D = { dx: 0, dy: -1 };
 * const right: Vector2D = { dx: 1, dy: 0 };
 * ```
 *
 * @see {@linkcode Point2D}
 * @author MathAid
 */
export interface Vector2D {
  /** The horizontal component. */
  readonly dx: number;
  /** The vertical component. */
  readonly dy: number;
}

/**
 * @summary Construct a {@linkcode Point2D}.
 *
 * @description
 * A thin wrapper over the object literal. The function exists so a call
 * site reads as code, not as data. A literal `{ x, y }` is ambiguous when
 * a vector is also in scope.
 *
 * @example
 * Example 1: An origin
 * ```ts
 * const o = point(0, 0);
 * ```
 *
 * @example
 * Example 2: A point from user input
 * ```ts
 * const p = point(event.clientX, event.clientY);
 * ```
 *
 * @param {number} x The horizontal coordinate.
 * @param {number} y The vertical coordinate.
 * @returns {Point2D} A new point.
 * @author MathAid
 */
export function point(x: number, y: number): Point2D {
  return { x, y };
}

/**
 * @summary Construct a {@linkcode Vector2D}.
 *
 * @description
 * A thin wrapper over the object literal. The field names `dx` and `dy`
 * signal that the result is a displacement, not a position.
 *
 * @example
 * Example 1: A unit vector
 * ```ts
 * const right = vector(1, 0);
 * ```
 *
 * @example
 * Example 2: A velocity from a speed and an angle
 * ```ts
 * const v = vector(speed * Math.cos(t), speed * Math.sin(t));
 * ```
 *
 * @param {number} dx The horizontal component.
 * @param {number} dy The vertical component.
 * @returns {Vector2D} A new vector.
 * @author MathAid
 */
export function vector(dx: number, dy: number): Vector2D {
  return { dx, dy };
}

/**
 * @summary Add a vector to a point, or add two vectors.
 *
 * @description
 * The overloads enforce the type rules. Adding a vector to a point moves
 * the point. Adding two vectors combines the displacements. Adding two
 * points is not allowed by the type system.
 *
 * The runtime check uses `'x' in a` to tell a point from a vector. The
 * field naming makes the check reliable.
 *
 * @example
 * Example 1: Translate a point
 * ```ts
 * const p = add(point(0, 0), vector(3, 4)); // { x: 3, y: 4 }
 * ```
 *
 * @example
 * Example 2: Combine two forces
 * ```ts
 * const total = add(vector(1, 0), vector(0, 1)); // { dx: 1, dy: 1 }
 * ```
 *
 * @param {Point2D | Vector2D} a The left operand.
 * @param {Vector2D} b The vector to add.
 * @returns {Point2D | Vector2D} A new point when `a` is a point. A new
 * vector when `a` is a vector.
 * @author MathAid
 */
export function add(a: Point2D, b: Vector2D): Point2D;
export function add(a: Vector2D, b: Vector2D): Vector2D;
export function add(a: Point2D | Vector2D, b: Vector2D): Point2D | Vector2D {
  if ('x' in a) {
    return { x: a.x + b.dx, y: a.y + b.dy };
  }
  return { dx: a.dx + b.dx, dy: a.dy + b.dy };
}

/**
 * @summary Subtract a point from a point, or subtract two vectors.
 *
 * @description
 * Subtracting one point from another gives the displacement between them.
 * Subtracting two vectors gives a new vector. The runtime check rejects
 * a mixed call because the result would be undefined.
 *
 * @example
 * Example 1: Displacement from one point to another
 * ```ts
 * const d = subtract(point(3, 4), point(0, 0)); // { dx: 3, dy: 4 }
 * ```
 *
 * @example
 * Example 2: Difference of two velocities
 * ```ts
 * const rel = subtract(vector(5, 0), vector(3, 0)); // { dx: 2, dy: 0 }
 * ```
 *
 * @param {Point2D | Vector2D} a The left operand.
 * @param {Point2D | Vector2D} b The right operand. Must be the same kind
 * as `a`.
 * @returns {Vector2D} A new vector.
 * @throws {Error} When the two arguments are different kinds.
 * @author MathAid
 */
export function subtract(a: Point2D, b: Point2D): Vector2D;
export function subtract(a: Vector2D, b: Vector2D): Vector2D;
export function subtract(
  a: Point2D | Vector2D,
  b: Point2D | Vector2D,
): Vector2D {
  if ('x' in a && 'x' in b) {
    return { dx: a.x - b.x, dy: a.y - b.y };
  }
  if ('dx' in a && 'dx' in b) {
    return { dx: a.dx - b.dx, dy: a.dy - b.dy };
  }
  throw new Error('subtract: mixed point and vector arguments are not allowed.');
}

/**
 * @summary Multiply a vector by a scalar.
 *
 * @description
 * Scales the displacement. A negative scalar reverses the direction. The
 * point type has no scale operation because scaling a location depends on
 * the origin. Use {@linkcode Mat2D} for point transforms.
 *
 * @example
 * Example 1: Double a velocity
 * ```ts
 * const fast = scale(vector(1, 2), 2); // { dx: 2, dy: 4 }
 * ```
 *
 * @example
 * Example 2: Reverse a direction
 * ```ts
 * const back = scale(vector(1, 0), -1); // { dx: -1, dy: 0 }
 * ```
 *
 * @param {Vector2D} v The vector to scale.
 * @param {number} s The scalar.
 * @returns {Vector2D} A new vector.
 * @author MathAid
 */
export function scale(v: Vector2D, s: number): Vector2D {
  return { dx: v.dx * s, dy: v.dy * s };
}

/**
 * @summary The magnitude of a vector.
 *
 * @description
 * Returns the Euclidean length. The result is always non-negative. A zero
 * vector returns `0`.
 *
 * @example
 * Example 1: The speed of a velocity
 * ```ts
 * length(vector(3, 4)); // 5
 * ```
 *
 * @example
 * Example 2: A unit vector has length 1
 * ```ts
 * length(vector(1, 0)); // 1
 * ```
 *
 * @param {Vector2D} v The vector to measure.
 * @returns {number} The magnitude.
 * @author MathAid
 */
export function length(v: Vector2D): number {
  return Math.hypot(v.dx, v.dy);
}

/**
 * @summary Normalize a vector to unit length.
 *
 * @description
 * Divides by the magnitude. When the input is the zero vector, the
 * function returns the zero vector. This avoids a division by zero and
 * keeps the function total.
 *
 * @example
 * Example 1: A unit direction from a velocity
 * ```ts
 * normalize(vector(3, 4)); // { dx: 0.6, dy: 0.8 }
 * ```
 *
 * @example
 * Example 2: Zero stays zero
 * ```ts
 * normalize(vector(0, 0)); // { dx: 0, dy: 0 }
 * ```
 *
 * @param {Vector2D} v The vector to normalize.
 * @returns {Vector2D} A new unit vector, or the zero vector.
 * @author MathAid
 */
export function normalize(v: Vector2D): Vector2D {
  const len = Math.hypot(v.dx, v.dy);
  if (len === 0) return { dx: 0, dy: 0 };
  return { dx: v.dx / len, dy: v.dy / len };
}

/**
 * @summary The dot product of two vectors.
 *
 * @description
 * Returns `a.dx * b.dx + a.dy * b.dy`. The dot product measures alignment.
 * A positive result means the vectors point in the same general direction.
 * A zero result means they are perpendicular.
 *
 * @example
 * Example 1: Are two vectors aligned?
 * ```ts
 * dot(vector(1, 0), vector(1, 0)); // 1
 * ```
 *
 * @example
 * Example 2: Perpendicular vectors
 * ```ts
 * dot(vector(1, 0), vector(0, 1)); // 0
 * ```
 *
 * @param {Vector2D} a The first vector.
 * @param {Vector2D} b The second vector.
 * @returns {number} The dot product.
 * @author MathAid
 */
export function dot(a: Vector2D, b: Vector2D): number {
  return a.dx * b.dx + a.dy * b.dy;
}

/**
 * @summary The 2D cross product of two vectors.
 *
 * @description
 * Returns `a.dx * b.dy - a.dy * b.dx`. In 2D this is the signed area of
 * the parallelogram formed by the two vectors. It is the `z` component of
 * the 3D cross product when the vectors lie in the `xy` plane.
 *
 * The sign tells the turn direction. A positive result means `b` is
 * counter-clockwise from `a`. A negative result means clockwise.
 *
 * @example
 * Example 1: Which way does the turn go?
 * ```ts
 * cross(vector(1, 0), vector(0, 1)); // 1 (left turn)
 * cross(vector(1, 0), vector(0, -1)); // -1 (right turn)
 * ```
 *
 * @example
 * Example 2: Parallel vectors
 * ```ts
 * cross(vector(1, 0), vector(2, 0)); // 0
 * ```
 *
 * @param {Vector2D} a The first vector.
 * @param {Vector2D} b The second vector.
 * @returns {number} The signed area.
 * @author MathAid
 */
export function cross(a: Vector2D, b: Vector2D): number {
  return a.dx * b.dy - a.dy * b.dx;
}

/**
 * @summary The distance between two points.
 *
 * @description
 * Equivalent to `length(subtract(a, b))`. The result is always
 * non-negative. Two identical points return `0`.
 *
 * @example
 * Example 1: Distance from the origin
 * ```ts
 * distance(point(3, 4), point(0, 0)); // 5
 * ```
 *
 * @example
 * Example 2: Two points at the same location
 * ```ts
 * distance(point(1, 1), point(1, 1)); // 0
 * ```
 *
 * @param {Point2D} a The first point.
 * @param {Point2D} b The second point.
 * @returns {number} The distance.
 * @author MathAid
 */
export function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}