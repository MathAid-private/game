/**
 * @fileoverview
 * @summary Tests for the frame schema validators.
 *
 * @description
 * Covers the happy path for every command variant, the rejection of
 * malformed input, and the recursion into shapes and paths.
 *
 * @see {@linkcode validateSerializedFrame}
 * @author MathAid
 */

import {
  validateSerializedColor,
  validateSerializedCommand,
  validateSerializedFrame,
  validateSerializedPaint,
  validateSerializedShape,
} from '@games/render';
import { describe, expect, it } from 'vitest';

describe('validateSerializedFrame', () => {
  it('accepts an empty frame', () => {
    expect(() => validateSerializedFrame({ commands: [] })).not.toThrow();
  });

  it('accepts a frame with a push and pop', () => {
    expect(() =>
      validateSerializedFrame({ commands: [{ kind: 'push' }, { kind: 'pop' }] }),
    ).not.toThrow();
  });

  it('rejects a non-object', () => {
    expect(() => validateSerializedFrame(null)).toThrow(/object/);
  });

  it('rejects a missing commands array', () => {
    expect(() => validateSerializedFrame({})).toThrow(/commands/);
  });

  it('rejects a malformed command with the index in the message', () => {
    expect(() =>
      validateSerializedFrame({ commands: [{ kind: 'push' }, { kind: 'nope' }] }),
    ).toThrow(/command 1/);
  });
});

describe('validateSerializedCommand', () => {
  it('accepts a clear with a paint', () => {
    expect(() =>
      validateSerializedCommand({
        kind: 'clear',
        paint: { kind: 'solid', color: ['sRGB', 0, 0, 0, 1] },
      }),
    ).not.toThrow();
  });

  it('accepts a clear with no paint', () => {
    expect(() => validateSerializedCommand({ kind: 'clear' })).not.toThrow();
  });

  it('accepts a set-fill with null', () => {
    expect(() =>
      validateSerializedCommand({ kind: 'set-fill', paint: null }),
    ).not.toThrow();
  });

  it('accepts a set-stroke with a full style', () => {
    expect(() =>
      validateSerializedCommand({
        kind: 'set-stroke',
        stroke: {
          paint: { kind: 'solid', color: ['sRGB', 1, 1, 1, 1] },
          width: 2,
          cap: 'round',
          join: 'round',
          dash: [4, 4],
        },
      }),
    ).not.toThrow();
  });

  it('rejects an invalid cap value', () => {
    expect(() =>
      validateSerializedCommand({
        kind: 'set-stroke',
        stroke: {
          paint: { kind: 'solid', color: ['sRGB', 1, 1, 1, 1] },
          cap: 'flat',
        },
      }),
    ).toThrow(/cap/);
  });

  it('accepts a set-transform', () => {
    expect(() =>
      validateSerializedCommand({
        kind: 'set-transform',
        transform: [1, 0, 0, 1, 100, 50],
      }),
    ).not.toThrow();
  });

  it('rejects a transform with the wrong length', () => {
    expect(() =>
      validateSerializedCommand({
        kind: 'set-transform',
        transform: [1, 0, 0, 1, 100],
      }),
    ).toThrow(/6 elements/);
  });

  it('rejects a transform with a non-finite element', () => {
    expect(() =>
      validateSerializedCommand({
        kind: 'set-transform',
        transform: [1, 0, 0, 1, 100, NaN],
      }),
    ).toThrow(/finite/);
  });

  it('accepts a fill-shape with a rect', () => {
    expect(() =>
      validateSerializedCommand({
        kind: 'fill-shape',
        shape: { kind: 'rect', rect: { x: 0, y: 0, width: 10, height: 10 } },
      }),
    ).not.toThrow();
  });

  it('accepts a text command', () => {
    expect(() =>
      validateSerializedCommand({
        kind: 'text',
        text: 'HELLO',
        position: { x: 10, y: 20 },
        style: { size: 16 },
      }),
    ).not.toThrow();
  });

  it('rejects a text command with a non-string text field', () => {
    expect(() =>
      validateSerializedCommand({
        kind: 'text',
        text: 42,
        position: { x: 0, y: 0 },
        style: {},
      }),
    ).toThrow(/text\.text/);
  });

  it('accepts a sprite command', () => {
    expect(() =>
      validateSerializedCommand({
        kind: 'sprite',
        sprite: { id: 'ship' },
        transform: [1, 0, 0, 1, 0, 0],
      }),
    ).not.toThrow();
  });

  it('rejects an unknown kind', () => {
    expect(() => validateSerializedCommand({ kind: 'bogus' })).toThrow(/unknown/);
  });
});

describe('validateSerializedShape', () => {
  it('accepts a line', () => {
    expect(() =>
      validateSerializedShape({
        kind: 'line',
        from: { x: 0, y: 0 },
        to: { x: 10, y: 10 },
      }),
    ).not.toThrow();
  });

  it('accepts a polygon with closed true', () => {
    expect(() =>
      validateSerializedShape({
        kind: 'polygon',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 5, y: 10 },
        ],
        closed: true,
      }),
    ).not.toThrow();
  });

  it('rejects a polygon with a non-boolean closed', () => {
    expect(() =>
      validateSerializedShape({
        kind: 'polygon',
        points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
        closed: 'yes',
      }),
    ).toThrow(/closed/);
  });

  it('accepts a rounded rect with a single radius', () => {
    expect(() =>
      validateSerializedShape({
        kind: 'rect',
        rect: { x: 0, y: 0, width: 10, height: 10 },
        cornerRadius: 4,
      }),
    ).not.toThrow();
  });

  it('accepts an ellipse', () => {
    expect(() =>
      validateSerializedShape({
        kind: 'ellipse',
        center: { x: 0, y: 0 },
        radiusX: 10,
        radiusY: 5,
      }),
    ).not.toThrow();
  });

  it('accepts a path with every segment kind', () => {
    expect(() =>
      validateSerializedShape({
        kind: 'path',
        segments: [
          { kind: 'move', to: { x: 0, y: 0 } },
          { kind: 'line', to: { x: 10, y: 0 } },
          { kind: 'quadratic', control: { x: 5, y: -5 }, to: { x: 10, y: 0 } },
          {
            kind: 'cubic',
            c1: { x: 0, y: 0 },
            c2: { x: 10, y: 10 },
            to: { x: 20, y: 0 },
          },
          {
            kind: 'arc',
            rx: 5,
            ry: 5,
            rotation: 0,
            largeArc: false,
            sweep: true,
            to: { x: 25, y: 0 },
          },
          { kind: 'close' },
        ],
      }),
    ).not.toThrow();
  });

  it('rejects a path with an unknown segment kind', () => {
    expect(() =>
      validateSerializedShape({
        kind: 'path',
        segments: [{ kind: 'spline', to: { x: 0, y: 0 } }],
      }),
    ).toThrow(/spline/);
  });

  it('accepts a group of nested shapes', () => {
    expect(() =>
      validateSerializedShape({
        kind: 'group',
        shapes: [
          { kind: 'rect', rect: { x: 0, y: 0, width: 10, height: 10 } },
          {
            kind: 'group',
            shapes: [
              {
                kind: 'ellipse',
                center: { x: 0, y: 0 },
                radiusX: 5,
                radiusY: 5,
              },
            ],
          },
        ],
      }),
    ).not.toThrow();
  });

  it('rejects a nested group with an invalid shape', () => {
    expect(() =>
      validateSerializedShape({
        kind: 'group',
        shapes: [{ kind: 'bogus' }],
      }),
    ).toThrow(/shape\.shapes\[0\]/);
  });
});

describe('validateSerializedColor', () => {
  it('accepts a valid 5-tuple', () => {
    expect(() =>
      validateSerializedColor(['sRGB', 1, 0, 0, 1]),
    ).not.toThrow();
  });

  it('rejects a wrong length', () => {
    expect(() =>
      validateSerializedColor(['sRGB', 1, 0, 0]),
    ).toThrow(/5 elements/);
  });

  it('rejects a non-string space id', () => {
    expect(() =>
      validateSerializedColor([42, 1, 0, 0, 1]),
    ).toThrow(/spaceId/);
  });

  it('rejects a NaN channel', () => {
    expect(() =>
      validateSerializedColor(['sRGB', NaN, 0, 0, 1]),
    ).toThrow(/finite/);
  });
});

describe('validateSerializedPaint', () => {
  it('accepts a solid', () => {
    expect(() =>
      validateSerializedPaint({
        kind: 'solid',
        color: ['sRGB', 1, 0, 0, 1],
      }),
    ).not.toThrow();
  });

  it('rejects an unknown paint kind', () => {
    expect(() =>
      validateSerializedPaint({ kind: 'gradient' }),
    ).toThrow(/unknown/);
  });
});