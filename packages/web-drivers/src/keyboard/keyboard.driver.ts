// packages/controller-web/src/keyboard/keyboard-driver.ts

import type { AdvancedVPadData, IControllerDriver, SimpleVPadData } from '@games/controllers';
import { type IGameEnvironment, type IGameLogic } from '@games/loop';
import { DEFAULT_ADVANCED_KEYBOARD_BINDINGS, LOW_ONES, ONES } from './keyboard.const';
import type { IKeyboardBindings } from './keyboard.types';

export class SimpleKeyboardDriver<GL extends IGameLogic> implements IControllerDriver<
  GL,
  SimpleVPadData
> {
  #data: number = 0;
  #bindings: IKeyboardBindings<SimpleVPadData>;
  #onKeyDown: (e: KeyboardEvent) => void;
  #onKeyUp: (e: KeyboardEvent) => void;

  constructor(bindings: IKeyboardBindings<SimpleVPadData>) {
    this.#bindings = bindings;
    this.#onKeyDown = (e) => {
      const mask = this.#bindings[e.key] ?? 0;
      this.#data |= mask;
    };
    this.#onKeyUp = (e) => {
      const mask = this.#bindings[e.key] ?? 0;
      this.#data &= mask ^ LOW_ONES;
    };
  }

  async connect(_: IGameEnvironment<GL>): Promise<boolean> {
    window.addEventListener('keydown', this.#onKeyDown);
    window.addEventListener('keyup', this.#onKeyUp);
    return await Promise.resolve(true);
  }

  async disconnect(_: IGameEnvironment<GL>): Promise<boolean> {
    window.removeEventListener('keydown', this.#onKeyDown);
    window.removeEventListener('keyup', this.#onKeyUp);
    return await Promise.resolve(true);
  }

  // To use a concrete game loop object one may extends this
  // class and override this method, use the parameter and then
  // return super.read()
  read(): SimpleVPadData {
    return this.#data;
  }
}
export class KeyboardDriver<GL extends IGameLogic> implements IControllerDriver<
  GL,
  AdvancedVPadData
> {
  #data: bigint = 0n;
  #bindings: IKeyboardBindings<AdvancedVPadData>;
  #onKeyDown: (e: KeyboardEvent) => void;
  #onKeyUp: (e: KeyboardEvent) => void;

  constructor(
    // controller: IInputController<AdvancedVPadData, GL>,
    bindings: IKeyboardBindings<AdvancedVPadData> = DEFAULT_ADVANCED_KEYBOARD_BINDINGS,
  ) {
    this.#bindings = bindings;
    this.#onKeyDown = (e) => {
      const mask = this.#bindings[e.code] ?? 0n;
      this.#data |= mask;
      // controller.dispatch(nanoTime());
    };
    this.#onKeyUp = (e) => {
      const mask = this.#bindings[e.code] ?? 0n;
      this.#data &= mask ^ ONES;
      // controller.dispatch(nanoTime());
    };
  }
  get bindings(): Readonly<IKeyboardBindings<AdvancedVPadData>> {
    return this.#bindings;
  }
  setBinding(key: string, mask: bigint) {
    this.#bindings[key] = mask;
  }

  async connect(_: IGameEnvironment<GL>): Promise<boolean> {
    this.#bindings = { ...this.#bindings };
    window.addEventListener('keydown', this.#onKeyDown);
    window.addEventListener('keyup', this.#onKeyUp);
    return await Promise.resolve(true);
  }

  async disconnect(_: IGameEnvironment<GL>): Promise<boolean> {
    window.removeEventListener('keydown', this.#onKeyDown);
    window.removeEventListener('keyup', this.#onKeyUp);
    return await Promise.resolve(true);
  }

  // To use a concrete game loop object one may extends this
  // class and override this method, use the parameter and then
  // return super.read()
  read(): AdvancedVPadData {
    return this.#data;
  }
}

export function highResOnes(byteLength: number) {
  return new Uint8Array(byteLength).fill(0xff);
}

export function composedOnes(wordLength: number) {
  return new Array<number>(wordLength).fill(0xffff_ffff);
}
