import { describe, expect, it } from 'vitest';
import { Tetris } from '@games/games';
import { noInput, present, step } from './util';

describe('Tetris', () => {
  it('emits a clear followed by piece rects', () => {
    const commands = present(new Tetris(1, 30));
    expect(commands[0].kind).toBe('clear');
    expect(commands.filter((c) => c.kind === 'rect').length).toBeGreaterThanOrEqual(8);
  });

  it('is deterministic for a given seed', () => {
    const a = new Tetris(7, 30);
    const b = new Tetris(7, 30);
    for (let i = 0; i < 120; i++) {
      step(a);
      step(b);
    }
    expect(present(a)).toEqual(present(b));
  });

  it('rotation changes the active piece shape', () => {
    const rotated = new Tetris(3, 30);
    const plain = new Tetris(3, 30);
    step(rotated, { ...noInput, wasPressed: (a) => a === 'rotate' });
    step(plain);
    expect(present(rotated)).not.toEqual(present(plain));
  });

  it('hard drop locks the piece without error', () => {
    const game = new Tetris(1, 30);
    step(game, { ...noInput, wasPressed: (a) => a === 'hard-drop' });
    expect(() => present(game)).not.toThrow();
  });
});
