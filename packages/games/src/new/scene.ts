/**
 * @fileoverview
 * @summary The stateful-game contract — scenes and recursive transitions on top of `IGame`.
 *
 * @description
 * This module defines `Scene` and `IStatefulGame`, the composable state model a game may opt into
 * beyond the plain `IGame` contract. A scene is the game's own view of where it is (`playing`,
 * `paused`, `transitioning`, `gameOver`); a transition is an optional next game the current one
 * hands off to, enabling recursive `game → gameOver → nextLevel → …` chains without the engine
 * knowing any specific scene.
 *
 * @author MathAid
 */

import type { IGame } from '@games/loop';

/**
 * @summary The lifecycle scene a game reports itself to be in.
 *
 * @description
 * `Scene` is a closed set of named states. `playing` is normal simulation; `paused` halts the
 * world (and may draw a menu); `transitioning` advances a hand-off timeline; `gameOver` is the
 * terminal scene. A game routes `step`/`present` by its current scene, and reports it read-only so
 * a host can react (e.g. render an overlay) without knowing the game's internals.
 *
 * @see {@link IStatefulGame}
 * @author MathAid
 */
export type Scene = 'playing' | 'paused' | 'transitioning' | 'gameOver';

/**
 * @summary A game that exposes a scene and an optional recursive transition.
 *
 * @description
 * `IStatefulGame<F>` extends `IGame<F>` with a read-only `scene` and an optional `transition` to
 * the next game. A transition may itself be stateful, so transitions nest (a `gameOver` scene can
 * hand off to a `nextLevel` which hands off again). The engine is unaffected: it still drives a
 * single `IGame`, and the game internally decides which scene/transition to route to.
 *
 * @template F - The presentation output type, as in `IGame`.
 *
 * @example
 * class LevelOne implements IStatefulGame<IFrameBuilder> {
 *   get scene(): Scene { return this.#done ? 'transitioning' : 'playing'; }
 *   get transition(): IGame<IFrameBuilder> | undefined { return this.#done ? this.#next : undefined; }
 * }
 *
 * @see {@link IGame}
 * @see {@link Scene}
 * @author MathAid
 */
export interface IStatefulGame<F = unknown> extends IGame<F> {
  /** The game's current scene. */
  readonly scene: Scene;
  /** The next game to hand off to (recursive), or `undefined` when none. */
  readonly transition?: IGame<F>;
}
