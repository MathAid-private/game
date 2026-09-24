/**
 * @fileoverview
 * @summary Tests for the state methods of {@linkcode FrameBuilder}.
 *
 * @description
 * Covers every state command the builder emits. The state commands are
 * `set-background`, `set-fill`, `set-stroke`, `set-transform`, and the
 * composed transform helpers. The tests check the emitted command shape
 * and the transform composition behavior.
 *
 * @see {@linkcode FrameBuilder}
 * @author MathAid
 */

import {
  FrameBuilder,
  identity,
  make,
  makeSolid,
  rect,
  sRGB,
  translation,
} from '@games/render';
import { describe, expect, it } from 'vitest';

describe('FrameBuilder.clear', () => {
  it('emits a clear with a paint', () => {
    const b = new FrameBuilder();
    b.clear(makeSolid(make(sRGB, 0, 0, 0)));
    const cmd = b.commands[0];
    expect(cmd?.kind).toBe('clear');
    if (cmd && cmd.kind === 'clear') {
      expect(cmd.paint?.kind).toBe('solid');
    }
  });

  it('emits a clear with no paint', () => {
    const b = new FrameBuilder();
    b.clear();
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'clear') {
      expect(cmd.paint).toBeUndefined();
    }
  });
});

describe('FrameBuilder.setBackground', () => {
  it('emits a set-background with a paint', () => {
    const b = new FrameBuilder();
    b.setBackground(makeSolid(make(sRGB, 0.1, 0.1, 0.1)));
    const cmd = b.commands[0];
    expect(cmd?.kind).toBe('set-background');
    if (cmd && cmd.kind === 'set-background') {
      expect(cmd.paint?.kind).toBe('solid');
    }
  });

  it('emits a set-background with null', () => {
    const b = new FrameBuilder();
    b.setBackground(null);
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'set-background') {
      expect(cmd.paint).toBeNull();
    }
  });
});

describe('FrameBuilder.setFill', () => {
  it('emits a set-fill with a paint', () => {
    const b = new FrameBuilder();
    b.setFill(makeSolid(make(sRGB, 1, 0, 0)));
    const cmd = b.commands[0];
    expect(cmd?.kind).toBe('set-fill');
  });

  it('emits a set-fill with null to disable', () => {
    const b = new FrameBuilder();
    b.setFill(null);
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'set-fill') {
      expect(cmd.paint).toBeNull();
    }
  });
});

describe('FrameBuilder.setStroke', () => {
  it('emits a set-stroke with a style', () => {
    const b = new FrameBuilder();
    b.setStroke({ paint: makeSolid(make(sRGB, 1, 1, 1)), width: 2 });
    const cmd = b.commands[0];
    expect(cmd?.kind).toBe('set-stroke');
    if (cmd && cmd.kind === 'set-stroke') {
      expect(cmd.stroke?.width).toBe(2);
    }
  });

  it('emits a set-stroke with null to disable', () => {
    const b = new FrameBuilder();
    b.setStroke(null);
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'set-stroke') {
      expect(cmd.stroke).toBeNull();
    }
  });
});

describe('FrameBuilder.setTransform', () => {
  it('emits a set-transform with the given matrix', () => {
    const b = new FrameBuilder();
    b.setTransform([1, 0, 0, 1, 10, 20]);
    const cmd = b.commands[0];
    expect(cmd?.kind).toBe('set-transform');
    if (cmd && cmd.kind === 'set-transform') {
      expect(cmd.transform).toEqual([1, 0, 0, 1, 10, 20]);
    }
  });

  it('accepts a decomposed Transform2D', () => {
    const b = new FrameBuilder();
    b.setTransform({ x: 10, y: 20, rotation: 0, scaleX: 2, scaleY: 2 });
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'set-transform') {
      expect(cmd.transform[0]).toBeCloseTo(2, 6);
      expect(cmd.transform[3]).toBeCloseTo(2, 6);
      expect(cmd.transform[4]).toBe(10);
      expect(cmd.transform[5]).toBe(20);
    }
  });
});

describe('FrameBuilder.resetTransform', () => {
  it('emits the identity matrix', () => {
    const b = new FrameBuilder();
    b.resetTransform();
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'set-transform') {
      expect(cmd.transform).toEqual(identity());
    }
  });
});

describe('FrameBuilder.translate', () => {
  it('emits a translation', () => {
    const b = new FrameBuilder();
    b.translate(10, 20);
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'set-transform') {
      expect(cmd.transform[4]).toBe(10);
      expect(cmd.transform[5]).toBe(20);
    }
  });

  it('composes two translations into one', () => {
    const b = new FrameBuilder();
    b.translate(10, 20);
    b.translate(5, 5);
    expect(b.commands).toHaveLength(2);
    const last = b.commands[1];
    if (last && last.kind === 'set-transform') {
      expect(last.transform[4]).toBe(15);
      expect(last.transform[5]).toBe(25);
    }
  });
});

describe('FrameBuilder.rotate', () => {
  it('emits a rotation matrix', () => {
    const b = new FrameBuilder();
    b.rotate(Math.PI / 2);
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'set-transform') {
      expect(cmd.transform[0]).toBeCloseTo(0, 6);
      expect(cmd.transform[1]).toBeCloseTo(1, 6);
      expect(cmd.transform[2]).toBeCloseTo(-1, 6);
      expect(cmd.transform[3]).toBeCloseTo(0, 6);
    }
  });

  it('composes rotation after translation', () => {
    const b = new FrameBuilder();
    b.translate(100, 0);
    b.rotate(Math.PI / 2);
    const last = b.commands[1];
    if (last && last.kind === 'set-transform') {
      // translate then rotate: origin is still translated, but the
      // rotation applies in the translated frame.
      expect(last.transform[4]).toBe(100);
      expect(last.transform[5]).toBe(0);
    }
  });
});

describe('FrameBuilder.scale', () => {
  it('emits a uniform scale when only sx is given', () => {
    const b = new FrameBuilder();
    b.scale(2);
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'set-transform') {
      expect(cmd.transform[0]).toBe(2);
      expect(cmd.transform[3]).toBe(2);
    }
  });

  it('emits a non-uniform scale when sx and sy are given', () => {
    const b = new FrameBuilder();
    b.scale(2, 0.5);
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'set-transform') {
      expect(cmd.transform[0]).toBe(2);
      expect(cmd.transform[3]).toBe(0.5);
    }
  });
});

describe('FrameBuilder.transform', () => {
  it('composes an arbitrary matrix onto the current transform', () => {
    const b = new FrameBuilder();
    b.translate(10, 0);
    b.transform(translation(5, 5));
    const last = b.commands[1];
    if (last && last.kind === 'set-transform') {
      expect(last.transform[4]).toBe(15);
      expect(last.transform[5]).toBe(5);
    }
  });
});

describe('FrameBuilder.clip', () => {
  it('emits a clip with a shape', () => {
    const b = new FrameBuilder();
    b.clip({ kind: 'rect', rect: rect(0, 0, 10, 10) });
    expect(b.commands[0]?.kind).toBe('clip');
  });

  it('emits a rect clip via clipRect', () => {
    const b = new FrameBuilder();
    b.clipRect(rect(0, 0, 100, 100));
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'clip') {
      expect(cmd.shape.kind).toBe('rect');
    }
  });
});

describe('FrameBuilder.push and pop', () => {
  it('emits a push', () => {
    const b = new FrameBuilder();
    b.push();
    expect(b.commands[0]?.kind).toBe('push');
  });

  it('emits a pop', () => {
    const b = new FrameBuilder();
    b.pop();
    expect(b.commands[0]?.kind).toBe('pop');
  });
});

describe('FrameBuilder.reset', () => {
  it('clears the command list', () => {
    const b = new FrameBuilder();
    b.translate(10, 20);
    b.clear();
    b.reset();
    expect(b.commands).toHaveLength(0);
  });

  it('resets the current transform to identity', () => {
    const b = new FrameBuilder();
    b.translate(10, 20);
    b.reset();
    b.translate(1, 1);
    const cmd = b.commands[0];
    if (cmd && cmd.kind === 'set-transform') {
      expect(cmd.transform[4]).toBe(1);
      expect(cmd.transform[5]).toBe(1);
    }
  });
});