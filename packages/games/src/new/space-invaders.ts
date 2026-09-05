/**
 * @fileoverview
 * @summary Space Invaders — entities, a marching formation, and AABB collision.
 *
 * @description
 * This module implements Space Invaders as an `IGame<IFrameBuilder>` on the decoupled engine. It
 * exercises the remaining engine concepts: a flat entity list (invaders and bullets as plain
 * records, not a full ECS), a formation that marches side-to-side and descends, and axis-aligned
 * collision via `@games/math`. The player ship, invaders, and bullets are all described as render
 * commands, and the whole game is deterministic when seeded.
 *
 * @author MathAid
 */

import { rectsIntersect, type Color, type Rect } from '@games/math';
import type {
  IGame,
  IPresentationContext,
  ISimulationContext,
} from '@games/loop';
import type { IFrameBuilder } from '@games/render';
import { mulberry32 } from './random';

/** Play-field width, in logical pixels. */
const PLAY_WIDTH = 400;
/** Play-field height, in logical pixels. */
const PLAY_HEIGHT = 520;
/** Play-field left edge. */
const PLAY_X = 20;

/** Player ship dimensions. */
const PLAYER_WIDTH = 24;
const PLAYER_HEIGHT = 12;
/** Player ship top edge (fixed). */
const PLAYER_Y = 470;

/** Bullet dimensions. */
const BULLET_WIDTH = 3;
const BULLET_HEIGHT = 8;

/** Invader formation geometry. */
const INVADER_COLS = 11;
const INVADER_ROWS = 5;
const INVADER_WIDTH = 18;
const INVADER_HEIGHT = 12;
const INVADER_GAP_X = 8;
const INVADER_GAP_Y = 10;

/** Player horizontal speed, in pixels per step. */
const PLAYER_SPEED = 3;
/** Bullet vertical speed, in pixels per step. */
const BULLET_SPEED = 6;
/** Steps between formation moves. */
const MOVE_STEPS = 20;
/** Formation horizontal step per move. */
const FORMATION_STEP = 2;
/** Formation descent when it reverses at an edge. */
const FORMATION_DESCENT = 12;
/** Steps between invader shots. */
const SHOOT_INTERVAL = 45;
/** Maximum simultaneous player bullets. */
const MAX_PLAYER_BULLETS = 3;

/** The background colour. */
const BACKGROUND: Color = { r: 0.02, g: 0.02, b: 0.05, a: 1 };
/** The player ship colour. */
const PLAYER_COLOR: Color = { r: 0.3, g: 0.9, b: 0.35, a: 1 };
/** Player bullet colour. */
const PLAYER_BULLET_COLOR: Color = { r: 0.8, g: 1, b: 0.3, a: 1 };
/** Invader bullet colour. */
const INVADER_BULLET_COLOR: Color = { r: 1, g: 0.3, b: 0.3, a: 1 };

/** Invader colours, one per row (top to bottom). */
const INVADER_COLORS: readonly Color[] = [
  { r: 1, g: 0.4, b: 0.9, a: 1 },
  { r: 0.4, g: 0.7, b: 1, a: 1 },
  { r: 0.4, g: 0.7, b: 1, a: 1 },
  { r: 0.4, g: 0.9, b: 0.4, a: 1 },
  { r: 0.4, g: 0.9, b: 0.4, a: 1 },
];

/**
 * @summary The logical actions Space Invaders reads.
 *
 * @description
 * `INVADERS_ACTIONS` is the game's input vocabulary: horizontal movement and shooting. A host
 * binds keys to these ids; the game reads them from `context.input`.
 *
 * @author MathAid
 */
export const INVADERS_ACTIONS = {
  left: 'left',
  right: 'right',
  shoot: 'shoot',
} as const;

/**
 * @summary A flying bullet.
 * @author MathAid
 */
interface Bullet {
  readonly x: number;
  y: number;
  /** Vertical direction: negative up (player), positive down (invader). */
  readonly dy: number;
}

/**
 * @summary An invader in the formation, addressed by its grid slot.
 * @author MathAid
 */
interface Invader {
  readonly col: number;
  readonly row: number;
  alive: boolean;
}

/**
 * @summary Space Invaders, implemented as a fixed-step entity game with AABB collision.
 *
 * @description
 * `SpaceInvaders` keeps a flat list of invaders (addressed by formation slot) and a list of
 * bullets. Each step moves the player, advances bullets, marches the formation (reversing and
 * descending at the edges), and resolves axis-aligned collisions between bullets and their
 * targets. `present` describes every entity as render commands. All state is internal, so the
 * game is deterministic for a given seed and input sequence.
 *
 * @example
 * const invaders = new SpaceInvaders(1);
 *
 * @see {@link IGame}
 * @author MathAid
 */
export class SpaceInvaders implements IGame<IFrameBuilder> {
  readonly #rng: () => number;
  readonly #invaders: Invader[] = [];
  readonly #bullets: Bullet[] = [];
  #formationX: number;
  #formationY = 40;
  #dir: 1 | -1 = 1;
  #playerX: number;
  #lives = 3;
  #score = 0;
  #stepCounter = 0;
  #gameOver = false;

  /**
   * @summary Construct a Space Invaders game.
   * @param seed - Seed for deterministic invader shooting. Defaults to `1`.
   * @author MathAid
   */
  constructor(seed = 1) {
    this.#rng = mulberry32(seed);
    for (let row = 0; row < INVADER_ROWS; row++) {
      for (let col = 0; col < INVADER_COLS; col++) {
        this.#invaders.push({ col, row, alive: true });
      }
    }
    const formationWidth = INVADER_COLS * (INVADER_WIDTH + INVADER_GAP_X) - INVADER_GAP_X;
    this.#formationX = PLAY_X + (PLAY_WIDTH - formationWidth) / 2;
    this.#playerX = PLAY_X + (PLAY_WIDTH - PLAYER_WIDTH) / 2;
  }

  /**
   * @summary Advance the game by one fixed step.
   * @param context - Timing, metrics, and the frame's logical input.
   * @author MathAid
   */
  step(context: ISimulationContext): void {
    if (this.#gameOver) return;
    const input = context.input;

    if (input.isDown(INVADERS_ACTIONS.left)) this.#playerX = Math.max(PLAY_X, this.#playerX - PLAYER_SPEED);
    if (input.isDown(INVADERS_ACTIONS.right)) {
      this.#playerX = Math.min(PLAY_X + PLAY_WIDTH - PLAYER_WIDTH, this.#playerX + PLAYER_SPEED);
    }
    if (input.wasPressed(INVADERS_ACTIONS.shoot) && this.#playerBullets().length < MAX_PLAYER_BULLETS) {
      this.#bullets.push({ x: this.#playerX + PLAYER_WIDTH / 2 - BULLET_WIDTH / 2, y: PLAYER_Y, dy: -1 });
    }

    this.#stepCounter++;

    if (this.#stepCounter % MOVE_STEPS === 0) this.#march();
    if (this.#stepCounter % SHOOT_INTERVAL === 0) this.#invaderShoot();

    this.#moveBullets();
    this.#resolveCollisions();
    this.#checkEnd();
  }

  /**
   * @summary Describe the invaders, player, and bullets as render commands.
   * @param context - The interpolation factor and the frame builder.
   * @author MathAid
   */
  present(context: IPresentationContext<IFrameBuilder>): void {
    const { frame } = context;
    frame.clear(BACKGROUND);

    for (const invader of this.#invaders) {
      if (!invader.alive) continue;
      const rect = this.#invaderRect(invader);
      frame.rect(rect, INVADER_COLORS[invader.row]);
    }

    frame.rect(
      { x: this.#playerX, y: PLAYER_Y, width: PLAYER_WIDTH, height: PLAYER_HEIGHT },
      PLAYER_COLOR,
    );

    for (const bullet of this.#bullets) {
      const color = bullet.dy < 0 ? PLAYER_BULLET_COLOR : INVADER_BULLET_COLOR;
      frame.rect({ x: bullet.x, y: bullet.y, width: BULLET_WIDTH, height: BULLET_HEIGHT }, color);
    }

    frame.text(`SCORE ${this.#score}`, { x: PLAY_X, y: 4 }, { color: { r: 1, g: 1, b: 1, a: 1 }, size: 12 });
    frame.text(`LIVES ${this.#lives}`, { x: PLAY_X + 120, y: 4 }, { color: { r: 1, g: 1, b: 1, a: 1 }, size: 12 });
    if (this.#gameOver) {
      frame.text('GAME OVER', { x: PLAY_X + 130, y: 240 }, { color: { r: 1, g: 0.3, b: 0.3, a: 1 }, size: 24 });
    }
  }

  /**
   * @summary The bounding rectangle of an invader at its current formation position.
   * @param invader - The invader.
   * @return Its on-screen rectangle.
   * @author MathAid
   */
  #invaderRect(invader: Invader): Rect {
    return {
      x: this.#formationX + invader.col * (INVADER_WIDTH + INVADER_GAP_X),
      y: this.#formationY + invader.row * (INVADER_HEIGHT + INVADER_GAP_Y),
      width: INVADER_WIDTH,
      height: INVADER_HEIGHT,
    };
  }

  /**
   * @summary The player's bounding rectangle.
   * @return The player ship's rectangle.
   * @author MathAid
   */
  #playerRect(): Rect {
    return { x: this.#playerX, y: PLAYER_Y, width: PLAYER_WIDTH, height: PLAYER_HEIGHT };
  }

  /**
   * @summary Move the formation, reversing and descending at the edges.
   * @author MathAid
   */
  #march(): void {
    const alive = this.#invaders.filter((i) => i.alive);
    if (alive.length === 0) return;
    const minX = Math.min(...alive.map((i) => this.#invaderRect(i).x));
    const maxX = Math.max(...alive.map((i) => this.#invaderRect(i).x + INVADER_WIDTH));
    const atLeftEdge = minX <= PLAY_X && this.#dir === -1;
    const atRightEdge = maxX >= PLAY_X + PLAY_WIDTH && this.#dir === 1;

    if (atLeftEdge || atRightEdge) {
      this.#dir = this.#dir === 1 ? -1 : 1;
      this.#formationY += FORMATION_DESCENT;
    } else {
      this.#formationX += this.#dir * FORMATION_STEP;
    }
  }

  /**
   * @summary Have a random bottom-most invader fire a bullet.
   * @author MathAid
   */
  #invaderShoot(): void {
    const shooters = this.#invaders.filter((i) => i.alive);
    if (shooters.length === 0) return;
    const shooter = shooters[Math.floor(this.#rng() * shooters.length)];
    const rect = this.#invaderRect(shooter);
    this.#bullets.push({ x: rect.x + INVADER_WIDTH / 2 - BULLET_WIDTH / 2, y: rect.y + INVADER_HEIGHT, dy: 1 });
  }

  /**
   * @summary Advance every bullet, removing any that leave the field.
   * @author MathAid
   */
  #moveBullets(): void {
    for (const bullet of this.#bullets) bullet.y += bullet.dy * BULLET_SPEED;
    for (let i = this.#bullets.length - 1; i >= 0; i--) {
      if (this.#bullets[i].y < -BULLET_HEIGHT || this.#bullets[i].y > PLAY_HEIGHT) {
        this.#bullets.splice(i, 1);
      }
    }
  }

  /**
   * @summary Resolve bullet-vs-invader and bullet-vs-player collisions.
   * @author MathAid
   */
  #resolveCollisions(): void {
    const playerRects = this.#playerRect();
    for (let i = this.#bullets.length - 1; i >= 0; i--) {
      const bullet = this.#bullets[i];
      const bulletRect: Rect = { x: bullet.x, y: bullet.y, width: BULLET_WIDTH, height: BULLET_HEIGHT };
      let hit = false;

      if (bullet.dy < 0) {
        for (const invader of this.#invaders) {
          if (invader.alive && rectsIntersect(bulletRect, this.#invaderRect(invader))) {
            invader.alive = false;
            this.#score += 10;
            hit = true;
            break;
          }
        }
      } else if (rectsIntersect(bulletRect, playerRects)) {
        this.#lives--;
        hit = true;
      }

      if (hit) this.#bullets.splice(i, 1);
    }
  }

  /**
   * @summary End the game when an invader reaches the player or lives run out.
   * @author MathAid
   */
  #checkEnd(): void {
    if (this.#lives <= 0) {
      this.#gameOver = true;
      return;
    }
    for (const invader of this.#invaders) {
      if (invader.alive && this.#invaderRect(invader).y + INVADER_HEIGHT >= PLAYER_Y) {
        this.#gameOver = true;
        return;
      }
    }
  }

  /**
   * @summary The player's live bullets.
   * @return Bullets moving upward.
   * @author MathAid
   */
  #playerBullets(): Bullet[] {
    return this.#bullets.filter((b) => b.dy < 0);
  }
}
