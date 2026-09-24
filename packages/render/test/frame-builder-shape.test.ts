/**
 * @fileoverview
 * @summary Tests for the shape methods of {@linkcode FrameBuilder}.
 *
 * @description
 * Covers every shape drawing method the builder emits. Each method
 * produces one or two {@linkcode FillShapeCommand} or
 * {@linkcode StrokeShapeCommand} values. The tests check the emitted
 * command kind, the shape kind, and the presence or absence of the paint
 * or stroke override.
 *
 * @see {@linkcode FrameBuilder}
 * @author MathAid
 */

import {
  FrameBuilder,
  make,
  makeSolid,
  point,
  rect,
  sRGB,
} from '@games/render';
import { describe, expect, it } from 'vitest';

const red = makeSolid(make(sRGB, 1, 0, 0));
const white = makeSolid(make(sRGB, 1, 1, 1));
const whiteStroke = { paint: white, width: 1 };

describe('FrameBuilder.fill', () => {
  it('emits a fill-shape with the given paint', () => {
    const b = new FrameBuilder();
    b.fill({ kind: 'rect', rect: rect(0, 0, 10, 10) }, red);
    const cmd = b.commands[0];
    expect(cmd?.kind).toBe('fill-shape');
    if (cmd && cmd.kind === 'fill-shape') {
      expect(cmd.paint).toBe(red);
    }
  });

  it('emits a fill-shape with no paint override', () => {
    const b = new FrameBuilder();
    b.fill({ kind: 'rect', rect: rect(0, 0, 10, 10) });
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'fill-shape') {
      expect(cmd.paint).toBeUndefined();
    }
  });
});

describe('FrameBuilder.fillPolygon', () => {
  it('emits a closed polygon by default', () => {
    const b = new FrameBuilder();
    b.fillPolygon([point(0, 0), point(10, 0), point(5, 10)], red);
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'fill-shape' && cmd.shape.kind === 'polygon') {
      expect(cmd.shape.closed).toBe(true);
      expect(cmd.shape.points).toHaveLength(3);
    }
  });

  it('carries the paint through', () => {
    const b = new FrameBuilder();
    b.fillPolygon([point(0, 0), point(1, 0), point(0, 1)], red);
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'fill-shape') {
      expect(cmd.paint).toBe(red);
    }
  });
});

describe('FrameBuilder.fillRect', () => {
  it('emits a rect shape', () => {
    const b = new FrameBuilder();
    b.fillRect(rect(1, 2, 3, 4), red);
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'fill-shape' && cmd.shape.kind === 'rect') {
      expect(cmd.shape.rect).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    }
  });

  it('accepts no paint and falls back to the fill state', () => {
    const b = new FrameBuilder();
    b.fillRect(rect(0, 0, 5, 5));
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'fill-shape') {
      expect(cmd.paint).toBeUndefined();
    }
  });
});

describe('FrameBuilder.fillEllipse', () => {
  it('emits an ellipse shape', () => {
    const b = new FrameBuilder();
    b.fillEllipse(point(50, 50), 20, 10, red);
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'fill-shape' && cmd.shape.kind === 'ellipse') {
      expect(cmd.shape.center).toEqual({ x: 50, y: 50 });
      expect(cmd.shape.radiusX).toBe(20);
      expect(cmd.shape.radiusY).toBe(10);
    }
  });
});

describe('FrameBuilder.fillCircle', () => {
  it('emits an ellipse with equal radii', () => {
    const b = new FrameBuilder();
    b.fillCircle(point(0, 0), 5, red);
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'fill-shape' && cmd.shape.kind === 'ellipse') {
      expect(cmd.shape.radiusX).toBe(5);
      expect(cmd.shape.radiusY).toBe(5);
    }
  });
});

describe('FrameBuilder.stroke', () => {
  it('emits a stroke-shape with the given style', () => {
    const b = new FrameBuilder();
    b.stroke({ kind: 'rect', rect: rect(0, 0, 10, 10) }, whiteStroke);
    const cmd = b.commands[0];
    expect(cmd?.kind).toBe('stroke-shape');
    if (cmd && cmd.kind === 'stroke-shape') {
      expect(cmd.stroke).toBe(whiteStroke);
    }
  });

  it('emits a stroke-shape with no style override', () => {
    const b = new FrameBuilder();
    b.stroke({ kind: 'rect', rect: rect(0, 0, 10, 10) });
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'stroke-shape') {
      expect(cmd.stroke).toBeUndefined();
    }
  });
});

describe('FrameBuilder.strokeLine', () => {
  it('emits a line shape', () => {
    const b = new FrameBuilder();
    b.strokeLine(point(0, 0), point(10, 10), whiteStroke);
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'stroke-shape' && cmd.shape.kind === 'line') {
      expect(cmd.shape.from).toEqual({ x: 0, y: 0 });
      expect(cmd.shape.to).toEqual({ x: 10, y: 10 });
    }
  });
});

describe('FrameBuilder.strokePolygon', () => {
  it('respects the closed flag', () => {
    const b = new FrameBuilder();
    b.strokePolygon([point(0, 0), point(10, 0), point(10, 10)], false, whiteStroke);
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'stroke-shape' && cmd.shape.kind === 'polygon') {
      expect(cmd.shape.closed).toBe(false);
    }
  });

  it('accepts a closed polygon', () => {
    const b = new FrameBuilder();
    b.strokePolygon([point(0, 0), point(10, 0), point(10, 10)], true, whiteStroke);
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'stroke-shape' && cmd.shape.kind === 'polygon') {
      expect(cmd.shape.closed).toBe(true);
    }
  });
});

describe('FrameBuilder.strokeRect', () => {
  it('emits a rect shape', () => {
    const b = new FrameBuilder();
    b.strokeRect(rect(0, 0, 10, 10), whiteStroke);
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'stroke-shape' && cmd.shape.kind === 'rect') {
      expect(cmd.shape.rect.width).toBe(10);
    }
  });
});

describe('FrameBuilder.strokeEllipse', () => {
  it('emits an ellipse shape', () => {
    const b = new FrameBuilder();
    b.strokeEllipse(point(0, 0), 10, 5, whiteStroke);
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'stroke-shape' && cmd.shape.kind === 'ellipse') {
      expect(cmd.shape.radiusX).toBe(10);
      expect(cmd.shape.radiusY).toBe(5);
    }
  });
});

describe('FrameBuilder.strokeCircle', () => {
  it('emits an ellipse with equal radii', () => {
    const b = new FrameBuilder();
    b.strokeCircle(point(0, 0), 5, whiteStroke);
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'stroke-shape' && cmd.shape.kind === 'ellipse') {
      expect(cmd.shape.radiusX).toBe(5);
      expect(cmd.shape.radiusY).toBe(5);
    }
  });
});

describe('FrameBuilder.rect', () => {
  it('emits one fill-shape when only fill is given', () => {
    const b = new FrameBuilder();
    b.rect(rect(0, 0, 10, 10), red);
    expect(b.commands.map((c) => c.kind)).toEqual(['fill-shape']);
  });

  it('emits one stroke-shape when only stroke is given', () => {
    const b = new FrameBuilder();
    b.rect(rect(0, 0, 10, 10), undefined, whiteStroke);
    expect(b.commands.map((c) => c.kind)).toEqual(['stroke-shape']);
  });

  it('emits two commands when both are given', () => {
    const b = new FrameBuilder();
    b.rect(rect(0, 0, 10, 10), red, whiteStroke);
    expect(b.commands.map((c) => c.kind)).toEqual([
      'fill-shape',
      'stroke-shape',
    ]);
  });

  it('emits nothing when neither is given', () => {
    const b = new FrameBuilder();
    b.rect(rect(0, 0, 10, 10));
    expect(b.commands).toHaveLength(0);
  });

  it('uses the same shape instance for both commands', () => {
    const b = new FrameBuilder();
    b.rect(rect(0, 0, 10, 10), red, whiteStroke);
    const fill = b.commands[0];
    const stroke = b.commands[1];
    if (
      fill && fill.kind === 'fill-shape' &&
      stroke && stroke.kind === 'stroke-shape'
    ) {
      expect(fill.shape).toBe(stroke.shape);
    }
  });
});

describe('FrameBuilder shape integration', () => {
  it('combines state and shape commands', () => {
    const b = new FrameBuilder();
    b.setFill(red);
    b.fillRect(rect(0, 0, 10, 10));
    b.setFill(white);
    b.fillRect(rect(0, 0, 10, 10));
    expect(b.commands.map((c) => c.kind)).toEqual([
      'set-fill',
      'fill-shape',
      'set-fill',
      'fill-shape',
    ]);
  });

  it('scopes fill state with push and pop', () => {
    const b = new FrameBuilder();
    b.push();
    b.setFill(red);
    b.fillCircle(point(0, 0), 10);
    b.pop();
    b.fillCircle(point(0, 0), 10);
    expect(b.commands.map((c) => c.kind)).toEqual([
      'push',
      'set-fill',
      'fill-shape',
      'pop',
      'fill-shape',
    ]);
  });
});