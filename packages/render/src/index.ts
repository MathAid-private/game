/**
 * @fileoverview
 * @summary Public entry point for `@games/render`.
 *
 * @description
 * Re-exports every public module of the render package. The geometry
 * layer, the color module, the command union, the frame contracts, the
 * renderer contract, the reference renderers, and the sprite registry.
 *
 * Import from this barrel in application code and tests. Files inside
 * `src/` import their siblings with relative paths. Never import from a
 * deep path such as `@games/render/src/geometry/point`.
 *
 * ```text
 *   @games/render
 *   +-- geometry    point, rect, transform, shape, paint, style, ops
 *   +-- color       spaces, conversion, gamut, backends
 *   +-- command     RenderCommand, SpriteRef
 *   +-- frame       IFrame, IFrameBuilder
 *   +-- frame-builder  FrameBuilder
 *   +-- renderer    IRenderer, IRendererCapabilities
 *   +-- renderers   Canvas2DRenderer, NoopRenderer, RecordingRenderer
 *   +-- sprite-registry  ISpriteRegistry, SpriteRegistry
 * ```
 *
 * @example
 * Example 1: Build a frame and render it
 * ```ts
 * import {
 *   FrameBuilder, Canvas2DRenderer, make, sRGB, rect,
 * } from '@games/render';
 *
 * const builder = new FrameBuilder();
 * builder.clear(make(sRGB, 0, 0, 0));
 * builder.rect(rect(0, 0, 32, 32), make(sRGB, 1, 0, 0));
 * ```
 *
 * @example
 * Example 2: Test a game with a recording renderer
 * ```ts
 * import { FrameBuilder, RecordingRenderer } from '@games/render';
 *
 * const recorder = new RecordingRenderer();
 * recorder.render(new FrameBuilder());
 * ```
 *
 * @author MathAid
 */

export * from './color';
export * from './command';
export * from './frame';
export * from './frame-builder';
export * from './geometry';
export * from './renderer';
export * from './renderers';
export * from './serialize';
export * from './shim';
export * from './sprite-registry';
export * from './trace';
