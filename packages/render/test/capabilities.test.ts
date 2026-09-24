/**
 * @fileoverview
 * @summary Tests for {@linkcode IRendererCapabilities} across every renderer.
 *
 * @description
 * Every renderer advertises the nine capability flags. The tests check
 * that each flag is the correct type, that the values are honest for
 * each renderer, and that the capability objects are frozen.
 *
 * @see {@linkcode IRendererCapabilities}
 * @author MathAid
 */

import {
  NoopRenderer,
  RecordingRenderer,
  type IRendererCapabilities,
} from '@games/render';
import { describe, expect, it } from 'vitest';

/**
 * @summary Assert that a capability object has all nine flags with the
 * correct types.
 *
 * @description
 * Reads each flag and checks its type. The test does not check the
 * values. Each renderer's test does that separately.
 *
 * @param {IRendererCapabilities} caps The capabilities to inspect.
 * @returns {void}
 * @author MathAid
 */
function assertShape(caps: IRendererCapabilities): void {
  expect(typeof caps.color).toBe('boolean');
  expect(typeof caps.text).toBe('boolean');
  expect(typeof caps.images).toBe('boolean');
  expect(typeof caps.depth).toBe('boolean');
  expect(typeof caps.shapes).toBe('boolean');
  expect(Array.isArray(caps.nativeShapes)).toBe(true);
  expect(typeof caps.clip).toBe('boolean');
  expect(typeof caps.capture).toBe('boolean');
  expect(typeof caps.captureStream).toBe('boolean');
}

describe('NoopRenderer capabilities', () => {
  const caps = new NoopRenderer().capabilities;

  it('has every flag with the correct type', () => {
    assertShape(caps);
  });

  it('reports false for every drawing flag', () => {
    expect(caps.color).toBe(false);
    expect(caps.text).toBe(false);
    expect(caps.images).toBe(false);
    expect(caps.depth).toBe(false);
    expect(caps.shapes).toBe(false);
    expect(caps.clip).toBe(false);
  });

  it('reports an empty nativeShapes list', () => {
    expect(caps.nativeShapes).toEqual([]);
  });

  it('reports false for capture flags', () => {
    expect(caps.capture).toBe(false);
    expect(caps.captureStream).toBe(false);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(caps)).toBe(true);
    expect(Object.isFrozen(caps.nativeShapes)).toBe(true);
  });
});

describe('RecordingRenderer capabilities', () => {
  const caps = new RecordingRenderer().capabilities;

  it('has every flag with the correct type', () => {
    assertShape(caps);
  });

  it('reports true for every drawing flag so games emit everything', () => {
    expect(caps.color).toBe(true);
    expect(caps.text).toBe(true);
    expect(caps.images).toBe(true);
    expect(caps.shapes).toBe(true);
    expect(caps.clip).toBe(true);
  });

  it('reports every shape kind as native', () => {
    expect(caps.nativeShapes).toEqual(
      expect.arrayContaining(['rect', 'ellipse', 'polygon', 'line', 'path', 'group']),
    );
  });

  it('has no depth buffer', () => {
    expect(caps.depth).toBe(false);
  });

  it('reports false for capture flags', () => {
    expect(caps.capture).toBe(false);
    expect(caps.captureStream).toBe(false);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(caps)).toBe(true);
  });
});

describe('capability object identity', () => {
  it('NoopRenderer returns the same object from every instance', () => {
    const a = new NoopRenderer().capabilities;
    const b = new NoopRenderer().capabilities;
    expect(a).toBe(b);
  });

  it('RecordingRenderer returns the same object from every instance', () => {
    const a = new RecordingRenderer().capabilities;
    const b = new RecordingRenderer().capabilities;
    expect(a).toBe(b);
  });
});