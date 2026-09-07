/**
 * @fileoverview
 * @summary Tetris — the first game rebuilt on the decoupled engine.
 *
 * @description
 * This module implements Tetris as an `IGame<IFrameBuilder>`: a deterministic fixed-step
 * simulation (a seven-bag piece queue, gravity, rotation, movement, and line clears) plus a
 * declarative presentation that describes the board as `RenderCommand`s. It proves the engine
 * end-to-end — the game knows nothing of Canvas, `requestAnimationFrame`, or a keyboard; it reads
 * logical actions from its step context and emits render commands into a frame builder.
 *
 * @author MathAid
 */

import type { IGame, IPresentationContext, ISimulationContext } from '@games/loop';
import { Mulberry, type Color, type Rect } from '@games/math';
import type { IFrameBuilder } from '@games/render';
import { COLORS, PIECE_TYPES, SHAPES, rotate, type Mino, type PieceType } from './tetromino';
import type { IStatefulGame, Scene } from './scene';

/** Board width, in cells. */
const COLS = 10;
/** Board height, in cells. */
const ROWS = 20;
/** On-screen size of one cell, in logical pixels. */
const TILE = 24;
/** Board origin (top-left), in logical pixels. */
const ORIGIN_X = 12;
const ORIGIN_Y = 540;

/** The board background colour. */
const BACKGROUND: Color = { r: 0.07, g: 0.07, b: 0.1, a: 1 };
/** The board border colour. */
const BORDER: Color = { r: 0.5, g: 0.5, b: 0.55, a: 1 };

/**
 * @summary The logical actions Tetris reads, as engine-agnostic action ids.
 *
 * @description
 * `TETRIS_ACTIONS` is the game's input vocabulary. The host binds physical keys to these ids via
 * an `IInputSource`; the game only ever reads these names from `context.input`, so the same game
 * runs on keyboard, gamepad, or a scripted test source.
 *
 * @author MathAid
 */
export const TETRIS_ACTIONS = {
  moveLeft: 'move-left',
  moveRight: 'move-right',
  rotate: 'rotate',
  softDrop: 'soft-drop',
  hardDrop: 'hard-drop',
  pause: 'pause',
} as const;

/**
 * @summary A seven-bag randomiser: each of the seven pieces appears once per shuffle.
 *
 * @description
 * `Bag` draws pieces from a shuffled copy of all seven types and refills by reshuffling when it
 * empties, so a piece is never starved or repeated more than twice in a row. It is seeded by the
 * PRNG given at construction, keeping the whole queue deterministic.
 *
 * @author MathAid
 */
class Bag {
  readonly #rng: () => number;
  #queue: PieceType[] = [];

  /**
   * @summary Construct a bag over the standard seven pieces.
   * @param rng - The seeded PRNG used to shuffle each refill.
   * @author MathAid
   */
  constructor(rng: () => number) {
    this.#rng = rng;
  }

  /**
   * @summary Draw the next piece, refilling (reshuffling) when the bag is empty.
   * @return The next piece type.
   * @author MathAid
   */
  next(): PieceType {
    if (this.#queue.length === 0) {
      this.#queue = PIECE_TYPES.slice();
      for (let i = this.#queue.length - 1; i > 0; i--) {
        const j = Math.floor(this.#rng() * (i + 1));
        [this.#queue[i], this.#queue[j]] = [this.#queue[j], this.#queue[i]];
      }
    }
    return this.#queue.pop()!;
  }
}

/**
 * @summary A piece on the board: its type and current cell positions.
 * @author MathAid
 */
interface ActivePiece {
  readonly type: PieceType;
  cells: Mino[];
}

/**
 * @summary Tetris, implemented as a fixed-step simulation with declarative rendering.
 *
 * @description
 * `Tetris` composes the seven-bag queue, a 10×20 board, gravity, rotation, horizontal movement,
 * soft/hard drop, and line clearing behind the `IGame<IFrameBuilder>` contract. `step` advances
 * the simulation deterministically from the frame's logical input; `present` describes the board
 * and pieces as render commands. Game state (board, queue, counters) lives entirely in the class,
 * so the same instance is trivially driveable by a manual clock in tests or a browser host.
 *
 * @example
 * const tetris = new Tetris(1, 30); // seed 1, gravity every 30 steps
 * const engine = new Engine(tetris, { fps: 60 }, new BrowserHostLoop(), present);
 *
 * @see {@link IGame}
 * @author MathAid
 */
export class Tetris implements IStatefulGame<IFrameBuilder> {
  readonly #gravitySteps: number;
  readonly #bag: Bag;
  readonly #board: (Color | null)[][] = [];
  #current: ActivePiece;
  #next: ActivePiece;
  #stepCounter = 0;
  #linesCleared = 0;

  #paused: boolean;
  // #score: number;

  /**
   * @summary Construct a Tetris game.
   * @param seed - Seed for the deterministic piece queue. Defaults to `1`.
   * @param gravitySteps - Fixed steps between gravity falls. Defaults to `30`.
   * @author MathAid
   */
  constructor(seed = 1, gravitySteps = 30) {
    this.#gravitySteps = gravitySteps;
    this.#bag = new Bag(Mulberry.mulberry32(seed));
    for (let row = 0; row < ROWS; row++) this.#board.push(new Array<Color | null>(COLS).fill(null));
    this.#current = this.#spawn(this.#bag.next());
    this.#next = this.#spawn(this.#bag.next());

    this.#paused = false;
  }

  /**
   * @summary The game's current scene.
   * @author MathAid
   */
  get scene(): Scene {
    return this.#paused ? 'paused' : 'playing';
  }

  /**
   * @summary Advance the game by one fixed step.
   * @param context - Timing, metrics, and the frame's logical input.
   * @author MathAid
   */
  step(context: ISimulationContext): void {
    const input = context.input;
    if (input.wasPressed(TETRIS_ACTIONS.pause)) this.#pause();
    if (!this.#paused) {
      if (input.wasPressed(TETRIS_ACTIONS.rotate)) this.#rotate();
      if (input.wasPressed(TETRIS_ACTIONS.moveLeft)) this.#move(-1);
      if (input.wasPressed(TETRIS_ACTIONS.moveRight)) this.#move(1);
      if (input.wasPressed(TETRIS_ACTIONS.hardDrop)) this.#hardDrop();

      this.#stepCounter++;
      const interval = input.isDown(TETRIS_ACTIONS.softDrop)
        ? Math.max(1, Math.floor(this.#gravitySteps / 4))
        : this.#gravitySteps;
      if (this.#stepCounter >= interval) {
        this.#stepCounter = 0;
        this.#fall();
      }
    }
  }

  /**
   * @summary Describe the current board and pieces as render commands.
   * @param context - The interpolation factor and the frame builder to write into.
   * @author MathAid
   */
  present(context: IPresentationContext<IFrameBuilder>): void {
    const { frame } = context;
    frame.clear(BACKGROUND);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const color = this.#board[row][col];
        if (color !== null) {
          frame.rect(this.#cellRect(col, row), color, {
            color: { r: 1, g: 1, b: 1, a: 1 },
            width: 1,
          });
        }
      }
    }

    for (const cell of this.#current.cells) {
      if (cell.row >= 0) {
        frame.rect(this.#cellRect(cell.col, cell.row), COLORS[this.#current.type], {
          color: { r: 1, g: 1, b: 1, a: 1 },
          width: 1,
        });
      }
    }

    this.#drawNext(frame);
    frame.rect(
      { x: ORIGIN_X - 1, y: ORIGIN_Y - 1, width: COLS * TILE + 2, height: ROWS * TILE + 2 },
      undefined,
      { color: BORDER, width: 1 },
    );
  }

  /**
   * @summary Draw the upcoming piece in a box to the right of the board.
   * @param frame - The frame builder to write into.
   * @author MathAid
   */
  #drawNext(frame: IFrameBuilder): void {
    const boxX = ORIGIN_X + COLS * TILE + 32;
    const boxY = ORIGIN_Y + 32;
    frame.rect({ x: boxX - 1, y: boxY - 1, width: 5 * TILE, height: 3 * TILE }, undefined, {
      color: BORDER,
      width: 1,
    });
    for (const cell of this.#next.cells) {
      frame.rect(
        { x: boxX + cell.col * TILE, y: boxY + (cell.row + 1) * TILE, width: TILE, height: TILE },
        COLORS[this.#next.type],
        { color: { r: 1, g: 1, b: 1, a: 1 }, width: 1 },
      );
    }
  }

  /**
   * @summary The on-screen rectangle for a board cell.
   * @param col - Board column.
   * @param row - Board row.
   * @return The cell's rectangle.
   * @author MathAid
   */
  #cellRect(col: number, row: number): Rect {
    return { x: ORIGIN_X + col * TILE, y: ORIGIN_Y + row * TILE, width: TILE, height: TILE };
  }

  /**
   * @summary Create a piece at its spawn position.
   * @param type - The piece type.
   * @return The piece, translated to the board's top-centre.
   * @author MathAid
   */
  #spawn(type: PieceType): ActivePiece {
    return { type, cells: SHAPES[type].map((m) => ({ col: m.col + 3, row: m.row - 1 })) };
  }

  #pause() {
    this.#paused = !this.#paused;
  }

  /**
   * @summary Whether cells overlap the board bounds or a filled cell.
   * @param cells - The cells to test.
   * @return `true` on collision, `false` when the cells are free.
   * @author MathAid
   */
  #collides(cells: readonly Mino[]): boolean {
    for (const cell of cells) {
      if (cell.col < 0 || cell.col >= COLS || cell.row >= ROWS) return true;
      if (cell.row >= 0 && this.#board[cell.row][cell.col] !== null) return true;
    }
    return false;
  }

  /**
   * @summary Rotate the current piece if the result is free.
   * @author MathAid
   */
  #rotate(): void {
    const rotated = rotate(this.#current.cells);
    if (!this.#collides(rotated)) this.#current.cells = rotated;
  }

  /**
   * @summary Move the current piece horizontally if free.
   * @param dc - Column delta (`-1` left, `1` right).
   * @author MathAid
   */
  #move(dc: number): void {
    const moved = this.#current.cells.map((m) => ({ col: m.col + dc, row: m.row }));
    if (!this.#collides(moved)) this.#current.cells = moved;
  }

  /**
   * @summary Fall one cell, or lock when the piece cannot descend further.
   * @author MathAid
   */
  #fall(): void {
    const fallen = this.#current.cells.map((m) => ({ col: m.col, row: m.row + 1 }));
    if (this.#collides(fallen)) this.#lock();
    else this.#current.cells = fallen;
  }

  /**
   * @summary Drop the piece to the bottom immediately, then lock.
   * @author MathAid
   */
  #hardDrop(): void {
    while (!this.#collides(this.#current.cells.map((m) => ({ col: m.col, row: m.row + 1 })))) {
      this.#current.cells = this.#current.cells.map((m) => ({ col: m.col, row: m.row + 1 }));
    }
    this.#lock();
  }

  /**
   * @summary Merge the current piece into the board, clear lines, and spawn the next piece.
   * @author MathAid
   */
  #lock(): void {
    const color = COLORS[this.#current.type];
    let toppedOut = false;
    for (const cell of this.#current.cells) {
      if (cell.row < 0) {
        toppedOut = true;
        break;
      }
      this.#board[cell.row][cell.col] = color;
    }

    if (toppedOut) {
      for (const row of this.#board) row.fill(null);
      this.#linesCleared = 0;
    } else {
      this.#clearLines();
    }

    this.#current = this.#next;
    this.#next = this.#spawn(this.#bag.next());
  }

  /**
   * @summary Remove completed rows, shifting everything above them down.
   * @author MathAid
   */
  #clearLines(): void {
    for (let row = ROWS - 1; row >= 0; row--) {
      if (this.#board[row].every((cell) => cell !== null)) {
        this.#board.splice(row, 1);
        this.#board.unshift(new Array<Color | null>(COLS).fill(null));
        this.#linesCleared++;
        row++;
      }
    }
  }
}
