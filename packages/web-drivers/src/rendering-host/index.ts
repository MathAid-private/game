import type { IGameRenderingHost } from '@games/loop';
import { nanoTime } from '@games/loop';

/**
 * @summary Browser host loop backed by `requestAnimationFrame`.
 *
 * @description
 * The default `IGameRenderingHost` for browser environments. Passes `callback`
 * directly to `requestAnimationFrame` so the loop runs at the display
 * refresh rate (typically 60 or 120 Hz). The fixed-timestep accumulator
 * handles any mismatch between display rate and target simulation FPS.
 *
 * @see {@linkcode FixedStepHostLoop} for testing.
 */
export const BrowserHostLoop: IGameRenderingHost = {
  schedule: (cb) => requestAnimationFrame(cb),
  cancel: (h) => cancelAnimationFrame(h as number),
  now: () => nanoTime(),
};

export const UnlockedHostLoop: IGameRenderingHost = {
  schedule: (cb) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => cb();
    ch.port2.postMessage(null);
    return ch;
  },
  cancel: (h) => {
    (h as MessageChannel).port1.onmessage = null;
  },
  now: () => nanoTime(),
};

export * from './split-host-loop';
