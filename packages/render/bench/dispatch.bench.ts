/**
 * @fileoverview
 * @summary Dispatch throughput benchmarks.
 *
 * @description
 * Measures the cost of building a frame and dispatching it to a
 * headless renderer. The dispatch path covers the {@linkcode FrameBuilder}
 * methods, the command list, and the renderer's dispatcher.
 *
 * Every benchmark uses the recording renderer so the numbers reflect
 * dispatch cost, not GPU work. A caller that wants render cost
 * benchmarks runs them against a real backend.
 *
 * ```text
 *   build+dispatch-1k          build 1000 commands, render
 *   build+dispatch-10k         build 10000 commands, render
 *   build-only-10k             build 10000 commands
 *   dispatch-only-10k          dispatch a pre-built 10000-command frame
 * ```
 *
 * @see {@linkcode RecordingRenderer}
 * @author MathAid
 */

import {
  FrameBuilder,
  make,
  makeSolid,
  RecordingRenderer,
  rect,
  sRGB,
  type IFrame,
} from '@games/render';
import { bench, describe } from 'vitest';

const red = makeSolid(make(sRGB, 1, 0, 0));

function buildFrame(count: number): FrameBuilder {
  const b = new FrameBuilder();
  b.clear();
  for (let i = 0; i < count; i++) {
    b.fillRect(rect(i % 100, (i / 100) | 0, 8, 8), red);
  }
  return b;
}

describe('frame dispatch', () => {
  bench('build+dispatch-1k', () => {
    const b = buildFrame(1000);
    const r = new RecordingRenderer();
    r.render(b);
  });

  bench('build+dispatch-10k', () => {
    const b = buildFrame(10000);
    const r = new RecordingRenderer();
    r.render(b);
  });

  bench('build-only-10k', () => {
    buildFrame(10000);
  });

  const prebuilt: IFrame = buildFrame(10000);

  bench('dispatch-only-10k', () => {
    const r = new RecordingRenderer();
    r.render(prebuilt);
  });
});