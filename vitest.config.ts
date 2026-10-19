import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

import { applyTestEnvDefaults } from './src/__tests__/test-env';

// Sets process.env so globalSetup sees the values too (test.env only applies to workers).
const { apiUrl: TWENTY_API_URL, apiKey: TWENTY_API_KEY } = applyTestEnvDefaults();

export default defineConfig({
  plugins: [
    tsconfigPaths({
      projects: ['tsconfig.spec.json'],
      ignoreConfigErrors: true,
    }),
  ],
  test: {
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    // The dev server is slow on the first calls after a deploy; one retry on CI keeps that
    // from failing a run, while a real bug still fails twice.
    retry: process.env.CI ? 1 : 0,
    include: ['src/**/*.integration-test.ts'],
    globalSetup: ['src/__tests__/global-setup.ts'],
    env: {
      TWENTY_API_URL,
      TWENTY_API_KEY,
    },
  },
});
