/**
 * @fileoverview
 * @summary Input contracts — logical actions and the sources that sample them.
 *
 * @description
 * This module decouples *what a player does* from *which physical device reports it*. A game
 * declares logical `InputAction`s (`'move-left'`, `'rotate'`, `'shoot'`); an `IInputSource`
 * (keyboard, gamepad, touch, a remote peer) turns its raw device state into an `IInputState`
 * that answers those actions with held/pressed/released queries.
 *
 * The engine core consumes only `IInputSource` and `IInputState`. It never sees a key code or a
 * gamepad button, so a game is portable across every input device and even a scripted/test
 * source.
 *
 * @author MathAid
 */

/**
 * @summary A logical, game-defined action, independent of any physical control.
 *
 * @description
 * `InputAction` is an opaque string identifier agreed between a game and its input bindings.
 * It names intent (`'pause'`, `'move-right'`), never a physical key or button. Because it is
 * just a string, actions are trivially serialisable and remappable without touching game code.
 *
 * @example
 * type TetrisActions = 'move-left' | 'move-right' | 'rotate' | 'soft-drop' | 'hard-drop' | 'pause';
 *
 * @author MathAid
 */
export type InputAction = string;

/**
 * @summary A point-in-time snapshot of the player's logical input.
 *
 * @description
 * `IInputState` answers three questions about any action: is it currently down, did it just
 * transition to down this frame, and did it just transition to up this frame. The edge queries
 * (`wasPressed` / `wasReleased`) exist so a game never hand-rolls "was it held last frame"
 * bookkeeping — the source produces them from its own previous-sample history.
 *
 * A state is a value, not a live object: it represents one sampled frame and does not change
 * after it is produced.
 *
 * @example
 * if (input.wasPressed('rotate')) board.rotateActive();
 * if (input.isDown('move-right')) player.translate(+1);
 *
 * @see {@link IInputSource}
 * @author MathAid
 */
export interface IInputState {
  /**
   * @summary Whether an action is held during this frame.
   * @param action - The logical action to query.
   * @return `true` when the action is currently down, `false` otherwise.
   * @author MathAid
   */
  isDown(action: InputAction): boolean;
  /**
   * @summary Whether an action transitioned to down on this frame (rising edge).
   * @param action - The logical action to query.
   * @return `true` exactly once per press, at the frame the action becomes held.
   * @author MathAid
   */
  wasPressed(action: InputAction): boolean;
  /**
   * @summary Whether an action transitioned to up on this frame (falling edge).
   * @param action - The logical action to query.
   * @return `true` exactly once per release, at the frame the action stops being held.
   * @author MathAid
   */
  wasReleased(action: InputAction): boolean;
}

/**
 * @summary A device or system that produces fresh input snapshots.
 *
 * @description
 * `IInputSource` is the input adapter contract. Each frame the engine calls `sample()` to get an
 * `IInputState` for that frame. The source owns the raw device (its event listeners, its prior
 * state, its action bindings) and exposes none of it — only the resulting snapshot.
 *
 * Input is deliberately separate from rendering: an `IInputSource` and an `IRenderer` are
 * attached to the engine through different seams (`attachInput` vs `setRenderer`), so neither
 * constrains the other.
 *
 * @example
 * const keyboard = new KeyboardSource({ 'move-left': ['ArrowLeft', 'KeyA'], rotate: ['ArrowUp', 'KeyW'] });
 * engine.attachInput(keyboard, 'keyboard-0');
 *
 * @see {@link IInputState}
 * @see {@link InputAction}
 * @author MathAid
 */
export interface IInputSource {
  /**
   * @summary Produce the input snapshot for the current frame.
   * @return A fresh `IInputState` reflecting the source's state at this frame.
   * @author MathAid
   */
  sample(): IInputState;
}
