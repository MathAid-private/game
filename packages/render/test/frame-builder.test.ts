/**
 * @fileoverview
 * @summary Tests for {@linkcode FrameBuilder} and the reference renderers.
 *
 * @description
 * Covers the append order of builder methods, the reuse behavior of
 * `reset`, and the observation surface of `RecordingRenderer` and
 * `NoopRenderer`.
 *
 * @author MathAid
 */

import {
  FrameBuilder,
  make,
  makeSolid,
  NoopRenderer,
  RecordingRenderer,
  rect,
  sRGB,
} from '@games/render';
import { describe, expect, it } from 'vitest';

describe('FrameBuilder', () => {
  it('accumulates commands in call order', () => {
    const builder = new FrameBuilder();
    builder.clear(makeSolid(make(sRGB, 0, 0, 0, 1)));
    builder.fillRect(rect(1, 2, 3, 4), makeSolid(make(sRGB, 1, 0, 0, 1)));
    builder.push();
    builder.pop();

    expect(builder.commands.map((c) => c.kind)).toEqual([
      'clear',
      'fill-shape',
      'push',
      'pop',
    ]);
  });

  it('rect emits two commands with fill and stroke', () => {
    const builder = new FrameBuilder();
    builder.rect(
      rect(0, 0, 10, 10),
      makeSolid(make(sRGB, 1, 0, 0)),
      { paint: makeSolid(make(sRGB, 1, 1, 1)), width: 1 },
    );
    expect(builder.commands.map((c) => c.kind)).toEqual([
      'fill-shape',
      'stroke-shape',
    ]);
  });

  it('reset clears all commands for reuse', () => {
    const builder = new FrameBuilder();
    builder.fillRect(rect(0, 0, 1, 1));
    builder.reset();
    expect(builder.commands).toHaveLength(0);
  });

  it('translate composes onto the current transform', () => {
    const builder = new FrameBuilder();
    builder.translate(10, 20);
    builder.translate(5, 5);
    const setTransform = builder.commands.find(
      (c) => c.kind === 'set-transform',
    );
    expect(setTransform).toBeDefined();
    if (setTransform && setTransform.kind === 'set-transform') {
      expect(setTransform.transform[4]).toBe(15);
      expect(setTransform.transform[5]).toBe(25);
    }
  });
});

describe('RecordingRenderer', () => {
  it('retains frames for assertion', () => {
    const recorder = new RecordingRenderer();
    const builder = new FrameBuilder();
    builder.clear();

    recorder.render(builder);
    expect(recorder.frames).toHaveLength(1);
    expect(recorder.lastFrame?.commands).toHaveLength(1);
  });
});

describe('NoopRenderer', () => {
  it('advertises no capabilities and discards frames', () => {
    const noop = new NoopRenderer();
    expect(noop.capabilities.color).toBe(false);
    expect(() => noop.render(new FrameBuilder())).not.toThrow();
  });
});