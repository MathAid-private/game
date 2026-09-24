/**
 * @fileoverview
 * @summary The output types and options for the shape tessellator.
 *
 * @description
 * Defines {@linkcode TriangleList}, the triangle soup a GPU backend
 * consumes, and {@linkcode TessellateOptions}, the tuning parameters the
 * tessellator accepts. A triangle list carries its own vertex buffer and
 * index buffer so a backend can upload it without further conversion.
 *
 * ```text
 *   TriangleList
 *     +-- positions       Float32Array     [x0, y0, x1, y1, ...]
 *     +-- indices         Uint32Array      [i0, i1, i2, i3, i4, i5, ...]
 *     +-- vertexCount     number           positions.length / 2
 *     +-- triangleCount   number           indices.length / 3
 * ```
 *
 * A triangle list is immutable. Every function that produces one
 * allocates fresh typed arrays. The arrays are the exact size the
 * geometry requires. There is no spare capacity.
 *
 * @example
 * Example 1: Inspect a triangle list
 * ```ts
 * const list = tessellateFill(makeRect(rect(0, 0, 10, 10)));
 * list.vertexCount;      // 4
 * list.triangleCount;    // 2
 * list.positions.length; // 8
 * ```
 *
 * @example
 * Example 2: Upload positions to a GPU buffer
 * ```ts
 * const list = tessellateFill(shape);
 * const buffer = device.createBuffer({
 *   size: list.positions.byteLength,
 *   usage: GPUBufferUsage.VERTEX,
 * });
 * device.queue.writeBuffer(buffer, 0, list.positions);
 * ```
 *
 * @see {@linkcode tessellateFill}
 * @see {@linkcode tessellateStroke}
 * @author MathAid
 */

/**
 * @summary A triangle soup: positions and indices.
 *
 * @description
 * The `positions` array is interleaved 2D coordinates. Every pair is one
 * vertex. The `indices` array groups vertices into triangles. Three
 * consecutive indices form one triangle.
 *
 * The vertex winding is counter-clockwise in a math-oriented frame. A
 * backend that uses a clockwise convention flips the winding when it
 * uploads the list.
 *
 * @example
 * Example 1: A rectangle
 * ```ts
 * const list = tessellateFill(makeRect(rect(0, 0, 10, 10)));
 * // positions: [0, 0, 10, 0, 10, 10, 0, 10]
 * // indices:   [0, 1, 2, 0, 2, 3]
 * ```
 *
 * @example
 * Example 2: An empty list
 * ```ts
 * const empty: TriangleList = {
 *   positions: new Float32Array(0),
 *   indices: new Uint32Array(0),
 *   vertexCount: 0,
 *   triangleCount: 0,
 * };
 * ```
 *
 * @see {@linkcode tessellateFill}
 * @author MathAid
 */
export interface TriangleList {
  /** Interleaved 2D vertex positions. Every pair is one vertex. */
  readonly positions: Float32Array;
  /** Triangle indices. Every three entries form one triangle. */
  readonly indices: Uint32Array;
  /** The number of vertices. Equals `positions.length / 2`. */
  readonly vertexCount: number;
  /** The number of triangles. Equals `indices.length / 3`. */
  readonly triangleCount: number;
}

/**
 * @summary Tuning parameters for the tessellator.
 *
 * @description
 * Every field is optional. The defaults work for typical UI and game
 * shapes at 1x and 2x device pixel ratios.
 *
 * The `tolerance` field controls how finely curves are flattened. A
 * smaller value produces more segments and a smoother curve. The value
 * is in logical pixels. The default of `0.25` matches the sub-pixel
 * precision of a 2x display.
 *
 * The `maxCurveSegments` field caps the number of line segments a single
 * curve can produce. This prevents a pathological curve with a huge
 * control polygon from producing thousands of segments.
 *
 * @example
 * Example 1: The defaults
 * ```ts
 * const list = tessellateFill(shape);
 * ```
 *
 * @example
 * Example 2: High precision for a static asset
 * ```ts
 * const list = tessellateFill(shape, { tolerance: 0.05 });
 * ```
 *
 * @example
 * Example 3: Low precision for a moving sprite
 * ```ts
 * const list = tessellateFill(shape, { tolerance: 1, maxCurveSegments: 8 });
 * ```
 *
 * @see {@linkcode tessellateFill}
 * @author MathAid
 */
export interface TessellateOptions {
  /** Flattening tolerance in logical pixels. Defaults to `0.25`. */
  readonly tolerance?: number;
  /** Maximum line segments per curve. Defaults to `64`. */
  readonly maxCurveSegments?: number;
}

/**
 * @summary An empty triangle list.
 *
 * @description
 * Returned when a shape produces no triangles. The arrays are zero
 * length. A caller that receives this value should skip the draw call.
 *
 * @example
 * Example 1: An empty shape
 * ```ts
 * const list = tessellateFill({ kind: 'group', shapes: [] });
 * list.triangleCount; // 0
 * ```
 *
 * @returns {TriangleList} The empty list.
 * @author MathAid
 */
export function emptyTriangleList(): TriangleList {
  return {
    positions: new Float32Array(0),
    indices: new Uint32Array(0),
    vertexCount: 0,
    triangleCount: 0,
  };
}

/**
 * @summary Build a triangle list from flat arrays.
 *
 * @description
 * A convenience constructor. Copies the input arrays into the
 * {@linkcode TriangleList} shape. The caller retains ownership of the
 * source arrays.
 *
 * @example
 * Example 1: From explicit data
 * ```ts
 * const list = makeTriangleList(
 *   new Float32Array([0, 0, 10, 0, 10, 10]),
 *   new Uint32Array([0, 1, 2]),
 * );
 * list.triangleCount; // 1
 * ```
 *
 * @param {Float32Array} positions The vertex positions.
 * @param {Uint32Array} indices The triangle indices.
 * @returns {TriangleList} A new list.
 * @author MathAid
 */
export function makeTriangleList(
  positions: Float32Array,
  indices: Uint32Array,
): TriangleList {
  return {
    positions,
    indices,
    vertexCount: positions.length / 2,
    triangleCount: indices.length / 3,
  };
}