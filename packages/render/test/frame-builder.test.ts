import { describe, expect, it } from 'vitest';
import { FrameBuilder, NoopRenderer, RecordingRenderer } from '@games/render';

describe('FrameBuilder', () => {
  it('accumulates commands in call order', () => {
    const builder = new FrameBuilder();
    builder.clear({ r: 0, g: 0, b: 0, a: 1 });
    builder.rect({ x: 1, y: 2, width: 3, height: 4 }, { r: 1, g: 0, b: 0, a: 1 });
    builder.push();
    builder.pop();

    expect(builder.commands.map((c) => c.kind)).toEqual(['clear', 'rect', 'push', 'pop']);
  });

  it('reset clears all commands for reuse', () => {
    const builder = new FrameBuilder();
    builder.rect({ x: 0, y: 0, width: 1, height: 1 });
    builder.reset();
    expect(builder.commands).toHaveLength(0);
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
