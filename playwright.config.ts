import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: '.test-results/playwright',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: '.test-results/playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.KINGTURF_BASE_URL ?? 'http://127.0.0.1:14331',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
