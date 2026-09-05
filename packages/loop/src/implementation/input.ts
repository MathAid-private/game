/**
 * @fileoverview
 * @summary Input-state implementations — the empty state and the many-sources composite.
 *
 * @description
 * This module provides the concrete `IInputState` shapes the engine composes at runtime: a
 * `NullInputState` for frames with no sources attached, and a `CompositeInputState` that merges
 * several sources into one logical snapshot. Both are pure and platform-free, so the engine can
 * sample input without knowing how many sources (if any) are attached.
 *
 * @author MathAid
 */

import type { IInputState, InputAction } from '../types';

/**
 * @summary An `IInputState` with every action always released.
 *
 * @description
 * `NullInputState` is the frame input used when no source is attached: every query returns
 * `false`. It is a shared singleton so the engine never allocates a fresh empty state per frame
 * when idle. Games that ignore input simply behave as if nothing is pressed.
 *
 * @example
 * const idle = NullInputState.INSTANCE; // isDown('anything') === false
 *
 * @see {@link IInputState}
 * @author MathAid
 */
export class NullInputState implements IInputState {
  /** The shared, allocation-free empty state. */
  static readonly INSTANCE = new NullInputState();

  private constructor() {}

  /**
   * @summary No action is ever down.
   * @return Always `false`.
   * @author MathAid
   */
  isDown(_action: InputAction): boolean {
    return false;
  }

  /**
   * @summary No action is ever pressed.
   * @return Always `false`.
   * @author MathAid
   */
  wasPressed(_action: InputAction): boolean {
    return false;
  }

  /**
   * @summary No action is ever released.
   * @return Always `false`.
   * @author MathAid
   */
  wasReleased(_action: InputAction): boolean {
    return false;
  }
}

/**
 * @summary An `IInputState` that merges several sources with "any" semantics.
 *
 * @description
 * `CompositeInputState` folds multiple `IInputState`s into one: an action is "down" if any
 * constituent reports it down, "pressed" if any reports a press, and "released" if any reports a
 * release. This lets the engine treat keyboard + gamepad + touch as a single logical input
 * surface, so a game queries one snapshot rather than iterating devices.
 *
 * @example
 * const merged = new CompositeInputState([keyboardState, gamepadState]);
 * if (merged.isDown('shoot')) fire();
 *
 * @see {@link IInputState}
 * @see {@link NullInputState}
 * @author MathAid
 */
export class CompositeInputState implements IInputState {
  readonly #states: readonly IInputState[];

  /**
   * @summary Construct a composite over the given states.
   * @param states - The constituent snapshots to merge (order is irrelevant).
   * @author MathAid
   */
  constructor(states: readonly IInputState[]) {
    this.#states = states;
  }

  /**
   * @summary Whether any constituent reports the action held.
   * @param action - The logical action to query.
   * @return `true` when at least one state reports the action down.
   * @author MathAid
   */
  isDown(action: InputAction): boolean {
    return this.#states.some((state) => state.isDown(action));
  }

  /**
   * @summary Whether any constituent reports a press this frame.
   * @param action - The logical action to query.
   * @return `true` when at least one state reports a rising edge.
   * @author MathAid
   */
  wasPressed(action: InputAction): boolean {
    return this.#states.some((state) => state.wasPressed(action));
  }

  /**
   * @summary Whether any constituent reports a release this frame.
   * @param action - The logical action to query.
   * @return `true` when at least one state reports a falling edge.
   * @author MathAid
   */
  wasReleased(action: InputAction): boolean {
    return this.#states.some((state) => state.wasReleased(action));
  }
}
