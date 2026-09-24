/**
 * @fileoverview
 * @summary Renderer-side shared types and helpers.
 *
 * @description
 * Re-exports the shared state, the state stack, and the shape
 * tessellator. Renderer implementations import from this barrel.
 *
 * Re-exports the reference renderers, the headless renderers, and the
 * WebGPU renderer factory.
 * 
 * ```text
 *   renderer/
 *     state.ts       RendererState, initialState
 *     state-stack.ts RendererStateStack
 *     tessellate/    TriangleList, tessellateFill, tessellateStroke
 *     index.ts       this file
 * ```
 *
 * @see {@linkcode RendererState}
 * @see {@linkcode RendererStateStack}
 * @see {@linkcode TriangleList}
 *
 * @see {@linkcode Canvas2DRenderer}
 * @see {@linkcode NoopRenderer}
 * @see {@linkcode RecordingRenderer}
 * @see {@linkcode createWebGPURenderer}
 * @author MathAid
 */

export * from './canvas2d-renderer';
export * from './capture';
export * from './noop-renderer';
export * from './shim-renderer';
export * from './state';
export * from './state-stack';
export * from './tessellate';
export * from './webgpu';
export * from './webgpu-renderer';
