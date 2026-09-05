import { describe, expect, it } from 'vitest';
import { SpaceInvaders } from '@games/games';
import { noInput, present, step } from './util';

describe('SpaceInvaders', () => {
  it('emits a clear, the 55 invaders, and the player', () => {
    const commands = present(new SpaceInvaders(1));
    expect(commands[0].kind).toBe('clear');
    expect(commands.filter((c) => c.kind === 'rect').length).toBe(56); // 55 invaders + 1 player
    expect(commands.some((c) => c.kind === 'text')).toBe(true);
  });

  it('shooting adds a bullet', () => {
    const game = new SpaceInvaders(1);
    step(game, { ...noInput, wasPressed: (a) => a === 'shoot' });
    expect(present(game).filter((c) => c.kind === 'rect').length).toBe(57); // +1 bullet
  });

  it('is deterministic for a given seed', () => {
    const a = new SpaceInvaders(9);
    const b = new SpaceInvaders(9);
    for (let i = 0; i < 100; i++) {
      step(a);
      step(b);
    }
    expect(present(a)).toEqual(present(b));
  });
});
