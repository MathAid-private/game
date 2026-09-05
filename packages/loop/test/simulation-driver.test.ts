import { describe, expect, it } from 'vitest';
import { FixedTimestepDriver, NullInputState, SecondMetric, type IGame } from '@games/loop';

describe('FixedTimestepDriver', () => {
  it('runs one step per whole frame owed', () => {
    let steps = 0;
    const game: IGame = { step: () => void steps++, present: () => {} };
    const driver = new FixedTimestepDriver(game, 60, 0);

    const run = driver.advance(SecondMetric.NANOSECONDS / 60, NullInputState.INSTANCE);
    expect(run).toBe(1);
    expect(steps).toBe(1);
  });

  it('runs zero steps when less than one frame is owed', () => {
    let steps = 0;
    const game: IGame = { step: () => void steps++, present: () => {} };
    const driver = new FixedTimestepDriver(game, 60, 0);

    driver.advance((SecondMetric.NANOSECONDS / 60) / 2, NullInputState.INSTANCE);
    expect(steps).toBe(0);
  });

  it('bounds catch-up steps to maxSteps', () => {
    let steps = 0;
    const game: IGame = { step: () => void steps++, present: () => {} };
    const driver = new FixedTimestepDriver(game, 60, 0, 2);

    driver.advance(SecondMetric.NANOSECONDS * 10, NullInputState.INSTANCE); // ~600 frames owed
    expect(steps).toBe(2);
  });
});
