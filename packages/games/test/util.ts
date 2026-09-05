import { FrameBuilder, type IFrameBuilder, type RenderCommand } from '@games/render';
import type { IGame, IInputState, ISimulationContext } from '@games/loop';

/** An input snapshot with every action released. */
export const noInput: IInputState = { isDown: () => false, wasPressed: () => false, wasReleased: () => false };

/** Present a game into a fresh frame builder and return its commands. */
export function present(game: IGame<IFrameBuilder>): RenderCommand[] {
  const builder = new FrameBuilder();
  game.present({ alpha: 0, frame: builder });
  return [...builder.commands];
}

/** Step a game with the given input snapshot. */
export function step(game: IGame<IFrameBuilder>, input: IInputState = noInput): void {
  game.step({ input } as unknown as ISimulationContext);
}

/** The x-coordinates of every rect command, in draw order. */
export function rectXs(commands: RenderCommand[]): number[] {
  return commands
    .filter((c) => c.kind === 'rect')
    .map((c) => (c as { rect: { x: number } }).rect.x);
}
