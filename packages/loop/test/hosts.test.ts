import { describe, expect, it } from 'vitest';
import {
  Engine,
  ManualHostLoop,
  ReplayHostLoop,
  SecondMetric,
  type IGame,
} from '@games/loop';

describe('ManualHostLoop', () => {
  it('steps once per manual tick', () => {
    let steps = 0;
    const game: IGame = { step: () => void steps++, present: () => {} };
    const host = new ManualHostLoop();
    const engine = new Engine(game, { fps: 60 }, host);

    void engine.run();
    host.clock.advance(SecondMetric.NANOSECONDS / 60);
    host.scheduler.tick(host.clock.now());

    expect(steps).toBe(1);
    void engine.stop();
  });
});

describe('ReplayHostLoop', () => {
  it('plays back a fixed timestamp sequence deterministically', () => {
    let steps = 0;
    const game: IGame = { step: () => void steps++, present: () => {} };
    const frame = SecondMetric.NANOSECONDS / 60;
    const timestamps = Array.from({ length: 60 }, (_, i) => (i + 1) * frame);
    const engine = new Engine(game, { fps: 60 }, new ReplayHostLoop(timestamps));

    void engine.run(); // synchronous full playback

    expect(steps).toBe(60);
    void engine.stop();
  });

  it('stops delivering once cancelled', () => {
    let steps = 0;
    const game: IGame = { step: () => void steps++, present: () => {} };
    const frame = SecondMetric.NANOSECONDS / 60;
    const timestamps = Array.from({ length: 10 }, (_, i) => (i + 1) * frame);
    const host = new ReplayHostLoop(timestamps);
    const engine = new Engine(game, { fps: 60 }, host);

    void engine.run();
    expect(steps).toBe(10);
    void engine.stop();
  });
});
