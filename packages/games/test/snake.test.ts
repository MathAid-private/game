import { describe, expect, it } from 'vitest';
import { Snake } from '@games/games';
import { noInput, present, rectXs, step } from './util';

describe('Snake', () => {
  it('emits a clear, food, snake, and border', () => {
    const commands = present(new Snake(1, 8));
    expect(commands[0].kind).toBe('clear');
    // food + 3 initial segments + border = 5 rects
    expect(commands.filter((c) => c.kind === 'rect').length).toBe(5);
  });

  it('wraps the head across the right edge', () => {
    const snake = new Snake(1, 8);
    const head = () => rectXs(present(snake))[1]; // rects[0] is food, rects[1] is head

    expect(head()).toBe(12 + 10 * 20); // starts at column 10

    for (let i = 0; i < 80; i++) step(snake); // 10 moves right
    expect(head()).toBe(12); // wrapped to column 0
  });

  it('is deterministic for a given seed', () => {
    const a = new Snake(5, 8);
    const b = new Snake(5, 8);
    for (let i = 0; i < 50; i++) {
      step(a);
      step(b);
    }
    expect(present(a)).toEqual(present(b));
  });

  it('turning changes the path', () => {
    const turned = new Snake(1, 8);
    const straight = new Snake(1, 8);
    step(turned, { ...noInput, wasPressed: (a) => a === 'up' });
    for (let i = 0; i < 8; i++) {
      step(turned);
      step(straight);
    }
    expect(present(turned)).not.toEqual(present(straight));
  });
});
