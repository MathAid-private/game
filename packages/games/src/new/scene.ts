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

import type {
  IGame,
  IPresentationContext,
  ISimulationContext,
  PresentSignal,
  StepSignal,
} from '@games/loop';

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

/**
 * @summary A recursive level sequence: plays each level and hands off to the next on `gameOver`.
 *
 * @description
 * `LevelTransition<F>` wraps an ordered list of `IStatefulGame<F>` levels and drives them one at a
 * time. When the current level reports `scene === 'gameOver'` it advances to the next; its own
 * `transition` is the *remaining* levels wrapped in another `LevelTransition`, so the hand-off is
 * recursive — a transition can wrap a game, and itself wrap another transition, indefinitely.
 *
 * @template F - The presentation output type, as in `IGame`.
 *
 * @example
 * const campaign = new LevelTransition([new Tetris(1), new Tetris(2), new Tetris(3)]);
 * // `campaign.transition` is a LevelTransition over levels 2–3, and so on.
 *
 * @see {@link IStatefulGame}
 * @see {@link Scene}
 * @author MathAid
 */
export class LevelTransition<F = unknown> implements IStatefulGame<F> {
  readonly #levels: readonly IStatefulGame<F>[];
  #index = 0;

  /**
   * @summary Construct a transition over an ordered level sequence.
   * @param levels - The levels to play, in order (at least one).
   * @throws {Error} If `levels` is empty.
   * @author MathAid
   */
  constructor(levels: readonly IStatefulGame<F>[]) {
    if (levels.length === 0) throw new Error('LevelTransition requires at least one level');
    this.#levels = levels;
  }

  /**
   * @summary The current level's scene, or `'gameOver'` after the last level finishes.
   * @author MathAid
   */
  get scene(): Scene {
    const current = this.#levels[this.#index];
    return current === undefined ? 'gameOver' : current.scene;
  }

  /**
   * @summary The remaining levels as another transition (recursive), or `undefined` when none.
   * @author MathAid
   */
  get transition(): IGame<F> | undefined {
    const remaining = this.#levels.slice(this.#index + 1);
    return remaining.length > 0 ? new LevelTransition(remaining) : undefined;
  }

  /**
   * @summary Step the current level, advancing to the next when it reports `gameOver`.
   * @param context - The step context, forwarded to the current level.
   * @return The current level's control signal (or `'continue'` after the sequence ends).
   * @author MathAid
   */
  step(context: ISimulationContext): StepSignal | void {
    const current = this.#levels[this.#index];
    if (current === undefined) return 'continue';
    const signal = current.step(context);
    if (current.scene === 'gameOver') this.#index++;
    return signal;
  }

  /**
   * @summary Present the current level (or nothing after the sequence ends).
   * @param context - The presentation context, forwarded to the current level.
   * @return The current level's present signal, or `'none'` when done.
   * @author MathAid
   */
  present(context: IPresentationContext<F>): PresentSignal | void {
    const current = this.#levels[this.#index];
    return current === undefined ? 'none' : current.present(context);
  }
}
