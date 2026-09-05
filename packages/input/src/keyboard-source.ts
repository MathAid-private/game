/**
 * @fileoverview
 * @summary The keyboard input source — maps physical key codes to logical actions.
 *
 * @description
 * This module provides `KeyboardSource`, the concrete `IInputSource` that turns keyboard events
 * into logical-action snapshots. A game declares an action→key-code binding map; the source
 * tracks held keys and one-shot press/release edges, and `sample()` returns an `IInputState` the
 * game queries by action name. The game never sees a key code, which is what makes input
 * remappable and game code portable across devices.
 *
 * @author MathAid
 */

import type { IInputSource, IInputState, InputAction } from '@games/loop';

/**
 * @summary An `IInputState` over a snapshot of keyboard action sets.
 *
 * @description
 * `KeyboardState` answers `isDown` / `wasPressed` / `wasReleased` against three sets captured at
 * sample time: currently-held actions, actions pressed since the last sample, and actions
 * released since the last sample. It is a plain, immutable view handed back from
 * `KeyboardSource.sample()`.
 *
 * @author MathAid
 */
class KeyboardState implements IInputState {
  readonly #down: ReadonlySet<InputAction>;
  readonly #pressed: ReadonlySet<InputAction>;
  readonly #released: ReadonlySet<InputAction>;

  /**
   * @summary Construct a state over the given snapshots.
   * @param down - Actions currently held.
   * @param pressed - Actions pressed since the last sample.
   * @param released - Actions released since the last sample.
   * @author MathAid
   */
  constructor(
    down: ReadonlySet<InputAction>,
    pressed: ReadonlySet<InputAction>,
    released: ReadonlySet<InputAction>,
  ) {
    this.#down = down;
    this.#pressed = pressed;
    this.#released = released;
  }

  /**
   * @summary Whether an action is currently held.
   * @param action - The logical action to query.
   * @return `true` when the action is in the held set.
   * @author MathAid
   */
  isDown(action: InputAction): boolean {
    return this.#down.has(action);
  }

  /**
   * @summary Whether an action was pressed since the last sample.
   * @param action - The logical action to query.
   * @return `true` when the action has a rising edge in this sample.
   * @author MathAid
   */
  wasPressed(action: InputAction): boolean {
    return this.#pressed.has(action);
  }

  /**
   * @summary Whether an action was released since the last sample.
   * @param action - The logical action to query.
   * @return `true` when the action has a falling edge in this sample.
   * @author MathAid
   */
  wasReleased(action: InputAction): boolean {
    return this.#released.has(action);
  }
}

/**
 * @summary An `IInputSource` driven by keyboard events mapped to logical actions.
 *
 * @description
 * `KeyboardSource` binds `KeyboardEvent.code` values (e.g. `'ArrowLeft'`, `'KeyA'`, `'Space'`) to
 * game-defined `InputAction`s, listens for keydown/keyup on a target window, and produces one
 * `IInputState` per `sample()`. Key auto-repeat is ignored for edge detection, so a held key
 * reports a single press, and each `sample()` resets the press/release edges for the next frame.
 *
 * A key pressed and released entirely between two samples reports both edges in the next sample;
 * callers that must not miss a sub-frame tap should poll more frequently or read `isDown`.
 *
 * @example
 * const keyboard = new KeyboardSource({
 *   'move-left': ['ArrowLeft', 'KeyA'],
 *   'rotate': ['ArrowUp', 'KeyW'],
 * });
 * const input = keyboard.sample();
 * if (input.wasPressed('rotate')) rotate();
 *
 * @see {@link IInputSource}
 * @author MathAid
 */
export class KeyboardSource implements IInputSource {
  readonly #bindings: ReadonlyMap<string, InputAction>;
  readonly #target: Window;
  readonly #onKeyDown: (event: KeyboardEvent) => void;
  readonly #onKeyUp: (event: KeyboardEvent) => void;
  #down = new Set<InputAction>();
  #pressed = new Set<InputAction>();
  #released = new Set<InputAction>();

  /**
   * @summary Construct a keyboard source and attach its listeners.
   * @param bindings - A map from logical action to the `KeyboardEvent.code`s that trigger it.
   * @param target - The window to listen on. Defaults to the global `window`.
   * @author MathAid
   */
  constructor(
    bindings: Readonly<Record<InputAction, readonly string[]>>,
    target: Window = window,
  ) {
    const byCode = new Map<string, InputAction>();
    for (const [action, codes] of Object.entries(bindings)) {
      for (const code of codes) byCode.set(code, action);
    }
    this.#bindings = byCode;
    this.#target = target;

    this.#onKeyDown = (event: KeyboardEvent) => {
      const action = this.#bindings.get(event.code);
      if (action === undefined) return;
      if (!this.#down.has(action)) this.#pressed.add(action);
      this.#down.add(action);
    };
    this.#onKeyUp = (event: KeyboardEvent) => {
      const action = this.#bindings.get(event.code);
      if (action === undefined) return;
      if (this.#down.delete(action)) this.#released.add(action);
    };

    target.addEventListener('keydown', this.#onKeyDown);
    target.addEventListener('keyup', this.#onKeyUp);
  }

  /**
   * @summary Produce the input snapshot for the current frame.
   * @return A fresh `IInputState`; press/release edges are reset for the next frame.
   * @author MathAid
   */
  sample(): IInputState {
    const down = new Set(this.#down);
    const pressed = this.#pressed;
    const released = this.#released;
    this.#pressed = new Set();
    this.#released = new Set();
    return new KeyboardState(down, pressed, released);
  }

  /**
   * @summary Detach the key listeners and release the source.
   * @author MathAid
   */
  dispose(): void {
    this.#target.removeEventListener('keydown', this.#onKeyDown);
    this.#target.removeEventListener('keyup', this.#onKeyUp);
  }
}
