/**
 * @fileoverview
 * @summary The sprite registry — the asset map a sprite-capable renderer resolves against.
 *
 * @description
 * This module defines `ISpriteRegistry`, the seam between a game's `SpriteRef` ids and the
 * concrete drawable images a renderer needs, together with a default `SpriteRegistry` that loads
 * PNG/JPEG/GIF (or WebP) sources into `CanvasImageSource`s. The game never touches image APIs; it
 * emits `{ kind: 'sprite', sprite, transform }` and the renderer looks the id up here.
 *
 * @author MathAid
 */

import type { SpriteRef } from './command';

/**
 * @summary A map from sprite ids to drawable images.
 *
 * @description
 * `ISpriteRegistry` is the asset-agnostic contract a sprite-capable renderer depends on:
 * `load` populates an entry from a URL/asset source, `get` returns the ready image (or
 * `undefined` while still loading or missing). Keeping it behind an interface lets a test supply
 * a stub map while a browser supplies real decoded images.
 *
 * @see {@link SpriteRef}
 * @author MathAid
 */
export interface ISpriteRegistry {
  /**
   * @summary Load a sprite asset and register it under an id.
   * @param id - The `SpriteRef.id` the game will request.
   * @param source - The image URL (PNG/JPEG/GIF/WebP).
   * @return Resolves once the image is decoded and registered.
   * @author MathAid
   */
  load(id: string, source: string): Promise<void>;
  /**
   * @summary Resolve a sprite id to its drawable image.
   * @param id - The `SpriteRef.id` to resolve.
   * @return The image, or `undefined` if not (yet) loaded.
   * @author MathAid
   */
  get(id: string): CanvasImageSource | undefined;
}

/**
 * @summary A default `ISpriteRegistry` that decodes images from URLs.
 *
 * @description
 * `SpriteRegistry` loads each source through an `HTMLImageElement` and its `decode()` promise,
 * storing the decoded image keyed by id. `get` returns the image (or `undefined` before load
 * completes). It is the concrete browser implementation; tests typically substitute a stub.
 *
 * @example
 * const sprites = new SpriteRegistry();
 * await sprites.load('invader-a', '/assets/invader-a.png');
 * renderer.setSprites(sprites);
 *
 * @see {@link ISpriteRegistry}
 * @author MathAid
 */
export class SpriteRegistry implements ISpriteRegistry {
  readonly #images = new Map<string, CanvasImageSource>();

  /**
   * @summary Load and register a sprite asset.
   * @param id - The id to register the image under.
   * @param source - The image URL to decode.
   * @return Resolves once decoded and stored.
   * @author MathAid
   */
  async load(id: string, source: string): Promise<void> {
    const image = new Image();
    image.src = source;
    await image.decode();
    this.#images.set(id, image);
  }

  /**
   * @summary Resolve a sprite id to its decoded image.
   * @param id - The id to look up.
   * @return The image, or `undefined` if not loaded.
   * @author MathAid
   */
  get(id: string): CanvasImageSource | undefined {
    return this.#images.get(id);
  }
}
