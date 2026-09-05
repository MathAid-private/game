import type { AdvancedVPadData } from '@games/controllers';
import type { IGameReadable } from '@games/loop';
import type { IAdvancedKeyboardBindings, KeyboardDriver } from '@games/web-drivers';
import type { Tetris } from './logic';

export const KEYBOARD_ID = 'keyboard';

function bit(mask: bigint, data: bigint) {
  return !!(data & mask);
}

export function evaluateKeyStokes(
  logic: Tetris,
  inputs: Record<string, IGameReadable<never, AdvancedVPadData>>,
) {
  const control = inputs[KEYBOARD_ID] as KeyboardDriver<Tetris>;
  const bindings = control.bindings as IAdvancedKeyboardBindings;
  if (bit(bindings.KeyW | bindings.ArrowUp, control.read())) {
    logic.rotate();
  } else if (bit(bindings.KeyS | bindings.ArrowDown, control.read())) {
    logic.descend();
  }

  if (bit(bindings.KeyA | bindings.ArrowLeft, control.read())) {
    logic.pan(false);
  } else if (bit(bindings.KeyD | bindings.ArrowRight, control.read())) {
    logic.pan(true);
  }

  if (bit(bindings.Space, control.read())) {
    logic.drop();
  }

  if (bit(bindings.Escape, control.read())) {
    // pause
  }
}
