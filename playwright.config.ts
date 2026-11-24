import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173/contact/chat/',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile-390',
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: 'npm run build && VITE_CONTACT_CHAT_MOCK=1 npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/contact/chat/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});