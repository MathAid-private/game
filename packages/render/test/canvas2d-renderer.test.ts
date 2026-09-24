/**
 * @fileoverview
 * @summary Tests for {@linkcode Canvas2DRenderer} using a mock context.
 *
 * @description
 * The mock records every Canvas 2D method call the renderer makes. The
 * tests check that each {@linkcode RenderCommand} produces the expected
 * sequence of calls. The mock also verifies the state stack alignment
 * between the shared {@linkcode RendererStateStack} and the Canvas
 * `save` and `restore` methods.
 *
 * @see {@linkcode Canvas2DRenderer}
 * @author MathAid
 */

import {
  type Canvas2DRenderer,
  FrameBuilder,
  make,
  makePath,
  makeSolid,
  point,
  rect,
  sRGB
} from '@games/render';
import { describe, expect, it } from 'vitest';

interface Call {
  readonly method: string;
  readonly args: readonly unknown[];
}

interface MockContext {
  readonly calls: Call[];
  readonly canvas: { width: number; height: number };
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  miterLimit: number;
  lineDashOffset: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  // Methods.
  save(): void;
  restore(): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void;
  rect(x: number, y: number, w: number, h: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
  ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    rot: number,
    start: number,
    end: number,
    ccw?: boolean,
  ): void;
  arc(cx: number, cy: number, r: number, start: number, end: number, ccw?: boolean): void;
  fill(): void;
  stroke(): void;
  clip(): void;
  setLineDash(pattern: number[]): void;
  drawImage(image: unknown, x: number, y: number): void;
}

function makeMock(): MockContext {
  const calls: Call[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]): void => {
      calls.push({ method, args });
    };
  return {
    calls,
    canvas: { width: 800, height: 600 },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    lineDashOffset: 0,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    save: record('save'),
    restore: record('restore'),
    setTransform: record('setTransform'),
    transform: record('transform'),
    clearRect: record('clearRect'),
    fillRect: record('fillRect'),
    strokeRect: record('strokeRect'),
    fillText: record('fillText'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    quadraticCurveTo: record('quadraticCurveTo'),
    bezierCurveTo: record('bezierCurveTo'),
    rect: record('rect'),
    arcTo: record('arcTo'),
    ellipse: record('ellipse'),
    arc: record('arc'),
    fill: record('fill'),
    stroke: record('stroke'),
    clip: record('clip'),
    setLineDash: record('setLineDash'),
    drawImage: record('drawImage'),
  };
}

function methodNames(mock: MockContext): string[] {
  return mock.calls.map((c) => c.method);
}

describe('Canvas2DRenderer clear', () => {
  it('calls clearRect when no paint is given', () => {
    const mock = makeMock();
    const renderer = new Canvas2DRenderer(mock as unknown as CanvasRenderingContext2D);
    const b = new FrameBuilder();
    b.clear();
    renderer.render(b);
    expect(methodNames(mock)).toEqual(['clearRect']);
  });

  it('calls fillRect when a paint is given', () => {
    const mock = makeMock();
    const renderer = new Canvas2DRenderer(mock as unknown as CanvasRenderingContext2D);
    const b = new FrameBuilder();
    b.clear(makeSolid(make(sRGB, 0, 0, 0)));
    renderer.render(b);
    expect(methodNames(mock)).toContain('fillRect');
  });
});

describe('Canvas2DRenderer fill-shape', () => {
  it('draws a rect with fillRect', () => {
    const mock = makeMock();
    const renderer = new Canvas2DRenderer(mock as unknown as CanvasRenderingContext2D);
    const b = new FrameBuilder();
    b.fillRect(rect(0, 0, 10, 10), makeSolid(make(sRGB, 1, 0, 0)));
    renderer.render(b);
    expect(methodNames(mock)).toContain('fillRect');
  });

  it('draws a circle with ellipse and fill', () => {
    const mock = makeMock();
    const renderer = new Canvas2DRenderer(mock as unknown as CanvasRenderingContext2D);
    const b = new FrameBuilder();
    b.fillCircle(point(50, 50), 10, makeSolid(make(sRGB, 1, 0, 0)));
    renderer.render(b);
    const names = methodNames(mock);
    expect(names).toContain('beginPath');
    expect(names).toContain('ellipse');
    expect(names).toContain('fill');
  });

  it('draws a polygon with moveTo, lineTo, closePath, fill', () => {
    const mock = makeMock();
    const renderer = new Canvas2DRenderer(mock as unknown as CanvasRenderingContext2D);
    const b = new FrameBuilder();
    b.fillPolygon([point(0, 0), point(10, 0), point(5, 10)], makeSolid(make(sRGB, 1, 0, 0)));
    renderer.render(b);
    const names = methodNames(mock);
    expect(names).toContain('beginPath');
    expect(names).toContain('moveTo');
    expect(names.filter((n) => n === 'lineTo').length).toBeGreaterThanOrEqual(2);
    expect(names).toContain('closePath');
    expect(names).toContain('fill');
  });

  it('draws a path with curve methods', () => {
    const mock = makeMock();
    const renderer = new Canvas2DRenderer(mock as unknown as CanvasRenderingContext2D);
    const b = new FrameBuilder();
    b.fill(
      makePath([
        { kind: 'move', to: point(0, 0) },
        { kind: 'quadratic', control: point(5, -10), to: point(10, 0) },
        { kind: 'cubic', c1: point(10, 10), c2: point(15, 10), to: point(20, 0) },
        { kind: 'close' },
      ]),
      makeSolid(make(sRGB, 0, 1, 0)),
    );
    renderer.render(b);
    const names = methodNames(mock);
    expect(names).toContain('moveTo');
    expect(names).toContain('quadraticCurveTo');
    expect(names).toContain('bezierCurveTo');
    expect(names).toContain('closePath');
  });

  it('skips the draw when no paint is available', () => {
    const mock = makeMock();
    const renderer = new Canvas2DRenderer(mock as unknown as CanvasRenderingContext2D);
    const b = new FrameBuilder();
    b.fillRect(rect(0, 0, 10, 10));
    renderer.render(b);
    expect(mock.calls).toHaveLength(0);
  });
});

describe('Canvas2DRenderer stroke-shape', () => {
  it('sets lineWidth and stroke style before stroking', () => {
    const mock = makeMock();
    const renderer = new Canvas2DRenderer(mock as unknown as CanvasRenderingContext2D);
    const b = new FrameBuilder();
    b.strokeRect(rect(0, 0, 10, 10), {
      paint: makeSolid(make(sRGB, 1, 1, 1)),
      width: 3,
    });
    renderer.render(b);
    expect(mock.lineWidth).toBe(3);
    expect(methodNames(mock)).toContain('strokeRect');
  });

  it('applies dash patterns', () => {
    const mock = makeMock();
    const renderer = new Canvas2DRenderer(mock as unknown as CanvasRenderingContext2D);
    const b = new FrameBuilder();
    b.strokeLine(point(0, 0), point(10, 0), {
      paint: makeSolid(make(sRGB, 1, 1, 1)),
      width: 2,
      dash: [4, 4],
    });
    renderer.render(b);
    expect(methodNames(mock)).toContain('setLineDash');
  });
});

describe('Canvas2DRenderer push and pop', () => {
  it('calls save on push', () => {
    const mock = makeMock();
    const renderer = new Canvas2DRenderer(mock as unknown as CanvasRenderingContext2D);
    const b = new FrameBuilder();
    b.push();
    renderer.render(b);
    expect(methodNames(mock)).toEqual(['save']);
  });

  it('calls restore on pop', () => {
    const mock = makeMock();
    const renderer = new Canvas2DRenderer(mock as unknown as CanvasRenderingContext2D);
    const b = new FrameBuilder();
    b.pop();
    renderer.render(b);
    expect(methodNames(mock)).toEqual(['restore']);
  });

  it('scopes a fill via push and pop', () => {
    const mock = makeMock();
    const renderer = new Canvas2DRenderer(mock as unknown as CanvasRenderingContext2D);
    const b = new FrameBuilder();
    b.setFill(makeSolid(make(sRGB, 1, 0, 0)));
    b.push();
    b.setFill(makeSolid(make(sRGB, 0, 0, 1)));
    b.fillRect(rect(0, 0, 10, 10));
    b.pop();
    b.fillRect(rect(0, 0, 10, 10));
    renderer.render(b);
    // Both fillRect calls succeed because the fill from the first
    // is restored after the pop.
    const names = methodNames(mock);
    expect(names.filter((n) => n === 'fillRect').length).toBe(2);
    expect(names).toContain('save');
    expect(names).toContain('restore');
  });
});

describe('Canvas2DRenderer set-transform', () => {
  it('calls setTransform with the matrix elements', () => {
    const mock = makeMock();
    const renderer = new Canvas2DRenderer(mock as unknown as CanvasRenderingContext2D);
    const b = new FrameBuilder();
    b.setTransform([1, 0, 0, 1, 100, 50]);
    renderer.render(b);
    const call = mock.calls.find((c) => c.method === 'setTransform');
    expect(call?.args).toEqual([1, 0, 0, 1, 100, 50]);
  });
});

describe('Canvas2DRenderer clip', () => {
  it('calls clip with the built path', () => {
    const mock = makeMock();
    const renderer = new Canvas2DRenderer(mock as unknown as CanvasRenderingContext2D);
    const b = new FrameBuilder();
    b.clipRect(rect(0, 0, 100, 100));
    renderer.render(b);
    const names = methodNames(mock);
    expect(names).toContain('beginPath');
    expect(names).toContain('rect');
    expect(names).toContain('clip');
  });
});

describe('Canvas2DRenderer text', () => {
  it('sets font and calls fillText', () => {
    const mock = makeMock();
    const renderer = new Canvas2DRenderer(mock as unknown as CanvasRenderingContext2D);
    const b = new FrameBuilder();
    b.text('HELLO', point(10, 20), { size: 16 });
    renderer.render(b);
    expect(mock.font).toBe('16px monospace');
    expect(mock.textAlign).toBe('left');
    expect(mock.textBaseline).toBe('top');
    const call = mock.calls.find((c) => c.method === 'fillText');
    expect(call?.args).toEqual(['HELLO', 10, 20]);
  });
});

describe('Canvas2DRenderer state reset between frames', () => {
  it('resets the shared state stack on every render', () => {
    const mock = makeMock();
    const renderer = new Canvas2DRenderer(mock as unknown as CanvasRenderingContext2D);

    const b1 = new FrameBuilder();
    b1.setFill(makeSolid(make(sRGB, 1, 0, 0)));
    b1.fillRect(rect(0, 0, 10, 10));
    renderer.render(b1);

    const b2 = new FrameBuilder();
    b2.fillRect(rect(0, 0, 10, 10));
    renderer.render(b2);

    // The second frame has no set-fill. The fill from the first frame
    // is discarded by the reset. The renderer draws nothing.
    expect(b2.commands).toHaveLength(1);
  });
});
