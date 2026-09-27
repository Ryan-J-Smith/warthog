import { defineConfig } from 'vitest/config';

/**
 * Headless playtests: autopilot bots fly whole missions and print tuning data.
 * Kept out of the normal `npm test` run because they are slow-ish and exploratory.
 * Run with: npx vitest run --config tests/playtest/vitest.config.ts
 */
export default defineConfig({
  test: {
    root: new URL('../..', import.meta.url).pathname,
    include: ['tests/playtest/**/*.playtest.ts'],
    environment: 'node',
    testTimeout: 600_000,
    hookTimeout: 600_000,
    // The playtests exist to print tables; show console output as it happens.
    disableConsoleIntercept: true,
  },
});
