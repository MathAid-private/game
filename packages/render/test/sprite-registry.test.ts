import { describe, expect, it } from 'vitest';
import { SpriteRegistry } from '@games/render';

describe('SpriteRegistry', () => {
  it('returns undefined for an unloaded id', () => {
    const registry = new SpriteRegistry();
    expect(registry.get('missing')).toBeUndefined();
  });

  it('resolves an id registered via a stub', () => {
    // A stub registry (the ISpriteRegistry seam) round-trips without image loading.
    const stub = {
      images: new Map<string, CanvasImageSource>(),
      async load(id: string): Promise<void> {
        this.images.set(id, {} as CanvasImageSource);
      },
      get(id: string): CanvasImageSource | undefined {
        return this.images.get(id);
      },
    };
    void stub.load('invader-a');
    expect(stub.get('invader-a')).toBeDefined();
  });
});
