/**
 * @fileoverview
 * @summary Shared types for the renderer conformance suite.
 *
 * @description
 * Defines the shape of a fixture, a known-pixel assertion, and a
 * tolerance band. Every fixture is a builder function that populates a
 * fresh {@linkcode FrameBuilder}. Every fixture carries one or more
 * known-pixel assertions that a backend must satisfy.
 *
 * ```text
 *   Fixture
 *     +-- name           a stable identifier
 *     +-- build          a function that writes into a FrameBuilder
 *     +-- knownPixels    one or more pixel assertions
 *
 *   ToleranceBand
 *     +-- backendId      a stable backend identifier
 *     +-- perChannel     the maximum per-channel difference, 0 to 255
 * ```
 *
 * @author MathAid
 */
import type { IFrameBuilder } from '@games/render';

/**
 * @summary A known-pixel assertion.
 *
 * @description
 * Names a pixel coordinate and the RGBA value the fixture must produce
 * at that coordinate. The pixel is compared against the rendered image
 * with the backend's tolerance band.
 *
 * @example
 * Example 1: The center of a red circle
 * ```ts
 * const p: KnownPixel = { x: 32, y: 32, rgba: [255, 0, 0, 255] };
 * ```
 *
 * @example 2: A transparent background pixel
 * ```ts
 * const p: KnownPixel = { x: 0, y: 0, rgba: [0, 0, 0, 0] };
 * ```
 *
 * @see {@linkcode Fixture}
 * @author MathAid
 */
export interface KnownPixel {
  /** The pixel column, 0-based from the left. */
  readonly x: number;
  /** The pixel row, 0-based from the top. */
  readonly y: number;
  /** The expected RGBA value, each channel 0 to 255. */
  readonly rgba: readonly [number, number, number, number];
}

/**
 * @summary A fixture.
 *
 * @description
 * A named frame builder plus one or more known-pixel assertions. The
 * suite renders every fixture on every backend and checks every pixel
 * assertion.
 *
 * @example
 * Example 1: A clear-only fixture
 * ```ts
 * const f: Fixture = {
 *   name: 'clear-red',
 *   build: (b) => b.clear(makeSolid(make(sRGB, 1, 0, 0))),
 *   knownPixels: [{ x: 5, y: 5, rgba: [255, 0, 0, 255] }],
 * };
 * ```
 *
 * @see {@linkcode KnownPixel}
 * @author MathAid
 */
export interface Fixture {
  /** A stable identifier, unique within the suite. */
  readonly name: string;
  /** Populates a fresh builder with the fixture's commands. */
  readonly build: (builder: FixtureBuilder) => void;
  /** One or more pixel assertions the fixture must satisfy. */
  readonly knownPixels: readonly KnownPixel[];
}

/**
 * @summary A minimal builder surface the fixture uses.
 *
 * @description
 * Matches the public methods of {@linkcode FrameBuilder}. A fixture
 * does not construct the builder. The runner does.
 *
 * @see {@linkcode Fixture}
 * @author MathAid
 */
export type FixtureBuilder = IFrameBuilder;

/**
 * @summary A per-backend tolerance band.
 *
 * @description
 * Names a backend and the maximum per-channel difference the suite
 * accepts when comparing that backend's output to the reference. A
 * difference of `0` means exact match. A value of `2` means each
 * channel may differ by at most 2 out of 255.
 *
 * @example
 * Example 1: Exact match for the reference backend
 * ```ts
 * const band: ToleranceBand = { backendId: 'canvas2d', perChannel: 0 };
 * ```
 *
 * @example 2: Two-step tolerance for a GPU backend
 * ```ts
 * const band: ToleranceBand = { backendId: 'webgpu', perChannel: 2 };
 * ```
 *
 * @see {@linkcode Fixture}
 * @author MathAid
 */
export interface ToleranceBand {
  /** The backend identifier. */
  readonly backendId: string;
  /** The maximum per-channel difference, 0 to 255. */
  readonly perChannel: number;
}
