import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from '@games/loop';

type Events = { tick: { delta: number }; stop: void };

describe('EventEmitter', () => {
  it('registers, emits, and unsubscribes handlers', () => {
    const emitter = new EventEmitter<Events>();
    const handler = vi.fn();
    const unsubscribe = emitter.on('tick', handler);

    emitter.emit('tick', { delta: 1 });
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    emitter.emit('tick', { delta: 2 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('emits void events with no argument', () => {
    const emitter = new EventEmitter<Events>();
    const handler = vi.fn();
    emitter.on('stop', handler);

    emitter.emit('stop');
    expect(handler).toHaveBeenCalledWith();
  });

  it('deduplicates the same handler reference', () => {
    const emitter = new EventEmitter<Events>();
    const handler = vi.fn();
    emitter.on('tick', handler);
    emitter.on('tick', handler);

    emitter.emit('tick', { delta: 1 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(emitter.listenerCount('tick')).toBe(1);
  });

  it('re-throws a single handler error and aggregates multiple', () => {
    const emitter = new EventEmitter<Events>();
    emitter.on('tick', () => {
      throw new Error('boom');
    });
    expect(() => emitter.emit('tick', { delta: 1 })).toThrow('boom');

    const multi = new EventEmitter<Events>();
    multi.on('tick', () => {
      throw new Error('a');
    });
    multi.on('tick', () => {
      throw new Error('b');
    });
    expect(() => multi.emit('tick', { delta: 1 })).toThrow(AggregateError);
  });

  it('clear removes all handlers', () => {
    const emitter = new EventEmitter<Events>();
    emitter.on('tick', vi.fn());
    emitter.on('stop', vi.fn());
    emitter.clear();
    expect(emitter.listenerCount('tick')).toBe(0);
    expect(emitter.listenerCount('stop')).toBe(0);
  });
});
