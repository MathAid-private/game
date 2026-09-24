/**
 * @fileoverview
 * @summary Tests for the capture methods.
 *
 * @description
 * Covers the capability gate on `NoopRenderer` and `RecordingRenderer`,
 * the `regionToRect` helper, and the shape of the Canvas2D capture
 * signatures. Pixel verification requires a real canvas and runs under
 * a jsdom environment or in a browser. The mock-based tests here cover
 * the capability gate and the geometry helper.
 *
 * @see {@linkcode IRenderer}
 * @see {@linkcode regionToRect}
 * @author MathAid
 */

import {
  makeCircle,
  NoopRenderer,
  point,
  RecordingRenderer,
  rect,
  regionToRect,
} from '@games/render';
import { describe, expect, it } from 'vitest';

describe('regionToRect', () => {
  it('returns a rect unchanged', () => {
    const r = rect(10, 20, 30, 40);
    expect(regionToRect(r)).toBe(r);
  });

  it('converts a circle to its bounding box', () => {
    const r = regionToRect(makeCircle(point(50, 50), 10));
    expect(r.x).toBe(40);
    expect(r.y).toBe(40);
    expect(r.width).toBe(20);
    expect(r.height).toBe(20);
  });
});

describe('NoopRenderer capture', () => {
  const noop = new NoopRenderer();

  it('reports capture: false', () => {
    expect(noop.capabilities.capture).toBe(false);
    expect(noop.capabilities.captureStream).toBe(false);
  });

  it('throws from capture', () => {
    expect(() => noop.capture(rect(0, 0, 1, 1))).toThrow(/NoopRenderer/);
  });

  it('throws from captureAsync', async () => {
    await expect(noop.captureAsync(rect(0, 0, 1, 1))).rejects.toThrow(/NoopRenderer/);
  });

  it('throws from captureStream', () => {
    expect(() => noop.captureStream(rect(0, 0, 1, 1))).toThrow(/NoopRenderer/);
  });
});

describe('RecordingRenderer capture', () => {
  const recorder = new RecordingRenderer();

  it('reports capture: false', () => {
    expect(recorder.capabilities.capture).toBe(false);
    expect(recorder.capabilities.captureStream).toBe(false);
  });

  it('throws from capture', () => {
    expect(() => recorder.capture(rect(0, 0, 1, 1))).toThrow(/RecordingRenderer/);
  });

  it('throws from captureAsync', async () => {
    await expect(recorder.captureAsync(rect(0, 0, 1, 1))).rejects.toThrow(
      /RecordingRenderer/,
    );
  });

  it('throws from captureStream', () => {
    expect(() => recorder.captureStream(rect(0, 0, 1, 1))).toThrow(
      /RecordingRenderer/,
    );
  });
});