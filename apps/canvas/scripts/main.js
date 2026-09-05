import { Tetris } from '@games/apps';

const CANVAS_ID = 'game-2d';

new Tetris({
  canvas: document.getElementById(CANVAS_ID),
  grid: {
    cols: 10,
    rows: 20,
  },
  tileSize: 7.3,
});
