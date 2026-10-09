import { defineConfig } from '@playwright/test';

const origin = new URL(process.env.KINGTURF_RUNTIME_WEB_ORIGIN ?? 'http://127.0.0.1:5173');
if (
  origin.protocol !== 'http:' ||
  !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) ||
  origin.username ||
  origin.password ||
  origin.pathname !== '/' ||
  origin.search ||
  origin.hash
)
  throw new Error('Runtime browser acceptance requires a loopback HTTP Web origin');

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'runtime-local.spec.mjs',
  outputDir: '.test-results/runtime',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: origin.origin,
    browserName: 'chromium',
    headless: true,
    // Real login material must never enter traces or screenshots.
    trace: 'off',
    screenshot: 'off',
  },
});
