import {
  GameEnvironment,
  SecondMetric,
  type IGameEnvironment,
  type IGameLogic,
  type IGameReadable,
  type IRenderOptions,
  type IUpdateOptions,
} from '@games/loop';
import {
  BrowserHostLoop,
  CanvasRenderingContext2DDriver,
  KeyboardDriver,
} from '@games/web-drivers';
import type { AdvancedVPadData } from '../../../controllers/dist';
import { evaluateKeyStokes, KEYBOARD_ID } from './input';
import type { IMino, IMinoRow, ITetrisGrid, ITetrisParams, ITetromino } from './tetris.types';
import {
  canClearRow,
  canDescend,
  canPanLeft,
  canPanRight,
  clearRow,
  createTetromino,
  descend,
  l,
  merge,
  panLeft,
  panRight,
  rectToPath,
  reverseL,
  reverseSkew,
  rotate,
  skew,
  square,
  straight,
  t,
} from './tetromino';
import { raffleDraw } from './utils';

export const CANVAS_DEVICE_ID = 'ctx2d-driver';

export class Tetris implements IGameLogic {
  // Scene
  #tileSize: number;
  #grid: ITetrisGrid;
  // #gridOffset: Required<DOMPointInit> = { x: 10, y: 10, w: 0, z: 0 };
  #fallen: IMinoRow[];
  #board: DOMRect;

  // Named blocks
  #current: ITetromino;
  #next: ITetromino;
  #types: (typeof skew)[];

  #env: IGameEnvironment<Tetris>;
  #tickRate = SecondMetric.SECONDS * 100;
  #lastTick: number = 0;

  #fps = 0;

  constructor({ tileSize, grid, canvas }: ITetrisParams) {
    this.#tileSize = tileSize;
    this.#fallen = [];
    this.#grid = grid;
    this.#types = [square, straight, t, l, skew, reverseSkew, reverseL];

    this.#current = this.next();
    this.#next = this.next();

    this.#board = this.#computeBoard(canvas);

    this.#env = new GameEnvironment({ fps: 30 }, this, BrowserHostLoop);
    this.#env.connect(new KeyboardDriver(), KEYBOARD_ID);
    this.#env.connect(
      new CanvasRenderingContext2DDriver(canvas.getContext('2d')!),
      CANVAS_DEVICE_ID,
    );

    this.#env.accumulator.performance.on('fps-reset', (fps) => {
      this.#fps = fps.frames;
    });

    this.#env.run({});
  }
  #pathFromMino({ row, col }: IMino, board = this.#board) {
    const { x, y } = board;
    const p = new Path2D();
    p.rect(col * this.#tileSize + x, row * this.#tileSize + y, this.#tileSize, this.#tileSize);
    return p;
  }
  #pathFromTetromino(shape: ITetromino['shape'], board = this.#board) {
    return shape.reduce((p, c) => {
      p.addPath(this.#pathFromMino(c, board));
      return p;
    }, new Path2D());
  }
  #computeBoard(canvas: HTMLCanvasElement) {
    const { width } = canvas;
    return new DOMRect(
      width / 2 - (this.#grid.cols * this.#tileSize) / 2,
      2,
      this.#grid.cols * this.#tileSize,
      this.#grid.rows * this.#tileSize,
    );
  }
  #computeNextQueueBoard() {
    const { x, y, height } = this.#board;
    // return new DOMRect(
    //   x + width + this.#tileSize * 3,
    //   y + (height / 2 - height / 2 / 2),
    //   width - this.#tileSize * 3,
    //   height / 2,
    // );
    const cols = Math.trunc(this.#grid.cols - 3);
    const rows = Math.trunc(this.#grid.rows / 2);
    return new DOMRect(
      x + cols * this.#tileSize * 2,
      y + (height / 2 - height / 2 / 2),
      cols * this.#tileSize,
      rows * this.#tileSize,
    );
  }
  #computeScoreBoard() {
    const { x, y, width, height } = this.#board;
    return new DOMRect(
      x - (width + this.#tileSize * 3),
      y + (height / 2 - height / 2 / 2),
      width - this.#tileSize * 3,
      height / 2,
    );
  }
  get gridOffset() {
    const { x, y } = this.#board;
    return new DOMPoint(x, y);
  }
  get fallenMinos() {
    return this.#fallen;
  }
  pause() {
    this.#env.paused = !this.#env.paused;
  }
  drop() {
    while (this.canDescend()) this.descend();
  }
  canDescend() {
    return canDescend(this.#current, this.#fallen, this.#grid.rows);
  }
  descend() {
    return descend(this.#current);
  }
  canClear() {
    return this.#current.shape.some((m) => {
      // if(canClearRow(m.row, this.#fallen)) clearRow(m.row, this.#fallen)
      return canClearRow(m.row, this.#fallen);
    });
  }
  tryClear() {
    return this.#current.shape.forEach((m) => {
      if (canClearRow(m.row, this.#fallen)) clearRow(m.row, this.#fallen);
    });
  }
  pan(right: boolean) {
    if (right && canPanRight(this.#current, this.#grid.cols)) {
      panRight(this.#current);
    } else if (!right && canPanLeft(this.#current)) {
      panLeft(this.#current);
    }
  }
  rotate() {
    rotate(this.#current);
  }
  next(): ITetromino {
    let tetromino = createTetromino(
      raffleDraw(this.#types),
      raffleDraw(['red', 'green', 'blue', 'indigo', 'lemon', 'azure', 'yellow']),
      this.#grid.cols,
    );
    const rotateTetromino = raffleDraw(Array.from({ length: 10 }).map((_, i) => (i & 1) === 1));
    return rotateTetromino ? rotate(tetromino) : tetromino;
  }
  #drawBoard(ctx: CanvasRenderingContext2D) {
    this.#drawGrid(ctx);
    this.#drawBoardBackground(ctx);
    this.#drawNextQueue(ctx);
    this.#drawScore(ctx);
  }
  #drawNextQueue(ctx: CanvasRenderingContext2D) {
    // next queue board
    ctx.strokeStyle = 'white';
    ctx.stroke(rectToPath(this.#computeNextQueueBoard()));
    const t: ITetromino = {
      color: this.#next.color,
      shape: this.#next.shape.map((m) => ({ ...m })),
    };
    t.shape.forEach((m) => {
      m.col = Math.abs(m.col);
      m.row = Math.abs(m.row);
    });
    this.#drawTetromino(ctx, t, this.#computeNextQueueBoard());
  }
  #drawScore(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = 'white';
    ctx.stroke(rectToPath(this.#computeScoreBoard()));
  }
  #drawBoardBackground(ctx: CanvasRenderingContext2D) {
    // border
    ctx.strokeStyle = 'white';
    ctx.stroke(rectToPath(this.#board));
    // background
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = 'gray';
    ctx.fill(rectToPath(this.#board));
    ctx.globalAlpha = 1;
  }
  #drawGrid(ctx: CanvasRenderingContext2D) {
    // grid
    const path = new Path2D();
    for (let row = 0; row < this.#grid.rows; row++) {
      for (let col = 0; col < this.#grid.cols; col++) {
        path.addPath(this.#pathFromMino({ row, col }));
      }
    }
    ctx.strokeStyle = 'lemonchiffon';
    const lineWidth = ctx.lineWidth;
    ctx.lineWidth = 0.1;
    ctx.stroke(path);
    ctx.lineWidth = lineWidth;
  }
  #drawTetromino(ctx: CanvasRenderingContext2D, t: ITetromino, board?: DOMRect) {
    const path = this.#pathFromTetromino(t.shape, board);
    // fill background
    ctx.fillStyle = t.color;
    ctx.fill(path);

    // stroke
    ctx.strokeStyle = 'black';
    const lineWidth = ctx.lineWidth;
    // stroke border
    ctx.lineWidth = 1;
    ctx.stroke(path);
    // stroke grid
    ctx.lineWidth = 0.01;
    t.shape.forEach((m) => ctx.stroke(this.#pathFromMino(m, board)));

    ctx.lineWidth = lineWidth;
  }

  #drawCurrent(ctx: CanvasRenderingContext2D) {
    this.#drawTetromino(ctx, this.#current);
  }
  /*
  #drawFallenMinos(ctx: CanvasRenderingContext2D) {
    for (let rowIndex = 0; rowIndex < this.#fallen.length; rowIndex++) {
      const minos = this.#fallen[rowIndex];
      for (let colIndex = 0; colIndex < minos.length; colIndex++) {
        const mino = minos[colIndex];
        if (mino === null) continue;
        this.#drawMino(ctx, mino.color, { row: rowIndex, col: colIndex });
      }
    }
    console.log('current: ', this.#current);
    return true;
  }*/
  render<GL extends IGameLogic>({ outputs, performance, alpha }: IRenderOptions<GL>): boolean {
    try {
      const driver = outputs[CANVAS_DEVICE_ID] as unknown as CanvasRenderingContext2DDriver<Tetris>;
      driver.clearAll();

      const ctx = driver.context;
      const fillStyle = ctx?.fillStyle ?? 'none';
      this.#drawCurrent(ctx);
      this.#drawBoard(ctx);
      ctx!.fillStyle = 'black';
      ctx?.fillText(`DELTA: ${performance.delta}`, 0, 10, 100);
      ctx?.fillText(`CURRENT: ${performance.current}`, 0, 20, 100);
      ctx?.fillText(`INTERVAL: ${performance.renderingInterval}`, 0, 30, 100);
      ctx?.fillText(`UPDATED: ${performance.updatedAt}`, 0, 40, 100);
      ctx?.fillText(`FPS: ${this.#fps}`, 0, 50, 100);
      ctx?.fillText(`ALPHA: ${alpha}`, 0, 60, 100);
      ctx!.fillStyle = fillStyle;
      // return this.#drawFallenMinos(ctx);
    } catch (error) {
      return false;
    }
    return true;
  }
  updateLogic() {
    if (!this.canDescend()) {
      merge(this.#current, this.#fallen);
      this.tryClear();
      const newTet = this.#next;
      this.#next = this.next();
      this.#current = newTet;
    } else {
      console.log('falling');
      descend(this.#current);
    }
    return true;
  }
  update({ inputs, performance, skip }: IUpdateOptions<never>): boolean {
    if (skip) return false;
    this.#lastTick += performance.delta;
    try {
      if (this.#lastTick >= this.#tickRate / 3)
        evaluateKeyStokes(this, inputs as Record<string, IGameReadable<never, AdvancedVPadData>>);
      if (this.#lastTick > this.#tickRate) {
        this.#lastTick = 0;
        return this.updateLogic();
      }
    } catch (error) {}
    return false;
  }
}
