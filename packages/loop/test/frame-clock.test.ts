import { describe, expect, it } from 'vitest';
import { FrameClock, SecondMetric } from '@games/loop';

describe('FrameClock', () => {
  it('accumulates exactly one pending step per frame at the configured rate', () => {
    const frame = SecondMetric.NANOSECONDS / 60;
    const clock = new FrameClock(frame, 0);

    expect(clock.pending).toBe(0);
    clock.advance(frame);
    expect(clock.pending).toBeCloseTo(1, 5);
    clock.consume();
    expect(clock.pending).toBeCloseTo(0, 5);
  });

  it('accumulates multiple steps over a longer span', () => {
    const frame = SecondMetric.NANOSECONDS / 60;
    const clock = new FrameClock(frame, 0);

    clock.advance(frame * 3);
    expect(clock.pending).toBeCloseTo(3, 5);
  });

  it('reset discards pending debt and re-anchors', () => {
    const clock = new FrameClock(SecondMetric.NANOSECONDS, 0);

    clock.advance(SecondMetric.NANOSECONDS * 5);
    expect(clock.pending).toBeCloseTo(5, 5);

    clock.reset(SecondMetric.NANOSECONDS * 10);
    expect(clock.pending).toBe(0);

    clock.advance(SecondMetric.NANOSECONDS * 11); // one second after re-anchor
    expect(clock.pending).toBeCloseTo(1, 5);
  });
});
