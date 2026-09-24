/**
 * @fileoverview
 * @summary The shape tessellator barrel.
 *
 * @description
 * Re-exports the public tessellation API. The two entry points are
 * {@linkcode tessellateFill} and {@linkcode tessellateStroke}. Both
 * return a {@linkcode TriangleList} that a GPU backend can upload
 * directly.
 *
 * ```text
 *   renderer/tessellate/
 *     types.ts     TriangleList, TessellateOptions
 *     flatten.ts   curve flattening helpers
 *     earcut.ts    polygon triangulation
 *     fill.ts      tessellateFill
 *     stroke.ts    tessellateStroke
 *     index.ts     this file
 * ```
 *
 * @example
 * Example 1: Tessellate a fill
 * ```ts
 * import { tessellateFill } from './renderer/tessellate';
 * const list = tessellateFill(makeRect(rect(0, 0, 10, 10)));
 * ```
 *
 * @example
 * Example 2: Tessellate a stroke
 * ```ts
 * import { tessellateStroke } from './renderer/tessellate';
 * const list = tessellateStroke(shape, {
 *   paint: makeSolid(make(sRGB, 1, 1, 1)),
 *   width: 2,
 * });
 * ```
 *
 * @see {@linkcode TriangleList}
 * @see {@linkcode tessellateFill}
 * @see {@linkcode tessellateStroke}
 * @author MathAid
 */

export * from './earcut';
export * from './fill';
export * from './flatten';
export * from './stroke';
export * from './types';
