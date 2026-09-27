import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the built game works from any sub-path (itch.io, GitHub Pages).
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
  server: {
    host: true,
  },
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
