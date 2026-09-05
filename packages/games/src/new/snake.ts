/**
 * @fileoverview
 * @summary Snake Xenzia — the Nokia classic with wall wrap and coloured segments.
 *
 * @description
 * This module implements Snake as an `IGame<IFrameBuilder>` on the decoupled engine. The snake
 * moves on a discrete grid at a fixed step cadence, wraps around the screen edges (the Xenzia
 * rule), grows when it eats, and ends on self-collision. Each body segment is coloured on a
 * head-to-tail gradient, and the whole game is deterministic when seeded.
 *
 * @author MathAid
 */

import type { Color } from '@games/math';
import type {
  IGame,
  IPresentationContext,
  ISimulationContext,
} from '@games/loop';
import type { IFrameBuilder } from '@games/render';
import { mulberry32 } from './random';

/** Grid width, in cells. */
const COLS = 20;
/** Grid height, in cells. */
const ROWS = 20;
/** On-screen size of one cell, in logical pixels. */
const TILE = 20;
/** Board origin (top-left), in logical pixels. */
const ORIGIN_X = 12;
const ORIGIN_Y = 12;

/** The board background colour. */
const BACKGROUND: Color = { r: 0.05, g: 0.06, b: 0.05, a: 1 };
/** The food colour. */
const FOOD_COLOR: Color = { r: 1, g: 0.25, b: 0.2, a: 1 };
/** The snake's head colour (brightest). */
const HEAD_COLOR: Color = { r: 0.6, g: 1, b: 0.25, a: 1 };
/** The snake's tail colour (darkest). */
const TAIL_COLOR: Color = { r: 0.1, g: 0.4, b: 0.1, a: 1 };

/**
 * @summary The logical actions Snake reads.
 *
 * @description
 * `SNAKE_ACTIONS` is the game's input vocabulary: the four directions. A host binds keys to
 * these ids; the game reads them from `context.input` and never sees a physical key.
 *
 * @author MathAid
 */
export const SNAKE_ACTIONS = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
} as const;

/**
 * @summary A grid cell.
 * @author MathAid
 */
interface Cell {
  readonly col: number;
  readonly row: number;
}

/**
 * @summary A direction as a unit cell delta.
 * @author MathAid
 */
interface Direction {
  readonly dc: number;
  readonly dr: number;
}

const UP: Direction = { dc: 0, dr: -1 };
const DOWN: Direction = { dc: 0, dr: 1 };
const LEFT: Direction = { dc: -1, dr: 0 };
const RIGHT: Direction = { dc: 1, dr: 0 };

/**
 * @summary Interpolate between two colours.
 * @param a - The colour at `t = 0`.
 * @param b - The colour at `t = 1`.
 * @param t - The interpolation factor in `[0, 1]`.
 * @return The blended colour.
 * @author MathAid
 */
function lerpColor(a: Color, b: Color, t: number): Color {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    a: 1,
  };
}

/**
 * @summary Snake Xenzia, implemented as a discrete fixed-step game with declarative rendering.
 *
 * @description
 * `Snake` keeps the body as a head-first list of cells, a queued-turn direction, and a fixed
 * movement cadence counted in steps. Each move wraps the head across the board edges, grows the
 * body when the head reaches the food, and ends the game on self-collision. `present` describes
 * the food and a head-to-tail colour gradient as render commands. All state is internal, so the
 * game is deterministic for a given seed and driveable by a manual clock or a browser host.
 *
 * @example
 * const snake = new Snake(1, 8); // seed 1, move every 8 steps
 *
 * @see {@link IGame}
 * @author MathAid
 */
export class Snake implements IGame<IFrameBuilder> {
  readonly #moveSteps: number;
  readonly #rng: () => number;
  readonly #body: Cell[] = [];
  #direction: Direction = RIGHT;
  #queue: Direction[] = [];
  #food: Cell;
  #stepCounter = 0;
  #score = 0;
  #gameOver = false;

  /**
   * @summary Construct a Snake game.
   * @param seed - Seed for deterministic food placement. Defaults to `1`.
   * @param moveSteps - Fixed steps between moves. Defaults to `8`.
   * @author MathAid
   */
  constructor(seed = 1, moveSteps = 8) {
    this.#moveSteps = moveSteps;
    this.#rng = mulberry32(seed);
    const startCol = Math.floor(COLS / 2);
    const startRow = Math.floor(ROWS / 2);
    this.#body.push(
      { col: startCol, row: startRow },
      { col: startCol - 1, row: startRow },
      { col: startCol - 2, row: startRow },
    );
    this.#food = this.#spawnFood();
  }

  /**
   * @summary Advance the game by one fixed step.
   * @param context - Timing, metrics, and the frame's logical input.
   * @author MathAid
   */
  step(context: ISimulationContext): void {
    const input = context.input;
    if (input.wasPressed(SNAKE_ACTIONS.up)) this.#turn(UP);
    if (input.wasPressed(SNAKE_ACTIONS.down)) this.#turn(DOWN);
    if (input.wasPressed(SNAKE_ACTIONS.left)) this.#turn(LEFT);
    if (input.wasPressed(SNAKE_ACTIONS.right)) this.#turn(RIGHT);

    this.#stepCounter++;
    if (this.#stepCounter >= this.#moveSteps) {
      this.#stepCounter = 0;
      if (!this.#gameOver) this.#advance();
    }
  }

  /**
   * @summary Describe the board, food, and snake as render commands.
   * @param context - The interpolation factor and the frame builder.
   * @author MathAid
   */
  present(context: IPresentationContext<IFrameBuilder>): void {
    const { frame } = context;
    frame.clear(BACKGROUND);

    frame.rect(this.#cellRect(this.#food.col, this.#food.row), FOOD_COLOR);

    const total = this.#body.length;
    this.#body.forEach((cell, index) => {
      const t = total === 1 ? 0 : index / (total - 1);
      frame.rect(this.#cellRect(cell.col, cell.row), lerpColor(HEAD_COLOR, TAIL_COLOR, t));
    });

    frame.rect(
      { x: ORIGIN_X - 1, y: ORIGIN_Y - 1, width: COLS * TILE + 2, height: ROWS * TILE + 2 },
      undefined,
      { color: { r: 0.4, g: 0.45, b: 0.4, a: 1 }, width: 1 },
    );
  }

  /**
   * @summary The on-screen rectangle for a grid cell.
   * @param col - Grid column.
   * @param row - Grid row.
   * @return The cell's rectangle.
   * @author MathAid
   */
  #cellRect(col: number, row: number) {
    return { x: ORIGIN_X + col * TILE, y: ORIGIN_Y + row * TILE, width: TILE, height: TILE };
  }

  /**
   * @summary Queue a turn, ignoring reversals.
   * @param next - The requested direction.
   * @author MathAid
   */
  #turn(next: Direction): void {
    const effective = this.#queue.length > 0 ? this.#queue[this.#queue.length - 1] : this.#direction;
    if (next.dc === -effective.dc && next.dr === -effective.dr) return;
    this.#queue.push(next);
  }

  /**
   * @summary Move the snake one cell, applying the next queued turn.
   * @author MathAid
   */
  #advance(): void {
    if (this.#queue.length > 0) this.#direction = this.#queue.shift()!;
    const head = this.#body[0];
    const nextHead: Cell = {
      col: (head.col + this.#direction.dc + COLS) % COLS,
      row: (head.row + this.#direction.dr + ROWS) % ROWS,
    };

    const eats = nextHead.col === this.#food.col && nextHead.row === this.#food.row;
    const collidable = eats ? this.#body : this.#body.slice(0, -1);
    if (collidable.some((cell) => cell.col === nextHead.col && cell.row === nextHead.row)) {
      this.#gameOver = true;
      return;
    }

    this.#body.unshift(nextHead);
    if (eats) {
      this.#score++;
      this.#food = this.#spawnFood();
    } else {
      this.#body.pop();
    }
  }

  /**
   * @summary Place food on a random empty cell.
   * @return A cell not occupied by the snake.
   * @author MathAid
   */
  #spawnFood(): Cell {
    const occupied = new Set(this.#body.map((c) => `${c.col},${c.row}`));
    const empty: Cell[] = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (!occupied.has(`${col},${row}`)) empty.push({ col, row });
      }
    }
    return empty[Math.floor(this.#rng() * empty.length)] ?? { col: 0, row: 0 };
  }
}
