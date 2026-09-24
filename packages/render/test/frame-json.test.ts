/**
 * @fileoverview
 * @summary Tests for the JSON frame codec.
 *
 * @description
 * Covers the round trip through a string for every command variant, the
 * shape of the JSON output, and the error cases. The tests build a
 * frame with a {@linkcode FrameBuilder} and pass it through
 * {@linkcode toFrameJSON} and {@linkcode fromFrameJSON}.
 *
 * @see {@linkcode toFrameJSON}
 * @see {@linkcode fromFrameJSON}
 * @author MathAid
 */

import {
  Display_P3,
  FrameBuilder,
  fromFrameJSON,
  make,
  makeCircle,
  makePath,
  makeSolid,
  OKLab,
  point,
  rect,
  sRGB,
  toFrameJSON
} from '@games/render';
import { describe, expect, it } from 'vitest';

describe('round trip', () => {
  it('handles an empty frame', () => {
    const b = new FrameBuilder();
    const back = fromFrameJSON(toFrameJSON(b));
    expect(back.commands).toEqual([]);
  });

  it('handles a clear with a paint', () => {
    const b = new FrameBuilder();
    b.clear(makeSolid(make(sRGB, 0, 0, 0)));
    const back = fromFrameJSON(toFrameJSON(b));
    expect(back.commands[0]?.kind).toBe('clear');
  });

  it('handles a clear with no paint', () => {
    const b = new FrameBuilder();
    b.clear();
    const back = fromFrameJSON(toFrameJSON(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'clear') {
      expect(cmd.paint).toBeUndefined();
    }
  });

  it('handles set-background with a paint', () => {
    const b = new FrameBuilder();
    b.setBackground(makeSolid(make(sRGB, 0.5, 0.5, 0.5)));
    const back = fromFrameJSON(toFrameJSON(b));
    expect(back.commands[0]?.kind).toBe('set-background');
  });

  it('handles set-background with null', () => {
    const b = new FrameBuilder();
    b.setBackground(null);
    const back = fromFrameJSON(toFrameJSON(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'set-background') {
      expect(cmd.paint).toBeNull();
    }
  });

  it('handles set-fill with null', () => {
    const b = new FrameBuilder();
    b.setFill(null);
    const back = fromFrameJSON(toFrameJSON(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'set-fill') {
      expect(cmd.paint).toBeNull();
    }
  });

  it('handles set-stroke with a full style', () => {
    const b = new FrameBuilder();
    b.setStroke({
      paint: makeSolid(make(sRGB, 1, 1, 1)),
      width: 2,
      cap: 'round',
      join: 'round',
      miterLimit: 5,
      dash: [4, 4],
      dashOffset: 2,
    });
    const back = fromFrameJSON(toFrameJSON(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'set-stroke' && cmd.stroke) {
      expect(cmd.stroke.width).toBe(2);
      expect(cmd.stroke.cap).toBe('round');
      expect(cmd.stroke.join).toBe('round');
      expect(cmd.stroke.miterLimit).toBe(5);
      expect(cmd.stroke.dash).toEqual([4, 4]);
      expect(cmd.stroke.dashOffset).toBe(2);
    }
  });

  it('handles set-transform', () => {
    const b = new FrameBuilder();
    b.setTransform([1, 0, 0, 1, 100, 50]);
    const back = fromFrameJSON(toFrameJSON(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'set-transform') {
      expect(cmd.transform).toEqual([1, 0, 0, 1, 100, 50]);
    }
  });

  it('handles fill-shape with a rect', () => {
    const b = new FrameBuilder();
    b.fillRect(rect(0, 0, 32, 32), makeSolid(make(sRGB, 1, 0, 0)));
    const back = fromFrameJSON(toFrameJSON(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'fill-shape') {
      expect(cmd.shape.kind).toBe('rect');
    }
  });

  it('handles fill-shape with no paint', () => {
    const b = new FrameBuilder();
    b.fillRect(rect(0, 0, 32, 32));
    const back = fromFrameJSON(toFrameJSON(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'fill-shape') {
      expect(cmd.paint).toBeUndefined();
    }
  });

  it('handles a rounded rect', () => {
    const b = new FrameBuilder();
    b.fill(
      { kind: 'rect', rect: rect(0, 0, 100, 30), cornerRadius: 15 },
      makeSolid(make(sRGB, 1, 1, 1)),
    );
    const back = fromFrameJSON(toFrameJSON(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'fill-shape' && cmd.shape.kind === 'rect') {
      expect(cmd.shape.cornerRadius).toBe(15);
    }
  });

  it('handles a circle', () => {
    const b = new FrameBuilder();
    b.fillCircle(point(50, 50), 10, makeSolid(make(sRGB, 1, 0, 0)));
    const back = fromFrameJSON(toFrameJSON(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'fill-shape' && cmd.shape.kind === 'ellipse') {
      expect(cmd.shape.radiusX).toBe(10);
      expect(cmd.shape.radiusY).toBe(10);
    }
  });

  it('handles a polygon', () => {
    const b = new FrameBuilder();
    b.fillPolygon(
      [point(0, 0), point(10, 0), point(5, 10)],
      makeSolid(make(sRGB, 0, 1, 0)),
    );
    const back = fromFrameJSON(toFrameJSON(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'fill-shape' && cmd.shape.kind === 'polygon') {
      expect(cmd.shape.points.length).toBe(3);
      expect(cmd.shape.closed).toBe(true);
    }
  });

  it('handles a path with every segment kind', () => {
    const b = new FrameBuilder();
    b.fill(
      makePath([
        { kind: 'move', to: point(0, 0) },
        { kind: 'line', to: point(10, 0) },
        { kind: 'quadratic', control: point(15, 10), to: point(20, 0) },
        { kind: 'cubic', c1: point(0, 5), c2: point(10, 5), to: point(20, 10) },
        {
          kind: 'arc',
          rx: 5,
          ry: 5,
          rotation: 0,
          largeArc: false,
          sweep: true,
          to: point(30, 10),
        },
        { kind: 'close' },
      ]),
      makeSolid(make(sRGB, 0, 0, 1)),
    );
    const back = fromFrameJSON(toFrameJSON(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'fill-shape' && cmd.shape.kind === 'path') {
      expect(cmd.shape.segments.length).toBe(6);
    }
  });

  it('handles a group of shapes', () => {
    const b = new FrameBuilder();
    b.fill(
      {
        kind: 'group',
        shapes: [
          { kind: 'rect', rect: rect(0, 0, 10, 10) },
          makeCircle(point(20, 5), 5),
        ],
      },
      makeSolid(make(sRGB, 1, 1, 1)),
    );
    const back = fromFrameJSON(toFrameJSON(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'fill-shape' && cmd.shape.kind === 'group') {
      expect(cmd.shape.shapes.length).toBe(2);
      expect(cmd.shape.shapes[1]?.kind).toBe('ellipse');
    }
  });

  it('handles stroke-shape with a style', () => {
    const b = new FrameBuilder();
    b.strokeRect(rect(0, 0, 10, 10), {
      paint: makeSolid(make(sRGB, 1, 1, 1)),
      width: 3,
    });
    const back = fromFrameJSON(toFrameJSON(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'stroke-shape' && cmd.stroke) {
      expect(cmd.stroke.width).toBe(3);
    }
  });

  it('handles clip', () => {
    const b = new FrameBuilder();
    b.clipRect(rect(0, 0, 100, 100));
    const back = fromFrameJSON(toFrameJSON(b));
    expect(back.commands[0]?.kind).toBe('clip');
  });

  it('handles text', () => {
    const b = new FrameBuilder();
    b.text('HELLO', point(10, 20), {
      size: 16,
      family: 'sans-serif',
      align: 'center',
      baseline: 'middle',
      paint: makeSolid(make(sRGB, 1, 1, 1)),
    });
    const back = fromFrameJSON(toFrameJSON(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'text') {
      expect(cmd.text).toBe('HELLO');
      expect(cmd.style.size).toBe(16);
      expect(cmd.style.family).toBe('sans-serif');
      expect(cmd.style.align).toBe('center');
      expect(cmd.style.baseline).toBe('middle');
    }
  });

  it('handles sprite', () => {
    const b = new FrameBuilder();
    b.sprite({ id: 'ship' }, { x: 100, y: 50 });
    const back = fromFrameJSON(toFrameJSON(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'sprite') {
      expect(cmd.sprite.id).toBe('ship');
      expect(cmd.transform[4]).toBe(100);
      expect(cmd.transform[5]).toBe(50);
    }
  });

  it('handles push and pop', () => {
    const b = new FrameBuilder();
    b.push();
    b.pop();
    const back = fromFrameJSON(toFrameJSON(b));
    expect(back.commands.map((c) => c.kind)).toEqual(['push', 'pop']);
  });

  it('handles a wide-gamut color', () => {
    const b = new FrameBuilder();
    b.fillRect(rect(0, 0, 10, 10), makeSolid(make(Display_P3, 1, 0.5, 0)));
    const back = fromFrameJSON(toFrameJSON(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'fill-shape' && cmd.paint) {
      expect(cmd.paint.color._space.id).toBe('Display_P3');
    }
  });

  it('handles an OKLab color', () => {
    const b = new FrameBuilder();
    b.fillRect(rect(0, 0, 10, 10), makeSolid(make(OKLab, 0.6, 0.1, 0.1)));
    const back = fromFrameJSON(toFrameJSON(b));
    const cmd = back.commands[0];
    if (cmd && cmd.kind === 'fill-shape' && cmd.paint) {
      expect(cmd.paint.color._space.id).toBe('OKLab');
    }
  });

  it('handles a full frame with every command kind', () => {
    const b = new FrameBuilder();
    b.clear(makeSolid(make(sRGB, 0, 0, 0)));
    b.setBackground(makeSolid(make(sRGB, 0.1, 0.1, 0.1)));
    b.setFill(makeSolid(make(sRGB, 1, 0, 0)));
    b.setStroke({ paint: makeSolid(make(sRGB, 1, 1, 1)), width: 2 });
    b.setTransform([1, 0, 0, 1, 10, 20]);
    b.fillRect(rect(0, 0, 10, 10));
    b.strokeRect(rect(0, 0, 10, 10));
    b.clipRect(rect(0, 0, 100, 100));
    b.text('HI', point(0, 0), {});
    b.sprite({ id: 'x' }, { x: 0, y: 0 });
    b.push();
    b.pop();
    const back = fromFrameJSON(toFrameJSON(b));
    expect(back.commands.map((c) => c.kind)).toEqual([
      'clear',
      'set-background',
      'set-fill',
      'set-stroke',
      'set-transform',
      'fill-shape',
      'stroke-shape',
      'clip',
      'text',
      'sprite',
      'push',
      'pop',
    ]);
  });
});

describe('JSON output shape', () => {
  it('produces an object with a commands array', () => {
    const b = new FrameBuilder();
    b.clear();
    const parsed = JSON.parse(toFrameJSON(b));
    expect(Array.isArray(parsed.commands)).toBe(true);
    expect(parsed.commands[0].kind).toBe('clear');
  });

  it('packs colors as five-element tuples', () => {
    const b = new FrameBuilder();
    b.fillRect(rect(0, 0, 1, 1), makeSolid(make(sRGB, 1, 0, 0, 0.5)));
    const parsed = JSON.parse(toFrameJSON(b));
    expect(parsed.commands[0].paint.color).toEqual(['sRGB', 1, 0, 0, 0.5]);
  });

  it('encodes a transform as a six-element array', () => {
    const b = new FrameBuilder();
    b.setTransform([1, 0, 0, 1, 100, 50]);
    const parsed = JSON.parse(toFrameJSON(b));
    expect(parsed.commands[0].transform).toEqual([1, 0, 0, 1, 100, 50]);
  });
});

describe('error cases', () => {
  it('throws on invalid JSON', () => {
    expect(() => fromFrameJSON('{not json')).toThrow();
  });

  it('throws on a JSON string that is not a frame', () => {
    expect(() => fromFrameJSON('42')).toThrow();
  });

  it('throws on an unknown command kind', () => {
    expect(() => fromFrameJSON('{"commands":[{"kind":"bogus"}]}')).toThrow(
      /unknown/,
    );
  });

  it('throws on a color with an unknown space ID', () => {
    expect(() =>
      fromFrameJSON(
        '{"commands":[{"kind":"clear","paint":{"kind":"solid","color":["NotASpace",0,0,0,1]}}]}',
      ),
    ).toThrow(/space/);
  });
});

describe('golden test', () => {
  it('produces the expected JSON for a simple frame', () => {
    const b = new FrameBuilder();
    b.clear(makeSolid(make(sRGB, 0, 0, 0, 1)));
    b.fillRect(rect(0, 0, 10, 10), makeSolid(make(sRGB, 1, 0, 0, 1)));
    const text = toFrameJSON(b);
    expect(text).toBe(
      '{"commands":[' +
        '{"kind":"clear","paint":{"kind":"solid","color":["sRGB",0,0,0,1]}},' +
        '{"kind":"fill-shape",' +
        '"shape":{"kind":"rect","rect":{"x":0,"y":0,"width":10,"height":10}},' +
        '"paint":{"kind":"solid","color":["sRGB",1,0,0,1]}}' +
        ']}',
    );
  });
});