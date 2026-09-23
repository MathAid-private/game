# Design Document

## 1. Scope

Three changes to `@games/render`.

1. **Sever `@games/math`.** Move `Color`, `Point2D`, `Rect`, `Transform2D` into the render module. Replace `Color` with `ColorValue<ColorSpaceDef<string>>` from `color/`.
2. **Add a geometry module.** Value types for shapes, transforms, and paints.
3. **Extend the command union.** New state commands and shape commands. New builder methods. Extended renderer capabilities. Capture and serialization.

## 2. Module layout

```text
  packages/render/
    src/
      color/               (existing)
      geometry/
        index.ts           Barrel.
        point.ts           Point2D, Vector2D, and operations.
        rect.ts            Rect and operations.
        transform.ts       Mat2D, Transform2D, and constructors.
        shape.ts           Shape union and make* constructors.
        paint.ts           Paint union and make* constructors.
        style.ts           StrokeStyle, TextStyle, FillStyle.
      command.ts           (extended)
      frame.ts             (extended)
      frame-builder.ts     (extended)
      renderer.ts          (extended with capabilities and capture)
      renderers/
        canvas2d-renderer.ts   (extended)
        noop-renderer.ts       (extended)
        recording-renderer.ts  (extended)
        index.ts
      sprite-registry.ts   (existing)
      serialize/           (new)
        index.ts
        frame-json.ts
        frame-msgpack.ts
      index.ts             (extended)
```

The `serialize/` directory mirrors `color/serialize/`. It handles the frame, not pixels. Pixel capture is a renderer capability.

## 3. Geometry value types

### 3.1 `Point2D` and `Vector2D`

```ts
interface Point2D {
  readonly x: number;
  readonly y: number;
}

interface Vector2D {
  readonly dx: number;
  readonly dy: number;
}
```

Point and vector are separate. A point is a location. A vector is a displacement. The distinction prevents bugs when transforms are applied.

Constructors: `point(x, y)`, `vector(dx, dy)`.
Operations: `add`, `subtract`, `scale`, `length`, `normalize`, `dot`, `cross`, `distance`.

### 3.2 `Rect`

```ts
interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
```

Constructors: `rect(x, y, w, h)`, `rectFromPoints(a, b)`, `rectFromBounds(min, max)`.
Operations: `center`, `contains`, `intersects`, `union`, `inflate`, `offset`.

### 3.3 Transforms

Two representations.

```ts
// Canonical. A 2D affine matrix in canvas order.
type Mat2D = readonly [
  a: number, b: number, c: number, d: number, e: number, f: number,
];

// Convenience. Decomposed form for authoring.
interface Transform2D {
  readonly x: number;
  readonly y: number;
  readonly rotation?: number;   // radians
  readonly scaleX?: number;
  readonly scaleY?: number;
}
```

`Mat2D` is what the commands carry. `Transform2D` is a convenient input. `toMat2D(t: Transform2D | Mat2D): Mat2D` normalizes.

The matrix layout matches Canvas2D and CSS:

```text
  | a  c  e |
  | b  d  f |
  | 0  0  1 |
```

Constructors:

```ts
identity(): Mat2D
translation(x: number, y: number): Mat2D
scaling(sx: number, sy?: number): Mat2D
rotation(rad: number): Mat2D
skew(ax: number, ay: number): Mat2D
compose(...ms: Mat2D[]): Mat2D
```

Operations:

```ts
invert(m: Mat2D): Mat2D
applyToPoint(m: Mat2D, p: Point2D): Point2D
applyToVector(m: Mat2D, v: Vector2D): Vector2D
determinant(m: Mat2D): number
equals(a: Mat2D, b: Mat2D, epsilon?: number): boolean
```

`applyToVector` ignores translation. This is the point-versus-vector distinction in action.

### 3.4 Shapes

A shape describes geometry only. It carries no style and no transform. The same shape object may be referenced by any number of commands.

```ts
type Shape =
  | LineShape
  | PolygonShape
  | RectShape
  | EllipseShape
  | PathShape
  | GroupShape;
```

**LineShape**

```ts
interface LineShape {
  readonly kind: 'line';
  readonly from: Point2D;
  readonly to: Point2D;
}
```

**PolygonShape**

```ts
interface PolygonShape {
  readonly kind: 'polygon';
  readonly points: readonly Point2D[];
  readonly closed: boolean;
}
```

`closed` is required. A fill treats an open polygon as closed. A stroke respects the flag.

**RectShape**

```ts
interface RectShape {
  readonly kind: 'rect';
  readonly rect: Rect;
  readonly cornerRadius?: number | readonly [number, number, number, number];
}
```

`cornerRadius` follows CSS: `[topLeft, topRight, bottomRight, bottomLeft]`. A single number applies to all four.

**EllipseShape**

```ts
interface EllipseShape {
  readonly kind: 'ellipse';
  readonly center: Point2D;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly rotation?: number;   // radians
  readonly startAngle?: number; // radians, default 0
  readonly endAngle?: number;   // radians, default 2*pi
}
```

`startAngle` and `endAngle` describe arcs. They default to a full ellipse.

**PathShape**

```ts
interface PathShape {
  readonly kind: 'path';
  readonly segments: readonly PathSegment[];
}

type PathSegment =
  | { readonly kind: 'move'; readonly to: Point2D }
  | { readonly kind: 'line'; readonly to: Point2D }
  | { readonly kind: 'quadratic'; readonly control: Point2D; readonly to: Point2D }
  | { readonly kind: 'cubic'; readonly c1: Point2D; readonly c2: Point2D; readonly to: Point2D }
  | { readonly kind: 'arc'; readonly rx: number; readonly ry: number; readonly rotation: number; readonly largeArc: boolean; readonly sweep: boolean; readonly to: Point2D }
  | { readonly kind: 'close' };
```

The path segment shape follows SVG. It covers every curved primitive.

**GroupShape**

```ts
interface GroupShape {
  readonly kind: 'group';
  readonly shapes: readonly Shape[];
}
```

A group is a composition. It does not carry a transform. The caller pushes a transform before drawing the group.

Constructors:

```ts
makeLine(from: Point2D, to: Point2D): LineShape
makePolygon(points: readonly Point2D[], closed?: boolean): PolygonShape
makeRect(rect: Rect, cornerRadius?: number | readonly [number, number, number, number]): RectShape
makeEllipse(center: Point2D, radiusX: number, radiusY: number, options?: EllipseOptions): EllipseShape
makeCircle(center: Point2D, radius: number): EllipseShape
makePath(segments: readonly PathSegment[]): PathShape
makeGroup(shapes: readonly Shape[]): GroupShape
```

### 3.5 Paint and style

```ts
type Paint =
  | { readonly kind: 'solid'; readonly color: ColorValue<ColorSpaceDef<string>> };
```

Pattern and gradient variants are deferred. The union is open for future extension.

```ts
interface StrokeStyle {
  readonly paint: Paint;
  readonly width?: number;
  readonly cap?: 'butt' | 'round' | 'square';
  readonly join?: 'miter' | 'round' | 'bevel';
  readonly miterLimit?: number;
  readonly dash?: readonly number[];
  readonly dashOffset?: number;
}
```

```ts
interface TextStyle {
  readonly paint?: Paint;
  readonly size?: number;
  readonly family?: string;
  readonly align?: 'left' | 'center' | 'right';
  readonly baseline?: 'top' | 'middle' | 'bottom' | 'alphabetic';
}
```

The `Paint` type replaces raw `Color` everywhere. A solid paint wraps a color. This makes future pattern and gradient support additive, not breaking.

## 4. Command union

The extended union.

```ts
type RenderCommand =
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
```

State commands.

```ts
interface ClearCommand {
  readonly kind: 'clear';
  readonly paint?: Paint;
}

interface SetBackgroundCommand {
  readonly kind: 'set-background';
  readonly paint: Paint | null;
}

interface SetFillCommand {
  readonly kind: 'set-fill';
  readonly paint: Paint | null;
}

interface SetStrokeCommand {
  readonly kind: 'set-stroke';
  readonly stroke: StrokeStyle | null;
}

interface SetTransformCommand {
  readonly kind: 'set-transform';
  readonly transform: Mat2D;
}
```

`null` disables the state. `undefined` is not used. A `set-fill` with `null` means "no fill for subsequent shapes until changed".

Action commands.

```ts
interface FillShapeCommand {
  readonly kind: 'fill-shape';
  readonly shape: Shape;
  readonly paint?: Paint;   // override; undefined uses current fill state
}

interface StrokeShapeCommand {
  readonly kind: 'stroke-shape';
  readonly shape: Shape;
  readonly stroke?: StrokeStyle;
}

interface ClipCommand {
  readonly kind: 'clip';
  readonly shape: Shape;
}
```

`text` and `sprite` are unchanged except for type replacements.

```ts
interface TextCommand {
  readonly kind: 'text';
  readonly text: string;
  readonly position: Point2D;
  readonly style: TextStyle;
}

interface SpriteCommand {
  readonly kind: 'sprite';
  readonly sprite: SpriteRef;
  readonly transform: Mat2D;
}
```

The `rect` variant is removed. The builder's `rect` method emits `fill-shape` and `stroke-shape` with a `RectShape`.

### 4.1 Rationale for Model A

State commands make the frame list longer but readable. A renderer that loses state on `push`/`pop` cannot misalign because the state is in the command stream.

State commands are also cheap to serialize. They are small objects. The frame serializer handles them like any other command.

### 4.2 `push` and `pop`

`push` saves the current state. The state is:

- Current transform.
- Current fill paint.
- Current stroke style.
- Current background.
- Current clip.

`pop` restores the most recently saved state. A `pop` with an empty stack is a no-op. Implementations may warn in development.

## 5. Frame builder

The builder grows methods to match the union. All existing methods remain.

### 5.1 Background and clear

```ts
clear(paint?: Paint): void;
setBackground(paint: Paint | null): void;
```

`clear` fills the surface immediately. `setBackground` sets a state that the renderer applies before drawing. In Canvas2D both map to the same underlying fill.

### 5.2 Fill and stroke state

```ts
setFill(paint: Paint | null): void;
setStroke(stroke: StrokeStyle | null): void;
```

### 5.3 Shape drawing

The generic form plus overloads.

```ts
// Fill
fill(shape: Shape, paint?: Paint): void;
fillPolygon(points: readonly Point2D[], paint?: Paint): void;
fillRect(rect: Rect, paint?: Paint): void;
fillEllipse(center: Point2D, radiusX: number, radiusY: number, paint?: Paint): void;
fillCircle(center: Point2D, radius: number, paint?: Paint): void;

// Stroke
stroke(shape: Shape, stroke?: StrokeStyle): void;
strokeLine(from: Point2D, to: Point2D, stroke?: StrokeStyle): void;
strokePolygon(points: readonly Point2D[], closed: boolean, stroke?: StrokeStyle): void;
strokeRect(rect: Rect, stroke?: StrokeStyle): void;
strokeEllipse(center: Point2D, radiusX: number, radiusY: number, stroke?: StrokeStyle): void;
strokeCircle(center: Point2D, radius: number, stroke?: StrokeStyle): void;

// Both at once (convenience)
rect(rect: Rect, fill?: Paint, stroke?: StrokeStyle): void;
```

The `rect` method emits two commands when both fill and stroke are provided. It emits one command otherwise.

### 5.4 Transform

```ts
setTransform(m: Mat2D | Transform2D): void;
resetTransform(): void;
translate(x: number, y: number): void;
rotate(rad: number): void;
scale(sx: number, sy?: number): void;
transform(m: Mat2D): void;   // compose onto current
```

`translate`, `rotate`, `scale`, and `transform` compose onto the current transform. This matches Canvas2D semantics.

### 5.5 Clip

```ts
clip(shape: Shape): void;
clipRect(rect: Rect): void;
```

A clip intersects with the current clip. `push`/`pop` scope it.

### 5.6 Text and sprite

Unchanged signatures, updated types.

```ts
text(text: string, position: Point2D, style: TextStyle): void;
sprite(sprite: SpriteRef, transform: Mat2D | Transform2D): void;
```

### 5.7 Save and restore

```ts
push(): void;
pop(): void;
```

Unchanged.

### 5.8 Reset

```ts
reset(): void;
```

Already present. It clears the command list. It does not reset the builder's internal state tracking, if any. The current builder has no internal state tracking. Every command is a full description. The renderer maintains the state.

## 6. Renderer contract

The renderer grows new methods and new capabilities.

### 6.1 Capabilities

```ts
interface IRendererCapabilities {
  readonly color: boolean;
  readonly text: boolean;
  readonly images: boolean;
  readonly depth: boolean;
  readonly shapes: boolean;
  readonly nativeShapes: readonly Shape['kind'][];
  readonly clip: boolean;
  readonly capture: boolean;
  readonly captureStream: boolean;
}
```

`nativeShapes` lists the shape kinds the backend draws without tessellation. A renderer that tessellates everything reports `[]`. A renderer that natively draws rects and ellipses reports `['rect', 'ellipse']`.

Games may check the flags before emitting expensive geometry. A terminal renderer, for example, reports `shapes: false`.

### 6.2 Render

```ts
render(frame: IFrame): void;
```

Unchanged. The renderer's command dispatcher grows cases.

### 6.3 Resize

```ts
resize(width: number, height: number): void;
```

Unchanged.

### 6.4 Capture

```ts
capture(region: Rect | Shape, options?: CaptureOptions): ImageData;
captureAsync(region: Rect | Shape, options?: CaptureOptions): Promise<ImageData>;
captureStream(region: Rect | Shape, options?: CaptureOptions): ReadableStream<Uint8Array>;
```

`capture` is sync. It returns pixels. It throws when the backend cannot capture synchronously. Callers check `capabilities.capture` first.

`captureAsync` returns a promise. The async variant is the recommended path. It is never a no-op.

`captureStream` returns a `ReadableStream` of encoded bytes. The format is set by `options.format`. Legal values are `'png'`, `'jpeg'`, `'webp'`, and `'raw'`.

`CaptureOptions`:

```ts
interface CaptureOptions {
  readonly format?: 'png' | 'jpeg' | 'webp' | 'raw';
  readonly quality?: number;   // 0 to 1 for lossy formats
  readonly scale?: number;     // output scale
  readonly background?: Paint; // fill under transparent regions
}
```

A renderer that cannot capture throws with a clear message. A renderer that cannot stream falls back to a buffered capture wrapped in a single-chunk stream. Both are legitimate. The capabilities flags state which is native.

## 7. Frame serialization

The frame itself is serializable. This is separate from pixel capture.

```ts
serializeFrame(frame: IFrame): SerializedFrame;
deserializeFrame(data: SerializedFrame): IFrame;

toFrameJSON(frame: IFrame): string;
fromFrameJSON(text: string): IFrame;

toFrameMsgPack(frame: IFrame): Uint8Array;
fromFrameMsgPack(data: Uint8Array): IFrame;
```

A `SerializedFrame` is a plain JSON-compatible structure. Colors are stored as `[spaceId, c1, c2, c3, alpha]` tuples. Shapes are stored as nested objects. Transforms are stored as 6-element arrays.

The serializer validates the shape. It throws on unknown shape kinds, unknown color space IDs, and non-finite numbers.

Streaming variants:

```ts
toFrameJSONStream(frame: IFrame): AsyncGenerator<Uint8Array>;
toFrameMsgPackStream(frame: IFrame): AsyncGenerator<Uint8Array>;
fromFrameJSONStream(source: AsyncIterable<Uint8Array>): Promise<IFrame>;
fromFrameMsgPackStream(source: AsyncIterable<Uint8Array>): Promise<IFrame>;
```

The streaming pattern matches `color/serialize/msgpack.ts`.

## 8. `@games/math` severance

The following types are removed from the render module's imports.

| Old source | New home | Replacement |
|------------|----------|-------------|
| `Color` | `color/` | `ColorValue<ColorSpaceDef<string>>` |
| `Point2D` | `geometry/point.ts` | Local `Point2D` |
| `Rect` | `geometry/rect.ts` | Local `Rect` |
| `Transform2D` | `geometry/transform.ts` | Local `Transform2D` and `Mat2D` |

Every file that imports from `@games/math` is updated. Every place that reads `color.r`, `color.g`, `color.b`, or `color.a` is updated to `color.c1`, `color.c2`, `color.c3`, or `color.alpha`.

`Canvas2DRenderer.toCssColor` is the primary consumer. It becomes:

```ts
function toCssColor(color: ColorValue<ColorSpaceDef<string>>): string {
  const srgb = color._space.id === 'sRGB' ? color : convert(color, sRGB);
  const r = Math.round(srgb.c1 * 255);
  const g = Math.round(srgb.c2 * 255);
  const b = Math.round(srgb.c3 * 255);
  return `rgba(${r}, ${g}, ${b}, ${srgb.alpha})`;
}
```

## 9. Design rules specific to the geometry module

1. **Value types only.** No classes. No mutable state. Every shape, transform, and paint is a plain object or tuple.
2. **Constructors use `make*`.** `makeLine`, `makePolygon`, `makeRect`. Matches the `color/` convention.
3. **No methods on data.** Operations are free functions. `length(v)`, not `v.length()`.
4. **Shapes are flyweights.** The same shape object may be shared. Nothing mutates a shape after creation.
5. **Color is `ColorValue`.** The render module has no local color type. Every color is a `ColorValue<ColorSpaceDef<string>>`.
6. **Paints wrap colors.** A solid paint is `{ kind: 'solid', color }`. This allows future gradient and pattern paints without breaking changes.
7. **The command union is the vocabulary.** Adding a rendering feature is a union change plus a handler in each renderer. Nothing else.

## 10. Design rules specific to the renderers

1. **Dispatch on `kind`.** Every renderer has a single `#draw` with a `switch`. The switch has no `default`. The union is closed and exhaustive.
2. **No state sharing between renderers.** Each renderer keeps its own state. `push` and `pop` operate on the renderer's own stack.
3. **Capabilities are honest.** A renderer that cannot do something reports `false`. It throws when called anyway, with a message that names the missing capability.
4. **No DOM leakage in the interface.** `IRenderer` has no Canvas2D, WebGL, or DOM types. Backends may use them internally.
5. **Capture is opt-in.** The default is `false`. A renderer that supports it implements all three capture methods or none.

---
