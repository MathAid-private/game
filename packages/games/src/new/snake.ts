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

import { Mulberry, type Color } from '@games/math';
import type {
  IGame,
  IInputState,
  IPresentationContext,
  ISimulationContext,
  PresentSignal,
  StepSignal,
} from '@games/loop';
import type { IFrameBuilder } from '@games/render';
import type { IStatefulGame, Scene } from './scene';

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
  pause: 'pause',
} as const;

/**
 * @summary Snake body palettes as `[head, tail]` gradient endpoints.
 * @author MathAid
 */
const SNAKE_PALETTES: readonly (readonly [Color, Color])[] = [
  [HEAD_COLOR, TAIL_COLOR],
  [{ r: 0.3, g: 0.6, b: 1, a: 1 }, { r: 0.1, g: 0.2, b: 0.5, a: 1 }],
  [{ r: 1, g: 0.4, b: 0.7, a: 1 }, { r: 0.5, g: 0.1, b: 0.3, a: 1 }],
];

/**
 * @summary Food (egg) colour palettes.
 * @author MathAid
 */
const FOOD_PALETTES: readonly Color[] = [
  FOOD_COLOR,
  { r: 1, g: 0.75, b: 0.2, a: 1 },
  { r: 0.3, g: 0.9, b: 0.4, a: 1 },
];

/**
 * @summary Stage themes as `{ background, border }` colour pairs.
 * @author MathAid
 */
const STAGE_THEMES: readonly { bg: Color; border: Color }[] = [
  { bg: BACKGROUND, border: { r: 0.4, g: 0.45, b: 0.4, a: 1 } },
  { bg: { r: 0.03, g: 0.03, b: 0.08, a: 1 }, border: { r: 0.3, g: 0.35, b: 0.55, a: 1 } },
  { bg: { r: 0.08, g: 0.05, b: 0.03, a: 1 }, border: { r: 0.55, g: 0.35, b: 0.25, a: 1 } },
];

/** A fixed obstacle block placed in the centre when obstacles are enabled. */
const OBSTACLES: readonly Cell[] = [
  { col: 9, row: 9 },
  { col: 10, row: 9 },
  { col: 9, row: 10 },
  { col: 10, row: 10 },
];

/** Pause-menu text colour. */
const MENU_TEXT: Color = { r: 0.9, g: 0.9, b: 0.9, a: 1 };
/** Pause-menu highlight (selected item) colour. */
const MENU_HIGHLIGHT: Color = { r: 1, g: 0.85, b: 0.3, a: 1 };
/** Pause-menu dim (hint) colour. */
const MENU_DIM: Color = { r: 0.55, g: 0.55, b: 0.6, a: 1 };

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
export class Snake implements IStatefulGame<IFrameBuilder> {
  readonly #moveSteps: number;
  readonly #rng: () => number;
  readonly #body: Cell[] = [];
  #direction: Direction = RIGHT;
  #queue: Direction[] = [];
  #food: Cell;
  #stepCounter = 0;
  #score = 0;
  #gameOver = false;
  #paused = false;
  #menuIndex = 0;
  #mode: 'arcade' | 'level' = 'arcade';
  #sprites = false;
  #snakePalette = 0;
  #foodPalette = 0;
  #stageTheme = 0;
  #obstaclesEnabled = false;

  /**
   * @summary Construct a Snake game.
   * @param seed - Seed for deterministic food placement. Defaults to `1`.
   * @param moveSteps - Fixed steps between moves. Defaults to `8`.
   * @author MathAid
   */
  constructor(seed = 1, moveSteps = 8) {
    this.#moveSteps = moveSteps;
    this.#rng = Mulberry.mulberry32(seed);
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
   * @summary The game's current scene.
   * @author MathAid
   */
  get scene(): Scene {
    return this.#paused ? 'paused' : 'playing';
  }

  /**
   * @summary Advance the game by one fixed step.
   * @param context - Timing, metrics, and the frame's logical input.
   * @return `'continue'`, or `'pause'`/`'resume'` on a pause-menu toggle.
   * @author MathAid
   */
  step(context: ISimulationContext): StepSignal {
    const input = context.input;
    if (input.wasPressed(SNAKE_ACTIONS.pause)) {
      this.#paused = !this.#paused;
      if (this.#paused) this.#menuIndex = 0;
      return this.#paused ? 'pause' : 'resume';
    }
    if (this.#paused) return this.#menuStep(input);

    if (input.wasPressed(SNAKE_ACTIONS.up)) this.#turn(UP);
    if (input.wasPressed(SNAKE_ACTIONS.down)) this.#turn(DOWN);
    if (input.wasPressed(SNAKE_ACTIONS.left)) this.#turn(LEFT);
    if (input.wasPressed(SNAKE_ACTIONS.right)) this.#turn(RIGHT);

    this.#stepCounter++;
    if (this.#stepCounter >= this.#effectiveMoveSteps()) {
      this.#stepCounter = 0;
      if (!this.#gameOver) this.#advance();
    }
    return 'continue';
  }

  /**
   * @summary Describe the board, food, and snake as render commands.
   * @param context - The interpolation factor and the frame builder.
   * @return `'full'`, or `'reduced'` when drawing the pause menu.
   * @author MathAid
   */
  present(context: IPresentationContext<IFrameBuilder>): PresentSignal {
    const { frame } = context;
    if (this.#paused) {
      this.#drawMenu(frame);
      return 'reduced';
    }

    const theme = STAGE_THEMES[this.#stageTheme];
    frame.clear(theme.bg);

    this.#drawFood(frame);
    this.#drawSnake(frame);
    this.#drawObstacles(frame);

    frame.rect(
      { x: ORIGIN_X - 1, y: ORIGIN_Y - 1, width: COLS * TILE + 2, height: ROWS * TILE + 2 },
      undefined,
      { color: theme.border, width: 1 },
    );
    return 'full';
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
   * @summary The sprite transform for a grid cell (position + `TILE` scale).
   * @param cell - The cell to place a sprite at.
   * @return A `Transform2D` covering the cell.
   * @author MathAid
   */
  #spriteTransform(cell: Cell) {
    return {
      x: ORIGIN_X + cell.col * TILE,
      y: ORIGIN_Y + cell.row * TILE,
      scaleX: TILE,
      scaleY: TILE,
    };
  }

  /**
   * @summary The move cadence, ramped by score in `'level'` mode.
   * @return The effective steps between moves.
   * @author MathAid
   */
  #effectiveMoveSteps(): number {
    if (this.#mode === 'level') return Math.max(2, this.#moveSteps - Math.floor(this.#score / 5));
    return this.#moveSteps;
  }

  /**
   * @summary Draw the food (as a sprite or a rect, per the sprites setting).
   * @param frame - The frame builder.
   * @author MathAid
   */
  #drawFood(frame: IFrameBuilder): void {
    if (this.#sprites) {
      frame.sprite({ id: 'egg' }, this.#spriteTransform(this.#food));
      return;
    }
    frame.rect(this.#cellRect(this.#food.col, this.#food.row), FOOD_PALETTES[this.#foodPalette]);
  }

  /**
   * @summary Draw the snake body (as sprites or a rect gradient).
   * @param frame - The frame builder.
   * @author MathAid
   */
  #drawSnake(frame: IFrameBuilder): void {
    const [head, tail] = SNAKE_PALETTES[this.#snakePalette];
    const total = this.#body.length;
    this.#body.forEach((cell, index) => {
      const t = total === 1 ? 0 : index / (total - 1);
      if (this.#sprites) {
        frame.sprite({ id: index === 0 ? 'snake-head' : 'snake-body' }, this.#spriteTransform(cell));
        return;
      }
      frame.rect(this.#cellRect(cell.col, cell.row), lerpColor(head, tail, t));
    });
  }

  /**
   * @summary Draw obstacles when enabled.
   * @param frame - The frame builder.
   * @author MathAid
   */
  #drawObstacles(frame: IFrameBuilder): void {
    if (!this.#obstaclesEnabled) return;
    for (const cell of OBSTACLES) {
      frame.rect(this.#cellRect(cell.col, cell.row), { r: 0.5, g: 0.4, b: 0.3, a: 1 });
    }
  }

  /**
   * @summary Navigate and edit the pause menu.
   * @param input - The menu-frame input snapshot.
   * @return `'continue'` to stay paused (resume is handled by the pause toggle).
   * @author MathAid
   */
  #menuStep(input: IInputState): StepSignal {
    const length = this.#menuItems().length;
    if (input.wasPressed(SNAKE_ACTIONS.down)) this.#menuIndex = (this.#menuIndex + 1) % length;
    if (input.wasPressed(SNAKE_ACTIONS.up)) this.#menuIndex = (this.#menuIndex - 1 + length) % length;
    if (input.wasPressed(SNAKE_ACTIONS.left)) this.#cycleSetting(-1);
    if (input.wasPressed(SNAKE_ACTIONS.right)) this.#cycleSetting(1);
    return 'continue';
  }

  /**
   * @summary The pause menu's items: label and current value.
   * @return The menu items.
   * @author MathAid
   */
  #menuItems(): { readonly label: string; readonly value: string }[] {
    return [
      { label: 'Mode', value: this.#mode },
      { label: 'Sprites', value: this.#sprites ? 'on' : 'off' },
      { label: 'Snake colour', value: `palette ${this.#snakePalette + 1}` },
      { label: 'Egg colour', value: `palette ${this.#foodPalette + 1}` },
      { label: 'Stage', value: `theme ${this.#stageTheme + 1}` },
      { label: 'Obstacles', value: this.#obstaclesEnabled ? 'on' : 'off' },
    ];
  }

  /**
   * @summary Cycle the selected setting.
   * @param dir - `+1` or `-1` (toggles ignore the direction).
   * @author MathAid
   */
  #cycleSetting(dir: number): void {
    switch (this.#menuIndex) {
      case 0:
        this.#mode = this.#mode === 'arcade' ? 'level' : 'arcade';
        break;
      case 1:
        this.#sprites = !this.#sprites;
        break;
      case 2:
        this.#snakePalette = (this.#snakePalette + dir + SNAKE_PALETTES.length) % SNAKE_PALETTES.length;
        break;
      case 3:
        this.#foodPalette = (this.#foodPalette + dir + FOOD_PALETTES.length) % FOOD_PALETTES.length;
        break;
      case 4:
        this.#stageTheme = (this.#stageTheme + dir + STAGE_THEMES.length) % STAGE_THEMES.length;
        break;
      case 5:
        this.#obstaclesEnabled = !this.#obstaclesEnabled;
        break;
      default:
        break;
    }
  }

  /**
   * @summary Draw the pause menu.
   * @param frame - The frame builder.
   * @author MathAid
   */
  #drawMenu(frame: IFrameBuilder): void {
    const theme = STAGE_THEMES[this.#stageTheme];
    frame.clear(theme.bg);
    const items = this.#menuItems();

    frame.text('PAUSED', { x: ORIGIN_X, y: 24 }, { color: MENU_HIGHLIGHT, size: 18 });
    frame.text(`score ${this.#score}`, { x: ORIGIN_X, y: 48 }, { color: MENU_TEXT, size: 12 });

    items.forEach((item, i) => {
      const selected = i === this.#menuIndex;
      frame.text(
        `${selected ? '>' : ' '} ${item.label}: ${item.value}`,
        { x: ORIGIN_X, y: 76 + i * 22 },
        { color: selected ? MENU_HIGHLIGHT : MENU_TEXT, size: 13 },
      );
    });

    frame.text(
      '↑/↓ select · ←/→ change · Esc resume',
      { x: ORIGIN_X, y: 76 + items.length * 22 + 10 },
      { color: MENU_DIM, size: 11 },
    );
  }

  /**
   * @summary Queue a turn, ignoring reversals.
   * @param next - The requested direction.
   * @author MathAid
   */
  #turn(next: Direction): void {
    const effective =
      this.#queue.length > 0 ? this.#queue[this.#queue.length - 1] : this.#direction;
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
    const hitsObstacle =
      this.#obstaclesEnabled &&
      OBSTACLES.some((o) => o.col === nextHead.col && o.row === nextHead.row);
    const collidable = eats ? this.#body : this.#body.slice(0, -1);
    if (
      hitsObstacle ||
      collidable.some((cell) => cell.col === nextHead.col && cell.row === nextHead.row)
    ) {
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
