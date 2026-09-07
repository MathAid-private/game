/**
 * @fileoverview
 * @summary A recording audio sink that logs sound requests for assertions.
 *
 * @description
 * This module provides `RecordingAudioSink`, an `IAudioSink` that records every `play`/`stop`/
 * `setVolume` call instead of producing sound. It is the observation seam for audio in tests,
 * mirroring `RecordingRenderer` for rendering.
 *
 * @author MathAid
 */

import type { IAudioSink } from '../types';

/**
 * @summary A logged audio request.
 * @author MathAid
 */
export interface AudioCall {
  readonly kind: 'play' | 'stop' | 'setVolume';
  readonly name?: string;
  readonly opts?: { readonly volume?: number; readonly loop?: boolean };
  readonly volume?: number;
}

/**
 * @summary An `IAudioSink` that records requests for later assertion.
 *
 * @description
 * `RecordingAudioSink` keeps an ordered list of every audio call made against it, so a test can
 * assert exactly which sounds a game requested (and with what options) without any audio
 * backend. `reset` clears the log.
 *
 * @example
 * const sink = new RecordingAudioSink();
 * engine.setAudio(sink);
 * assert.deepEqual(sink.calls, [{ kind: 'play', name: 'explosion', opts: { volume: 0.5 } }]);
 *
 * @see {@link IAudioSink}
 * @author MathAid
 */
export class RecordingAudioSink implements IAudioSink {
  readonly #calls: AudioCall[] = [];

  /**
   * @summary The recorded calls, in order.
   * @author MathAid
   */
  get calls(): readonly AudioCall[] {
    return this.#calls;
  }

  /**
   * @summary Record a play request.
   * @param name - The sound id.
   * @param opts - Optional volume/loop.
   * @author MathAid
   */
  play(name: string, opts?: { readonly volume?: number; readonly loop?: boolean }): void {
    this.#calls.push({ kind: 'play', name, opts });
  }

  /**
   * @summary Record a stop request.
   * @param name - The sound id.
   * @author MathAid
   */
  stop(name: string): void {
    this.#calls.push({ kind: 'stop', name });
  }

  /**
   * @summary Record a volume change.
   * @param volume - The master volume.
   * @author MathAid
   */
  setVolume(volume: number): void {
    this.#calls.push({ kind: 'setVolume', volume });
  }

  /**
   * @summary Clear the recorded calls.
   * @author MathAid
   */
  reset(): void {
    this.#calls.length = 0;
  }
}
