export interface ITetrisColourable {
  color: string;
}
export interface IMino {
  row: number;
  col: number;
}

export interface ITetromino extends ITetrisColourable {
  /** The tetris-board coordinates of the of the minos that makeup this tetromino */
  shape: IMino[];
}

export type IMinoRow = (null | ITetrisColourable)[];

export interface IMinos {
  rows: IMinoRow[];
}
export type ITetrisGrid = {
  rows: number;
  cols: number;
};
export type ITetrisParams = {
  /** 1x1 tile size */
  tileSize: number;
  /** The size of the tetris stage in tile measurement */
  grid: ITetrisGrid;

  canvas: HTMLCanvasElement;
};
