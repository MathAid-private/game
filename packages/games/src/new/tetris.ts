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

import type {
  IAudioSink,
  IGame,
  IInputState,
  IPresentationContext,
  ISimulationContext,
  PresentSignal,
  StepSignal,
} from '@games/loop';
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

/** Pause-menu text colour. */
const MENU_TEXT: Color = { r: 0.9, g: 0.9, b: 0.9, a: 1 };
/** Pause-menu highlight (selected item) colour. */
const MENU_HIGHLIGHT: Color = { r: 1, g: 0.85, b: 0.3, a: 1 };
/** Pause-menu dim (hint) colour. */
const MENU_DIM: Color = { r: 0.55, g: 0.55, b: 0.6, a: 1 };

/** Selectable gravity speeds (steps between falls). */
const SPEEDS = [10, 20, 30, 60] as const;
/** Selectable master volumes. */
const VOLUMES = [0, 0.25, 0.5, 0.75, 1] as const;

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
 * @summary Clamp a value to the closed interval `[0, 1]`.
 * @param value - The value to clamp.
 * @return `value` bounded to `[0, 1]`.
 * @author MathAid
 */
function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * @summary The scoring result of one clear: points, combo delta, and deluxe points.
 * @author MathAid
 */
export interface ClearScore {
  /** Points to add to the total score. */
  readonly points: number;
  /** Combo-meter delta to add (before clamping). */
  readonly combo: number;
  /** Points attributed to the cascade ("deluxe") stacking bonus. */
  readonly deluxe: number;
}

/**
 * @summary Score a clear under the four cumulative Tetris rules.
 *
 * @description
 * The rules stack in one lock:
 * - **Line cleared** — `+1` point per line, `+0.05` combo.
 * - **Multi-line lock** — `+1` stacking on the base (so `L` lines → `L + 1`), `+0.25` combo.
 * - **Full clean** — `3+` lines on an emptied board → `×2` base (`L × 2`), `+0.75` combo.
 * - **Deluxe (cascade)** — each successive cascade wave adds an incrementing stacking bonus
 *   (`+1`, `+2`, `+3`, …) and `+0.25` combo; the bonuses are summed into `deluxe`.
 *
 * @param lines - Total lines cleared (including cascade waves).
 * @param cascadeWaves - Number of cascade waves beyond the initial clear (`0` for a plain clear).
 * @param fullClean - Whether the board is empty after the clear with `3+` lines.
 * @return The points, combo delta, and deluxe bonus.
 * @author MathAid
 */
export function scoreClear(lines: number, cascadeWaves: number, fullClean: boolean): ClearScore {
  let points = lines; // base: +1 per line
  let combo = 0;
  let deluxe = 0;

  if (fullClean) {
    points = lines * 2;
    combo += 0.75;
  } else if (lines >= 2) {
    points = lines + 1;
    combo += 0.25;
  } else {
    combo += 0.05;
  }

  for (let wave = 1; wave <= cascadeWaves; wave++) {
    deluxe += wave;
    combo += 0.25;
  }
  points += deluxe;

  return { points, combo, deluxe };
}

/**
 * @summary A read-only snapshot of Tetris scoring and progress metrics.
 * @author MathAid
 */
export interface TetrisMetrics {
  /** Deluxe (cascade) points earned so far this session. */
  readonly deluxePoints: number;
  /** All-time high deluxe points this session. */
  readonly deluxeHigh: number;
  /** Total points this session. */
  readonly totalPoints: number;
  /** All-time high total points this session. */
  readonly totalHigh: number;
  /** The combo meter, clamped to `[0, 1]`. */
  readonly combo: number;
  /** Number of full-board clears (full cleans) this session. */
  readonly boardClears: number;
  /** All-time high board-clear count this session. */
  readonly boardClearsHigh: number;
}

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
  #gravitySteps: number;
  #bag: Bag;
  readonly #board: (Color | null)[][] = [];
  #current: ActivePiece;
  #next: ActivePiece;
  #stepCounter = 0;
  #linesCleared = 0;
  #score = 0;
  #combo = 0;
  #deluxePoints = 0;
  #boardClears = 0;
  #highScore = 0;
  #highDeluxe = 0;
  #highClears = 0;
  #seed: number;
  #volume = 0.5;
  #menuIndex = 0;
  #audio: IAudioSink | null = null;

  #paused: boolean;

  /**
   * @summary Construct a Tetris game.
   * @param seed - Seed for the deterministic piece queue. Defaults to `1`.
   * @param gravitySteps - Fixed steps between gravity falls. Defaults to `30`.
   * @author MathAid
   */
  constructor(seed = 1, gravitySteps = 30) {
    this.#gravitySteps = gravitySteps;
    this.#seed = seed;
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
   * @summary A read-only snapshot of scoring and progress metrics.
   * @author MathAid
   */
  get metrics(): TetrisMetrics {
    return {
      deluxePoints: this.#deluxePoints,
      deluxeHigh: this.#highDeluxe,
      totalPoints: this.#score,
      totalHigh: this.#highScore,
      combo: this.#combo,
      boardClears: this.#boardClears,
      boardClearsHigh: this.#highClears,
    };
  }

  /**
   * @summary Advance the game by one fixed step.
   * @param context - Timing, metrics, and the frame's logical input.
   * @author MathAid
   */
  step(context: ISimulationContext): StepSignal {
    const input = context.input;
    this.#audio = context.audio;

    if (input.wasPressed(TETRIS_ACTIONS.pause)) {
      this.#pause();
      return this.#paused ? 'pause' : 'resume';
    }
    if (this.#paused) return this.#menuStep(input);

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
      this.#combo = clamp01(this.#combo - 0.001);
      this.#fall();
    }
    return 'continue';
  }

  /**
   * @summary Describe the current board and pieces as render commands.
   * @param context - The interpolation factor and the frame builder to write into.
   * @author MathAid
   */
  present(context: IPresentationContext<IFrameBuilder>): PresentSignal {
    const { frame } = context;
    if (this.#paused) {
      this.#drawMenu(frame);
      return 'reduced';
    }

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
    return 'full';
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
    if (this.#paused) this.#menuIndex = 0;
  }

  /**
   * @summary Navigate and edit the pause menu; returns `'resume'` when the player exits.
   * @param input - The menu-frame input snapshot.
   * @return `'continue'` to stay paused, or `'resume'` to hand control back to the engine.
   * @author MathAid
   */
  #menuStep(input: IInputState): StepSignal {
    const length = this.#menuItems().length;
    if (input.wasPressed(TETRIS_ACTIONS.softDrop)) this.#menuIndex = (this.#menuIndex + 1) % length;
    if (input.wasPressed(TETRIS_ACTIONS.rotate)) this.#menuIndex = (this.#menuIndex - 1 + length) % length;
    if (input.wasPressed(TETRIS_ACTIONS.moveLeft)) this.#cycleSetting(-1);
    if (input.wasPressed(TETRIS_ACTIONS.moveRight)) this.#cycleSetting(1);
    return 'continue';
  }

  /**
   * @summary The pause menu's items: label and current value, in display order.
   * @return The menu items.
   * @author MathAid
   */
  #menuItems(): { readonly label: string; readonly value: string }[] {
    return [
      { label: 'Speed', value: `${this.#gravitySteps} steps` },
      { label: 'Volume', value: `${Math.round(this.#volume * 100)}%` },
      { label: 'Seed', value: `${this.#seed}` },
      { label: 'Colours', value: 'default' },
      { label: 'RNG', value: 'mulberry32' },
      { label: 'Keymap', value: '←→ move · ↑ rotate · ↓ drop · Space hard · Esc pause' },
    ];
  }

  /**
   * @summary Cycle the selected setting by one step.
   * @param dir - `+1` or `-1`.
   * @author MathAid
   */
  #cycleSetting(dir: number): void {
    switch (this.#menuIndex) {
      case 0: {
        const i = SPEEDS.indexOf(this.#gravitySteps as (typeof SPEEDS)[number]);
        this.#gravitySteps = SPEEDS[(i + dir + SPEEDS.length) % SPEEDS.length];
        break;
      }
      case 1: {
        const i = VOLUMES.indexOf(this.#volume as (typeof VOLUMES)[number]);
        this.#volume = VOLUMES[(i + dir + VOLUMES.length) % VOLUMES.length];
        this.#audio?.setVolume(this.#volume);
        break;
      }
      case 2: {
        this.#seed = ((this.#seed - 1 + dir + 9) % 9) + 1;
        this.#rebuildBag();
        break;
      }
      default:
        break;
    }
  }

  /**
   * @summary Rebuild the piece bag from the current seed and respawn the queue.
   * @author MathAid
   */
  #rebuildBag(): void {
    this.#bag = new Bag(Mulberry.mulberry32(this.#seed));
    this.#current = this.#spawn(this.#bag.next());
    this.#next = this.#spawn(this.#bag.next());
  }

  /**
   * @summary Draw the pause menu over the board.
   * @param frame - The frame builder to write into.
   * @author MathAid
   */
  #drawMenu(frame: IFrameBuilder): void {
    frame.clear(BACKGROUND);
    const items = this.#menuItems();

    frame.text('PAUSED', { x: ORIGIN_X, y: 40 }, { color: MENU_HIGHLIGHT, size: 18 });
    frame.text(
      `score ${this.#score} · combo ${this.#combo.toFixed(3)}`,
      { x: ORIGIN_X, y: 66 },
      { color: MENU_TEXT, size: 12 },
    );

    items.forEach((item, i) => {
      const selected = i === this.#menuIndex;
      frame.text(
        `${selected ? '>' : ' '} ${item.label}: ${item.value}`,
        { x: ORIGIN_X, y: 96 + i * 22 },
        { color: selected ? MENU_HIGHLIGHT : MENU_TEXT, size: 13 },
      );
    });

    frame.text(
      '↑/↓ select · ←/→ change · Esc resume',
      { x: ORIGIN_X, y: 96 + items.length * 22 + 10 },
      { color: MENU_DIM, size: 11 },
    );
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
      const lines = this.#clearLines();
      if (lines > 0) this.#applyScore(lines);
    }

    this.#current = this.#next;
    this.#next = this.#spawn(this.#bag.next());
  }

  /**
   * @summary Apply the four cumulative scoring rules to a clear and update the combo meter.
   * @param lines - Total lines cleared this lock.
   * @author MathAid
   */
  #applyScore(lines: number): void {
    const fullClean = lines >= 3 && this.#isEmptyBoard();
    const { points, combo, deluxe } = scoreClear(lines, 0, fullClean);

    this.#score += points;
    this.#combo = clamp01(this.#combo + combo);
    this.#deluxePoints += deluxe;
    if (fullClean) this.#boardClears++;

    this.#highScore = Math.max(this.#highScore, this.#score);
    this.#highDeluxe = Math.max(this.#highDeluxe, this.#deluxePoints);
    this.#highClears = Math.max(this.#highClears, this.#boardClears);
  }

  /**
   * @summary Whether every board cell is empty.
   * @return `true` when the board holds no locked cells.
   * @author MathAid
   */
  #isEmptyBoard(): boolean {
    return this.#board.every((row) => row.every((cell) => cell === null));
  }

  /**
   * @summary Remove completed rows, shifting everything above them down.
   * @return The number of rows cleared.
   * @author MathAid
   */
  #clearLines(): number {
    let lines = 0;
    for (let row = ROWS - 1; row >= 0; row--) {
      if (this.#board[row].every((cell) => cell !== null)) {
        this.#board.splice(row, 1);
        this.#board.unshift(new Array<Color | null>(COLS).fill(null));
        this.#linesCleared++;
        lines++;
        row++;
      }
    }
    return lines;
  }
}
