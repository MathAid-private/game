/**
 * @fileoverview
 * @summary The browser host — wires the engine, a renderer, input, and a game together.
 *
 * @description
 * This entry point is the composition root for the running application: it creates a
 * `Canvas2DRenderer` over the page's canvas, a `KeyboardSource` bound to Tetris's logical
 * actions, the `Tetris` game, and an `Engine` on a `BrowserHostLoop`. It is the one place the
 * engine's environment-agnostic contracts meet concrete browser adapters, and it is itself
 * written in TypeScript so the whole stack is type-checked.
 *
 * @author MathAid
 */

import { BrowserHostLoop, Engine, type PresentFrame } from '@games/loop';
import { Canvas2DRenderer, FrameBuilder, type IRenderer } from '@games/render';
import { KeyboardSource } from '@games/input';
import { Tetris, TETRIS_ACTIONS } from '@games/apps';

/** Logical canvas size, in device-independent pixels. */
const WIDTH = 440;
const HEIGHT = 520;

const canvas = document.getElementById('game-2d') as HTMLCanvasElement;
const context = canvas.getContext('2d');
if (context === null) {
  throw new Error('Canvas 2D is not supported in this browser');
}

const renderer = new Canvas2DRenderer(context);
renderer.resize(WIDTH, HEIGHT);

const keyboard = new KeyboardSource({
  [TETRIS_ACTIONS.moveLeft]: ['ArrowLeft', 'KeyA'],
  [TETRIS_ACTIONS.moveRight]: ['ArrowRight', 'KeyD'],
  [TETRIS_ACTIONS.rotate]: ['ArrowUp', 'KeyW'],
  [TETRIS_ACTIONS.softDrop]: ['ArrowDown', 'KeyS'],
  [TETRIS_ACTIONS.hardDrop]: ['Space'],
});

const game = new Tetris(1, 30);

/**
 * The render glue: describe the frame into a builder, then hand it to the active renderer.
 */
const present: PresentFrame<Tetris, IRenderer> = ({ game: current, alpha, renderer: active }) => {
  const frame = new FrameBuilder();
  current.present({ alpha, frame });
  active?.render(frame);
};

const engine = new Engine(game, { fps: 60 }, new BrowserHostLoop(), present);
engine.setRenderer(renderer);
void engine.attachInput(keyboard, 'keyboard');
void engine.run();
