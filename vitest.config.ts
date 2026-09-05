/**
 * @fileoverview
 * @summary Vitest configuration — resolves workspace packages to their TypeScript source.
 *
 * @description
 * Maps each `@games/*` package to its `src/index.ts` so tests run against source (no build step)
 * and exercise each package's public surface. Tests live under `packages/** /test/` and run in a
 * Node environment.
 *
 * @author MathAid
 */

import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * @summary Resolve a workspace package to its source entry.
 * @param name - The package directory under `packages/`.
 * @return An absolute filesystem path to the package's `src/index.ts`.
 * @author MathAid
 */
function toSource(name: string): string {
  return fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));
}

export default defineConfig({
  resolve: {
    alias: {
      '@games/loop': toSource('loop'),
      '@games/math': toSource('math'),
      '@games/render': toSource('render'),
      '@games/input': toSource('input'),
      '@games/games': toSource('games'),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/**/test/**/*.test.ts'],
  },
});
