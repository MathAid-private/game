/**
 * @fileoverview
 * @summary Tests for the frame trace and replay helpers.
 *
 * @description
 * Covers the structural diff for identical frames, changed commands,
 * added commands, and removed commands. Covers the three replay
 * helpers and the codec autodetection.
 *
 * @see {@linkcode diffFrames}
 * @see {@linkcode replayFile}
 * @author MathAid
 */

import {
  diffFrames,
  firstDifference,
  FrameBuilder,
  fromFrameJSON,
  make,
  makeSolid,
  RecordingRenderer,
  rect,
  replayFile,
  replayJSON,
  replayMsgPack,
  sRGB,
  toFrameJSON,
  toFrameMsgPack,
  type SerializedFrame,
} from '@games/render';
import { describe, expect, it } from 'vitest';

describe('diffFrames', () => {
  it('returns an empty diff for identical frames', () => {
    const b = new FrameBuilder();
    b.clear(makeSolid(make(sRGB, 0, 0, 0)));
    b.fillRect(rect(0, 0, 10, 10), makeSolid(make(sRGB, 1, 0, 0)));
    const a = fromFrameJSON(toFrameJSON(b));
    const aSerialized = fromFrameSerialized(a);
    expect(diffFrames(aSerialized, aSerialized)).toEqual([]);
  });

  it('reports the first changed command', () => {
    const a = parseFrame('{"commands":[{"kind":"push"}]}');
    const b = parseFrame('{"commands":[{"kind":"pop"}]}');
    const diff = diffFrames(a, b);
    expect(diff.length).toBe(1);
    expect(diff[0]?.kind).toBe('changed');
    expect(diff[0]?.reason).toMatch(/kind differs/);
  });

  it('reports an added command', () => {
    const a = parseFrame('{"commands":[]}');
    const b = parseFrame('{"commands":[{"kind":"push"}]}');
    const diff = diffFrames(a, b);
    expect(diff.length).toBe(1);
    expect(diff[0]?.kind).toBe('added');
  });

  it('reports a removed command', () => {
    const a = parseFrame('{"commands":[{"kind":"push"}]}');
    const b = parseFrame('{"commands":[]}');
    const diff = diffFrames(a, b);
    expect(diff.length).toBe(1);
    expect(diff[0]?.kind).toBe('removed');
  });

  it('reports a nested field difference', () => {
    const a = parseFrame(
      '{"commands":[{"kind":"fill-shape","shape":{"kind":"rect","rect":{"x":0,"y":0,"width":10,"height":10}}}]}',
    );
    const b = parseFrame(
      '{"commands":[{"kind":"fill-shape","shape":{"kind":"rect","rect":{"x":0,"y":0,"width":20,"height":10}}}]}',
    );
    const diff = diffFrames(a, b);
    expect(diff.length).toBe(1);
    expect(diff[0]?.reason).toMatch(/shape\.rect\.width/);
  });
});

describe('firstDifference', () => {
  it('returns null for identical frames', () => {
    const a = parseFrame('{"commands":[]}');
    expect(firstDifference(a, a)).toBeNull();
  });

  it('returns the first entry of the diff', () => {
    const a = parseFrame('{"commands":[{"kind":"push"},{"kind":"push"}]}');
    const b = parseFrame('{"commands":[{"kind":"push"},{"kind":"pop"}]}');
    const d = firstDifference(a, b);
    expect(d?.index).toBe(1);
  });
});

describe('replayJSON', () => {
  it('renders a JSON frame', () => {
    const recorder = new RecordingRenderer();
    const b = new FrameBuilder();
    b.clear();
    const text = toFrameJSON(b);
    replayJSON(text, recorder);
    expect(recorder.frames.length).toBe(1);
    expect(recorder.lastFrame?.commands[0]?.kind).toBe('clear');
  });
});

describe('replayMsgPack', () => {
  it('renders a MessagePack frame', () => {
    const recorder = new RecordingRenderer();
    const b = new FrameBuilder();
    b.clear();
    const bytes = toFrameMsgPack(b);
    replayMsgPack(bytes, recorder);
    expect(recorder.frames.length).toBe(1);
  });
});

describe('replayFile', () => {
  it('detects a JSON blob', () => {
    const recorder = new RecordingRenderer();
    const b = new FrameBuilder();
    b.clear();
    const bytes = new TextEncoder().encode(toFrameJSON(b));
    replayFile(bytes, recorder);
    expect(recorder.lastFrame?.commands[0]?.kind).toBe('clear');
  });

  it('detects a MessagePack blob', () => {
    const recorder = new RecordingRenderer();
    const b = new FrameBuilder();
    b.clear();
    const bytes = toFrameMsgPack(b);
    replayFile(bytes, recorder);
    expect(recorder.lastFrame?.commands[0]?.kind).toBe('clear');
  });

  it('throws on an empty blob', () => {
    const recorder = new RecordingRenderer();
    expect(() => replayFile(new Uint8Array(0), recorder)).toThrow(/empty/);
  });

  it('throws on an unknown prefix', () => {
    const recorder = new RecordingRenderer();
    expect(() => replayFile(new Uint8Array([0xff]), recorder)).toThrow(
      /unknown codec/,
    );
  });
});

// -----------------------------------------------------------------
//  Helpers
// -----------------------------------------------------------------

function parseFrame(text: string): SerializedFrame {
  return JSON.parse(text) as SerializedFrame;
}

function fromFrameSerialized(frame: { commands: readonly unknown[] }): SerializedFrame {
  return frame as SerializedFrame;
}