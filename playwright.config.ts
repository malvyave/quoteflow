import { defineConfig, devices } from '@playwright/test';

import { applyTestEnvDefaults } from './src/__tests__/test-env';

// Browser tests for the client page and the Quote tab, against a running Twenty server.
// Locally they use the installed Google Chrome; CI installs Playwright's Chromium.
const isCi = Boolean(process.env.CI);

applyTestEnvDefaults();

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 180_000,
  expect: { timeout: 60_000 },
  fullyParallel: false,
  workers: 1,
  retries: isCi ? 1 : 0,
  reporter: isCi ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.TWENTY_API_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(isCi ? {} : { channel: 'chrome' }),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
