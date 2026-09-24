/**
 * @fileoverview
 * @summary The conformance test runner.
 *
 * @description
 * Renders each fixture on every available backend and asserts that the
 * output matches the fixture's known pixels within the backend's
 * tolerance band. A backend that cannot render a fixture is skipped
 * with a warning. A backend that renders a fixture incorrectly fails
 * the test with a message that names the backend and the fixture.
 *
 * The runner is backend-agnostic. It accepts a list of backends, each
 * with an ID, a factory, and a tolerance band.
 *
 * ```text
 *   for each fixture
 *     for each backend
 *       render the fixture on the backend
 *       compare the result against the fixture's known pixels
 *       if the comparison fails, record the failure
 *   if any failures, throw a single error that names them all
 * ```
 *
 * @example
 * Example 1: Run against a single backend
 * ```ts
 * import { runConformance } from './runner';
 * import { FIXTURES } from './fixtures';
 *
 * await runConformance(FIXTURES, [
 *   {
 *     backendId: 'canvas2d',
 *     perChannel: 0,
 *     create: async () => {
 *       const canvas = createTestCanvas(64, 64);
 *       const ctx = canvas.getContext('2d')!;
 *       return new Canvas2DRenderer(ctx);
 *     },
 *     cleanup: async (renderer) => { void renderer; },
 *   },
 * ]);
 * ```
 *
 * @see {@linkcode Fixture}
 * @see {@linkcode ToleranceBand}
 * @author MathAid
 */

import type { IRenderer } from '@games/render';
import { FrameBuilder } from '@games/render';
import { compareKnownPixels } from './comparator';
import type { Fixture, ToleranceBand } from './types';

/**
 * @summary A backend entry for the conformance runner.
 *
 * @description
 * Bundles a backend identifier, a factory that creates the renderer,
 * and a cleanup function. The runner calls `create` once per fixture.
 * A backend that shares state across fixtures should create a fresh
 * renderer for each fixture to isolate failures.
 *
 * @example
 * Example 1: A Canvas2D backend
 * ```ts
 * const canvas2d: BackendEntry = {
 *   backendId: 'canvas2d',
 *   perChannel: 0,
 *   create: async (w, h) => {
 *     const canvas = document.createElement('canvas');
 *     canvas.width = w;
 *     canvas.height = h;
 *     return new Canvas2DRenderer(canvas.getContext('2d')!);
 *   },
 *   cleanup: async (r) => { void r; },
 * };
 * ```
 *
 * @see {@linkcode runConformance}
 * @author MathAid
 */
export interface BackendEntry {
  /** The backend identifier. */
  readonly backendId: string;
  /** The maximum per-channel tolerance, 0 to 255. */
  readonly perChannel: number;
  /**
   * Create a renderer with the given dimensions.
   *
   * @param width The canvas width in logical pixels.
   * @param height The canvas height in logical pixels.
   * @returns The renderer and a function that reads the canvas pixels.
   */
  readonly create: (
    width: number,
    height: number,
  ) => Promise<{
    readonly renderer: IRenderer;
    readonly readPixels: () => ImageData;
  }>;
  /** Release any resources the renderer holds. */
  readonly cleanup: (renderer: IRenderer) => Promise<void>;
}

/**
 * @summary A failure recorded by the runner.
 *
 * @description
 * Names the fixture and the backend, and carries the diagnostic
 * comparison result.
 *
 * @see {@linkcode runConformance}
 * @author MathAid
 */
export interface ConformanceFailure {
  /** The fixture name. */
  readonly fixture: string;
  /** The backend ID. */
  readonly backend: string;
  /** The pixel coordinates where the comparison failed. */
  readonly at: { readonly x: number; readonly y: number };
  /** The expected RGBA. */
  readonly expected: readonly [number, number, number, number];
  /** The actual RGBA. */
  readonly actual: readonly [number, number, number, number];
  /** The per-channel difference. */
  readonly diff: readonly [number, number, number, number];
}

/**
 * @summary The dimensions every fixture renders at.
 *
 * @description
 * 64 by 64 is large enough to place every fixture's shapes without
 * overlap and small enough to keep the pixel comparison fast.
 *
 * @see {@linkcode runConformance}
 * @author MathAid
 */
export const FIXTURE_WIDTH = 64;
export const FIXTURE_HEIGHT = 64;

/**
 * @summary Run every fixture on every backend.
 *
 * @description
 * Iterates the fixtures and backends in order. Renders each fixture on
 * a fresh renderer from each backend. Compares the output against the
 * fixture's known pixels with the backend's tolerance band. Collects
 * every failure and throws a single error that names them all.
 *
 * @example
 * Example 1: Run the suite
 * ```ts
 * const failures = await runConformance(FIXTURES, backends);
 * if (failures.length > 0) {
 *   throw new Error(`${failures.length} failures`);
 * }
 * ```
 *
 * @example 2: Run a subset
 * ```ts
 * const subset = FIXTURES.filter((f) => f.name.startsWith('clear'));
 * await runConformance(subset, backends);
 * ```
 *
 * @param {readonly Fixture[]} fixtures The fixture set.
 * @param {readonly BackendEntry[]} backends The available backends.
 * @returns {Promise<readonly ConformanceFailure[]>} The failures.
 * @author MathAid
 */
export async function runConformance(
  fixtures: readonly Fixture[],
  backends: readonly BackendEntry[],
): Promise<readonly ConformanceFailure[]> {
  const failures: ConformanceFailure[] = [];

  for (const backend of backends) {
    for (const fixture of fixtures) {
      // A fixture with no known pixels is a smoke test. Render it and
      // move on. A backend error still fails the test.
      const { renderer, readPixels } = await backend.create(
        FIXTURE_WIDTH,
        FIXTURE_HEIGHT,
      );
      try {
        const builder = new FrameBuilder();
        fixture.build(builder as never);
        renderer.render(builder);

        if (fixture.knownPixels.length === 0) continue;

        const imageData = readPixels();
        const result = compareKnownPixels(
          imageData,
          fixture.knownPixels,
          backend.perChannel,
        );
        if (!result.passed && result.failedAt && result.result) {
          failures.push({
            fixture: fixture.name,
            backend: backend.backendId,
            at: { x: result.failedAt.x, y: result.failedAt.y },
            expected: result.result.expected,
            actual: result.result.actual,
            diff: result.result.diff,
          });
        }
      } finally {
        await backend.cleanup(renderer);
      }
    }
  }

  return failures;
}

/**
 * @summary Format a list of failures into a human-readable report.
 *
 * @description
 * One line per failure. Names the fixture, the backend, the pixel, and
 * the difference. The report is used in the test's error message.
 *
 * @example
 * Example 1: Format a report
 * ```ts
 * const report = formatFailures(failures);
 * console.log(report);
 * ```
 *
 * @param {readonly ConformanceFailure[]} failures The failures.
 * @returns {string} The report.
 * @author MathAid
 */
export function formatFailures(
  failures: readonly ConformanceFailure[],
): string {
  if (failures.length === 0) return 'all fixtures passed';
  const lines: string[] = [`${failures.length} conformance failure(s):`];
  for (const f of failures) {
    lines.push(
      `  ${f.fixture} on ${f.backend}: (${f.at.x}, ${f.at.y}) ` +
        `expected [${f.expected.join(', ')}] ` +
        `actual [${f.actual.join(', ')}] ` +
        `diff [${f.diff.join(', ')}]`,
    );
  }
  return lines.join('\n');
}

/** The tolerance bands for the built-in backends. */
export const BUILTIN_TOLERANCES: readonly ToleranceBand[] = [
  { backendId: 'canvas2d', perChannel: 0 },
  { backendId: 'webgpu', perChannel: 2 },
  { backendId: 'shim-opengl', perChannel: 4 },
  { backendId: 'shim-vulkan', perChannel: 4 },
  { backendId: 'shim-dx12', perChannel: 4 },
  { backendId: 'shim-metal', perChannel: 4 },
];