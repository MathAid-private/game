/**
 * @fileoverview
 * @summary A no-op audio sink that discards every sound request.
 *
 * @description
 * This module provides `NoopAudioSink`, an `IAudioSink` that accepts and ignores all
 * `play`/`stop`/`setVolume` calls. It is the default sink when no audio backend is bound, so a
 * game can request sounds unconditionally and a headless/test engine stays silent with zero cost.
 *
 * @author MathAid
 */

import type { IAudioSink } from '../types';

/**
 * @summary An `IAudioSink` that discards all requests.
 *
 * @description
 * `NoopAudioSink` satisfies the audio contract while producing no sound, so games never need to
 * null-check `context.audio`. A shared `INSTANCE` avoids per-engine allocation; engines and
 * drivers default to it until a real sink is set.
 *
 * @example
 * const sink = NoopAudioSink.INSTANCE;
 *
 * @see {@link IAudioSink}
 * @author MathAid
 */
export class NoopAudioSink implements IAudioSink {
  /** A shared, stateless instance. */
  static readonly INSTANCE = new NoopAudioSink();

  /**
   * @summary Discard a play request.
   * @param _name - Ignored.
   * @param _opts - Ignored.
   * @author MathAid
   */
  play(_name: string, _opts?: { readonly volume?: number; readonly loop?: boolean }): void {}

  /**
   * @summary Discard a stop request.
   * @param _name - Ignored.
   * @author MathAid
   */
  stop(_name: string): void {}

  /**
   * @summary Discard a volume change.
   * @param _volume - Ignored.
   * @author MathAid
   */
  setVolume(_volume: number): void {}
}
