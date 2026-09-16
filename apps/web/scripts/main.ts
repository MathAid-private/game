/**
 * @fileoverview
 * @summary The browser host — wires the engine, renderer, input, audio, and any game together.
 *
 * @description
 * This entry point is the composition root for the running application, and it is also the app's
 * control surface: every setting (game, fps, resolution, host, simulator, input name) is read
 * from the URL query string, so a refresh reconfigures the whole app without a code edit. It
 * builds the chosen `IHostLoop` and `ISimulationDriver`, binds a `Canvas2DRenderer` + sprite
 * registry, attaches a keyboard source under a named input, subscribes to the engine's `metrics`
 * event for a live HUD, and renders the game's read-only key map. Because every game implements
 * the same `IGame<IFrameBuilder>` contract and every host/driver the same loop/driver contracts,
 * swapping any of them changes the experience without touching the engine core.
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
  EventDrivenDriver,
  FixedTimestepDriver,
  ManualHostLoop,
  NodeHostLoop,
  ReplayHostLoop,
  SecondMetric,
  VariableTimestepDriver,
  getBrowserRefreshRate,
  type IGame,
  type IHostLoop,
  type ISimulationDriver,
  type PresentFrame,
} from '@games/loop';
import {
  Canvas2DRenderer,
  FrameBuilder,
  SpriteRegistry,
  type IFrameBuilder,
  type IRenderer,
} from '@games/render';

/** Which game to run. */
type GameId = 'tetris' | 'snake' | 'invaders';
/** Which loop host to drive the engine with. */
type HostId = 'browser' | 'manual' | 'node' | 'replay';
/** Which simulation stepping strategy to use. */
type SimulatorId = 'fixed' | 'variable' | 'event-driven';

/**
 * @summary The app's serialisable configuration, sourced from the URL query string.
 * @author MathAid
 */
interface AppSettings {
  readonly game: GameId;
  readonly fps: number;
  readonly fpsHistory: number;
  readonly width: number;
  readonly height: number;
  readonly host: HostId;
  readonly simulator: SimulatorId;
  readonly inputName: string;
}

/** Fallback settings when a query parameter is absent or invalid. */
const DEFAULT_SETTINGS: AppSettings = {
  game: 'tetris',
  fps: 60,
  fpsHistory: 60,
  width: 720,
  height: 1024,
  host: 'browser',
  simulator: 'fixed',
  inputName: 'keyboard',
};

/**
 * @summary Parse app settings from the URL query string, falling back to defaults.
 * @return The effective settings.
 * @author MathAid
 */
function readSettings(): AppSettings {
  const params = new URLSearchParams(window.location.search);
  const gameParam = params.get('game');
  const hostParam = params.get('host');
  const simParam = params.get('simulator');

  const game: GameId =
    gameParam === 'snake' || gameParam === 'invaders' || gameParam === 'tetris'
      ? gameParam
      : DEFAULT_SETTINGS.game;
  const host: HostId =
    hostParam === 'manual' || hostParam === 'node' || hostParam === 'replay'
      ? hostParam
      : DEFAULT_SETTINGS.host;
  const simulator: SimulatorId =
    simParam === 'variable' || simParam === 'event-driven' ? simParam : DEFAULT_SETTINGS.simulator;

  return {
    game,
    host,
    simulator,
    fps: Number.parseFloat(params.get('fps') ?? '') || DEFAULT_SETTINGS.fps,
    fpsHistory: Number.parseInt(params.get('fpsHistory') ?? '', 10) || DEFAULT_SETTINGS.fpsHistory,
    width: Number.parseInt(params.get('width') ?? '', 10) || DEFAULT_SETTINGS.width,
    height: Number.parseInt(params.get('height') ?? '', 10) || DEFAULT_SETTINGS.height,
    inputName: params.get('inputName') ?? DEFAULT_SETTINGS.inputName,
  };
}

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
  const seed = Math.floor(Math.random() * 2_000_000);
  switch (id) {
    case 'tetris':
      return {
        game: new Tetris(seed, 30),
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
        game: new Snake(seed, 8),
        bindings: {
          [SNAKE_ACTIONS.up]: ['ArrowUp', 'KeyW'],
          [SNAKE_ACTIONS.down]: ['ArrowDown', 'KeyS'],
          [SNAKE_ACTIONS.left]: ['ArrowLeft', 'KeyA'],
          [SNAKE_ACTIONS.right]: ['ArrowRight', 'KeyD'],
          [SNAKE_ACTIONS.pause]: ['Escape'],
        },
      };
    case 'invaders':
      return {
        game: new SpaceInvaders(seed),
        bindings: {
          [INVADERS_ACTIONS.left]: ['ArrowLeft', 'KeyA'],
          [INVADERS_ACTIONS.right]: ['ArrowRight', 'KeyD'],
          [INVADERS_ACTIONS.shoot]: ['Space'],
        },
      };
  }
}

/**
 * @summary Build the chosen loop host.
 * @param id - The host id from settings.
 * @return An `IHostLoop` the engine drives.
 * @author MathAid
 */
function buildHost(id: HostId): IHostLoop {
  switch (id) {
    case 'node':
      return new NodeHostLoop();
    case 'manual':
      return new ManualHostLoop();
    case 'replay': {
      // Two seconds of 60 Hz timestamps: a deterministic, self-terminating playback.
      const frame = SecondMetric.NANOSECONDS / 60;
      return new ReplayHostLoop(Array.from({ length: 120 }, (_, i) => (i + 1) * frame));
    }
    default:
      return new BrowserHostLoop();
  }
}

/**
 * @summary Build the chosen simulation driver.
 * @param id - The simulator id from settings.
 * @param game - The game to step.
 * @param fps - The fixed rate (used only by the fixed driver).
 * @param fpsHistory - Number of one-second metric windows to retain.
 * @param startNanos - The initial anchor timestamp.
 * @return An `ISimulationDriver` for the game.
 * @author MathAid
 */
function buildDriver(
  id: SimulatorId,
  game: IGame<IFrameBuilder>,
  fps: number,
  fpsHistory: number,
  startNanos: number,
): ISimulationDriver<IGame<IFrameBuilder>> {
  switch (id) {
    case 'variable':
      return new VariableTimestepDriver(game, startNanos, fpsHistory);
    case 'event-driven':
      return new EventDrivenDriver(game, startNanos, fpsHistory);
    default:
      return new FixedTimestepDriver(game, fps, startNanos, undefined, fpsHistory);
  }
}

const settings = readSettings();

const canvas = document.getElementById('game-2d') as HTMLCanvasElement;
const context = canvas.getContext('2d');
if (context === null) {
  throw new Error('Canvas 2D is not supported in this browser');
}

const renderer = new Canvas2DRenderer(context);
renderer.resize(settings.width, settings.height);
renderer.setSprites(new SpriteRegistry());

const { game, bindings } = loadGame(settings.game);
const host = buildHost(settings.host);
const simulation = buildDriver(
  settings.simulator,
  game,
  settings.fps,
  settings.fpsHistory,
  host.now(),
);

/**
 * The render glue: describe the frame into a builder, then hand it to the active renderer.
 * The game's `PresentSignal` is forwarded so the engine can throttle rendering.
 */
const present: PresentFrame<IGame<IFrameBuilder>, IRenderer> = ({
  game: current,
  alpha,
  renderer: active,
}) => {
  const frame = new FrameBuilder();
  const signal = current.present({ alpha, frame });
  active?.render(frame);
  return signal;
};

const engine = new Engine(
  game,
  { fps: settings.fps, fpsHistory: settings.fpsHistory },
  host,
  present,
  simulation,
);
engine.setRenderer(renderer);

const keyboard = new KeyboardSource(bindings);
void engine.attachInput(keyboard, settings.inputName);

// Live metrics HUD, driven by the engine's per-frame `metrics` event.
const hud = document.getElementById('hud') as HTMLPreElement;
engine.on('metrics', (m) => {
  hud.textContent =
    `fps      ${m.fps.toFixed(1)}\n` +
    `alpha    ${m.alpha.toFixed(3)}\n` +
    `dt       ${(m.dtNanos / 1e6).toFixed(2)} ms\n` +
    `pending  ${m.pendingSteps.toFixed(3)}\n` +
    `elapsed  ${(m.elapsedNanos / 1e9).toFixed(1)} s`;
});

// Read-only key map.
const keymap = document.getElementById('keymap') as HTMLPreElement;
keymap.textContent = Object.entries(bindings)
  .map(([action, codes]) => `${action}: ${codes.join(', ')}`)
  .join('\n');

void engine.run();

// The manual host has no self-driving scheduler: pump it on a timer.
if (settings.host === 'manual') {
  const manual = host as ManualHostLoop;
  const frame = SecondMetric.NANOSECONDS / settings.fps;
  window.setInterval(
    () => {
      manual.clock.advance(frame);
      manual.scheduler.tick(manual.clock.now());
    },
    Math.round(1000 / settings.fps),
  );
}

getBrowserRefreshRate(200).then((rate) => {
  const p = document.getElementById('refresh-rate') as HTMLParagraphElement;
  p.textContent = `${rate} HZ.`;
});

/**
 * @summary Build a custom-styled dropdown over the native game `<select>`.
 * @param onSelect - Called with the chosen game id.
 * @author MathAid
 */
function configureSelect(onSelect: (id: GameId) => void): void {
  const wrapper = document.querySelector('.custom-select-wrapper') as HTMLDivElement;
  const selectEl = wrapper.querySelector('select') as HTMLSelectElement;
  selectEl.value = settings.game;

  const selectedDiv = document.createElement('div');
  selectedDiv.className = 'select-selected';
  selectedDiv.innerHTML = selectEl.options[selectEl.selectedIndex].innerHTML;
  wrapper.appendChild(selectedDiv);

  const itemsDiv = document.createElement('div');
  itemsDiv.className = 'select-items select-hide';

  for (const option of Array.from(selectEl.options)) {
    if (option.value === '') continue;
    const item = document.createElement('div');
    item.innerHTML = option.innerHTML;
    item.addEventListener('click', () => {
      selectEl.selectedIndex = option.index;
      selectedDiv.innerHTML = option.innerHTML;
      itemsDiv.classList.add('select-hide');
      onSelect(option.value as GameId);
    });
    itemsDiv.appendChild(item);
  }
  wrapper.appendChild(itemsDiv);

  selectedDiv.addEventListener('click', () => {
    itemsDiv.classList.toggle('select-hide');
    selectedDiv.classList.toggle('select-arrow-active');
  });

  document.addEventListener('click', (event) => {
    if (!wrapper.contains(event.target as Node)) {
      itemsDiv.classList.add('select-hide');
      selectedDiv.classList.remove('select-arrow-active');
    }
  });
}

// Choosing a game rewrites the query string and reloads, so the whole composition is rebuilt.
configureSelect((id) => {
  const params = new URLSearchParams(window.location.search);
  params.set('game', id);
  window.location.search = params.toString();
});
