import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8080,
    open: true,
  },
  // Tells Vite to force-optimize local monorepo packages
  // so changes trigger instantaneous hot-module reloading
  // optimizeDeps: {
  //   include: ['@games/loop'],
  // },
  optimizeDeps: {
    // ⚡ PREVENTS CACHING: Tells Vite not to pre-bundle these packages into .vite/deps
    exclude: ['@games/loop', '@games/render', '@games/input', '@games/games'],
  },
  watch: {
    // Forces Vite to track filesystem changes inside your symlinked packages
    ignored: ['!**/packages/**'],
  },
});
