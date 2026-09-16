import { describe, expect, it } from 'vitest';
import { Engine, ManualHostLoop, RecordingAudioSink, SecondMetric, type IGame } from '@games/loop';

describe('audio', () => {
  it('forwards game sound requests through the engine to the bound sink', () => {
    const sink = new RecordingAudioSink();
    const game: IGame = {
      step: ({ audio }) => {
        audio.play('explosion', { volume: 0.5 });
      },
      present: () => {},
    };
    const host = new ManualHostLoop();
    const engine = new Engine(game, { fps: 60 }, host);
    engine.setAudio(sink);
    void engine.run();

    host.clock.advance(SecondMetric.NANOSECONDS / 60);
    host.scheduler.tick(host.clock.now());

    expect(sink.calls).toEqual([{ kind: 'play', name: 'explosion', opts: { volume: 0.5 } }]);
    void engine.stop();
  });

  it('defaults to a silent sink so unbound games do not throw', () => {
    const game: IGame = {
      step: ({ audio }) => {
        audio.play('explosion'); // must be a safe no-op
      },
      present: () => {},
    };
    const host = new ManualHostLoop();
    const engine = new Engine(game, { fps: 60 }, host);
    void engine.run();

    host.clock.advance(SecondMetric.NANOSECONDS / 60);
    host.scheduler.tick(host.clock.now());

    expect(true).toBe(true); // reaching here without throwing is the assertion
    void engine.stop();
  });
});
