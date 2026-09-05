import type { IMino, IMinoRow, ITetromino } from './tetris.types';

// -- Primitives ------------------------------------------------------------------
export function square(color: string, totalgridCols: number): ITetromino {
  console.log('SQ');
  const startCol = Math.floor(totalgridCols / 2) - 1;
  return {
    color,
    shape: [
      { row: -2, col: startCol },
      { row: -2, col: startCol + 1 },
      { row: -1, col: startCol + 1 },
      { row: -1, col: startCol },
    ],
  };
}
export function straight(color: string, totalgridCols: number) {
  console.log('-----');
  const startCol = Math.floor(totalgridCols / 2);
  return {
    color,
    shape: [
      { row: -4, col: startCol },
      { row: -3, col: startCol },
      { row: -2, col: startCol },
      { row: -1, col: startCol },
    ],
  };
}
export function t(color: string, totalgridCols: number) {
  console.log('T');
  const startCol = Math.floor(totalgridCols / 2) - 2;
  return {
    color,
    shape: [
      { row: -2, col: startCol },
      { row: -2, col: startCol + 1 },
      { row: -2, col: startCol + 2 },
      { row: -1, col: startCol + 1 },
    ],
  };
}
export function l(color: string, totalgridCols: number) {
  console.log('L');
  const startCol = Math.floor(totalgridCols / 2) - 1;
  return {
    color,
    shape: [
      { row: -3, col: startCol },
      { row: -2, col: startCol },
      { row: -1, col: startCol },
      { row: -1, col: startCol + 1 },
    ],
  };
}
export function skew(color: string, totalgridCols: number) {
  console.log('S');
  const startCol = Math.floor(totalgridCols / 2) - 2;
  return {
    color,
    shape: [
      { row: -2, col: startCol + 1 },
      { row: -2, col: startCol + 2 },
      { row: -1, col: startCol + 1 },
      { row: -1, col: startCol },
    ],
  };
}

// -- Secondary --------------------------------------------------
export function reverseSkew(color: string, totalgridCols: number) {
  console.log('Z');
  const startCol = Math.floor(totalgridCols / 2) - 2;
  return {
    color,
    shape: [
      { row: -2, col: startCol },
      { row: -2, col: startCol + 1 },
      { row: -1, col: startCol + 1 },
      { row: -1, col: startCol + 2 },
    ],
  };
}
export function reverseL(color: string, totalgridCols: number) {
  console.log('J');
  const startCol = Math.floor(totalgridCols / 2) - 1;
  return {
    color,
    shape: [
      { row: -3, col: startCol },
      { row: -3, col: startCol + 1 },
      { row: -2, col: startCol },
      { row: -1, col: startCol },
    ],
  };
}

// -- Helpers --------------------------------------------------
export function createTetromino(
  type: typeof square,
  color: string,
  totalgridCols: number,
): ITetromino {
  return type(color, totalgridCols);
}
export function rectToPath(
  { x = 0, y = 0, width = 0, height }: DOMRectInit,
  path: Path2D = new Path2D(),
) {
  height ??= width;
  path.rect(x, y, width, height);
  return path;
}
export function transformRect(
  { x = 0, y = 0, width = 0, height }: DOMRectInit,
  { a, b, c, d, e, f }: DOMMatrix2DInit,
): Required<DOMRectInit> {
  height ??= width;
  let p = new DOMPoint(x, y);
  const matrix = new DOMMatrix([a!, b!, c!, d!, e!, f!]);
  p = matrix.transformPoint(p);
  return {
    ...p,
    width,
    height,
  };
}
export function canClearRow(rowIndex: number, minos: IMinoRow[]): boolean {
  return minos[rowIndex]?.every((cell) => cell !== null) ?? false;
}
export function clearRow(rowIndex: number, minos: IMinoRow[]) {
  minos.splice(rowIndex, 1);
}
export function canDescend(t: ITetromino, fallenMinos: IMinoRow[], depth: number): boolean {
  // Start from the last row up
  for (let cellIndex = t.shape.length - 1; cellIndex >= 0; cellIndex--) {
    const mino = t.shape[cellIndex];
    if (mino.row >= depth - 1) return false;
    const row = fallenMinos[mino.row + 1];
    if (row === undefined) continue;
    const cell = row[mino.col];
    if (cell === null) continue;
    return false;
  }
  return true;
}
export function descend(t: ITetromino) {
  t.shape.forEach((m) => m.row++);
  return t;
}
function getRange(shape: IMino[]) {
  return shape.reduce(
    (p, c) => {
      if (c.col < p.min.col) p.min.col = c.col;
      if (c.col > p.max.col) p.max.col = c.col;
      if (c.row < p.min.row) p.min.row = c.row;
      if (c.row > p.max.row) p.max.row = c.row;
      return p;
    },
    {
      min: {
        row: Number.MAX_SAFE_INTEGER,
        col: Number.MAX_SAFE_INTEGER,
      },
      max: {
        row: Number.MIN_SAFE_INTEGER,
        col: Number.MIN_SAFE_INTEGER,
      },
    },
  );
}
export function canPanRight(t: ITetromino, maxCol: number): boolean {
  return getRange(t.shape).max.col < maxCol;
}
export function panRight(t: ITetromino) {
  t.shape.forEach((m) => m.col++);
}
export function canPanLeft(t: ITetromino): boolean {
  return getRange(t.shape).min.col > 0;
}
export function panLeft(t: ITetromino) {
  t.shape.forEach((m) => m.col--);
}
export function rotate(t: ITetromino) {
  const {
    min: { col: minCol, row: minRow },
  } = getRange(t.shape);
  // compute the tetromino dimension using the board space
  const { height } = dimension(t);
  t.shape = t.shape.map((m) => {
    const r = m.row - minRow;
    const c = m.col - minCol;

    return {
      row: c + minRow,
      col: height - 1 - r + minCol,
    };
  });

  return t;
}
export function dimension(t: ITetromino): Pick<Required<DOMRectInit>, 'width' | 'height'> {
  const {
    max: { col: maxCol, row: maxRow },
    min: { col: minCol, row: minRow },
  } = getRange(t.shape);
  return {
    width: maxCol - minCol - 1,
    height: maxRow - minRow - 1,
  };
  /*const { rows, cols } = t.shape.reduce(
    (p, c) => {
      p.rows[c.row] = (p.rows[c.row] ?? 0) + 1;
      p.cols[c.col] = (p.cols[c.col] ?? 0) + 1;
      return p;
    },
    { rows: {}, cols: {} } as { rows: Record<number, number>; cols: Record<number, number> },
  );
  return {
    width: Math.max(...Object.values(rows)),
    height: Math.max(...Object.values(cols)),
  };*/
}
export function merge(t: ITetromino, fallenMinos: IMinoRow[]) {
  t.shape.forEach((m) => {
    if (fallenMinos[m.row] === undefined) fallenMinos[m.row] = [];
    const grid = fallenMinos[m.row][m.col];
    if (grid === null) fallenMinos[m.row][m.col] = { color: t.color };
  });
}
export function minoToPath(mino: IMino, offset: Required<DOMPointInit>, size: number): Path2D {
  let [x, y] = [offset.x + mino.row * size, offset.y + mino.col * size];
  const path = new Path2D();
  path.rect(x, y, size, size);
  return path;
}
export function toPath(shape: IMino[], offset: Required<DOMPointInit>, size: number): Path2D {
  const path = new Path2D();
  for (let i = 0; i < shape.length; i++) {
    const cell = shape[i];
    path.addPath(minoToPath(cell, offset, size));
  }
  return path;
}
