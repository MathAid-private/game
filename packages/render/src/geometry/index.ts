/**
 * @fileoverview
 * @summary Geometry value types for the render pipeline.
 *
 * @description
 * Re-exports the point, rect, transform, shape, paint, style, and
 * operations modules. This is the only public entry for the geometry
 * layer.
 *
 * The geometry layer has no dependencies outside itself and the color
 * module. It does not reach into the command union or any renderer. This
 * makes it safe to import from anywhere in the package.
 *
 * ```text
 *   geometry/
 *     point.ts       Point2D, Vector2D, arithmetic
 *     rect.ts        Rect, containment, union
 *     transform.ts   Mat2D, Transform2D, composition
 *     shape.ts       Shape union, PathSegment, constructors
 *     paint.ts       Paint union, makeSolid
 *     style.ts       StrokeStyle, TextStyle
 *     operations.ts  bounds, area, contains, applyToShape
 *     index.ts       this file
 * ```
 *
 * @example
 * Example 1: Import the public types
 * ```ts
 * import {
 *   point, vector, add, rect, contains,
 *   translation, makeCircle, makeSolid, bounds,
 * } from './geometry';
 * ```
 *
 * @example
 * Example 2: Build a shape and measure it
 * ```ts
 * import {
 *   point, makeCircle, bounds,
 * } from './geometry';
 *
 * const c = makeCircle(point(50, 50), 10);
 * bounds(c); // { x: 40, y: 40, width: 20, height: 20 }
 * ```
 * 
 * @note
 * > A function that operates on a type whose name is a common
 * English noun (`Rect`, `Point`, `Shape`, `Matrix`) gets the
 * noun as a prefix when the bare name would be ambiguous at
 * the package barrel. A function whose parameter types already
 * disambiguate the operation keeps its bare name.
 * 
 * The rule explains why `add(point, vector)` stays bare while
 * `rectContains(rect, point)` takes a prefix. A reader can
 * predict the next decision.
 *
 * @see {@linkcode Point2D}
 * @see {@linkcode Rect}
 * @see {@linkcode Mat2D}
 * @see {@linkcode Shape}
 * @see {@linkcode Paint}
 * @see {@linkcode StrokeStyle}
 * @see {@linkcode TextStyle}
 * @author MathAid
 */

export * as RRR from './operations';
export * from './paint';
export * from './point';
export * from './rect';
export * from './shape';
export * from './style';
export * from './transform';

