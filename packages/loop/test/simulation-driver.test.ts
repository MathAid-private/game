import { describe, expect, it } from 'vitest';
import {
  AdaptiveTimestepDriver,
  FixedTimestepDriver,
  NullInputState,
  SecondMetric,
  type IGame,
} from '@games/loop';

describe('FixedTimestepDriver', () => {
  it('runs one step per whole frame owed', () => {
    let steps = 0;
    const game: IGame = { step: () => void steps++, present: () => {} };
    const driver = new FixedTimestepDriver(game, 60, 0);

    const run = driver.advance(SecondMetric.NANOSECONDS / 60, NullInputState.INSTANCE);
    expect(run.steps).toBe(1);
    expect(run.signal).toBe('continue');
    expect(steps).toBe(1);
  });

  it('runs zero steps when less than one frame is owed', () => {
    let steps = 0;
    const game: IGame = { step: () => void steps++, present: () => {} };
    const driver = new FixedTimestepDriver(game, 60, 0);

    driver.advance(SecondMetric.NANOSECONDS / 60 / 2, NullInputState.INSTANCE);
    expect(steps).toBe(0);
  });

  it('bounds catch-up steps to maxSteps', () => {
    let steps = 0;
    const game: IGame = { step: () => void steps++, present: () => {} };
    const driver = new FixedTimestepDriver(game, 60, 0, 2);

    driver.advance(SecondMetric.NANOSECONDS * 10, NullInputState.INSTANCE); // ~600 frames owed
    expect(steps).toBe(2);
  });

  it('surfaces a pause signal and stops stepping that frame', () => {
    let steps = 0;
    const game: IGame = {
      step: () => (++steps === 2 ? 'pause' : 'continue'),
      present: () => {},
    };
    const driver = new FixedTimestepDriver(game, 60, 0, 10);

    const run = driver.advance(SecondMetric.NANOSECONDS * 10, NullInputState.INSTANCE);
    expect(run.signal).toBe('pause');
    expect(steps).toBe(2); // halted mid-frame; remaining debt discarded
  });

  it('surfaces a skip signal and stops stepping that frame', () => {
    let steps = 0;
    const game: IGame = {
      step: () => (++steps === 1 ? 'skip' : 'continue'),
      present: () => {},
    };
    const driver = new FixedTimestepDriver(game, 60, 0, 10);

    const run = driver.advance(SecondMetric.NANOSECONDS * 10, NullInputState.INSTANCE);
    expect(run.signal).toBe('skip');
    expect(steps).toBe(1);
  });
});

describe('AdaptiveTimestepDriver', () => {
  it('tracks the frame time and stays within the interval bounds', () => {
    let steps = 0;
    const game: IGame = { step: () => void steps++, present: () => {} };
    const driver = new AdaptiveTimestepDriver(game, 60, 0);
    const frame = SecondMetric.NANOSECONDS / 60;

    for (let i = 1; i <= 120; i++) driver.advance(i * frame, NullInputState.INSTANCE);

    expect(steps).toBeGreaterThanOrEqual(110);
    expect(steps).toBeLessThanOrEqual(130);
  });
});
