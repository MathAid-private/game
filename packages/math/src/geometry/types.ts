/**
 * @fileoverview
 * @summary 2D geometry and colour primitives — the engine's shared data vocabulary.
 *
 * @description
 * This module defines the pure, immutable data shapes every higher layer shares: positions,
 * vectors, rectangles, 2D transforms, and RGBA colours. They are environment-agnostic (no DOM,
 * no canvas, no graphics library), which is what lets render commands, games, and collision
 * code all speak one dialect regardless of the platform beneath them.
 *
 * Each type is an interface of `readonly` fields, so instances are treated as values: never
 * mutate a shared shape, replace it. This is the immutability convention the engine relies on
 * for deterministic simulation and safe frame sharing.
 *
 * @author MathAid
 */

/**
 * @summary A 2D vector — a displacement or direction with magnitude.
 *
 * @description
 * `Vec2` represents a free quantity in 2D Cartesian space: a velocity, an offset, a scale. It
 * is structurally identical to `Point2D` but named separately so call sites convey intent — a
 * vector is a *difference*, a point is a *location*. Both are plain `{ x, y }` records with no
 * attached methods, so they serialise and copy trivially.
 *
 * @example
 * const velocity: Vec2 = { x: 0, y: -1 }; // one cell up per step
 *
 * @see {@link Point2D}
 * @author MathAid
 */
export interface Vec2 {
  /** Horizontal component. */
  readonly x: number;
  /** Vertical component. */
  readonly y: number;
}

/**
 * @summary A 2D position in world or screen space.
 *
 * @description
 * `Point2D` is an absolute location. It shares `Vec2`'s shape but is used where an absolute
 * coordinate is meant — a sprite origin, a cell anchor, a pointer location — so code reads as
 * positions and displacements rather than anonymous `{ x, y }` pairs.
 *
 * @example
 * const origin: Point2D = { x: 0, y: 0 };
 *
 * @see {@link Vec2}
 * @author MathAid
 */
export interface Point2D {
  /** Horizontal coordinate. */
  readonly x: number;
  /** Vertical coordinate. */
  readonly y: number;
}

/**
 * @summary An axis-aligned rectangle defined by its top-left corner and size.
 *
 * @description
 * `Rect` is the engine's bounding shape. `x`/`y` locate the top-left corner (origin-top-left,
 * matching screen space); `width`/`height` are non-negative extents. It is used for sprites,
 * grid cells, camera viewports, and axis-aligned collision, and is deliberately axis-aligned so
 * overlap tests stay cheap and exact.
 *
 * @example
 * const cell: Rect = { x: 10, y: 20, width: 7.3, height: 7.3 };
 *
 * @see {@link Point2D}
 * @see {@link Transform2D}
 * @author MathAid
 */
export interface Rect {
  /** Horizontal coordinate of the top-left corner. */
  readonly x: number;
  /** Vertical coordinate of the top-left corner. */
  readonly y: number;
  /** Extent along the horizontal axis; non-negative. */
  readonly width: number;
  /** Extent along the vertical axis; non-negative. */
  readonly height: number;
}

/**
 * @summary A 2D affine transform: translation, uniform/axis scale, and rotation.
 *
 * @description
 * `Transform2D` places and orients a shape. `x`/`y` translate; `scaleX`/`scaleY` scale each axis
 * (defaulting to 1); `rotation` rotates clockwise in radians (defaulting to 0). Optional fields
 * default to identity so a transform can be as terse as `{ x, y }`. Renderers interpret this
 * data; the engine never bakes it into a specific matrix API.
 *
 * @example
 * const placed: Transform2D = { x: 64, y: 64, rotation: Math.PI / 2 };
 *
 * @see {@link Rect}
 * @author MathAid
 */
export interface Transform2D {
  /** Horizontal translation. */
  readonly x: number;
  /** Vertical translation. */
  readonly y: number;
  /** Horizontal scale factor. Defaults to `1`. */
  readonly scaleX?: number;
  /** Vertical scale factor. Defaults to `1`. */
  readonly scaleY?: number;
  /** Clockwise rotation in radians. Defaults to `0`. */
  readonly rotation?: number;
}

/**
 * @summary An RGBA colour with each component normalised to the interval [0, 1].
 *
 * @description
 * `Color` is the engine's single colour representation, independent of any backend. Normalised
 * `0..1` components are renderer-neutral: Canvas2D converts to CSS, WebGL uses them directly,
 * and a terminal maps them to a palette. `a` is opacity (`0` transparent, `1` opaque).
 *
 * @example
 * const lemon: Color = { r: 1, g: 0.97, b: 0.2, a: 1 };
 *
 * @author MathAid
 */
export interface Color {
  /** Red component, `0..1`. */
  readonly r: number;
  /** Green component, `0..1`. */
  readonly g: number;
  /** Blue component, `0..1`. */
  readonly b: number;
  /** Alpha (opacity) component, `0..1`. */
  readonly a: number;
}
