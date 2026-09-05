import { describe, expect, it } from 'vitest';
import { pointInRect, rectsIntersect } from '@games/math';

describe('rectsIntersect', () => {
  it('detects overlapping rectangles', () => {
    expect(
      rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }),
    ).toBe(true);
  });

  it('treats touching edges as non-overlapping', () => {
    expect(
      rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 }),
    ).toBe(false);
  });

  it('rejects disjoint rectangles', () => {
    expect(
      rectsIntersect({ x: 0, y: 0, width: 5, height: 5 }, { x: 20, y: 20, width: 5, height: 5 }),
    ).toBe(false);
  });
});

describe('pointInRect', () => {
  const rect = { x: 0, y: 0, width: 10, height: 10 };

  it('includes the top-left corner and interior', () => {
    expect(pointInRect({ x: 0, y: 0 }, rect)).toBe(true);
    expect(pointInRect({ x: 5, y: 5 }, rect)).toBe(true);
  });

  it('excludes the right and bottom edges', () => {
    expect(pointInRect({ x: 10, y: 5 }, rect)).toBe(false);
    expect(pointInRect({ x: 5, y: 10 }, rect)).toBe(false);
  });
});
