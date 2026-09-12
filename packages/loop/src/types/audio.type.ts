/**
 * @fileoverview
 * @summary The audio contract — the narrow sink a game requests sounds through.
 *
 * @description
 * This module defines `IAudioSink`, the engine's only view of audio playback. A game requests
 * sounds declaratively by name (`play`/`stop`/`setVolume`) and never touches a Web Audio
 * `AudioContext`; the engine holds one sink (a `WebAudioSink` in a browser, a no-op or recording
 * sink in tests/headless) and forwards game requests to it. Keeping the contract to three methods
 * makes audio as swappable as the renderer.
 *
 * @author MathAid
 */

/**
 * Optiona used at {@linkcode IAudioSink.play}
 */
export interface IAudioPlayOptions extends Readonly<Pick<
  AudioBufferSourceNode,
  | 'loop'
  | 'loopStart'
  | 'loopEnd'
  | 'playbackRate'
  | 'detune'
  | 'numberOfInputs'
  | 'numberOfOutputs'
>> {
  /** Audio volume */
  readonly volume?: number;
}

/**
 * @summary A swappable audio backend: plays named sounds on request.
 *
 * @description
 * `IAudioSink` is the orthogonal audio seam, mirroring `IRenderer` but for sound. `play` starts a
 * named sound (optionally at a volume, looping); `stop` halts it; `setVolume` sets a master gain.
 * The names are game-defined and resolved by the concrete sink's own asset registry, so the
 * engine and game stay decoupled from any audio API or asset pipeline.
 *
 * @example
 * class MyGame implements IGame {
 *   step({ audio }: ISimulationContext): void {
 *     if (this.exploded) audio.play('explosion');
 *   }
 * }
 *
 * @see {@link ISimulationContext}
 * @author MathAid
 */
export interface IAudioSink {
  /**
   * @summary Start playing a named sound.
   * @param name - The game-defined sound id.
   * @param opts - Optional volume (`0..1`), loop flag...
   * @author MathAid
   */
  play(name: string, opts?: IAudioPlayOptions): void;
  /**
   * @summary Stop a named sound.
   * @param name - The game-defined sound id to halt.
   * @author MathAid
   */
  stop(name: string): void;
  /**
   * @summary Set the master volume.
   * @param volume - Master gain, typically `0..1`.
   * @author MathAid
   */
  setVolume(volume: number): void;
}
