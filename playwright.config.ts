import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;
const PORT = Number(process.env.PORT || 4280);

// Default to the local working tree so tests validate the commit under review.
// Set BASE_URL to smoke-test a deployed environment instead.
const baseURL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? 'html' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // Only spin up the local server when we are not pointed at a remote target.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `node scripts/static-server.mjs --port ${PORT}`,
        url: `http://127.0.0.1:${PORT}/`,
        reuseExistingServer: !isCI,
        timeout: 30_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
