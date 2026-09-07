/**
 * @fileoverview
 * @summary The browser host — wires the engine, a renderer, input, and any game together.
 *
 * @description
 * This entry point is the composition root for the running application: it creates a
 * `Canvas2DRenderer`, a `KeyboardSource`, one of the three games, and an `Engine` on a
 * `BrowserHostLoop`. Because every game implements the same `IGame<IFrameBuilder>` contract,
 * swapping `GAME` below changes the whole experience without touching the engine, the renderer,
 * or the loop — the decoupling the engine exists to demonstrate.
 *
 * @author MathAid
 */

import {
  INVADERS_ACTIONS,
  SNAKE_ACTIONS,
  Snake,
  SpaceInvaders,
  TETRIS_ACTIONS,
  Tetris,
} from '@games/games';
import { KeyboardSource } from '@games/input';
import {
  BrowserHostLoop,
  Engine,
  getBrowserRefreshRate,
  type IGame,
  type PresentFrame,
} from '@games/loop';
import { Canvas2DRenderer, FrameBuilder, type IFrameBuilder, type IRenderer } from '@games/render';

/** Logical canvas size, in device-independent pixels. */
const WIDTH = 720;
const HEIGHT = 1024;

/** Which game to run. */
type GameId = 'tetris' | 'snake' | 'invaders';

const GAMES = Object.freeze<GameId[]>([
  'tetris', 'snake', 'invaders'
])

/** The game currently booted. Change this to run a different game. */
let loaded = {
  selected: GAMES[0],
  set selectedGame(value: string) {
    const v = GAMES.find(g => g === value.toLowerCase())
    if (v !== undefined && v === null) loaded.selected = v
  },
  get selectedGame(): GameId {
    return this.selected
  }
  
};

/**
 * @summary The game instance and its key bindings, by id.
 *
 * @description
 * Each game exposes its own logical actions; the bindings map physical `KeyboardEvent.code`
 * values to those actions. Returning them together keeps the composition in one place.
 *
 * @param id - The game to construct.
 * @return The game and a bindings map keyed by logical action.
 * @author MathAid
 */
function loadGame(id: GameId): {
  game: IGame<IFrameBuilder>;
  bindings: Record<string, readonly string[]>;
} {
  switch (id) {
    case 'tetris':
      return {
        game: new Tetris(1, 30),
        bindings: {
          [TETRIS_ACTIONS.moveLeft]: ['ArrowLeft', 'KeyA'],
          [TETRIS_ACTIONS.moveRight]: ['ArrowRight', 'KeyD'],
          [TETRIS_ACTIONS.rotate]: ['ArrowUp', 'KeyW'],
          [TETRIS_ACTIONS.softDrop]: ['ArrowDown', 'KeyS'],
          [TETRIS_ACTIONS.hardDrop]: ['Space'],
          [TETRIS_ACTIONS.pause]: ['Escape'],
        },
      };
    case 'snake':
      return {
        game: new Snake(1, 8),
        bindings: {
          [SNAKE_ACTIONS.up]: ['ArrowUp', 'KeyW'],
          [SNAKE_ACTIONS.down]: ['ArrowDown', 'KeyS'],
          [SNAKE_ACTIONS.left]: ['ArrowLeft', 'KeyA'],
          [SNAKE_ACTIONS.right]: ['ArrowRight', 'KeyD'],
        },
      };
    case 'invaders':
      return {
        game: new SpaceInvaders(1),
        bindings: {
          [INVADERS_ACTIONS.left]: ['ArrowLeft', 'KeyA'],
          [INVADERS_ACTIONS.right]: ['ArrowRight', 'KeyD'],
          [INVADERS_ACTIONS.shoot]: ['Space'],
        },
      };
  }
}

const canvas = document.getElementById('game-2d') as HTMLCanvasElement;
const context = canvas.getContext('2d');
if (context === null) {
  throw new Error('Canvas 2D is not supported in this browser');
}

void bootstrap();

const renderer = new Canvas2DRenderer(context);
renderer.resize(WIDTH, HEIGHT);

const { game, bindings } = loadGame(loaded.selectedGame);
const keyboard = new KeyboardSource(bindings);

/**
 * The render glue: describe the frame into a builder, then hand it to the active renderer.
 */
const present: PresentFrame<IGame<IFrameBuilder>, IRenderer> = ({
  game: current,
  alpha,
  renderer: active,
}) => {
  const frame = new FrameBuilder();
  current.present({ alpha, frame });
  active?.render(frame);
};

const engine = new Engine(game, { fps: 60 }, new BrowserHostLoop(), present);
engine.setRenderer(renderer);
void engine.attachInput(keyboard, 'keyboard');
void engine.run();

function bootstrap() {
  // Setup framerate
  getBrowserRefreshRate(200).then((rate) => {
    const p = document.getElementById('refresh-rate') as HTMLParagraphElement;
    p.textContent = `${rate} HZ.`;
  });

  // const select = document.getElementById('game-select') as HTMLSelectElement;
  // select.onchange = (e) => (GAME = select.value as GameId);

  configureSelect(g => loaded.selectedGame = g);
}

function configureSelect(onSelect: (id: GameId) => void) {
  function constructDivOption(
    iteration: number,
    selectedDiv: HTMLDivElement,
    consumeIteration: (i: number) => void,
    optionEl: HTMLOptionElement,
  ) {
    function configureClick(this: HTMLDivElement) {
      // Update original select value
      consumeIteration(iteration);
      selectedDiv.innerHTML = this.innerHTML;

      // Highlight selected option
      const sameAsSelected = itemsDiv.getElementsByClassName('same-as-selected');
      for (let j = 0; j < sameAsSelected.length; j++) {
        sameAsSelected[j].removeAttribute('class');
      }
      this.setAttribute('class', 'same-as-selected');

      // Close dropdown
      selectedDiv.click();
    }

    const optionDiv = document.createElement('div');
    optionDiv.innerHTML = optionEl.innerHTML;

    optionDiv.addEventListener('click', configureClick);

    return optionDiv;
  }

  function populateDivOptions(selectEl: HTMLSelectElement, itemsDiv: HTMLDivElement) {
    function consume(iteration: number) {
      selectEl.selectedIndex = iteration;
      onSelect(selectEl.value as GameId);
    }
    for (let i = 0; i < selectEl.length; i++) {
      const option = selectEl.options[i];
      itemsDiv.appendChild(
        constructDivOption(
          i,
          selectedDiv,
          consume,
          option,
        ),
      );
    }
  }

  function constructItemsListDiv(selectEl: HTMLSelectElement) {
    const itemsDiv = document.createElement('div');
    itemsDiv.setAttribute('class', 'select-items select-hide');

    // Populate options from native <select>
    populateDivOptions(selectEl, itemsDiv);

    return itemsDiv;
  }

  function configureSelectDivToggle(selectedDiv: HTMLDivElement, itemsDiv: HTMLDivElement) {
    function onDivClick(this: HTMLDivElement, e: PointerEvent) {
      e.stopPropagation();
      closeAllSelect(this);
      itemsDiv.classList.toggle('select-hide');
      this.classList.toggle('select-arrow-active');
    }

    selectedDiv.addEventListener('click', onDivClick);
  }

  function constructSelectDiv(selectEl: HTMLSelectElement) {
    const selectedDiv = document.createElement('div');
    selectedDiv.setAttribute('class', 'select-selected');
    selectedDiv.innerHTML = selectEl.options[selectEl.selectedIndex].innerHTML;

    return selectedDiv;
  }

  const customWrapper = document.querySelector('.custom-select-wrapper') as HTMLDivElement;
  const selectEl = customWrapper.querySelector('select') as HTMLSelectElement;

  // Create the selected display box
  const selectedDiv = constructSelectDiv(selectEl);
  customWrapper.appendChild(selectedDiv);

  // Create options list container
  const itemsDiv = constructItemsListDiv(selectEl);

  customWrapper.appendChild(itemsDiv);

  // Toggle dropdown open/close
  configureSelectDivToggle(selectedDiv, itemsDiv);

  // Close options if clicked anywhere outside
  function closeAllSelect(element: HTMLElement | Event) {
    const arrNo = [];
    const items = document.getElementsByClassName('select-items');
    const selected = document.getElementsByClassName('select-selected');

    for (let i = 0; i < selected.length; i++) {
      if (element == selected[i]) {
        arrNo.push(i);
      } else {
        selected[i].classList.remove('select-arrow-active');
      }
    }
    for (let i = 0; i < items.length; i++) {
      if (arrNo.indexOf(i)) {
        items[i].classList.add('select-hide');
      }
    }
  }

  document.addEventListener('click', closeAllSelect);
}
