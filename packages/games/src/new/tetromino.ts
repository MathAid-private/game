/**
 * @fileoverview
 * @summary Tetromino geometry — the seven piece shapes, their colours, and rotation.
 *
 * @description
 * This module defines the seven tetrominoes as small cell lists in a local coordinate space,
 * their display colours, and a pure 90° clockwise rotation. It is renderer- and engine-agnostic:
 * the shapes are plain data, and rotation is a pure function, so the game logic and any test can
 * share them without depending on the loop or a renderer.
 *
 * @author MathAid
 */

import type { Color } from '@games/math';

/**
 * @summary A single filled cell of a tetromino, in local piece coordinates.
 *
 * @description
 * `Mino` is a cell offset relative to the piece's own origin — `col` is the horizontal offset and
 * `row` the vertical. Pieces are lists of these; the board position is applied later by the game.
 *
 * @author MathAid
 */
export interface Mino {
  /** Horizontal cell offset. */
  readonly col: number;
  /** Vertical cell offset. */
  readonly row: number;
}

/**
 * @summary The seven standard tetrominoes.
 *
 * @description
 * `PieceType` names the seven shapes (`I`, `O`, `T`, `S`, `Z`, `J`, `L`) using the conventional
 * single-letter names. `PIECE_TYPES` is the ordered list used to build a seven-bag.
 *
 * @author MathAid
 */
export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

/**
 * @summary The ordered seven pieces, used to seed the randomiser bag.
 * @author MathAid
 */
export const PIECE_TYPES: readonly PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

/**
 * @summary The cell layout of each piece in its local coordinate space.
 *
 * @description
 * Each piece is a list of `Mino`s laid out in a small grid whose origin is its top-left bounding
 * box. `rotate` operates on these offsets; the game translates them onto the board.
 *
 * @author MathAid
 */
export const SHAPES: Readonly<Record<PieceType, readonly Mino[]>> = {
  I: [
    { col: 0, row: 0 },
    { col: 1, row: 0 },
    { col: 2, row: 0 },
    { col: 3, row: 0 },
  ],
  O: [
    { col: 0, row: 0 },
    { col: 1, row: 0 },
    { col: 0, row: 1 },
    { col: 1, row: 1 },
  ],
  T: [
    { col: 1, row: 0 },
    { col: 0, row: 1 },
    { col: 1, row: 1 },
    { col: 2, row: 1 },
  ],
  S: [
    { col: 1, row: 0 },
    { col: 2, row: 0 },
    { col: 0, row: 1 },
    { col: 1, row: 1 },
  ],
  Z: [
    { col: 0, row: 0 },
    { col: 1, row: 0 },
    { col: 1, row: 1 },
    { col: 2, row: 1 },
  ],
  J: [
    { col: 0, row: 0 },
    { col: 0, row: 1 },
    { col: 1, row: 1 },
    { col: 2, row: 1 },
  ],
  L: [
    { col: 2, row: 0 },
    { col: 0, row: 1 },
    { col: 1, row: 1 },
    { col: 2, row: 1 },
  ],
};

/**
 * @summary The display colour of each piece.
 * @author MathAid
 */
export const COLORS: Readonly<Record<PieceType, Color>> = {
  I: { r: 0.2, g: 0.8, b: 1, a: 1 },
  O: { r: 1, g: 0.9, b: 0.2, a: 1 },
  T: { r: 0.65, g: 0.35, b: 0.9, a: 1 },
  S: { r: 0.3, g: 0.85, b: 0.4, a: 1 },
  Z: { r: 1, g: 0.3, b: 0.3, a: 1 },
  J: { r: 0.3, g: 0.45, b: 1, a: 1 },
  L: { r: 1, g: 0.6, b: 0.2, a: 1 },
};

/**
 * @summary Rotate a shape 90° clockwise in its bounding box.
 *
 * @description
 * `rotate` maps each cell `(col, row)` to `(size − 1 − row, col)` within the shape's square
 * bounding box (`size` is the larger of its width and height). It is a pure function returning a
 * new list; the input is never mutated. The `O` piece is symmetric and maps onto itself.
 *
 * @param shape - The cells to rotate.
 * @return The rotated cells, in a new array.
 *
 * @example
 * const vertical = rotate(SHAPES.I); // a 1×4 bar becomes a 4×1 bar
 *
 * @author MathAid
 */
export function rotate(shape: readonly Mino[]): Mino[] {
  const minCol = Math.min(...shape.map((m) => m.col));
  const maxCol = Math.max(...shape.map((m) => m.col));
  const minRow = Math.min(...shape.map((m) => m.row));
  const maxRow = Math.max(...shape.map((m) => m.row));
  const size = Math.max(maxCol - minCol, maxRow - minRow) + 1;

  return shape.map((m) => ({
    col: size - 1 - (m.row - minRow) + minCol,
    row: m.col - minCol + minRow,
  }));
}
