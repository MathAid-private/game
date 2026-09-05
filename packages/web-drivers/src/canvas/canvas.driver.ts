import type { IGameLogic, IGamePluggable, IGameWritable } from '@games/loop';
import type { CanvasRenderingContext2DDriverWriteOptions } from './canvas.types';

export class CanvasDriver<GL extends IGameLogic>
  implements IGamePluggable<GL>, IGameWritable<GL, '2d' | 'bitmaprenderer' | 'webgl' | 'webgl2'>
{
  #canvas: HTMLCanvasElement | null = null;
  #name: string;

  constructor(selector: string) {
    this.#name = selector;
  }
  get canvas() {
    return this.#canvas;
  }
  write(
    context: '2d' | 'bitmaprenderer' | 'webgl' | 'webgl2',
  ):
    | CanvasRenderingContext2D
    | ImageBitmapRenderingContext
    | WebGLRenderingContext
    | WebGL2RenderingContext
    | RenderingContext
    | null {
    return this.#canvas?.getContext(context) || null;
  }
  clearAll(): void {
    const ctx = this.write('2d') as CanvasRenderingContext2D;
    ctx.clearRect(
      0,
      0,
      this.#canvas?.width ?? window.innerWidth,
      this.#canvas?.height ?? window.innerHeight,
    );
  }
  async connect(): Promise<boolean> {
    return await new Promise<boolean>((resolve) => {
      try {
        this.#canvas = document.querySelector(this.#name) as HTMLCanvasElement;
        resolve(true);
      } catch (error) {
        console.error('Error trying to connect canvas: ', error);
        resolve(false);
      }
    });
  }
  async disconnect(): Promise<boolean> {
    return await new Promise<boolean>((resolve) => {
      try {
        this.#canvas = null;
        resolve(true);
      } catch (error) {
        resolve(false);
      }
    });
  }
}

export class CanvasRenderingContext2DDriver<GL extends IGameLogic>
  implements IGamePluggable<GL>, IGameWritable<GL, CanvasRenderingContext2DDriverWriteOptions>
{
  #ctx: CanvasRenderingContext2D;
  constructor(ctx: CanvasRenderingContext2D) {
    this.#ctx = ctx;
  }
  get context() {
    return this.#ctx;
  }
  write(_options: CanvasRenderingContext2DDriverWriteOptions): null {
    return null;
  }
  clearAll(): void {
    const canvas = this.#ctx.canvas;
    this.#ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  async connect(): Promise<boolean> {
    return await Promise.resolve(true);
  }
  async disconnect(): Promise<boolean> {
    return await Promise.resolve(true);
  }
}
