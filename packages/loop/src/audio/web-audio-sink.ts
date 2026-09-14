/**
 * @fileoverview
 * @summary The Web Audio sink — the browser audio backend over an `AudioContext`.
 *
 * @description
 * This module provides `WebAudioSink`, an `IAudioSink` backed by the Web Audio API. It holds an
 * `AudioContext`, a master `GainNode`, and a registry of decoded `AudioBuffer`s; `play` starts a
 * buffer source for a named sound, `stop` halts it, and `setVolume` adjusts the master gain. It is
 * the production counterpart to `NoopAudioSink`/`RecordingAudioSink`.
 *
 * @author MathAid
 */

import type { IAudioPlayOptions, IAudioSink } from '../types';

/**
 * @summary An `IAudioSink` over the Web Audio API.
 *
 * @description
 * `WebAudioSink` decodes named assets into `AudioBuffer`s and plays them through a master gain.
 * `load(name, source)` fetches and decodes an asset (a `fetch` + `decodeAudioData` pair); `play`
 * creates an `AudioBufferSourceNode` for the decoded buffer (one-shot by default, looping when
 * requested). `stop` terminates a named source, and `setVolume` sets the master gain.
 *
 * Assets are loaded lazily by the host before use; a `play` for an unloaded name is a no-op. This
 * sink is the only place the engine's audio requests meet the concrete Web Audio API.
 *
 * @example
 * const sink = new WebAudioSink();
 * await sink.load('explosion', '/assets/explosion.wav');
 * engine.setAudio(sink);
 *
 * @see {@link IAudioSink}
 * @author MathAid
 */
export class WebAudioSink implements IAudioSink {
  readonly #context: AudioContext;
  readonly #master: GainNode;
  readonly #buffers = new Map<string, AudioBuffer>();
  readonly #sources = new Map<string, AudioBufferSourceNode>();

  /**
   * @summary Construct a sink over a fresh `AudioContext`.
   * @author MathAid
   */
  constructor() {
    this.#context = new AudioContext();
    this.#master = this.#context.createGain();
    this.#master.connect(this.#context.destination);
  }

  /**
   * @summary Load and decode a named sound asset.
   * @param name - The game-defined sound id.
   * @param source - The audio URL to fetch and decode.
   * @return Resolves once decoded and registered.
   * @author MathAid
   */
  async load(name: string, source: string): Promise<void> {
    const response = await fetch(source);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await this.#context.decodeAudioData(arrayBuffer);
    this.#buffers.set(name, buffer);
  }

  /**
   * @summary Play a named sound (no-op if it is not loaded).
   * @param name - The sound id.
   * @param opts - Optional volume (`0..1`) and loop flag.
   * @author MathAid
   */
  play(name: string, opts?: IAudioPlayOptions): void {
    const buffer = this.#buffers.get(name);
    if (buffer === undefined) return;

    this.stop(name);

    const source = this.#context.createBufferSource();
    source.buffer = buffer;
    source.loop = opts?.loop ?? false;

    const gain = this.#context.createGain();
    gain.gain.value = opts?.volume ?? 1;
    source.connect(gain);
    gain.connect(this.#master);

    source.onended = () => this.#sources.delete(name);
    this.#sources.set(name, source);
    source.start();
  }

  /**
   * @summary Stop a named sound if it is playing.
   * @param name - The sound id to halt.
   * @author MathAid
   */
  stop(name: string): void {
    const source = this.#sources.get(name);
    if (source === undefined) return;
    try {
      source.stop();
    } catch {
      // Already stopped or not yet started — safe to ignore.
    }
    this.#sources.delete(name);
  }

  /**
   * @summary Set the master volume.
   * @param volume - Master gain, typically `0..1`.
   * @author MathAid
   */
  setVolume(volume: number): void {
    this.#master.gain.value = volume;
  }
}
