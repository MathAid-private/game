import {
  Engine,
  ManualClock,
  ManualScheduler,
  SecondMetric,
  type IGame,
  type IHostLoop,
} from '@games/loop';
import { describe, expect, it } from 'vitest';

/** A minimal host loop backed by the manual clock and scheduler. */
function manualHost() {
  const clock = new ManualClock();
  const scheduler = new ManualScheduler();
  const host: IHostLoop = {
    now: () => clock.now(),
    schedule: (step) => scheduler.schedule(step),
    cancel: (handle) => scheduler.cancel(handle),
  };
  return { clock, scheduler, host };
}

describe('Engine', () => {
  it('steps the game once per frame and presents once per frame', () => {
    let steps = 0;
    let frames = 0;
    const game: IGame = { step: () => void steps++, present: () => {} };
    const { clock, scheduler, host } = manualHost();
    const engine = new Engine(game, { fps: 60 }, host, () => void frames++);

    void engine.run();
    const frame = SecondMetric.NANOSECONDS / 60;
    for (let i = 0; i < 120; i++) {
      clock.advance(frame);
      scheduler.tick(clock.now());
    }

    expect(steps).toBe(120);
    expect(frames).toBe(120);
    void engine.stop();
  });

  it('does not step while paused, and resume resets the clock', () => {
    let steps = 0;
    const game: IGame = { step: () => void steps++, present: () => {} };
    const { clock, scheduler, host } = manualHost();
    const engine = new Engine(game, { fps: 60 }, host);

    void engine.run();
    const frame = SecondMetric.NANOSECONDS / 60;

    clock.advance(frame);
    scheduler.tick(clock.now());
    expect(steps).toBe(1);

    engine.paused = true;
    clock.advance(frame * 10);
    scheduler.tick(clock.now());
    expect(steps).toBe(1); // paused: no stepping

    engine.paused = false;
    clock.advance(frame);
    scheduler.tick(clock.now());
    expect(steps).toBe(2); // resumed, debt from the pause was discarded
    void engine.stop();
  });

  it('emits lifecycle events across start/stop and pause/resume', () => {
    const events: string[] = [];
    const game: IGame = { step: () => {}, present: () => {} };
    const { host } = manualHost();
    const engine = new Engine(game, { fps: 60 }, host);

    engine.on('started', () => events.push('started'));
    engine.on('paused', () => events.push('paused'));
    engine.on('resumed', () => events.push('resumed'));
    engine.on('stopped', () => events.push('stopped'));

    void engine.run();
    engine.paused = true;
    engine.paused = false;
    void engine.stop();

    expect(events).toEqual(['started', 'paused', 'resumed', 'stopped']);
  });
});
