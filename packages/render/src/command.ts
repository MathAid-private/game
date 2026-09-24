/**
 * @fileoverview
 * @summary The render command vocabulary: the closed union of every draw and state operation.
 *
 * @description
 * Defines {@linkcode RenderCommand}, the discriminated union that is the
 * complete vocabulary a game may emit and a renderer must understand.
 * The union is closed. Adding a rendering feature is a union change plus
 * a handler in each renderer. Nothing else changes.
 *
 * Commands fall into two groups.
 *
 * ```text
 *   State commands     set-background, set-fill, set-stroke,
 *                      set-transform, push, pop
 *   Action commands    clear, fill-shape, stroke-shape, clip,
 *                      text, sprite
 * ```
 *
 * State commands change what subsequent action commands draw. Action
 * commands draw immediately. `push` and `pop` scope a subtree of state
 * changes so they do not leak into later commands.
 *
 * A `null` value on a state command disables that state slot. An
 * `undefined` value is not used. The distinction matters because
 * `undefined` is a valid property value in a JSON round trip, while
 * `null` is a deliberate choice.
 *
 * @example
 * Example 1: A clear and a filled shape
 * ```ts
 * import { make, sRGB } from './color';
 * import { makeSolid } from './geometry/paint';
 * import { makeRect } from './geometry/shape';
 * import { rect } from './geometry/rect';
 *
 * const clear: RenderCommand = {
 *   kind: 'clear',
 *   paint: makeSolid(make(sRGB, 0, 0, 0)),
 * };
 * const cell: RenderCommand = {
 *   kind: 'fill-shape',
 *   shape: makeRect(rect(0, 0, 32, 32)),
 *   paint: makeSolid(make(sRGB, 1, 1, 0)),
 * };
 * ```
 *
 * @example
 * Example 2: A scoped transform via push and pop
 * ```ts
 * const scope: RenderCommand[] = [
 *   { kind: 'push' },
 *   { kind: 'set-transform', transform: [1, 0, 0, 1, 100, 50] },
 *   { kind: 'sprite', sprite: { id: 'ship' }, transform: [1, 0, 0, 1, 0, 0] },
 *   { kind: 'pop' },
 * ];
 * ```
 *
 * @see {@linkcode Shape}
 * @see {@linkcode Paint}
 * @see {@linkcode Mat2D}
 * @author MathAid
 */

import { type Paint } from './geometry/paint';
import { type Point2D } from './geometry/point';
import { type Rect } from './geometry/rect';
import { type Shape } from './geometry/shape';
import { type StrokeStyle, type TextStyle } from './geometry/style';
import { type Mat2D } from './geometry/transform';

// Re-export the style types for callers that imported them from here.
export type { StrokeStyle, TextStyle };

/**
 * @summary A reference to a sprite asset, resolved by the active renderer.
 *
 * @description
 * {@linkcode SpriteRef} is an opaque handle to a renderable sprite. It
 * may be an image, an atlas region, or a procedurally defined shape. The
 * game refers to sprites by `id`. The renderer owns the registry that
 * maps ids to concrete assets.
 *
 * @example
 * Example 1: A named sprite
 * ```ts
 * const invader: SpriteRef = { id: 'invader-a' };
 * ```
 *
 * @example 2: A tile from an atlas
 * ```ts
 * const tile: SpriteRef = { id: 'tiles/grass' };
 * ```
 *
 * @see {@linkcode RenderCommand}
 * @author MathAid
 */
export interface SpriteRef {
  /** An opaque asset identifier, unique within a renderer's registry. */
  readonly id: string;
}

/**
 * @summary Fill the surface with a single paint.
 *
 * @description
 * The command fills the entire surface in one operation. The paint is
 * optional. When omitted, the renderer performs a transparent clear. The
 * renderer decides what "transparent" means for its surface.
 *
 * @example
 * Example 1: Opaque black
 * ```ts
 * const cmd: ClearCommand = {
 *   kind: 'clear',
 *   paint: makeSolid(make(sRGB, 0, 0, 0)),
 * };
 * ```
 *
 * @example 2: Transparent
 * ```ts
 * const cmd: ClearCommand = { kind: 'clear' };
 * ```
 *
 * @see {@linkcode RenderCommand}
 * @author MathAid
 */
export interface ClearCommand {
  /** The kind tag. */
  readonly kind: 'clear';
  /** The fill paint. Optional. Omit for a transparent clear. */
  readonly paint?: Paint;
}

/**
 * @summary Set the background paint applied before every frame.
 *
 * @description
 * The background is drawn once, before any other command. It is not
 * affected by the current transform. `null` disables the background.
 *
 * @example
 * Example 1: A solid background
 * ```ts
 * const cmd: SetBackgroundCommand = {
 *   kind: 'set-background',
 *   paint: makeSolid(make(sRGB, 0.1, 0.1, 0.1)),
 * };
 * ```
 *
 * @example 2: Disable
 * ```ts
 * const cmd: SetBackgroundCommand = { kind: 'set-background', paint: null };
 * ```
 *
 * @see {@linkcode RenderCommand}
 * @author MathAid
 */
export interface SetBackgroundCommand {
  /** The kind tag. */
  readonly kind: 'set-background';
  /** The background paint. `null` disables the background. */
  readonly paint: Paint | null;
}

/**
 * @summary Set the fill paint for subsequent shape fills.
 *
 * @description
 * The paint applies to every `fill-shape` command until the next
 * `set-fill`, `push`, or `pop`. `null` disables the fill state, which
 * means a subsequent `fill-shape` with no explicit paint draws nothing.
 *
 * @example
 * Example 1: A solid fill
 * ```ts
 * const cmd: SetFillCommand = {
 *   kind: 'set-fill',
 *   paint: makeSolid(make(sRGB, 1, 0, 0)),
 * };
 * ```
 *
 * @example 2: Disable
 * ```ts
 * const cmd: SetFillCommand = { kind: 'set-fill', paint: null };
 * ```
 *
 * @see {@linkcode RenderCommand}
 * @author MathAid
 */
export interface SetFillCommand {
  /** The kind tag. */
  readonly kind: 'set-fill';
  /** The fill paint. `null` disables the fill state. */
  readonly paint: Paint | null;
}

/**
 * @summary Set the stroke style for subsequent shape strokes.
 *
 * @description
 * The stroke applies to every `stroke-shape` command until the next
 * `set-stroke`, `push`, or `pop`. `null` disables the stroke state.
 *
 * @example
 * Example 1: A red outline
 * ```ts
 * const cmd: SetStrokeCommand = {
 *   kind: 'set-stroke',
 *   stroke: { paint: makeSolid(make(sRGB, 1, 0, 0)), width: 2 },
 * };
 * ```
 *
 * @example 2: Disable
 * ```ts
 * const cmd: SetStrokeCommand = { kind: 'set-stroke', stroke: null };
 * ```
 *
 * @see {@linkcode RenderCommand}
 * @author MathAid
 */
export interface SetStrokeCommand {
  /** The kind tag. */
  readonly kind: 'set-stroke';
  /** The stroke style. `null` disables the stroke state. */
  readonly stroke: StrokeStyle | null;
}

/**
 * @summary Set the current transform.
 *
 * @description
 * The transform is a {@linkcode Mat2D}. It replaces the current
 * transform. Compose helpers such as translate and rotate are builder
 * methods, not commands. The command carries the final matrix.
 *
 * @example
 * Example 1: A translation
 * ```ts
 * const cmd: SetTransformCommand = {
 *   kind: 'set-transform',
 *   transform: [1, 0, 0, 1, 100, 50],
 * };
 * ```
 *
 * @example 2: A rotation
 * ```ts
 * const s = Math.SQRT1_2;
 * const cmd: SetTransformCommand = {
 *   kind: 'set-transform',
 *   transform: [s, s, -s, s, 0, 0],
 * };
 * ```
 *
 * @see {@linkcode RenderCommand}
 * @author MathAid
 */
export interface SetTransformCommand {
  /** The kind tag. */
  readonly kind: 'set-transform';
  /** The transform matrix. */
  readonly transform: Mat2D;
}

/**
 * @summary Fill a shape with a paint.
 *
 * @description
 * The shape provides the geometry. The paint provides the color. When
 * `paint` is omitted, the current fill state from `set-fill` is used.
 * When neither is available, the command is a no-op.
 *
 * @example
 * Example 1: Fill a rectangle
 * ```ts
 * const cmd: FillShapeCommand = {
 *   kind: 'fill-shape',
 *   shape: makeRect(rect(0, 0, 32, 32)),
 *   paint: makeSolid(make(sRGB, 1, 0, 0)),
 * };
 * ```
 *
 * @example 2: Fill with the current state
 * ```ts
 * const cmd: FillShapeCommand = {
 *   kind: 'fill-shape',
 *   shape: makeCircle(point(50, 50), 10),
 * };
 * ```
 *
 * @see {@linkcode RenderCommand}
 * @author MathAid
 */
export interface FillShapeCommand {
  /** The kind tag. */
  readonly kind: 'fill-shape';
  /** The shape geometry. */
  readonly shape: Shape;
  /** The fill paint override. Optional. Falls back to the fill state. */
  readonly paint?: Paint;
}

/**
 * @summary Stroke a shape with a stroke style.
 *
 * @description
 * The shape provides the geometry. The stroke provides the color and
 * width. When `stroke` is omitted, the current stroke state from
 * `set-stroke` is used. When neither is available, the command is a
 * no-op.
 *
 * @example
 * Example 1: Stroke a polygon
 * ```ts
 * const cmd: StrokeShapeCommand = {
 *   kind: 'stroke-shape',
 *   shape: makePolygon([point(0, 0), point(10, 0), point(5, 10)]),
 *   stroke: { paint: makeSolid(make(sRGB, 1, 1, 1)), width: 1 },
 * };
 * ```
 *
 * @example 2: Stroke with the current state
 * ```ts
 * const cmd: StrokeShapeCommand = {
 *   kind: 'stroke-shape',
 *   shape: makeRect(rect(0, 0, 32, 32)),
 * };
 * ```
 *
 * @see {@linkcode RenderCommand}
 * @author MathAid
 */
export interface StrokeShapeCommand {
  /** The kind tag. */
  readonly kind: 'stroke-shape';
  /** The shape geometry. */
  readonly shape: Shape;
  /** The stroke style override. Optional. Falls back to the stroke state. */
  readonly stroke?: StrokeStyle;
}

/**
 * @summary Restrict subsequent drawing to the interior of a shape.
 *
 * @description
 * The clip intersects the current clip region with the shape's interior.
 * The effect ends at the matching `pop`. Nested clips intersect.
 *
 * @example
 * Example 1: Clip to a rectangle
 * ```ts
 * const cmd: ClipCommand = {
 *   kind: 'clip',
 *   shape: makeRect(rect(0, 0, 100, 100)),
 * };
 * ```
 *
 * @example 2: Clip to a circle
 * ```ts
 * const cmd: ClipCommand = {
 *   kind: 'clip',
 *   shape: makeCircle(point(50, 50), 25),
 * };
 * ```
 *
 * @see {@linkcode RenderCommand}
 * @author MathAid
 */
export interface ClipCommand {
  /** The kind tag. */
  readonly kind: 'clip';
  /** The shape used as the clip region. */
  readonly shape: Shape;
}

/**
 * @summary Draw a text string at a position.
 *
 * @description
 * The text is drawn at the anchor position with the given style. The
 * style controls color, size, alignment, and baseline.
 *
 * @example
 * Example 1: A score
 * ```ts
 * const cmd: TextCommand = {
 *   kind: 'text',
 *   text: 'SCORE 42',
 *   position: point(10, 10),
 *   style: { size: 16 },
 * };
 * ```
 *
 * @example 2: A centered title
 * ```ts
 * const cmd: TextCommand = {
 *   kind: 'text',
 *   text: 'GAME OVER',
 *   position: point(320, 200),
 *   style: { size: 32, align: 'center' },
 * };
 * ```
 *
 * @see {@linkcode RenderCommand}
 * @author MathAid
 */
export interface TextCommand {
  /** The kind tag. */
  readonly kind: 'text';
  /** The string to draw. */
  readonly text: string;
  /** The anchor position. */
  readonly position: Point2D;
  /** The text style. */
  readonly style: TextStyle;
}

/**
 * @summary Draw a sprite at a transform.
 *
 * @description
 * The sprite is resolved by the renderer's sprite registry. The
 * transform positions, scales, and rotates the sprite within the frame.
 * The command carries a normalized {@linkcode Mat2D}, not a decomposed
 * {@linkcode Transform2D}.
 *
 * @example
 * Example 1: A sprite at a position
 * ```ts
 * const cmd: SpriteCommand = {
 *   kind: 'sprite',
 *   sprite: { id: 'ship' },
 *   transform: [1, 0, 0, 1, 100, 50],
 * };
 * ```
 *
 * @example 2: A scaled sprite
 * ```ts
 * const cmd: SpriteCommand = {
 *   kind: 'sprite',
 *   sprite: { id: 'invader-a' },
 *   transform: [2, 0, 0, 2, 200, 100],
 * };
 * ```
 *
 * @see {@linkcode RenderCommand}
 * @author MathAid
 */
export interface SpriteCommand {
  /** The kind tag. */
  readonly kind: 'sprite';
  /** The sprite asset. */
  readonly sprite: SpriteRef;
  /** The placement, scale, and rotation. */
  readonly transform: Mat2D;
}

/**
 * @summary Save the current state on the renderer's state stack.
 *
 * @description
 * The saved state includes the transform, fill, stroke, background, and
 * clip. A matching `pop` restores it. Unmatched pushes are legal. The
 * renderer resets its stack at the start of every frame.
 *
 * @example
 * Example 1: Open a scope
 * ```ts
 * const cmd: PushCommand = { kind: 'push' };
 * ```
 *
 * @see {@linkcode RenderCommand}
 * @author MathAid
 */
export interface PushCommand {
  /** The kind tag. */
  readonly kind: 'push';
}

/**
 * @summary Restore the most recently saved state.
 *
 * @description
 * Pops the renderer's state stack. A `pop` with an empty stack is a
 * no-op. A development build may warn.
 *
 * @example
 * Example 1: Close a scope
 * ```ts
 * const cmd: PopCommand = { kind: 'pop' };
 * ```
 *
 * @see {@linkcode RenderCommand}
 * @author MathAid
 */
export interface PopCommand {
  /** The kind tag. */
  readonly kind: 'pop';
}

/**
 * @summary One draw or state operation, abstracted from any graphics API.
 *
 * @description
 * {@linkcode RenderCommand} is a closed, discriminated union keyed by
 * `kind`. A game emits an ordered list during `present()`. The engine
 * hands that list to the active {@linkcode IRenderer}, which translates
 * each command to its backend.
 *
 * The union has twelve variants. Six are state changes. Six are actions.
 * The state variants are `set-background`, `set-fill`, `set-stroke`,
 * `set-transform`, `push`, and `pop`. The action variants are `clear`,
 * `fill-shape`, `stroke-shape`, `clip`, `text`, and `sprite`.
 *
 * @example
 * Example 1: A complete frame
 * ```ts
 * const frame: RenderCommand[] = [
 *   { kind: 'clear', paint: makeSolid(make(sRGB, 0, 0, 0)) },
 *   { kind: 'set-fill', paint: makeSolid(make(sRGB, 1, 0, 0)) },
 *   { kind: 'fill-shape', shape: makeRect(rect(0, 0, 32, 32)) },
 *   { kind: 'push' },
 *   { kind: 'set-transform', transform: [1, 0, 0, 1, 100, 50] },
 *   { kind: 'sprite', sprite: { id: 'ship' }, transform: [1, 0, 0, 1, 0, 0] },
 *   { kind: 'pop' },
 * ];
 * ```
 *
 * @example
 * Example 2: A clip with a fill override
 * ```ts
 * const frame: RenderCommand[] = [
 *   { kind: 'clip', shape: makeCircle(point(50, 50), 25) },
 *   {
 *     kind: 'fill-shape',
 *     shape: makeRect(rect(0, 0, 100, 100)),
 *     paint: makeSolid(make(sRGB, 0, 0, 1)),
 *   },
 * ];
 * ```
 *
 * @see {@linkcode Shape}
 * @see {@linkcode Paint}
 * @see {@linkcode Mat2D}
 * @author MathAid
 */
export type RenderCommand =
  | ClearCommand
  | SetBackgroundCommand
  | SetFillCommand
  | SetStrokeCommand
  | SetTransformCommand
  | FillShapeCommand
  | StrokeShapeCommand
  | ClipCommand
  | TextCommand
  | SpriteCommand
  | PushCommand
  | PopCommand;

// Rect is imported only to satisfy the JSDoc references above.
export type { Rect };
