/**
 * @fileoverview
 * @summary The browser host — wires the engine, a renderer, input, and any game together.
 *
 * @description
 * This entry point is the composition root for the running application: it creates a
 * `Canvas2DRenderer`, a `KeyboardSource`, one of the three games, and an `Engine` on a
 * `BrowserHostLoop`. Because every game implements the same `IGame<IFrameBuilder>` contract,
 * swapping `GAME` below changes the whole experience without touching the engine, the renderer,
 * or the loop — the decoupling the engine exists to demonstrate.
 *
 * @author MathAid
 */

import {
  INVADERS_ACTIONS,
  SNAKE_ACTIONS,
  Snake,
  SpaceInvaders,
  TETRIS_ACTIONS,
  Tetris,
} from '@games/games';
import { KeyboardSource } from '@games/input';
import { BrowserHostLoop, Engine, type IGame, type PresentFrame } from '@games/loop';
import { Canvas2DRenderer, FrameBuilder, type IFrameBuilder, type IRenderer } from '@games/render';

/** Logical canvas size, in device-independent pixels. */
const WIDTH = 440;
const HEIGHT = 520;

/** Which game to run. */
type GameId = 'tetris' | 'snake' | 'invaders';

/** The game currently booted. Change this to run a different game. */
const GAME: GameId = 'invaders';

/**
 * @summary The game instance and its key bindings, by id.
 *
 * @description
 * Each game exposes its own logical actions; the bindings map physical `KeyboardEvent.code`
 * values to those actions. Returning them together keeps the composition in one place.
 *
 * @param id - The game to construct.
 * @return The game and a bindings map keyed by logical action.
 * @author MathAid
 */
function selectGame(id: GameId): {
  game: IGame<IFrameBuilder>;
  bindings: Record<string, readonly string[]>;
} {
  switch (id) {
    case 'tetris':
      return {
        game: new Tetris(1, 30),
        bindings: {
          [TETRIS_ACTIONS.moveLeft]: ['ArrowLeft', 'KeyA'],
          [TETRIS_ACTIONS.moveRight]: ['ArrowRight', 'KeyD'],
          [TETRIS_ACTIONS.rotate]: ['ArrowUp', 'KeyW'],
          [TETRIS_ACTIONS.softDrop]: ['ArrowDown', 'KeyS'],
          [TETRIS_ACTIONS.hardDrop]: ['Space'],
        },
      };
    case 'snake':
      return {
        game: new Snake(1, 8),
        bindings: {
          [SNAKE_ACTIONS.up]: ['ArrowUp', 'KeyW'],
          [SNAKE_ACTIONS.down]: ['ArrowDown', 'KeyS'],
          [SNAKE_ACTIONS.left]: ['ArrowLeft', 'KeyA'],
          [SNAKE_ACTIONS.right]: ['ArrowRight', 'KeyD'],
        },
      };
    case 'invaders':
      return {
        game: new SpaceInvaders(1),
        bindings: {
          [INVADERS_ACTIONS.left]: ['ArrowLeft', 'KeyA'],
          [INVADERS_ACTIONS.right]: ['ArrowRight', 'KeyD'],
          [INVADERS_ACTIONS.shoot]: ['Space'],
        },
      };
  }
}

const canvas = document.getElementById('game-2d') as HTMLCanvasElement;
const context = canvas.getContext('2d');
if (context === null) {
  throw new Error('Canvas 2D is not supported in this browser');
}

const renderer = new Canvas2DRenderer(context);
renderer.resize(WIDTH, HEIGHT);

const { game, bindings } = selectGame(GAME);
const keyboard = new KeyboardSource(bindings);

/**
 * The render glue: describe the frame into a builder, then hand it to the active renderer.
 */
const present: PresentFrame<IGame<IFrameBuilder>, IRenderer> = ({
  game: current,
  alpha,
  renderer: active,
}) => {
  const frame = new FrameBuilder();
  current.present({ alpha, frame });
  active?.render(frame);
};

const engine = new Engine(game, { fps: 60 }, new BrowserHostLoop(), present);
engine.setRenderer(renderer);
void engine.attachInput(keyboard, 'keyboard');
void engine.run();
