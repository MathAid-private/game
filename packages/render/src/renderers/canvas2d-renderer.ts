/**
 * @fileoverview
 * @summary The Canvas2D render mode: translates render commands to the Canvas 2D API.
 *
 * @description
 * Provides {@linkcode Canvas2DRenderer}, the reference
 * {@linkcode IRenderer}. It walks an {@linkcode IFrame}'s command list
 * and draws each command with the HTML Canvas 2D context.
 *
 * The renderer uses the shared {@linkcode RendererStateStack} to track
 * the current fill, stroke, and transform. The stack is kept in sync
 * with the Canvas 2D state stack. The shared stack is the source of
 * truth for a future WebGPU renderer that has no built-in stack.
 *
 * Colors are formatted with {@linkcode toCSS} from the color module.
 * Every shape kind is drawn through the Canvas 2D path API. No
 * tessellation is required for Canvas2D. A GPU renderer tessellates.
 *
 * @see {@linkcode IRenderer}
 * @see {@linkcode RendererStateStack}
 * @see {@linkcode toCSS}
 * @author MathAid
 */

import { toCSS } from '../color/w3c/css';
import type { RenderCommand, SpriteRef } from '../command';
import type { IFrame } from '../frame';
import type { Point2D } from '../geometry';
import { type Paint } from '../geometry/paint';
import { type Rect } from '../geometry/rect';
import { point, type PathSegment, type Shape } from '../geometry/shape';
import { type StrokeStyle, type TextStyle } from '../geometry/style';
import { type Mat2D } from '../geometry/transform';
import type { IRenderer, IRendererCapabilities } from '../renderer';
import type { ISpriteRegistry } from '../sprite-registry';
import { regionToRect, type CaptureOptions } from './capture';
import { RendererStateStack } from './state-stack';

const CANVAS_CAPABILITIES: IRendererCapabilities = Object.freeze({
  color: true,
  text: true,
  images: true,
  depth: false,
  shapes: true,
  nativeShapes: Object.freeze([
    'line',
    'polygon',
    'rect',
    'ellipse',
    'path',
    'group',
  ] as const) as readonly Shape['kind'][],
  clip: true,
  capture: true,
  captureStream: true,
});

/**
 * @summary An {@linkcode IRenderer} that draws frames with the Canvas 2D API.
 *
 * @description
 * {@linkcode Canvas2DRenderer} owns a {@linkcode CanvasRenderingContext2D}
 * and translates every {@linkcode RenderCommand} to the matching Canvas
 * call.
 *
 * @example
 * Example 1: Attach to a canvas
 * ```ts
 * const canvas = document.querySelector('canvas')!;
 * const renderer = new Canvas2DRenderer(canvas.getContext('2d')!);
 * engine.setRenderer(renderer);
 * ```
 *
 * @see {@linkcode IRenderer}
 * @author MathAid
 */
export class Canvas2DRenderer implements IRenderer {
  readonly #ctx: CanvasRenderingContext2D;
  readonly #state = new RendererStateStack();
  #sprites: ISpriteRegistry | null = null;
  #lastPoint: Point2D = point(0, 0);

  constructor(ctx: CanvasRenderingContext2D) {
    this.#ctx = ctx;
  }

  setSprites(registry: ISpriteRegistry | null): void {
    this.#sprites = registry;
  }

  get context(): CanvasRenderingContext2D {
    return this.#ctx;
  }

  get capabilities(): IRendererCapabilities {
    return CANVAS_CAPABILITIES;
  }

  resize(width: number, height: number): void {
    this.#ctx.canvas.width = width;
    this.#ctx.canvas.height = height;
  }

  render(frame: IFrame): void {
    this.#state.reset();
    for (const command of frame.commands) this.#draw(command);
  }

    /**
   * @summary Read raw pixels from the canvas.
   *
   * @description
   * Uses `getImageData` on the underlying 2D context. The result is a
   * raw RGBA buffer. The `options` argument is accepted for signature
   * compatibility. Only `scale` is honoured, by reading the scaled
   * dimensions from the canvas. `format`, `quality`, and `background`
   * are ignored.
   *
   * @example
   * Example 1: Capture a rectangle
   * ```ts
   * const image = renderer.capture(rect(0, 0, 100, 100));
   * image.width;  // 100
   * image.height; // 100
   * ```
   *
   * @param {Rect | Shape} region The capture region.
   * @param {CaptureOptions} _options Ignored.
   * @returns {ImageData} The raw pixels.
   * @author MathAid
   */
  capture(region: Rect | Shape, _options?: CaptureOptions): ImageData {
    const r = regionToRect(region);
    return this.#ctx.getImageData(r.x, r.y, r.width, r.height);
  }

  /**
   * @summary Read raw pixels from the canvas, asynchronously.
   *
   * @description
   * Delegates to the synchronous {@linkcode Canvas2DRenderer.capture}.
   * Canvas 2D has no asynchronous readback path. The method exists for
   * interface compatibility.
   *
   * @example
   * Example 1: Async capture
   * ```ts
   * const image = await renderer.captureAsync(rect(0, 0, 100, 100));
   * ```
   *
   * @param {Rect | Shape} region The capture region.
   * @param {CaptureOptions} options Optional capture parameters.
   * @returns {Promise<ImageData>} The raw pixels.
   * @author MathAid
   */
  async captureAsync(
    region: Rect | Shape,
    options?: CaptureOptions,
  ): Promise<ImageData> {
    return this.capture(region, options);
  }

  /**
   * @summary Stream encoded pixels from the canvas.
   *
   * @description
   * Renders the region to an offscreen canvas, encodes it with
   * `HTMLCanvasElement.toBlob`, and yields the encoded bytes as a
   * single-chunk `ReadableStream`. The `format` option selects the
   * encoder. The `quality` option applies to `jpeg` and `webp`. The
   * `scale` option resizes the output. The `background` option fills
   * the region before encoding.
   *
   * @example
   * Example 1: A PNG stream
   * ```ts
   * const stream = renderer.captureStream(rect(0, 0, 100, 100));
   * for await (const chunk of stream) { ... }
   * ```
   *
   * @example 2: A JPEG thumbnail
   * ```ts
   * const stream = renderer.captureStream(region, {
   *   format: 'jpeg',
   *   quality: 0.6,
   *   scale: 0.5,
   * });
   * ```
   *
   * @param {Rect | Shape} region The capture region.
   * @param {CaptureOptions} options Optional capture parameters.
   * @returns {ReadableStream<Uint8Array>} The encoded bytes.
   * @author MathAid
   */
  captureStream(
    region: Rect | Shape,
    options: CaptureOptions = {},
  ): ReadableStream<Uint8Array> {
    const self = this;
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const bytes = await self.#encodeRegion(region, options);
          controller.enqueue(bytes);
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
  }

  #draw(command: RenderCommand): void {
    switch (command.kind) {
      case 'clear':
        this.#clear(command.paint);
        break;
      case 'set-background':
        this.#state.setBackground(command.paint);
        break;
      case 'set-fill':
        this.#state.setFill(command.paint);
        break;
      case 'set-stroke':
        this.#state.setStroke(command.stroke);
        break;
      case 'set-transform':
        this.#state.setTransform(command.transform);
        this.#applyTransform(command.transform);
        break;
      case 'fill-shape':
        this.#fillShape(command.shape, command.paint);
        break;
      case 'stroke-shape':
        this.#strokeShape(command.shape, command.stroke);
        break;
      case 'clip':
        this.#clip(command.shape);
        break;
      case 'text':
        this.#text(command.text, command.position.x, command.position.y, command.style);
        break;
      case 'sprite':
        this.#sprite(command.sprite, command.transform);
        break;
      case 'push':
        this.#state.push();
        this.#ctx.save();
        break;
      case 'pop':
        this.#state.pop();
        this.#ctx.restore();
        break;
    }
  }

  #applyTransform(m: Mat2D): void {
    this.#ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
  }

  #clear(paint?: Paint): void {
    const { width, height } = this.#ctx.canvas;
    if (paint === undefined) {
      this.#ctx.clearRect(0, 0, width, height);
      return;
    }
    this.#ctx.fillStyle = toCSS(paint.color);
    this.#ctx.fillRect(0, 0, width, height);
  }

  #fillShape(shape: Shape, paint?: Paint): void {
    const p = paint ?? this.#state.current.fill;
    if (p === null || p === undefined) return;
    this.#ctx.fillStyle = toCSS(p.color);
    this.#buildPath(shape);
    this.#ctx.fill();
  }

  #strokeShape(shape: Shape, stroke?: StrokeStyle): void {
    const s = stroke ?? this.#state.current.stroke;
    if (s === null || s === undefined) return;
    this.#ctx.strokeStyle = toCSS(s.paint.color);
    this.#ctx.lineWidth = s.width ?? 1;
    this.#ctx.lineCap = s.cap ?? 'butt';
    this.#ctx.lineJoin = s.join ?? 'miter';
    this.#ctx.miterLimit = s.miterLimit ?? 10;
    this.#ctx.setLineDash(s.dash ? [...s.dash] : []);
    this.#ctx.lineDashOffset = s.dashOffset ?? 0;
    this.#buildPath(shape);
    this.#ctx.stroke();
  }

  #clip(shape: Shape): void {
    this.#buildPath(shape);
    this.#ctx.clip();
  }

  /**
   * @summary Build a Canvas 2D path from a shape.
   *
   * @description
   * Walks the shape tree. A group recurses into its children. An
   * ellipse uses `ctx.ellipse`. A path emits one `moveTo`, `lineTo`,
   * `quadraticCurveTo`, `bezierCurveTo`, `arc`, or `closePath` per
   * segment. Every leaf shape begins a new subpath so a fill or stroke
   * covers the shape's full geometry.
   *
   * @param {Shape} shape The shape to walk.
   * @returns {void}
   * @author MathAid
   */
  #buildPath(shape: Shape): void {
    this.#ctx.beginPath();
    this.#appendShape(shape);
  }

  #appendShape(shape: Shape): void {
    switch (shape.kind) {
      case 'line':
        this.#ctx.moveTo(shape.from.x, shape.from.y);
        this.#ctx.lineTo(shape.to.x, shape.to.y);
        this.#lastPoint = shape.to;
        return;
      case 'polygon': {
        const pts = shape.points;
        if (pts.length === 0) return;
        this.#ctx.moveTo(pts[0]!.x, pts[0]!.y);
        for (let i = 1; i < pts.length; i++) {
          this.#ctx.lineTo(pts[i]!.x, pts[i]!.y);
        }
        if (shape.closed) this.#ctx.closePath();
        this.#lastPoint = pts[pts.length - 1];
        return;
      }
      case 'rect': {
        const r = shape.rect;
        if (shape.cornerRadius === undefined) {
          this.#ctx.rect(r.x, r.y, r.width, r.height);
          return;
        }
        this.#appendRoundedRect(r, shape.cornerRadius);
        this.#lastPoint = point(r.x, r.y);
        return;
      }
      case 'ellipse': {
        const rot = shape.rotation ?? 0;
        const start = shape.startAngle ?? 0;
        const end = shape.endAngle ?? Math.PI * 2;
        this.#ctx.ellipse(
          shape.center.x,
          shape.center.y,
          shape.radiusX,
          shape.radiusY,
          rot,
          start,
          end,
        );
        // The ellipse starts wherever its startAngle places it.
        this.#lastPoint = point(
          shape.center.x +
            shape.radiusX * Math.cos(start) * Math.cos(rot) -
            shape.radiusY * Math.sin(start) * Math.sin(rot),
          shape.center.y +
            shape.radiusX * Math.cos(start) * Math.sin(rot) +
            shape.radiusY * Math.sin(start) * Math.cos(rot),
        );
        return;
      }
      case 'path':
        for (const seg of shape.segments) this.#appendSegment(seg);
        return;
      case 'group':
        for (const child of shape.shapes) this.#appendShape(child);
        return;
    }
  }

  /**
   * @summary Append a path segment to the current subpath.
   *
   * @description
   * A `close` segment does not update `#lastPoint`. If a path author
   * writes a `close` followed by an `arc` with no intervening `move`,
   * the arc's start point is taken from the last anchor before the
   * close. This deviates from the SVG spec. The deviation is rare and
   * documented here as a known limit.
   */
  #appendSegment(seg: PathSegment): void {
    switch (seg.kind) {
      case 'move':
        this.#ctx.moveTo(seg.to.x, seg.to.y);
        this.#lastPoint = seg.to;
        return;
      case 'line':
        this.#ctx.lineTo(seg.to.x, seg.to.y);
        this.#lastPoint = seg.to;
        return;
      case 'quadratic':
        this.#ctx.quadraticCurveTo(seg.control.x, seg.control.y, seg.to.x, seg.to.y);
        this.#lastPoint = seg.to;
        return;
      case 'cubic':
        this.#ctx.bezierCurveTo(seg.c1.x, seg.c1.y, seg.c2.x, seg.c2.y, seg.to.x, seg.to.y);
        this.#lastPoint = seg.to;
        return;
      case 'arc':
        this.#appendSVGArc(seg);
        return;
      case 'close':
        this.#ctx.closePath();
        return;
    }
  }

  /**
   * @summary Append an SVG elliptical arc to the current path.
   *
   * @description
   * Converts the SVG endpoint parametrization to the center
   * parametrization, then calls `ctx.ellipse` with the correct start and
   * end angles. The math follows the SVG 1.1 implementation notes.
   *
   * The current point is the start of the arc. It is read from the
   * canvas path state by tracking the last `moveTo` or `lineTo`. The
   * helper does not read the canvas because there is no API for that.
   *
   * @param {Extract<PathSegment, { kind: 'arc' }>} seg The arc segment.
   * @returns {void}
   * @author MathAid
   */
  #appendSVGArc(seg: Extract<PathSegment, { kind: 'arc' }>): void {
    const from = this.#lastPoint;
    const x1 = from.x;
    const y1 = from.y;
    const x2 = seg.to.x;
    const y2 = seg.to.y;

    if (x1 === x2 && y1 === y2) return;
    if (seg.rx === 0 || seg.ry === 0) {
      this.#ctx.lineTo(x2, y2);
      this.#lastPoint = seg.to;
      return;
    }

    const phi = seg.rotation;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);

    const dx = (x1 - x2) / 2;
    const dy = (y1 - y2) / 2;
    const x1p = cosPhi * dx + sinPhi * dy;
    const y1p = -sinPhi * dx + cosPhi * dy;

    const lambda = (x1p * x1p) / (seg.rx * seg.rx) + (y1p * y1p) / (seg.ry * seg.ry);
    let rx = seg.rx;
    let ry = seg.ry;
    if (lambda > 1) {
      const s = Math.sqrt(lambda);
      rx = s * seg.rx;
      ry = s * seg.ry;
    }

    const rx2 = rx * rx;
    const ry2 = ry * ry;
    const num = rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p;
    const den = rx2 * y1p * y1p + ry2 * x1p * x1p;
    const sign = seg.largeArc === seg.sweep ? -1 : 1;
    const co = sign * Math.sqrt(Math.max(0, num / den));
    const cxp = (co * (rx * y1p)) / ry;
    const cyp = (co * (-ry * x1p)) / rx;
    const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
    const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

    const ux = (x1p - cxp) / rx;
    const uy = (y1p - cyp) / ry;
    const vx = (-x1p - cxp) / rx;
    const vy = (-y1p - cyp) / ry;
    const theta1 = Math.atan2(uy, ux);
    let dTheta = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    if (!seg.sweep && dTheta > 0) dTheta -= 2 * Math.PI;
    if (seg.sweep && dTheta < 0) dTheta += 2 * Math.PI;

    this.#ctx.ellipse(cx, cy, rx, ry, phi, theta1, theta1 + dTheta, !seg.sweep);
    this.#lastPoint = seg.to;
  }

  #appendRoundedRect(r: Rect, radius: number | readonly [number, number, number, number]): void {
    const [tl, tr, br, bl] = Array.isArray(radius) ? radius : [radius, radius, radius, radius];
    const x = r.x;
    const y = r.y;
    const w = r.width;
    const h = r.height;
    this.#ctx.moveTo(x + tl, y);
    this.#ctx.lineTo(x + w - tr, y);
    this.#ctx.arcTo(x + w, y, x + w, y + tr, tr);
    this.#ctx.lineTo(x + w, y + h - br);
    this.#ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
    this.#ctx.lineTo(x + bl, y + h);
    this.#ctx.arcTo(x, y + h, x, y + h - bl, bl);
    this.#ctx.lineTo(x, y + tl);
    this.#ctx.arcTo(x, y, x + tl, y, tl);
    this.#ctx.closePath();
  }

  #text(text: string, x: number, y: number, style: TextStyle): void {
    if (style.paint !== undefined) {
      this.#ctx.fillStyle = toCSS(style.paint.color);
    }
    if (style.size !== undefined) {
      this.#ctx.font = `${style.size}px ${style.family ?? 'monospace'}`;
    }
    this.#ctx.textAlign = style.align ?? 'left';
    this.#ctx.textBaseline = style.baseline ?? 'top';
    this.#ctx.fillText(text, x, y);
  }

  #sprite(sprite: SpriteRef, transform: Mat2D): void {
    const image = this.#sprites?.get(sprite.id);
    this.#ctx.save();
    this.#ctx.transform(
      transform[0],
      transform[1],
      transform[2],
      transform[3],
      transform[4],
      transform[5],
    );
    if (image !== undefined) {
      this.#ctx.drawImage(image, 0, 0);
    } else {
      this.#ctx.fillStyle = 'magenta';
      this.#ctx.fillRect(0, 0, 1, 1);
    }
    this.#ctx.restore();
  }

  async #encodeRegion(
    region: Rect | Shape,
    options: CaptureOptions,
  ): Promise<Uint8Array> {
    const r = regionToRect(region);
    const format = options.format ?? 'png';
    const scale = options.scale ?? 1;
    const outW = Math.max(1, Math.round(r.width * scale));
    const outH = Math.max(1, Math.round(r.height * scale));

    const offscreen = document.createElement('canvas');
    offscreen.width = outW;
    offscreen.height = outH;
    const ctx = offscreen.getContext('2d');
    if (ctx === null) {
      throw new Error('Canvas2DRenderer.captureStream: no 2D context.');
    }

    if (options.background !== undefined) {
      ctx.fillStyle = toCSS(options.background.color);
      ctx.fillRect(0, 0, outW, outH);
    }

    ctx.drawImage(
      this.#ctx.canvas,
      r.x, r.y, r.width, r.height,
      0, 0, outW, outH,
    );

    if (format === 'raw') {
      const imageData = ctx.getImageData(0, 0, outW, outH);
      return new Uint8Array(imageData.data.buffer.slice(0));
    }

    const quality = Math.max(0, Math.min(1, options.quality ?? 0.92));
    const blob = await new Promise<Blob>((resolve, reject) => {
      offscreen.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob returned null.'))),
        `image/${format}`,
        quality,
      );
    });
    return new Uint8Array(await blob.arrayBuffer());
  }
}
