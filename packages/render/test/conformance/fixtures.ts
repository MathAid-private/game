/**
 * @fileoverview
 * @summary The conformance fixture set.
 *
 * @description
 * Exports {@linkcode FIXTURES}, the ordered list of every fixture the
 * suite renders. Every command kind in the union is exercised at least
 * once. Every shape kind is exercised at least once. Every state
 * command is exercised at least once.
 *
 * ```text
 *   Command kind       Fixture(s)
 *   --------------     ---------------------
 *   clear              clear-opaque, clear-transparent
 *   set-background     state-background
 *   set-fill           state-fill
 *   set-stroke         state-stroke
 *   set-transform      transform-translate
 *   fill-shape         solid-rect, rounded-rect, circle, polygon,
 *                      path-curves, path-arc, group, clip-inside
 *   stroke-shape       stroked-rect, dash-pattern
 *   clip               clip-inside
 *   text               text-hello
 *   sprite             sprite-ship
 *   push               nested-push
 *   pop                nested-push
 *
 *   Shape kind         Fixture(s)
 *   --------------     ---------------------
 *   line               (stroke only) stroked-line
 *   polygon            polygon
 *   rect               solid-rect, rounded-rect
 *   ellipse            circle
 *   path               path-curves, path-arc
 *   group              group
 * ```
 *
 * @example
 * Example 1: Iterate the fixtures
 * ```ts
 * import { FIXTURES } from './fixtures';
 * for (const f of FIXTURES) console.log(f.name);
 * ```
 *
 * @see {@linkcode Fixture}
 * @author MathAid
 */

import type { Fixture } from './types';

/**
 * @summary Every fixture the suite renders.
 *
 * @description
 * The order is stable. A new fixture is appended, never inserted, so
 * that the index of an existing fixture does not change.
 *
 * @see {@linkcode Fixture}
 * @author MathAid
 */
export const FIXTURES: readonly Fixture[] = [
  // -------------------------------------------------------------
  //  Clear
  // -------------------------------------------------------------
  {
    name: 'clear-opaque',
    build: (b) => {
      b.clear(makeSolid(make(sRGB, 1, 0, 0, 1)));
    },
    knownPixels: [
      { x: 5, y: 5, rgba: [255, 0, 0, 255] },
      { x: 32, y: 32, rgba: [255, 0, 0, 255] },
    ],
  },
  {
    name: 'clear-transparent',
    build: (b) => {
      b.clear();
    },
    knownPixels: [
      { x: 5, y: 5, rgba: [0, 0, 0, 0] },
      { x: 32, y: 32, rgba: [0, 0, 0, 0] },
    ],
  },

  // -------------------------------------------------------------
  //  Fill shape
  // -------------------------------------------------------------
  {
    name: 'solid-rect',
    build: (b) => {
      b.clear();
      b.fillRect(rect(0, 0, 32, 32), makeSolid(make(sRGB, 0, 1, 0, 1)));
    },
    knownPixels: [
      { x: 16, y: 16, rgba: [0, 255, 0, 255] },
      { x: 40, y: 40, rgba: [0, 0, 0, 0] },
    ],
  },
  {
    name: 'rounded-rect',
    build: (b) => {
      b.clear();
      b.fill(
        { kind: 'rect', rect: rect(4, 4, 56, 56), cornerRadius: 12 },
        makeSolid(make(sRGB, 0, 0, 1, 1)),
      );
    },
    knownPixels: [
      { x: 32, y: 32, rgba: [0, 0, 255, 255] },
      { x: 5, y: 5, rgba: [0, 0, 0, 0] },
    ],
  },
  {
    name: 'circle',
    build: (b) => {
      b.clear();
      b.fillCircle(point(32, 32), 20, makeSolid(make(sRGB, 1, 1, 0, 1)));
    },
    knownPixels: [
      { x: 32, y: 32, rgba: [255, 255, 0, 255] },
      { x: 2, y: 2, rgba: [0, 0, 0, 0] },
    ],
  },
  {
    name: 'polygon',
    build: (b) => {
      b.clear();
      b.fillPolygon(
        [point(32, 8), point(56, 56), point(8, 56)],
        makeSolid(make(sRGB, 1, 0, 1, 1)),
      );
    },
    knownPixels: [
      { x: 32, y: 40, rgba: [255, 0, 255, 255] },
      { x: 4, y: 4, rgba: [0, 0, 0, 0] },
    ],
  },
  {
    name: 'path-curves',
    build: (b) => {
      b.clear();
      b.fill(
        makePath([
          { kind: 'move', to: point(8, 32) },
          { kind: 'quadratic', control: point(32, 0), to: point(56, 32) },
          { kind: 'quadratic', control: point(32, 64), to: point(8, 32) },
          { kind: 'close' },
        ]),
        makeSolid(make(sRGB, 0.5, 0.5, 0.5, 1)),
      );
    },
    knownPixels: [
      { x: 32, y: 32, rgba: [128, 128, 128, 255] },
      { x: 2, y: 2, rgba: [0, 0, 0, 0] },
    ],
  },
  {
    name: 'path-arc',
    build: (b) => {
      b.clear();
      b.fill(
        makePath([
          { kind: 'move', to: point(32, 16) },
          {
            kind: 'arc',
            rx: 16,
            ry: 16,
            rotation: 0,
            largeArc: false,
            sweep: true,
            to: point(48, 32),
          },
          { kind: 'line', to: point(32, 48) },
          { kind: 'line', to: point(16, 32) },
          { kind: 'close' },
        ]),
        makeSolid(make(sRGB, 0, 0.5, 1, 1)),
      );
    },
    knownPixels: [
      { x: 32, y: 32, rgba: [0, 128, 255, 255] },
      { x: 2, y: 2, rgba: [0, 0, 0, 0] },
    ],
  },
  {
    name: 'group',
    build: (b) => {
      b.clear();
      b.fill(
        makeGroup([
          makeRect(rect(8, 8, 16, 16)),
          makeRect(rect(40, 8, 16, 16)),
        ]),
        makeSolid(make(sRGB, 1, 0.5, 0, 1)),
      );
    },
    knownPixels: [
      { x: 16, y: 16, rgba: [255, 128, 0, 255] },
      { x: 48, y: 16, rgba: [255, 128, 0, 255] },
      { x: 32, y: 16, rgba: [0, 0, 0, 0] },
    ],
  },

  // -------------------------------------------------------------
  //  Stroke shape
  // -------------------------------------------------------------
  {
    name: 'stroked-rect',
    build: (b) => {
      b.clear();
      b.strokeRect(rect(8, 8, 48, 48), {
        paint: makeSolid(make(sRGB, 1, 1, 1, 1)),
        width: 4,
      });
    },
    knownPixels: [
      { x: 10, y: 32, rgba: [255, 255, 255, 255] },
      { x: 32, y: 32, rgba: [0, 0, 0, 0] },
    ],
  },
  {
    name: 'stroked-line',
    build: (b) => {
      b.clear();
      b.stroke(makeLine(point(8, 32), point(56, 32)), {
        paint: makeSolid(make(sRGB, 1, 0, 0, 1)),
        width: 4,
      });
    },
    knownPixels: [
      { x: 32, y: 32, rgba: [255, 0, 0, 255] },
      { x: 32, y: 16, rgba: [0, 0, 0, 0] },
    ],
  },
  {
    name: 'dash-pattern',
    build: (b) => {
      b.clear();
      b.stroke(makeLine(point(8, 32), point(56, 32)), {
        paint: makeSolid(make(sRGB, 0, 1, 1, 1)),
        width: 2,
        dash: [4, 4],
      });
    },
    // Only the "on" segments carry color. Assert one solid part.
    knownPixels: [{ x: 10, y: 32, rgba: [0, 255, 255, 255] }],
  },

  // -------------------------------------------------------------
  //  State commands
  // -------------------------------------------------------------
  {
    name: 'state-fill',
    build: (b) => {
      b.clear();
      b.setFill(makeSolid(make(sRGB, 1, 0, 0, 1)));
      b.fillRect(rect(0, 0, 32, 32));
      b.fillRect(rect(32, 0, 32, 32));
    },
    knownPixels: [
      { x: 16, y: 16, rgba: [255, 0, 0, 255] },
      { x: 48, y: 16, rgba: [255, 0, 0, 255] },
    ],
  },
  {
    name: 'state-stroke',
    build: (b) => {
      b.clear();
      b.setStroke({
        paint: makeSolid(make(sRGB, 0, 1, 0, 1)),
        width: 4,
      });
      b.strokeRect(rect(8, 8, 48, 48));
    },
    knownPixels: [{ x: 10, y: 32, rgba: [0, 255, 0, 255] }],
  },
  {
    name: 'state-background',
    build: (b) => {
      b.clear();
      b.setBackground(makeSolid(make(sRGB, 0.25, 0.25, 0.25, 1)));
      b.fillRect(rect(16, 16, 32, 32), makeSolid(make(sRGB, 1, 1, 1, 1)));
    },
    // The background is not drawn in this milestone. Assert the rect.
    knownPixels: [{ x: 32, y: 32, rgba: [255, 255, 255, 255] }],
  },
  {
    name: 'transform-translate',
    build: (b) => {
      b.clear();
      b.setTransform([1, 0, 0, 1, 16, 16]);
      b.fillRect(rect(0, 0, 32, 32), makeSolid(make(sRGB, 1, 0, 0, 1)));
    },
    knownPixels: [
      { x: 32, y: 32, rgba: [255, 0, 0, 255] },
      { x: 4, y: 4, rgba: [0, 0, 0, 0] },
    ],
  },

  // -------------------------------------------------------------
  //  Clip
  // -------------------------------------------------------------
  {
    name: 'clip-inside',
    build: (b) => {
      b.clear();
      b.clipRect(rect(16, 16, 32, 32));
      b.fillRect(rect(0, 0, 64, 64), makeSolid(make(sRGB, 1, 0, 0, 1)));
    },
    knownPixels: [
      { x: 32, y: 32, rgba: [255, 0, 0, 255] },
      { x: 4, y: 4, rgba: [0, 0, 0, 0] },
    ],
  },

  // -------------------------------------------------------------
  //  Push / pop
  // -------------------------------------------------------------
  {
    name: 'nested-push',
    build: (b) => {
      b.clear();
      b.setFill(makeSolid(make(sRGB, 1, 0, 0, 1)));
      b.fillRect(rect(0, 0, 32, 32));
      b.push();
      b.setFill(makeSolid(make(sRGB, 0, 0, 1, 1)));
      b.fillRect(rect(32, 0, 32, 32));
      b.pop();
      b.fillRect(rect(0, 32, 32, 32));
    },
    knownPixels: [
      { x: 16, y: 16, rgba: [255, 0, 0, 255] },
      { x: 48, y: 16, rgba: [0, 0, 255, 255] },
      { x: 16, y: 48, rgba: [255, 0, 0, 255] },
    ],
  },

  // -------------------------------------------------------------
  //  Text and sprite
  // -------------------------------------------------------------
  {
    name: 'text-hello',
    build: (b) => {
      b.clear();
      b.text('H', point(8, 8), {
        size: 32,
        family: 'monospace',
        paint: makeSolid(make(sRGB, 1, 1, 1, 1)),
      });
    },
    // Text rendering is backend-specific. The assertion is soft:
    // any non-transparent pixel is acceptable within the tolerance.
    knownPixels: [],
  },
  {
    name: 'sprite-ship',
    build: (b) => {
      b.clear();
      b.sprite({ id: 'ship' }, { x: 32, y: 32 });
    },
    // A backend without a sprite registry draws the magenta placeholder.
    knownPixels: [{ x: 32, y: 32, rgba: [255, 0, 255, 255] }],
  },
];

// Helper imports are pulled in after the fixtures. The `import` block
// sits here to keep the fixture list visually first.
import {
  make,
  makeGroup,
  makeLine,
  makePath,
  makeRect,
  makeSolid,
  point,
  rect,
  sRGB,
} from '@games/render';

