/**
 * @fileoverview
 * @summary The render command vocabulary — a renderer-agnostic description of a frame.
 *
 * @description
 * This module defines `RenderCommand`, the closed, discriminated union that is the *only*
 * drawing vocabulary a game may emit and a renderer must understand. A game builds an ordered
 * list of these during `present()`; each `IRenderer` implementation translates them to its own
 * graphics API. Extending rendering therefore means adding a variant here (once) and handling it
 * in each renderer — never touching game or engine-core code.
 *
 * The supporting style types (`StrokeStyle`, `TextStyle`, `SpriteRef`) are plain, immutable data
 * that decorate their command without binding to any backend.
 *
 * @author MathAid
 */

import type { Color, Point2D, Rect, Transform2D } from '@games/math';

/**
 * @summary An outline style for stroked shapes.
 *
 * @description
 * `StrokeStyle` describes how a shape's border is drawn: a colour and an optional line width.
 * The width is in logical pixels and defaults to `1`. It is pure data — a renderer decides how
 * to rasterise it.
 *
 * @example
 * const border: StrokeStyle = { color: white, width: 0.1 };
 *
 * @see {@link RenderCommand}
 * @author MathAid
 */
export interface StrokeStyle {
  /** Border colour. */
  readonly color: Color;
  /** Line width in logical pixels. Defaults to `1`. */
  readonly width?: number;
}

/**
 * @summary A text drawing style.
 *
 * @description
 * `TextStyle` controls how a text command is drawn: colour, point size, and horizontal
 * alignment relative to the position anchor. All fields are optional so a caller can specify
 * only what it needs to override.
 *
 * @example
 * const hud: TextStyle = { color: white, size: 12, align: 'left' };
 *
 * @see {@link RenderCommand}
 * @author MathAid
 */
export interface TextStyle {
  /** Text colour. */
  readonly color?: Color;
  /** Point size. */
  readonly size?: number;
  /** Horizontal alignment of the text relative to `position`. Defaults to `'left'`. */
  readonly align?: 'left' | 'center' | 'right';
}

/**
 * @summary A reference to a sprite asset, resolved by the active renderer.
 *
 * @description
 * `SpriteRef` is an opaque handle to a renderable sprite — an image, an atlas region, or a
 * procedurally defined shape. The game refers to sprites by `id`; the renderer owns the registry
 * that maps ids to concrete assets. This keeps game code asset-agnostic and lets the same game
 * present differently on renderers with different sprite backends.
 *
 * @example
 * const invader: SpriteRef = { id: 'invader-a' };
 *
 * @see {@link RenderCommand}
 * @author MathAid
 */
export interface SpriteRef {
  /** Opaque asset identifier, unique within a renderer's sprite registry. */
  readonly id: string;
}

/**
 * @summary One draw operation, abstracted from any graphics API.
 *
 * @description
 * `RenderCommand` is a closed, discriminated union keyed by `kind`. A game emits an ordered list
 * of these during `present()`; the engine hands that list to the active `IRenderer`, which
 * translates each command to its backend. Because this union is the entire vocabulary a renderer
 * must understand, adding a rendering capability (a new primitive, a gradient, a clip) is a
 * single union-variant change rather than a cross-cutting refactor.
 *
 * Stateful variants — `push` and `pop` — save and restore the renderer's transform/style state
 * so a subtree of commands can be scoped, mirroring a canvas state stack without naming any API.
 *
 * @example
 * const clear: RenderCommand = { kind: 'clear', color: black };
 * const cell: RenderCommand = { kind: 'rect', rect: bounds, fill: lemon };
 *
 * @see {@link StrokeStyle}
 * @see {@link TextStyle}
 * @see {@link SpriteRef}
 * @author MathAid
 */
export type RenderCommand =
  | { readonly kind: 'clear'; readonly color?: Color }
  | {
      readonly kind: 'rect';
      readonly rect: Rect;
      readonly fill?: Color;
      readonly stroke?: StrokeStyle;
    }
  | { readonly kind: 'sprite'; readonly sprite: SpriteRef; readonly transform: Transform2D }
  | {
      readonly kind: 'text';
      readonly text: string;
      readonly position: Point2D;
      readonly style: TextStyle;
    }
  | { readonly kind: 'push' }
  | { readonly kind: 'pop' };
