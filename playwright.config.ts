import { existsSync } from 'node:fs';
import { chromium, defineConfig } from '@playwright/test';

const browserCandidates = [
  process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH,
  chromium.executablePath(),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter((value): value is string => Boolean(value));

const executablePath = browserCandidates.find((candidate) => existsSync(candidate));

export default defineConfig({
  testDir: './e2e',
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    headless: true,
    launchOptions: executablePath ? { executablePath } : {},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
