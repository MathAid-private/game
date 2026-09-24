/**
 * @fileoverview
 * @summary The conformance test.
 *
 * @description
 * Runs every fixture on every available backend. The Canvas2D backend
 * is the reference. Every other backend is compared against its own
 * known-pixel assertions with a per-backend tolerance band.
 *
 * The test requires a DOM. It is designed for the Vitest `jsdom` or
 * `happy-dom` environment. A backend that needs a real GPU device is
 * skipped when the device is not available.
 *
 * @see {@linkcode runConformance}
 * @author MathAid
 */

import {
  Canvas2DRenderer,
} from '@games/render';
import { describe, expect, it } from 'vitest';
import { FIXTURES } from './fixtures';
import {
  type BackendEntry,
  FIXTURE_HEIGHT,
  FIXTURE_WIDTH,
  formatFailures,
  runConformance,
} from './runner';

/**
 * @summary Create a headless canvas for the given dimensions.
 *
 * @description
 * Uses `document.createElement('canvas')`. Works under jsdom and in a
 * browser. Returns `null` when the environment has no document.
 *
 * @param {number} width The canvas width.
 * @param {number} height The canvas height.
 * @returns {HTMLCanvasElement | null} The canvas or `null`.
 * @author MathAid
 */
function createHeadlessCanvas(
  width: number,
  height: number,
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * @summary Read an ImageData from a canvas.
 *
 * @description
 * Reads the full canvas pixels. The canvas must have a 2D context.
 *
 * @param {HTMLCanvasElement} canvas The canvas.
 * @returns {ImageData} The pixel data.
 * @throws {Error} When the canvas has no 2D context.
 * @author MathAid
 */
function readCanvasPixels(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('readCanvasPixels: no 2D context on the canvas.');
  }
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * @summary The Canvas2D backend entry.
 * @author MathAid
 */
const canvasBackend: BackendEntry = {
  backendId: 'canvas2d',
  perChannel: 0,
  async create(width, height) {
    const canvas = createHeadlessCanvas(width, height);
    if (canvas === null) {
      throw new Error('canvas2d backend: no document in this environment.');
    }
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      throw new Error('canvas2d backend: no 2D context.');
    }
    const renderer = new Canvas2DRenderer(ctx);
    return {
      renderer,
      readPixels: () => readCanvasPixels(canvas),
    };
  },
  async cleanup(renderer) {
    void renderer;
  },
};

/**
 * @summary The list of backends the suite runs against.
 *
 * @description
 * The Canvas2D backend is always available when a DOM is present. The
 * WebGPU and native shim backends are added when their devices are
 * available. A backend that needs a real GPU is skipped in this
 * milestone.
 *
 * @author MathAid
 */
const BACKENDS: readonly BackendEntry[] = [canvasBackend];

describe('conformance', () => {
  it('runs every fixture on every available backend', async () => {
    const failures = await runConformance(FIXTURES, BACKENDS);
    expect(failures, formatFailures(failures)).toEqual([]);
  });

  it('renders every fixture twice with the same output', async () => {
    // Self-consistency. A backend that produces different output for
    // the same input on two consecutive renders is not conformant.
    for (const fixture of FIXTURES) {
      const b1 = await canvasBackend.create(FIXTURE_WIDTH, FIXTURE_HEIGHT);
      const b2 = await canvasBackend.create(FIXTURE_WIDTH, FIXTURE_HEIGHT);
      try {
        const builder1 = new FrameBuilder();
        fixture.build(builder1 as never);
        b1.renderer.render(builder1);
        const p1 = b1.readPixels();

        const builder2 = new FrameBuilder();
        fixture.build(builder2 as never);
        b2.renderer.render(builder2);
        const p2 = b2.readPixels();

        expect(Array.from(p1.data), `fixture ${fixture.name}`).toEqual(
          Array.from(p2.data),
        );
      } finally {
        await canvasBackend.cleanup(b1.renderer);
        await canvasBackend.cleanup(b2.renderer);
      }
    }
  });

  it('every fixture has a unique name', () => {
    const names = FIXTURES.map((f) => f.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('every command kind appears in at least one fixture', () => {
    // A soft check. The suite would catch a missing kind if a fixture
    // silently stopped rendering. This test makes the coverage
    // requirement explicit.
    const covered = new Set<string>();
    for (const f of FIXTURES) {
      const builder = new FrameBuilder();
      f.build(builder as never);
      for (const c of builder.commands) covered.add(c.kind);
    }
    const required = [
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
    ];
    for (const kind of required) {
      expect(covered.has(kind), `command kind "${kind}" is not covered`).toBe(true);
    }
  });
});

// Import FrameBuilder after the fixtures. The fixture file imports it
// through the barrel. This import is local to the test file.
import { FrameBuilder } from '@games/render';
