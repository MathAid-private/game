/**
 * @fileoverview
 * Vitest configuration for the monorepo test suite.
 *
 * @summary
 * Resolve workspace packages to their TypeScript source.
 *
 * @description
 * The config aliases each `@games/*` package to `packages/<name>/src/index.ts`.
 * Tests then run against source code. A build step is not necessary. Every
 * suite exercises the public surface of its target package.
 *
 * Tests live under `packages/<name>/test/` and run in a Node environment.
 *
 * @example
 * <caption>Import package source in a test</caption>
 * ```ts
 * import { startLoop } from '@games/loop';
 * // Resolves to packages/loop/src/index.ts during the test run.
 * ```
 *
 * @example
 * <caption>Run the full suite</caption>
 * ```bash
 * pnpm test
 * ```
 *
 * @example
 * <caption>Run one package's tests</caption>
 * ```bash
 * pnpm vitest run packages/math
 * ```
 *
 * @see {@link https://vitest.dev/config/ | Vitest configuration reference}
 * @author MathAid
 */

import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * @summary
 * Resolve a workspace package to its source entry.
 *
 * @description
 * The helper builds an absolute path to `packages/<name>/src/index.ts` from the
 * current config file. The Vitest alias map calls this helper. As a result,
 * test imports reach package source directly.
 *
 * @example
 * <caption>Resolve the loop package</caption>
 * ```ts
 * toSource('loop');
 * // => /abs/path/to/game/packages/loop/src/index.ts
 * ```
 *
 * @example
 * <caption>Register the alias map</caption>
 * ```ts
 * resolve: {
 *   alias: {
 *     '@games/loop': toSource('loop'),
 *   },
 * }
 * ```
 *
 * @param name - The short package folder name under `packages/`. Pass `loop`, not `@games/loop`. A missing folder makes Vitest fail on the first import.
 * @return An absolute path to `packages/<name>/src/index.ts`. The path resolves through `import.meta.url`, so it works from any working directory.
 * @see {@link fileURLToPath}
 * @see {@link https://nodejs.org/api/url.html | Node URL API}
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
